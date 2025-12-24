/**
 * utils.js
 * - 공용 유틸 함수 모음
 * - 프로젝트, 언프로젝트, 탄젠트/바이탄젠트 계산, 배럴 피벗 등
 */

import { vec4, mat4 } from "wgpu-matrix";

/**
 * 주어진 3D 좌표 p_obj를 MVP 행렬과 뷰포트를 통해 스크린 좌표로 매핑
 * - p_obj: [x, y, z, 1]
 * - MVP: 4x4 행렬
 * - viewport: [x, y, width, height]
 */
export function project(p_obj, MVP, viewport) {
    let tmp = vec4.transformMat4(p_obj, MVP);
    tmp = tmp.map((x) => x / tmp[3]); // 정규화
    for (let i = 0; i < 2; i++) tmp[i] = (0.5 * tmp[i] + 0.5) * viewport[i + 2] + viewport[i];
    return tmp;
}

/**
 * 스크린 좌표 p_win을 MVP의 역행렬을 통해 3D 오브젝트 좌표로 변환
 * - p_win: [x, y, z, 1]
 * - MVP: 4x4 행렬
 * - viewport: [x, y, width, height]
 */
export function unproject(p_win, MVP, viewport) {
    let MVP_inv = mat4.invert(MVP);
    let tmp = mat4.clone(p_win);
    for (let i = 0; i < 2; i++) tmp[i] = (2.0 * (tmp[i] - viewport[i])) / viewport[i + 2] - 1.0;
    let p_obj = vec4.transformMat4(tmp, MVP_inv);
    p_obj = p_obj.map((x) => x / p_obj[3]);
    return p_obj;
}

/**
 * 2D 마우스 드래그(스크린 이동량)를 3D 벡터로 변환하기 위한 유틸
 * - vec_win: [dx, dy, dz]
 * - MVP: 4x4 행렬
 * - viewport: [x, y, width, height]
 */
export function unproject_vector(vec_win, MVP, viewport) {
    let org_win = project([0, 0, 0, 1], MVP, viewport);
    let vec = unproject(
        [org_win[0] + vec_win[0], org_win[1] + vec_win[1], org_win[2] + vec_win[2], 1],
        MVP,
        viewport
    );
    return vec;
}

/**
 * 메시(positions/normals/uvs/indices)에 대해 탄젠트와 바이탄젠트를 계산
 * - PBR 또는 노멀맵 적용 시 사용
 */
export function computeTangents(positions, normals, uvs, indices) {
    const vertexCount = positions.length / 3;
    const tangents = new Float32Array(vertexCount * 3);
    const bitangents = new Float32Array(vertexCount * 3);

    // 삼각형(인덱스) 단위로 탄젠트, 바이탄젠트 누적
    for (let i = 0; i < indices.length; i += 3) {
        const i0 = indices[i],
            i1 = indices[i + 1],
            i2 = indices[i + 2];
        const x0 = positions[i0 * 3],
            y0 = positions[i0 * 3 + 1],
            z0 = positions[i0 * 3 + 2];
        const x1 = positions[i1 * 3],
            y1 = positions[i1 * 3 + 1],
            z1 = positions[i1 * 3 + 2];
        const x2 = positions[i2 * 3],
            y2 = positions[i2 * 3 + 1],
            z2 = positions[i2 * 3 + 2];

        const u0 = uvs[i0 * 2],
            v0 = uvs[i0 * 2 + 1];
        const u1 = uvs[i1 * 2],
            v1 = uvs[i1 * 2 + 1];
        const u2 = uvs[i2 * 2],
            v2 = uvs[i2 * 2 + 1];

        const E1x = x1 - x0,
            E1y = y1 - y0,
            E1z = z1 - z0;
        const E2x = x2 - x0,
            E2y = y2 - y0,
            E2z = z2 - z0;
        const dU1 = u1 - u0,
            dV1 = v1 - v0;
        const dU2 = u2 - u0,
            dV2 = v2 - v0;

        let denom = dU1 * dV2 - dU2 * dV1;
        if (denom === 0.0) continue;
        const r = 1.0 / denom;
        const Tx = (E1x * dV2 - E2x * dV1) * r;
        const Ty = (E1y * dV2 - E2y * dV1) * r;
        const Tz = (E1z * dV2 - E2z * dV1) * r;
        const Bx = (E2x * dU1 - E1x * dU2) * r;
        const By = (E2y * dU1 - E1y * dU2) * r;
        const Bz = (E2z * dU1 - E1z * dU2) * r;

        tangents[i0 * 3] += Tx;
        tangents[i0 * 3 + 1] += Ty;
        tangents[i0 * 3 + 2] += Tz;
        tangents[i1 * 3] += Tx;
        tangents[i1 * 3 + 1] += Ty;
        tangents[i1 * 3 + 2] += Tz;
        tangents[i2 * 3] += Tx;
        tangents[i2 * 3 + 1] += Ty;
        tangents[i2 * 3 + 2] += Tz;

        bitangents[i0 * 3] += Bx;
        bitangents[i0 * 3 + 1] += By;
        bitangents[i0 * 3 + 2] += Bz;
        bitangents[i1 * 3] += Bx;
        bitangents[i1 * 3 + 1] += By;
        bitangents[i1 * 3 + 2] += Bz;
        bitangents[i2 * 3] += Bx;
        bitangents[i2 * 3 + 1] += By;
        bitangents[i2 * 3 + 2] += Bz;
    }

    // 누적된 탄젠트/바이탄젠트를 정규화 및 정오르소화
    for (let i = 0; i < vertexCount; i++) {
        const nx = normals[i * 3],
            ny = normals[i * 3 + 1],
            nz = normals[i * 3 + 2];
        let tx = tangents[i * 3],
            ty = tangents[i * 3 + 1],
            tz = tangents[i * 3 + 2];
        const NdotT = nx * tx + ny * ty + nz * tz;
        tx = tx - NdotT * nx;
        ty = ty - NdotT * ny;
        tz = tz - NdotT * nz;
        let tlen = Math.sqrt(tx * tx + ty * ty + tz * tz);
        if (tlen > 0.0) {
            tx /= tlen;
            ty /= tlen;
            tz /= tlen;
        }
        tangents[i * 3] = tx;
        tangents[i * 3 + 1] = ty;
        tangents[i * 3 + 2] = tz;

        let bx = bitangents[i * 3],
            by = bitangents[i * 3 + 1],
            bz = bitangents[i * 3 + 2];
        const NdotB = nx * bx + ny * by + nz * bz;
        bx = bx - NdotB * nx;
        by = by - NdotB * ny;
        bz = bz - NdotB * nz;
        let blen = Math.sqrt(bx * bx + by * by + bz * bz);
        if (blen > 0.0) {
            bx /= blen;
            by /= blen;
            bz /= blen;
        }
        bitangents[i * 3] = bx;
        bitangents[i * 3 + 1] = by;
        bitangents[i * 3 + 2] = bz;
    }

    return { tangents, bitangents };
}

/**
 * 배럴 끝 포인트(로컬)를 월드좌표로 변환하는 함수
 * - 탱크 바디, 터렛, 조인트(회전축) 매트릭스를 순차적으로 조립
 */
export function computeBarrelPivot(tankState, turretPivot, barrelPivot, joinPivot) {
    // 탱크 바디 행렬
    let M_body = mat4.identity();
    M_body = mat4.translate(M_body, [tankState.position[0], 0.46, tankState.position[2]]);
    M_body = mat4.rotateY(M_body, tankState.rotation);

    // 터렛 행렬
    let M_turret = mat4.clone(M_body);
    M_turret = mat4.translate(M_turret, [-turretPivot[0], -turretPivot[1], -turretPivot[2]]);
    M_turret = mat4.rotateY(M_turret, tankState.turretRotation);
    M_turret = mat4.translate(M_turret, turretPivot);

    // 배럴 행렬 (위아래 회전까지 반영)
    let M_barrel = mat4.clone(M_turret);
    M_barrel = mat4.translate(M_barrel, [-joinPivot[0], -joinPivot[1], -joinPivot[2]]);
    M_barrel = mat4.rotate(M_barrel, [0, 0, 1], tankState.barrelElevation);
    M_barrel = mat4.translate(M_barrel, joinPivot);

    // 로컬 상에서 배럴 끝 지점 (barrelPivot 기준) -> 월드
    let localEnd = [barrelPivot[0], barrelPivot[1] - 0.46, barrelPivot[2], 1];
    let worldEnd = vec4.transformMat4(localEnd, M_barrel);

    return [worldEnd[0], worldEnd[1], worldEnd[2]];
}
