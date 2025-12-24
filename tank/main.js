/**
 * 메인 엔트리 포인트 파일(main.js)
 * - WebGPU 초기화, 렌더 파이프라인 구성, 이벤트 등록 등을 한꺼번에 진행
 * - 전역 상태(tankState, shell들)와 주요 로직(renderFrame 등)도 포함
 */

import { mat4 } from "wgpu-matrix";
import { vertexShaderWGSL } from "./shaders/vertex.js";
import { fragmentShaderWGSL } from "./shaders/fragment.js";
import { gridVertexCode } from "./shaders/gridVertex.js";
import { localAxesVertexCode } from "./shaders/localAxesVertex.js";
import { localAxesFragmentCode } from "./shaders/localAxesFragment.js";
import { UI } from "./ui.js";
import {
    createBindGroup,
    createBuffer,
    createPartIDBuffer,
    createDepthTexture,
    createRenderPipeline,
} from "./pipelines.js";
import { computeBarrelPivot } from "./utils.js";
import { loadAllMeshesFromGLTF, loadOBJAsMeshes, loadImageAsTexture } from "./loader.js";

/**
 * 전체 프로그램 시작점: main()
 * - GPU 초기화 및 device/context 설정
 * - 셰이더 모듈 로드
 * - 리소스(메시, 텍스처, 버퍼) 로드 및 초기화
 * - 이벤트 핸들러 세팅
 * - 렌더 루프(renderFrame) 호출
 */
async function main() {
    // WebGPU 지원 확인
    if (!navigator.gpu) {
        throw new Error("WebGPU is not supported in this browser");
    }

    // 캔버스 & WebGPU 기본 설정
    const canvas = document.getElementById("webgpu-canvas");
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        throw new Error("No GPU adapter found");
    }
    const device = await adapter.requestDevice();
    const context = canvas.getContext("webgpu");
    const preferredFormat = navigator.gpu.getPreferredCanvasFormat();

    // 셰이더 모듈 준비
    const vertexModule = device.createShaderModule({
        code: vertexShaderWGSL,
    });
    const fragmentModule = device.createShaderModule({
        code: fragmentShaderWGSL,
    });
    const gridModule = device.createShaderModule({ code: gridVertexCode });
    const localAxesVertexModule = device.createShaderModule({
        code: localAxesVertexCode,
    });
    const localAxesFragmentModule = device.createShaderModule({
        code: localAxesFragmentCode,
    });

    // 캔버스 크기 및 WebGPU Context 구성
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    context.configure({
        device: device,
        format: preferredFormat,
        alphaMode: "opaque",
    });

    // 기본 UI 이벤트(마우스, 휠 등) 등록
    canvas.onmousedown = UI.onmousedown;
    canvas.onmouseup = UI.onmouseup;
    canvas.onmousemove = UI.onmousemove;
    window.addEventListener("wheel", UI.onwheel, { passive: false });

    UI.canvas = canvas;
    UI.update_VP();

    // 메시 및 텍스처 로드
    const meshData = await loadAllMeshesFromGLTF(device, "models/tank.glb");
    const shellData = await loadOBJAsMeshes(device, "models/shell.obj");
    const tankColor = await loadImageAsTexture(device, "textures/tank-color.jpeg");
    const tankEtc = await loadImageAsTexture(device, "textures/tank-etc.png");
    const tankNormal = await loadImageAsTexture(device, "textures/tank-normal.png");
    const shellColor = await loadImageAsTexture(device, "textures/shell-color.png");
    const shellEtc = await loadImageAsTexture(device, "textures/shell-etc.png");
    const shellNormal = await loadImageAsTexture(device, "textures/shell-normal.png");

    // GPUSampler 및 각종 버퍼 생성
    const sampler = device.createSampler({
        magFilter: "linear",
        minFilter: "linear",
        mipmapFilter: "linear",
        maxAnisotropy: 16,
    });

    const sceneBuffer = device.createBuffer({
        size: 64,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const modelBuffer = createBuffer(device);
    const modelBuffer_turret = createBuffer(device);
    const modelBuffer_barrel = createBuffer(device);
    const normalMatrixBuffer = createBuffer(device);
    const normalMatrixBuffer_turret = createBuffer(device);
    const normalMatrixBuffer_barrel = createBuffer(device);
    const lightBuffer = createBuffer(device);

    // Tank 파츠 구분 ID별 버퍼
    const partIDBuffer_Body = createPartIDBuffer(device, 0);
    const partIDBuffer_Turret = createPartIDBuffer(device, 1);
    const partIDBuffer_InnerWheel = createPartIDBuffer(device, 2);
    const partIDBuffer_OuterWheel = createPartIDBuffer(device, 3);
    const partIDBuffer_Barrel = createPartIDBuffer(device, 4);
    const partIDBuffer_Shell = createPartIDBuffer(device, 5);

    // 그리드 렌더 파이프라인
    const pipelineGrid = device.createRenderPipeline({
        layout: "auto",
        vertex: {
            module: gridModule,
            entryPoint: "main",
            buffers: [
                {
                    arrayStride: 24,
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: "float32x3" },
                        { shaderLocation: 1, offset: 12, format: "float32x3" },
                    ],
                },
            ],
        },
        fragment: {
            module: gridModule,
            entryPoint: "fs_main",
            targets: [{ format: preferredFormat }],
        },
        primitive: { topology: "line-list" },
        depthStencil: {
            format: "depth24plus",
            depthWriteEnabled: true,
            depthCompare: "less",
        },
    });

    // 로컬 축 표시용 렌더 파이프라인
    const localAxesPipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: {
            module: localAxesVertexModule,
            entryPoint: "main",
            buffers: [
                {
                    arrayStride: 24,
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: "float32x3" },
                        { shaderLocation: 1, offset: 12, format: "float32x3" },
                    ],
                },
            ],
        },
        fragment: {
            module: localAxesFragmentModule,
            entryPoint: "fs_main",
            targets: [{ format: preferredFormat }],
        },
        primitive: { topology: "line-list" },
        depthStencil: {
            format: "depth24plus",
            depthWriteEnabled: true,
            depthCompare: "less",
        },
    });

    // 본체, 포탄, 터렛, 배럴 등에 대한 렌더 파이프라인
    const pipeline = createRenderPipeline(
        device,
        vertexModule,
        fragmentModule,
        "depth24plus",
        preferredFormat
    );
    const pipelineShell = createRenderPipeline(
        device,
        vertexModule,
        fragmentModule,
        "depth24plus",
        preferredFormat
    );
    const pipelineTurret = createRenderPipeline(
        device,
        vertexModule,
        fragmentModule,
        "depth24plus",
        preferredFormat
    );
    const pipelineBarrel = createRenderPipeline(
        device,
        vertexModule,
        fragmentModule,
        "depth24plus",
        preferredFormat
    );

    // 각각의 파이프라인 + 파츠에 대한 BindGroup 생성
    const bindGroup_Body = createBindGroup(
        device,
        pipeline,
        sceneBuffer,
        modelBuffer,
        normalMatrixBuffer,
        lightBuffer,
        tankColor,
        tankEtc,
        tankNormal,
        sampler,
        partIDBuffer_Body
    );
    const bindGroup_Turret = createBindGroup(
        device,
        pipelineTurret,
        sceneBuffer,
        modelBuffer_turret,
        normalMatrixBuffer_turret,
        lightBuffer,
        tankColor,
        tankEtc,
        tankNormal,
        sampler,
        partIDBuffer_Turret
    );
    const bindGroup_InnerWheel = createBindGroup(
        device,
        pipeline,
        sceneBuffer,
        modelBuffer,
        normalMatrixBuffer,
        lightBuffer,
        tankColor,
        tankEtc,
        tankNormal,
        sampler,
        partIDBuffer_InnerWheel
    );
    const bindGroup_OuterWheel = createBindGroup(
        device,
        pipeline,
        sceneBuffer,
        modelBuffer,
        normalMatrixBuffer,
        lightBuffer,
        tankColor,
        tankEtc,
        tankNormal,
        sampler,
        partIDBuffer_OuterWheel
    );
    const bindGroup_Barrel = createBindGroup(
        device,
        pipelineBarrel,
        sceneBuffer,
        modelBuffer_barrel,
        normalMatrixBuffer_barrel,
        lightBuffer,
        tankColor,
        tankEtc,
        tankNormal,
        sampler,
        partIDBuffer_Barrel
    );

    // 그리드 및 로컬축용 버퍼 생성
    const { buffer: gridBuffer, vertexCount: gridVertexCount } = (function createGridAndAxesBuffers(
        device
    ) {
        const lines = [];
        lines.push(...[0, 0, 0, 1, 0, 0]);
        lines.push(...[1, 0, 0, 1, 0, 0]);
        lines.push(...[0, 0, 0, 0, 1, 0]);
        lines.push(...[0, 1, 0, 0, 1, 0]);
        lines.push(...[0, 0, 0, 0, 0, 1]);
        lines.push(...[0, 0, 1, 0, 0, 1]);
        for (let i = -5; i <= 5; i++) {
            lines.push(...[-5, 0, i, 1.0, 1.0, 1.0]);
            lines.push(...[5, 0, i, 1.0, 1.0, 1.0]);
            lines.push(...[i, 0, -5, 1.0, 1.0, 1.0]);
            lines.push(...[i, 0, 5, 1.0, 1.0, 1.0]);
        }
        const data = new Float32Array(lines);
        const buf = device.createBuffer({
            size: data.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(buf, 0, data);
        return { buffer: buf, vertexCount: data.length / 6 };
    })(device);

    const bindGroup_Grid = device.createBindGroup({
        layout: pipelineGrid.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: sceneBuffer } }],
    });

    const { buffer: localAxesBuffer, vertexCount: localAxesVertexCount } =
        (function createLocalAxesBuffer(device) {
            const axesLines = [];
            axesLines.push(...[0, 0, 0, 1, 0, 0]);
            axesLines.push(...[0.5, 0, 0, 1, 0, 0]);
            axesLines.push(...[0, 0, 0, 0, 1, 0]);
            axesLines.push(...[0, 0.5, 0, 0, 1, 0]);
            axesLines.push(...[0, 0, 0, 0, 0, 1]);
            axesLines.push(...[0, 0, 0.5, 0, 0, 1]);
            const data = new Float32Array(axesLines);
            const buf = device.createBuffer({
                size: data.byteLength,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            });
            device.queue.writeBuffer(buf, 0, data);
            return { buffer: buf, vertexCount: axesLines.length / 6 };
        })(device);

    const bindGroup_localAxes = device.createBindGroup({
        layout: localAxesPipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: sceneBuffer } },
            { binding: 1, resource: { buffer: modelBuffer } },
        ],
    });

    // 탱크 위치/회전/배럴 상태 관리
    const tankState = {
        position: [0, 0, 0],
        rotation: 0,
        turretRotation: 0,
        barrelElevation: 0,
    };

    // 터렛과 배럴의 피벗값 및 포탄 일시정지 여부
    let turretPivot = [0.45, 0.299, 0];
    let barrelPivot = [0.65, 0.87, 0];
    let joinPivot = [0.2, 0, 0];
    let shellPaused = false;

    // 포탄(shell) 관리 배열과 포탄 생성 함수
    const shells = [];
    function spawnShell(initialPos, initialVel) {
        let shell = {
            pos: [...initialPos],
            vel: [...initialVel],
            alive: true,

            modelBuffer: device.createBuffer({
                size: 64,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            }),
            normalMatrixBuffer: device.createBuffer({
                size: 64,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            }),
        };

        shell.bindGroup = device.createBindGroup({
            layout: pipelineShell.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: sceneBuffer } },
                { binding: 1, resource: { buffer: shell.modelBuffer } },
                { binding: 2, resource: { buffer: shell.normalMatrixBuffer } },
                { binding: 3, resource: { buffer: lightBuffer } },
                { binding: 4, resource: shellColor.createView() },
                { binding: 5, resource: shellEtc.createView() },
                { binding: 6, resource: shellNormal.createView() },
                { binding: 7, resource: sampler },
                { binding: 8, resource: { buffer: partIDBuffer_Shell } },
            ],
        });

        shells.push(shell);
    }

    /**
     * 포탄 업데이트 로직
     * - shellPaused가 true면 이동/중력 적용 정지
     * - ground(바닥)에 닿으면 alive=false
     */
    function updateAllShells() {
        let dt = 1 / 60;
        for (let shell of shells) {
            if (!shell.alive) continue;
            if (shellPaused) {
                continue;
            }
            shell.vel[1] -= 9.8 * 0.06 * dt;
            shell.pos[0] += shell.vel[0] * dt;
            shell.pos[1] += shell.vel[1] * dt;
            shell.pos[2] += shell.vel[2] * dt;
            if (shell.pos[1] < 0) {
                shell.pos[1] = 0;
                shell.alive = false;
            }
        }
    }

    /**
     * 특정 메쉬를 그리는 함수(drawPart)
     * - 파트별 model/normal 행렬 업데이트
     * - 파이프라인 + bindGroup 세팅 후 draw
     */
    function drawPart(renderPass, M, bindGroup, modelBuffer, normalMatrixBuffer, pipeline, mesh) {
        let invM = mat4.invert(M);
        let normalMat = mat4.transpose(invM);
        device.queue.writeBuffer(modelBuffer, 0, M);
        device.queue.writeBuffer(normalMatrixBuffer, 0, normalMat);

        renderPass.setPipeline(pipeline);
        renderPass.setBindGroup(0, bindGroup);
        renderPass.setVertexBuffer(0, mesh.posBuffer);
        renderPass.setVertexBuffer(1, mesh.normalBuffer);
        renderPass.setVertexBuffer(2, mesh.uvBuffer);
        renderPass.setVertexBuffer(3, mesh.tangentBuffer);
        renderPass.setVertexBuffer(4, mesh.bitangentBuffer);
        renderPass.setIndexBuffer(mesh.indexBuffer, "uint32");
        renderPass.drawIndexed(mesh.indexCount, 1, 0, 0, 0);
    }

    /**
     * 실제 렌더 루프(renderFrame)
     * - shell 업데이트
     * - 탱크 행렬 계산
     * - 각 파트/포탄 draw
     * - 다음 프레임 콜백
     */
    function renderFrame() {
        updateAllShells();

        // 탱크 본체(Body) 매트릭스
        let M_body = mat4.identity();
        M_body = mat4.translate(M_body, [tankState.position[0], 0.46, tankState.position[2]]);
        M_body = mat4.rotate(M_body, [0, 1, 0], tankState.rotation);

        // 터렛 매트릭스
        let M_turret = mat4.clone(M_body);
        M_turret = mat4.translate(M_turret, [-turretPivot[0], -turretPivot[1], -turretPivot[2]]);
        M_turret = mat4.rotate(M_turret, [0, 1, 0], tankState.turretRotation);
        M_turret = mat4.translate(M_turret, [turretPivot[0], turretPivot[1], turretPivot[2]]);

        // 배럴 매트릭스
        let M_barrel = mat4.clone(M_turret);
        M_barrel = mat4.translate(M_barrel, [-joinPivot[0], -joinPivot[1], -joinPivot[2]]);
        M_barrel = mat4.rotate(M_barrel, [0, 0, 1], tankState.barrelElevation);
        M_barrel = mat4.translate(M_barrel, joinPivot);

        // 휠(바퀴)들은 임시로 본체 행렬 그대로 사용(애니메이션X)
        let M_innerWheel = M_body;
        let M_outerWheel = M_body;

        // 라이트 정보
        const lightDir = new Float32Array([-1, 5, 5]);
        device.queue.writeBuffer(lightBuffer, 0, lightDir);

        // Scene(투영행렬) 버퍼 업데이트
        device.queue.writeBuffer(sceneBuffer, 0, UI.matrices.VP);

        // 렌더 패스 시작
        const depthTexture = createDepthTexture(device, canvas.width, canvas.height, "depth24plus");
        const commandEncoder = device.createCommandEncoder();
        const textureView = context.getCurrentTexture().createView();

        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    view: textureView,
                    loadOp: "clear",
                    clearValue: { r: 0.3, g: 0.3, b: 0.3, a: 1 },
                    storeOp: "store",
                },
            ],
            depthStencilAttachment: {
                view: depthTexture.createView(),
                depthLoadOp: "clear",
                depthClearValue: 1.0,
                depthStoreOp: "store",
            },
        });

        // 그리드 먼저 렌더
        renderPass.setPipeline(pipelineGrid);
        renderPass.setBindGroup(0, bindGroup_Grid);
        renderPass.setVertexBuffer(0, gridBuffer);
        renderPass.draw(gridVertexCount, 1, 0, 0);

        // 탱크 각 파츠 렌더
        drawPart(
            renderPass,
            M_body,
            bindGroup_Body,
            modelBuffer,
            normalMatrixBuffer,
            pipeline,
            meshData[0]
        );
        drawPart(
            renderPass,
            M_turret,
            bindGroup_Turret,
            modelBuffer_turret,
            normalMatrixBuffer_turret,
            pipelineTurret,
            meshData[1]
        );
        drawPart(
            renderPass,
            M_innerWheel,
            bindGroup_InnerWheel,
            modelBuffer,
            normalMatrixBuffer,
            pipeline,
            meshData[2]
        );
        drawPart(
            renderPass,
            M_outerWheel,
            bindGroup_OuterWheel,
            modelBuffer,
            normalMatrixBuffer,
            pipeline,
            meshData[3]
        );
        drawPart(
            renderPass,
            M_barrel,
            bindGroup_Barrel,
            modelBuffer_barrel,
            normalMatrixBuffer_barrel,
            pipelineBarrel,
            meshData[4]
        );

        // 포탄들 렌더
        for (let shell of shells) {
            if (!shell.alive) continue;

            let M_shell_t = mat4.identity();
            M_shell_t = mat4.translate(M_shell_t, shell.pos);

            let [vx, vy, vz] = shell.vel;
            let speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
            if (speed > 1e-6) {
                vx /= speed;
                vy /= speed;
                vz /= speed;
            }

            let yaw = Math.atan2(-vz, vx);
            let pitch = Math.atan2(vy, Math.sqrt(vx * vx + vz * vz));

            M_shell_t = mat4.rotate(M_shell_t, [0, 1, 0], yaw);
            M_shell_t = mat4.rotate(M_shell_t, [0, 0, 1], pitch);
            M_shell_t = mat4.scale(M_shell_t, [1.1, 1.1, 1.1]);

            drawPart(
                renderPass,
                M_shell_t,
                shell.bindGroup,
                shell.modelBuffer,
                shell.normalMatrixBuffer,
                pipelineShell,
                shellData[0]
            );
        }

        // 로컬 축 표시
        device.queue.writeBuffer(modelBuffer, 0, M_body);
        renderPass.setPipeline(localAxesPipeline);
        renderPass.setBindGroup(0, bindGroup_localAxes);
        renderPass.setVertexBuffer(0, localAxesBuffer);
        renderPass.draw(localAxesVertexCount, 1, 0, 0);

        // 렌더 패스 종료 및 제출
        renderPass.end();
        device.queue.submit([commandEncoder.finish()]);
        requestAnimationFrame(renderFrame);
    }

    // 로딩 완료 - 로딩 화면 숨김
    const loadingElement = document.getElementById("loading");
    if (loadingElement) {
        loadingElement.classList.add("hidden");
    }

    // 초기 렌더 시작
    requestAnimationFrame(renderFrame);

    // 리사이즈 처리
    window.addEventListener("resize", () => {
        canvas.width = canvas.clientWidth * devicePixelRatio;
        canvas.height = canvas.clientHeight * devicePixelRatio;
        context.configure({ device, format: preferredFormat });
    });

    /**
     * 키보드 이벤트(탱크 조작, 배럴, 포탄 일시정지 토글 등)
     * - 영문/한글 키 매핑도 일부 반영
     */
    window.addEventListener("keydown", (e) => {
        let forwardX = Math.cos(tankState.rotation);
        let forwardZ = Math.sin(tankState.rotation);
        const key = e.key.toLowerCase();

        switch (key) {
            case "arrowup":
                tankState.position[0] += forwardX * 0.1;
                tankState.position[2] -= forwardZ * 0.1;
                break;
            case "arrowdown":
                tankState.position[0] -= forwardX * 0.1;
                tankState.position[2] += forwardZ * 0.1;
                break;
            case "arrowleft":
                tankState.rotation += 0.05;
                break;
            case "arrowright":
                tankState.rotation -= 0.05;
                break;

            case "a":
            case "ㅁ":
                tankState.turretRotation += 0.05;
                break;
            case "d":
            case "ㅇ":
                tankState.turretRotation -= 0.05;
                break;

            case "w":
            case "ㅈ":
                if (tankState.barrelElevation < 0.1) tankState.barrelElevation += 0.05;
                break;
            case "s":
            case "ㄴ":
                if (tankState.barrelElevation > -0.1) tankState.barrelElevation -= 0.05;
                break;

            // 스페이스: 포탄 발사
            case " ":
                const barrel_pivot = computeBarrelPivot(
                    tankState,
                    turretPivot,
                    barrelPivot,
                    joinPivot
                );
                let forward_X = Math.cos(tankState.rotation + tankState.turretRotation);
                let forward_Z = Math.sin(tankState.rotation + tankState.turretRotation);
                let speed = 1.3;
                let dx = forward_X * speed;
                let dy = 0.12;
                let dz = -forward_Z * speed;
                let initialVel = [dx, dy, dz];

                spawnShell([barrel_pivot[0], barrel_pivot[1], barrel_pivot[2]], initialVel);
                break;

            // P: 포탄 일시정지/재개
            case "p":
                shellPaused = !shellPaused;
                console.log("shellPaused =", shellPaused);
                break;
        }
    });
}

// 실제로 main() 호출
main().catch((error) => {
    console.error("Failed to initialize:", error);
    const loadingElement = document.getElementById("loading");
    const loadingText = document.getElementById("loading-text");
    if (loadingElement && loadingText) {
        loadingText.textContent = "Failed to load. Your browser may not support WebGPU.";
        loadingText.style.color = "#ff5555";
    }
});
