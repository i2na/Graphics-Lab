/**
 * pipelines.js
 * - WebGPU 관련된 파이프라인과 바인드그룹 등을 생성하는 함수 모음
 *   - createBindGroup: 파이프라인 레이아웃에 맞추어 Uniform / Texture 등을 연결
 *   - createBuffer: 간단한 Uniform Buffer 생성
 *   - createSampler, createDepthTexture: 샘플러와 깊이 텍스처 생성
 *   - createRenderPipeline: 기본적인 렌더 파이프라인 설정
 *   - createPartIDBuffer: 파트 식별을 위한 작은 버퍼 생성
 */

export function createBindGroup(
  device,
  pipeline,
  sceneBuffer,
  modelBuffer,
  normalMatrixBuffer,
  lightBuffer,
  colorTex,
  etcTex,
  normalTex,
  sampler,
  partIDBuf
) {
  // 주어진 파이프라인에 필요한 리소스(버퍼, 텍스처 등)을 묶어
  // 실제 렌더링 시점에 파이프라인과 연결해주는 BindGroup 생성
  return device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: sceneBuffer } },
      { binding: 1, resource: { buffer: modelBuffer } },
      { binding: 2, resource: { buffer: normalMatrixBuffer } },
      { binding: 3, resource: { buffer: lightBuffer } },
      { binding: 4, resource: colorTex.createView() },
      { binding: 5, resource: etcTex.createView() },
      { binding: 6, resource: normalTex.createView() },
      { binding: 7, resource: sampler },
      { binding: 8, resource: { buffer: partIDBuf } },
    ],
  });
}

/**
 * 64바이트 크기의 Uniform Buffer를 간단히 만들기 위한 함수
 * - 일반적인 모델 행렬, 노말 행렬, 라이트 정보 등
 */
export function createBuffer(device) {
  return device.createBuffer({
    size: 64,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
}

/**
 * 텍스처 필터링을 위한 샘플러를 생성
 * - Anisotropy를 최대로 하고, 선형 필터링 등을 사용
 */
export function createSampler(device) {
  return device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "linear",
    maxAnisotropy: 16,
  });
}

/**
 * 깊이 테스트용 텍스처를 생성
 * - 렌더 패스에서 depthStencilAttachment로 사용
 */
export function createDepthTexture(device, width, height, format) {
  return device.createTexture({
    size: [width, height],
    format: format,
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });
}

/**
 * 기본적인 렌더 파이프라인을 생성
 * - 바인딩 레이아웃: auto
 * - Vertex/Fragment 모듈, Depth 스텐실 설정 등
 * - 정점 속성(포지션, 노멀, UV, 탄젠트, 바이탄젠트)을 지정
 */
export function createRenderPipeline(
  device,
  vertexModule,
  fragmentModule,
  depthFormat,
  preferredFormat
) {
  return device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: vertexModule,
      entryPoint: "main",
      buffers: [
        // position
        {
          arrayStride: 4 * 3,
          attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }],
        },
        // normal
        {
          arrayStride: 4 * 3,
          attributes: [{ shaderLocation: 1, offset: 0, format: "float32x3" }],
        },
        // uv
        {
          arrayStride: 4 * 2,
          attributes: [{ shaderLocation: 2, offset: 0, format: "float32x2" }],
        },
        // tangent
        {
          arrayStride: 4 * 3,
          attributes: [{ shaderLocation: 3, offset: 0, format: "float32x3" }],
        },
        // bitangent
        {
          arrayStride: 4 * 3,
          attributes: [{ shaderLocation: 4, offset: 0, format: "float32x3" }],
        },
      ],
    },
    fragment: {
      module: fragmentModule,
      entryPoint: "main",
      targets: [{ format: preferredFormat }],
    },
    primitive: { topology: "triangle-list" },
    depthStencil: {
      format: depthFormat,
      depthWriteEnabled: true,
      depthCompare: "less",
    },
  });
}

/**
 * 파트(탱크 바디, 터렛, 바퀴 등)를 구분하기 위한 작은 4바이트 버퍼
 * - 각 파트에 고유 ID를 넣어 쉐이더에서 구분 가능하게 함
 */
export function createPartIDBuffer(device, id) {
  const buf = device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Uint32Array(buf.getMappedRange())[0] = id;
  buf.unmap();
  return buf;
}
