export const vertexShaderWGSL = `
@group(0) @binding(0) var<uniform> sceneUniform: mat4x4<f32>;
@group(0) @binding(1) var<uniform> modelMatrix: mat4x4<f32>;
@group(0) @binding(2) var<uniform> normalMatrix: mat4x4<f32>;

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) uv: vec2<f32>,
  @location(3) tangent: vec3<f32>,
  @location(4) bitangent: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) fragPos: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) uv: vec2<f32>,
  @location(3) tangent: vec3<f32>,
  @location(4) bitangent: vec3<f32>,
};

@vertex
fn main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let worldPos = modelMatrix * vec4<f32>(input.position, 1.0);
  output.position = sceneUniform * worldPos;
  output.fragPos = worldPos.xyz;

  output.normal = normalize((normalMatrix * vec4<f32>(input.normal, 0.0)).xyz);
  output.tangent = normalize((modelMatrix * vec4<f32>(input.tangent, 0.0)).xyz);
  output.bitangent = normalize((modelMatrix * vec4<f32>(input.bitangent, 0.0)).xyz);

  output.uv = input.uv;
  return output;
}
`;
