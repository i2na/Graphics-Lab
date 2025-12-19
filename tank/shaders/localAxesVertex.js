export const localAxesVertexCode = `
@group(0) @binding(0) var<uniform> sceneUniform: mat4x4<f32>;
@group(0) @binding(1) var<uniform> modelMatrix: mat4x4<f32>;

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) color: vec3<f32>,
};
struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>,
};

@vertex
fn main(input:VertexInput)->VertexOutput{
  var output:VertexOutput;
  let worldPos=modelMatrix*vec4<f32>(input.position,1.0);
  output.position=sceneUniform*worldPos;
  output.color=input.color;
  return output;
}
`;
