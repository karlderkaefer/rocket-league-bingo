/**
 * GLSL ES 3.00 shaders for the WebGL2 smoke celebration.
 *
 * Two programs:
 *  - UPDATE: a transform-feedback vertex shader that integrates each particle's
 *    position/velocity using curl noise (divergence-free flow → smoke-like
 *    motion) plus an attraction force toward a target shape.
 *  - RENDER: draws each particle as a soft, warm, additively-blended point.
 *
 * Curl noise is derived from Ashima Arts' simplex noise (webgl-noise, MIT).
 */

/** 3D simplex noise (Ashima Arts, MIT licensed) — shared by the update shader. */
const SIMPLEX_NOISE_GLSL = /* glsl */ `
vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0 / 7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

/** Divergence-free curl of a simplex-noise potential field. */
vec3 curlNoise(vec3 p) {
  const float e = 0.1;
  vec3 dx = vec3(e, 0.0, 0.0);
  vec3 dy = vec3(0.0, e, 0.0);
  vec3 dz = vec3(0.0, 0.0, e);

  vec3 p_x0 = vec3(snoise(p - dx), snoise(p - dx + vec3(31.4)), snoise(p - dx + vec3(-27.1)));
  vec3 p_x1 = vec3(snoise(p + dx), snoise(p + dx + vec3(31.4)), snoise(p + dx + vec3(-27.1)));
  vec3 p_y0 = vec3(snoise(p - dy), snoise(p - dy + vec3(31.4)), snoise(p - dy + vec3(-27.1)));
  vec3 p_y1 = vec3(snoise(p + dy), snoise(p + dy + vec3(31.4)), snoise(p + dy + vec3(-27.1)));
  vec3 p_z0 = vec3(snoise(p - dz), snoise(p - dz + vec3(31.4)), snoise(p - dz + vec3(-27.1)));
  vec3 p_z1 = vec3(snoise(p + dz), snoise(p + dz + vec3(31.4)), snoise(p + dz + vec3(-27.1)));

  float x = (p_y1.z - p_y0.z) - (p_z1.y - p_z0.y);
  float y = (p_z1.x - p_z0.x) - (p_x1.z - p_x0.z);
  float z = (p_x1.y - p_x0.y) - (p_y1.x - p_y0.x);
  return normalize(vec3(x, y, z) / (2.0 * e) + 1e-6);
}
`;

/**
 * Update (simulation) vertex shader. Runs under RASTERIZER_DISCARD and writes
 * new position/velocity into transform-feedback buffers.
 */
export const UPDATE_VERTEX_SHADER = /* glsl */ `#version 300 es
precision highp float;

layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_velocity;
layout(location = 2) in vec3 a_target;
layout(location = 3) in vec3 a_seed;

uniform float u_dt;
uniform float u_time;
uniform float u_formStrength;   // 0 = free smoke, 1 = pulled hard to shape
uniform float u_noiseStrength;  // magnitude of curl-noise drift
uniform float u_buoyancy;       // upward drift (smoke rises)
uniform float u_damping;        // velocity retention per step

out vec3 v_position;
out vec3 v_velocity;

${SIMPLEX_NOISE_GLSL}

void main() {
  vec3 pos = a_position;
  vec3 vel = a_velocity;

  // Per-particle variation so the cloud does not move in lockstep.
  float noiseScale = 0.9 + a_seed.x * 0.6;
  float timeOffset = a_seed.y * 6.2831853;

  // Curl-noise flow field → organic, swirling, volume-preserving motion.
  vec3 flow = curlNoise(pos * noiseScale + vec3(0.0, -u_time * 0.15, u_time * 0.05) + timeOffset);
  vel += flow * u_noiseStrength * u_dt;

  // Attraction toward the target shape. Force eases with distance so particles
  // decelerate as they settle into the silhouette.
  vec3 toTarget = a_target - pos;
  float dist = length(toTarget);
  vec3 dir = toTarget / (dist + 1e-5);
  vel += dir * u_formStrength * (0.6 + dist) * u_dt * 6.0;

  // Buoyancy — smoke drifts upward.
  vel.y += u_buoyancy * u_dt;

  // Damping keeps things from exploding and gives a smoky, viscous feel.
  vel *= u_damping;

  pos += vel * u_dt;

  v_position = pos;
  v_velocity = vel;

  gl_Position = vec4(0.0, 0.0, 0.0, 1.0); // unused (rasterizer discarded)
}
`;

/** Minimal fragment shader for the update program (output discarded). */
export const UPDATE_FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;
out vec4 fragColor;
void main() { fragColor = vec4(0.0); }
`;

/** Render vertex shader — projects particles and sizes soft points. */
export const RENDER_VERTEX_SHADER = /* glsl */ `#version 300 es
precision highp float;

layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_seed;

uniform float u_aspect;     // canvas width / height
uniform float u_pointSize;  // base point size in px (already DPR-scaled)
uniform float u_opacity;    // global fade in/out

out float v_alpha;
out float v_heat;

void main() {
  vec3 p = a_position;

  // Aspect-correct so the shape is not stretched on wide screens.
  vec2 clip = p.xy;
  if (u_aspect >= 1.0) {
    clip.x /= u_aspect;
  } else {
    clip.y *= u_aspect;
  }

  gl_Position = vec4(clip, 0.0, 1.0);

  // Slight size variation + subtle depth scaling.
  float sizeVar = 0.6 + a_seed.z * 0.8;
  gl_PointSize = u_pointSize * sizeVar * (1.0 + p.z * 0.4);

  v_alpha = u_opacity * (0.5 + a_seed.z * 0.5);
  v_heat = a_seed.x; // used to vary warm color per particle
}
`;

/** Render fragment shader — warm, soft, glowing additive puff. */
export const RENDER_FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;

in float v_alpha;
in float v_heat;
out vec4 fragColor;

void main() {
  // Soft radial falloff from the point center.
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float d = dot(uv, uv);
  if (d > 1.0) discard;
  float falloff = pow(1.0 - d, 1.6);

  // Warm pipe-smoke palette: deep ember → gold → white-hot core.
  vec3 ember = vec3(1.0, 0.32, 0.06);
  vec3 gold = vec3(1.0, 0.78, 0.32);
  vec3 warm = mix(ember, gold, v_heat);
  vec3 color = mix(warm, vec3(1.0), falloff * 0.6);

  float alpha = falloff * v_alpha;

  // Premultiplied for additive blending (blendFunc(ONE, ONE)).
  fragColor = vec4(color * alpha, alpha);
}
`;
