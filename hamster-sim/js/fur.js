// Shell-textured fur layered on top of a physically based material (sheen = fuzz rim light).
import * as THREE from 'three';

let QUALITY = 1;
export function setFurQuality(q) { QUALITY = q; }

const VERT_HEAD = /* glsl */`
attribute float aLayer;
uniform float uFurLen;
uniform vec3 uStretch;
uniform float uDroop;
varying float vLayer;
varying vec3 vLocal;
varying vec3 vObjN;
`;
const VERT_BODY = /* glsl */`
#include <begin_vertex>
vLayer = aLayer;
vLocal = position * uStretch;
vObjN = normal;
transformed += normal * (uFurLen * aLayer);
transformed.y -= uDroop * aLayer * aLayer;
{
  vec3 hp = position * 5200.0;
  vec3 rr = fract(sin(vec3(dot(hp, vec3(12.9898, 78.233, 37.719)), dot(hp, vec3(39.346, 11.135, 83.155)), dot(hp, vec3(73.156, 52.235, 9.151)))) * 43758.5453) - 0.5;
  transformed += rr * uFurLen * 0.55 * aLayer * aLayer;
}
`;

const FRAG_HEAD = /* glsl */`
varying float vLayer;
varying vec3 vLocal;
varying vec3 vObjN;
uniform float uDensity;
uniform vec3 uBase;
uniform vec3 uTip;
uniform vec3 uDark;
uniform vec3 uBelly;
uniform vec4 uBlob0;
uniform vec4 uBlob1;
uniform vec4 uBlob2;
uniform float uBellyAmt;
uniform float uTick;
float h13(vec3 p){ p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vn3(vec3 p){
  vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(mix(h13(i),h13(i+vec3(1,0,0)),f.x), mix(h13(i+vec3(0,1,0)),h13(i+vec3(1,1,0)),f.x), f.y),
             mix(mix(h13(i+vec3(0,0,1)),h13(i+vec3(1,0,1)),f.x), mix(h13(i+vec3(0,1,1)),h13(i+vec3(1,1,1)),f.x), f.y), f.z);
}
float blob(vec4 b, vec3 p, float nz){
  if (b.w <= 0.0) return 0.0;
  // mirrored across the sagittal plane so patches are symmetric
  vec3 q2 = vec3(abs(p.x) - abs(b.x), p.y - b.y, p.z - b.z);
  float d = length(q2);
  return smoothstep(b.w, b.w * 0.35, d + (nz - 0.5) * b.w * 0.9);
}
`;
const FRAG_COLOR = /* glsl */`
#include <color_fragment>
vec3 sp = vLocal * uDensity;
vec3 sid = floor(sp);
float srnd = h13(sid);
float srnd2 = h13(sid + 7.7);
float fw = length(fwidth(sp));
float farK = smoothstep(0.6, 2.2, fw);
{
  vec3 sn = normalize(vObjN);
  vec3 sf = fract(sp) - 0.5;
  vec3 ft = sf - sn * dot(sf, sn);
  float strandH = 0.30 + 0.70 * srnd;
  if (vLayer > 0.001 && fw < 0.95) {
    if (vLayer > strandH) discard;
    float rad = 0.46 * (1.0 - 0.8 * vLayer / strandH) / max(1.0, fw * 1.4);
    if (length(ft) > rad) discard;
  }
}
float nz = vn3(vLocal * 120.0);
float nzL = vn3(vLocal * 38.0 + 3.1);
float m = max(max(blob(uBlob0, vLocal, nzL), blob(uBlob1, vLocal, nzL)), blob(uBlob2, vLocal, nzL));
float tickMask = smoothstep(0.52, 0.8, nzL) * uTick;
vec3 fur = mix(uBase, uTip, smoothstep(0.1, 1.0, vLayer) * (0.55 + 0.45 * srnd2));
fur = mix(fur, uDark, clamp(max(m, tickMask * 0.7), 0.0, 1.0) * (0.75 + 0.25 * srnd));
float belly = smoothstep(-0.15, -0.6, normalize(vObjN).y) * uBellyAmt;
fur = mix(fur, uBelly, belly);
fur *= mix(0.82 + 0.34 * srnd2, 1.0, farK);
fur *= mix(mix(0.46, 1.0, pow(vLayer, 0.6)), mix(0.75, 1.0, vLayer), farK);      // self occlusion towards the skin
diffuseColor.rgb = fur;
`;
const FRAG_NORMAL = /* glsl */`
#include <normal_fragment_begin>
normal = normalize(normal + (vec3(h13(sid + 1.3), h13(sid + 2.9), h13(sid + 4.1)) - 0.5) * 0.9 * vLayer * (1.0 - farK));
`;

/**
 * @param {THREE.BufferGeometry} geometry
 * @param {object} o {len, density, layers, base, tip, dark, belly, blobs, tick, bellyAmt, droop}
 */
export function createFur(geometry, o) {
  geometry = geometry.clone();
  const layers = Math.max(6, Math.round((o.layers ?? 20) * QUALITY));
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.78,
    metalness: 0,
    sheen: 1,
    sheenRoughness: 0.45,
    sheenColor: new THREE.Color(o.sheen ?? 0xffc98a),
  });
  const u = {
    uFurLen: { value: o.len ?? 0.006 },
    uStretch: { value: new THREE.Vector3(1, 1, 1) },
    uDroop: { value: o.droop ?? 0.0008 },
    uDensity: { value: o.density ?? 900 },
    uBase: { value: new THREE.Color(o.base ?? 0xd9822b).convertSRGBToLinear() },
    uTip: { value: new THREE.Color(o.tip ?? 0xf0a64c).convertSRGBToLinear() },
    uDark: { value: new THREE.Color(o.dark ?? 0x2b1a12).convertSRGBToLinear() },
    uBelly: { value: new THREE.Color(o.belly ?? 0xf3e2c4).convertSRGBToLinear() },
    uBlob0: { value: new THREE.Vector4(...(o.blobs?.[0] ?? [0, 0, 0, 0])) },
    uBlob1: { value: new THREE.Vector4(...(o.blobs?.[1] ?? [0, 0, 0, 0])) },
    uBlob2: { value: new THREE.Vector4(...(o.blobs?.[2] ?? [0, 0, 0, 0])) },
    uBellyAmt: { value: o.bellyAmt ?? 1 },
    uTick: { value: o.tick ?? 0.5 },
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_HEAD)
      .replace('#include <begin_vertex>', VERT_BODY);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_HEAD)
      .replace('#include <color_fragment>', FRAG_COLOR)
      .replace('#include <normal_fragment_begin>', FRAG_NORMAL);
  };
  mat.customProgramCacheKey = () => 'fur-v2';
  const mesh = new THREE.InstancedMesh(geometry, mat, layers);
  const attr = new Float32Array(layers);
  const id = new THREE.Matrix4();
  for (let i = 0; i < layers; i++) { attr[i] = i / (layers - 1); mesh.setMatrixAt(i, id); }
  mesh.geometry.setAttribute('aLayer', new THREE.InstancedBufferAttribute(attr, 1));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  mesh.userData.fur = u;
  mesh.userData.setStretch = (x, y, z) => u.uStretch.value.set(x, y, z);
  return mesh;
}
