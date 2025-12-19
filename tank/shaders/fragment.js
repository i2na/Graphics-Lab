export const fragmentShaderWGSL = `
@group(0) @binding(3) var<uniform> lightDirection: vec3<f32>;
@group(0) @binding(4) var colorTex: texture_2d<f32>;
@group(0) @binding(5) var etcTex: texture_2d<f32>;
@group(0) @binding(6) var normalTex: texture_2d<f32>;
@group(0) @binding(7) var mySampler: sampler;
@group(0) @binding(8) var<uniform> partUniform: u32;

const PI = 3.14159265359;

fn fresnelSchlick(cosTheta: f32, F0: vec3<f32>) -> vec3<f32> {
return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}

fn ndfGGX(N: vec3<f32>, H: vec3<f32>, roughness: f32) -> f32 {
let a = roughness * roughness;
let a2 = a * a;
let NdotH = max(dot(N, H), 0.0);
let NdotH2 = NdotH * NdotH;
let denom = NdotH2 * (a2 - 1.0) + 1.0;
return a2 / (PI * denom * denom);
}

fn geometrySmith(N: vec3<f32>, V: vec3<f32>, L: vec3<f32>, roughness: f32) -> f32 {
let k = (roughness + 1.0)*(roughness + 1.0)/8.0;
let NdotV = max(dot(N,V),0.0);
let NdotL = max(dot(N,L),0.0);
let G1V = NdotV/(NdotV*(1.0-k)+k);
let G1L = NdotL/(NdotL*(1.0-k)+k);
return G1V * G1L;
}

struct VertexOutput {
@builtin(position) position: vec4<f32>,
@location(0) fragPos: vec3<f32>,
@location(1) normal: vec3<f32>,
@location(2) uv: vec2<f32>,
@location(3) tangent: vec3<f32>,
@location(4) bitangent: vec3<f32>,
};

@fragment
fn main(input: VertexOutput)->@location(0) vec4<f32> {
let baseColor_srgb = textureSample(colorTex,mySampler,input.uv).rgb;
var baseColor = pow(baseColor_srgb, vec3<f32>(2.2));

let etcColor = textureSample(etcTex,mySampler,input.uv);
let AO = etcColor.r;
var roughness = etcColor.g;
var metallic = etcColor.b;

let normalSample = textureSample(normalTex, mySampler, input.uv).rgb;
let N_map = normalSample * 2.0 - 1.0;
let tangentNormal = normalize(-N_map);

let T = normalize(input.tangent);
let B = normalize(input.bitangent);
let N = normalize(input.normal);
let TBN = mat3x3<f32>(T, B, N);

let worldNormal = normalize(TBN * tangentNormal);

if (partUniform == 2u) {
metallic = 0.1;
roughness = 0.05;
baseColor = vec3<f32>(0.38, 0.37, 0.36);


// rustMask를 g채널에서 추출 (0~1)
let rustMask = textureSample(etcTex, mySampler, input.uv).g;

// AO 기반으로 녹 섞기 (AO 낮을수록 녹심)
let rustFactorAO = smoothstep(0.1, 0.5, AO);

let noise = 0.5 + 0.5*sin(input.uv.x*50.0 + input.uv.y*50.0);
let combinedRustFactor = rustMask * rustFactorAO;

let rustColor = vec3<f32>(0.02, 0.01, 0.005);
baseColor = mix(baseColor, rustColor, combinedRustFactor);

// 녹 부분은 금속성 줄이고 더 거칠게
metallic = mix(metallic, 0.0, combinedRustFactor);
roughness = mix(roughness, 0.85, combinedRustFactor);
}

let L = normalize(-lightDirection);
let V = normalize(-input.fragPos);
let H = normalize(L + V);

let NdotV = max(dot(worldNormal, V),0.0);
let NdotL = max(dot(worldNormal, L),0.0);

let NDF = ndfGGX(worldNormal, H, roughness);
let G = geometrySmith(worldNormal, V, L, roughness);
let F0 = mix(vec3<f32>(0.04,0.04,0.04), baseColor, metallic);
let F = fresnelSchlick(max(dot(H, V),0.0), F0);

let kS = F * (NDF * G) / (4.0 * NdotV * NdotL + 0.001);
let kD = (vec3<f32>(1.0)-F)*(1.0-metallic);

let diffuse = NdotL * baseColor;
let ambientIntensity = 0.0001;
let ambient = AO * AO * vec3<f32>(ambientIntensity, ambientIntensity, ambientIntensity);

var finalColor = ambient + kD*diffuse + kS;

let gamma = 2.2;
finalColor = pow(finalColor, vec3<f32>(1.0/gamma));
return vec4<f32>(finalColor, 1.0);
}
`;
