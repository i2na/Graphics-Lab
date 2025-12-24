/**
 * loader.js
 * - GLTF / OBJ 로더, 텍스처 로더 등 모델 및 이미지 로딩 관련 함수 모음
 * - 삼각형 메시 정보를 GPU 버퍼로 만들고, 노멀맵에 필요한 탄젠트/바이탄젠트도 계산
 */

import { computeTangents } from "./utils.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

/**
 * GLTF 파일에서 모든 메시를 가져와 GPU 버퍼를 생성
 * - positions, normals, uvs, tangents, bitangents, indices 등을 포함
 */
export async function loadAllMeshesFromGLTF(device, url) {
    const loader = new GLTFLoader();
    const gltf = await new Promise((resolve, reject) => {
        loader.load(
            url,
            (g) => resolve(g),
            undefined,
            (e) => reject(e)
        );
    });

    let meshes = [];
    gltf.scene.traverse((c) => {
        if (c.isMesh && c.geometry) meshes.push(c);
    });
    if (meshes.length === 0) throw Error("No meshes found in gltf");

    function createBufferFromArray(arr, usage) {
        const buf = device.createBuffer({
            size: arr.byteLength,
            usage: usage | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(buf, 0, arr);
        return buf;
    }

    let meshData = [];
    for (let obj of meshes) {
        const positions = obj.geometry.attributes.position.array;
        const normals = obj.geometry.attributes.normal.array;
        const uvs = obj.geometry.attributes.uv
            ? obj.geometry.attributes.uv.array
            : new Float32Array((positions.length / 3) * 2);

        let indices = obj.geometry.index.array;
        // 인덱스 버퍼가 32비트가 아닐 경우 변환
        if (!(indices instanceof Uint32Array)) {
            const tmp = new Uint32Array(indices.length);
            for (let i = 0; i < indices.length; i++) tmp[i] = indices[i];
            indices = tmp;
        }

        // 노멀맵을 위한 탄젠트/바이탄젠트 계산
        const { tangents, bitangents } = computeTangents(positions, normals, uvs, indices);

        // GPU 버퍼로 생성
        const posBuffer = createBufferFromArray(positions, GPUBufferUsage.VERTEX);
        const normalBuffer = createBufferFromArray(normals, GPUBufferUsage.VERTEX);
        const uvBuffer = createBufferFromArray(uvs, GPUBufferUsage.VERTEX);
        const tangentBuffer = createBufferFromArray(tangents, GPUBufferUsage.VERTEX);
        const bitangentBuffer = createBufferFromArray(bitangents, GPUBufferUsage.VERTEX);
        const indexBuffer = createBufferFromArray(indices, GPUBufferUsage.INDEX);

        meshData.push({
            posBuffer,
            normalBuffer,
            uvBuffer,
            tangentBuffer,
            bitangentBuffer,
            indexBuffer,
            indexCount: indices.length,
        });
    }
    return meshData;
}

/**
 * OBJ 파일에서 메시 정보를 추출해 GPU 버퍼를 생성
 * - GLTF와 유사하나, OBJ 형식에 맞춘 파싱과 버퍼 준비
 */
export async function loadOBJAsMeshes(device, url) {
    const loader = new OBJLoader();
    const obj = await new Promise((resolve, reject) => {
        loader.load(
            url,
            (obj) => resolve(obj),
            undefined,
            (e) => reject(e)
        );
    });

    let meshes = [];
    obj.traverse((c) => {
        if (c.isMesh && c.geometry) meshes.push(c);
    });
    if (meshes.length === 0) throw Error("No meshes found in obj");

    function createBufferFromArray(arr, usage) {
        const buf = device.createBuffer({
            size: arr.byteLength,
            usage: usage | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(buf, 0, arr);
        return buf;
    }

    let meshData = [];
    for (let m of meshes) {
        const geom = m.geometry;
        const positions = geom.attributes.position.array;
        const normals = geom.attributes.normal.array;
        let uvs;
        if (geom.attributes.uv) uvs = geom.attributes.uv.array;
        else uvs = new Float32Array((positions.length / 3) * 2);

        let indices;
        if (geom.index) {
            indices = geom.index.array;
        } else {
            // 인덱스가 없으면 순차적으로 생성
            let count = positions.length / 3;
            indices = new Uint32Array(count);
            for (let i = 0; i < count; i++) indices[i] = i;
        }

        // 노멀맵용 탄젠트/바이탄젠트 계산
        const { tangents, bitangents } = computeTangents(positions, normals, uvs, indices);

        // GPU 버퍼들 생성
        const posBuffer = createBufferFromArray(positions, GPUBufferUsage.VERTEX);
        const normalBuffer = createBufferFromArray(normals, GPUBufferUsage.VERTEX);
        const uvBuffer = createBufferFromArray(uvs, GPUBufferUsage.VERTEX);
        const tangentBuffer = createBufferFromArray(tangents, GPUBufferUsage.VERTEX);
        const bitangentBuffer = createBufferFromArray(bitangents, GPUBufferUsage.VERTEX);
        const indexBuffer = createBufferFromArray(indices, GPUBufferUsage.INDEX);

        meshData.push({
            posBuffer,
            normalBuffer,
            uvBuffer,
            tangentBuffer,
            bitangentBuffer,
            indexBuffer,
            indexCount: indices.length,
        });
    }
    return meshData;
}

/**
 * 이미지를 로드하여 WebGPU 텍스처로 생성
 * - 일반 텍스처, 노멀맵, 메탈/러프/AO 텍스처 등 공용
 */
export async function loadImageAsTexture(device, url) {
    const img = new Image();
    img.src = url;
    await img.decode();

    // HTML 이미지 -> ImageBitmap -> WebGPU 텍스처
    const bitmap = await createImageBitmap(img, {
        colorSpaceConversion: "none",
    });
    const texture = device.createTexture({
        label: url,
        format: "rgba8unorm",
        size: [bitmap.width, bitmap.height],
        usage:
            GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.COPY_DST |
            GPUTextureUsage.RENDER_ATTACHMENT,
    });
    device.queue.copyExternalImageToTexture({ source: bitmap }, { texture: texture }, [
        bitmap.width,
        bitmap.height,
    ]);
    return texture;
}
