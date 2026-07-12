/**
 * WebGL2 GPU smoke engine.
 *
 * Runs a GPU particle simulation using transform feedback (no CPU per-particle
 * work each frame). Particles are emitted from a "pipe" origin, drift on a
 * curl-noise flow field, coalesce into a target shape, hold, then dissipate.
 *
 * All particle state lives in GPU buffers. Position/velocity are double
 * buffered and ping-ponged each frame; target/seed are static.
 */

import {
  RENDER_FRAGMENT_SHADER,
  RENDER_VERTEX_SHADER,
  UPDATE_FRAGMENT_SHADER,
  UPDATE_VERTEX_SHADER,
} from './shaders';
import { buildTargetPositions, sampleOpaquePoints, type ShapePoint } from './shapeSampler';

export interface SmokeEngineOptions {
  /** Number of particles. Tune down on low-end / mobile. */
  particleCount: number;
  /** Text to form out of smoke. */
  text: string;
  /** Base point size in CSS px (multiplied by DPR internally). */
  pointSize?: number;
  /** Called once the full timeline has elapsed. */
  onComplete?: () => void;
}

/** Timeline keyframes (seconds). */
const TIMELINE = {
  emitEnd: 0.8,
  flowEnd: 1.8,
  formEnd: 3.3,
  holdEnd: 4.6,
  dissipateEnd: 7.2,
} as const;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Failed to create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${log}`);
  }
  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vsSource: string,
  fsSource: string,
  transformFeedbackVaryings?: string[],
): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error('Failed to create program');
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  if (transformFeedbackVaryings) {
    gl.transformFeedbackVaryings(program, transformFeedbackVaryings, gl.SEPARATE_ATTRIBS);
  }
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link error: ${log}`);
  }
  return program;
}

/** Render the target text to an offscreen canvas and sample its silhouette. */
function sampleTextShape(text: string): ShapePoint[] {
  const width = 1024;
  const height = 320;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Fit the font size to the canvas width.
  let fontSize = 260;
  ctx.font = `900 ${fontSize}px "Geist Variable", system-ui, sans-serif`;
  const maxWidth = width * 0.92;
  while (ctx.measureText(text).width > maxWidth && fontSize > 20) {
    fontSize -= 8;
    ctx.font = `900 ${fontSize}px "Geist Variable", system-ui, sans-serif`;
  }
  ctx.fillText(text, width / 2, height / 2);

  const { data } = ctx.getImageData(0, 0, width, height);
  return sampleOpaquePoints(data, { width, height, step: 3, alphaThreshold: 128 });
}

export class SmokeEngine {
  private gl: WebGL2RenderingContext;
  private updateProgram: WebGLProgram;
  private renderProgram: WebGLProgram;

  private posBuffers: [WebGLBuffer, WebGLBuffer];
  private velBuffers: [WebGLBuffer, WebGLBuffer];
  private targetBuffer: WebGLBuffer;
  private seedBuffer: WebGLBuffer;

  private updateVaos: [WebGLVertexArrayObject, WebGLVertexArrayObject];
  private renderVaos: [WebGLVertexArrayObject, WebGLVertexArrayObject];
  private transformFeedback: WebGLTransformFeedback;

  private uUpdate: {
    dt: WebGLUniformLocation | null;
    time: WebGLUniformLocation | null;
    formStrength: WebGLUniformLocation | null;
    noiseStrength: WebGLUniformLocation | null;
    buoyancy: WebGLUniformLocation | null;
    damping: WebGLUniformLocation | null;
  };
  private uRender: {
    aspect: WebGLUniformLocation | null;
    pointSize: WebGLUniformLocation | null;
    opacity: WebGLUniformLocation | null;
  };

  private count: number;
  private pointSize: number;
  private onComplete?: () => void;

  private current = 0;
  private startTime = 0;
  private lastTime = 0;
  private rafId = 0;
  private disposed = false;
  private dpr = 1;

  constructor(canvas: HTMLCanvasElement, options: SmokeEngineOptions) {
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
    });
    if (!gl) throw new Error('WebGL2 not supported');
    this.gl = gl;
    this.count = options.particleCount;
    this.pointSize = options.pointSize ?? 26;
    this.onComplete = options.onComplete;

    this.updateProgram = createProgram(gl, UPDATE_VERTEX_SHADER, UPDATE_FRAGMENT_SHADER, [
      'v_position',
      'v_velocity',
    ]);
    this.renderProgram = createProgram(gl, RENDER_VERTEX_SHADER, RENDER_FRAGMENT_SHADER);

    this.uUpdate = {
      dt: gl.getUniformLocation(this.updateProgram, 'u_dt'),
      time: gl.getUniformLocation(this.updateProgram, 'u_time'),
      formStrength: gl.getUniformLocation(this.updateProgram, 'u_formStrength'),
      noiseStrength: gl.getUniformLocation(this.updateProgram, 'u_noiseStrength'),
      buoyancy: gl.getUniformLocation(this.updateProgram, 'u_buoyancy'),
      damping: gl.getUniformLocation(this.updateProgram, 'u_damping'),
    };
    this.uRender = {
      aspect: gl.getUniformLocation(this.renderProgram, 'u_aspect'),
      pointSize: gl.getUniformLocation(this.renderProgram, 'u_pointSize'),
      opacity: gl.getUniformLocation(this.renderProgram, 'u_opacity'),
    };

    const { positions, velocities, targets, seeds } = this.buildInitialData(options.text);

    this.posBuffers = [this.makeBuffer(positions), this.makeBuffer(positions)];
    this.velBuffers = [this.makeBuffer(velocities), this.makeBuffer(velocities)];
    this.targetBuffer = this.makeBuffer(targets);
    this.seedBuffer = this.makeBuffer(seeds);

    this.updateVaos = [this.makeUpdateVao(0), this.makeUpdateVao(1)];
    this.renderVaos = [this.makeRenderVao(0), this.makeRenderVao(1)];

    const tf = gl.createTransformFeedback();
    if (!tf) throw new Error('Failed to create transform feedback');
    this.transformFeedback = tf;
  }

  private makeBuffer(data: Float32Array): WebGLBuffer {
    const gl = this.gl;
    const buffer = gl.createBuffer();
    if (!buffer) throw new Error('Failed to create buffer');
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_COPY);
    return buffer;
  }

  private buildInitialData(text: string) {
    const n = this.count;
    const positions = new Float32Array(n * 3);
    const velocities = new Float32Array(n * 3);
    const seeds = new Float32Array(n * 3);

    // Emit from a "pipe" near the bottom-center of the screen.
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 0.12;
      positions[i * 3 + 0] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = -0.95 + Math.random() * 0.1;
      positions[i * 3 + 2] = (Math.random() * 2 - 1) * 0.1;

      velocities[i * 3 + 0] = (Math.random() * 2 - 1) * 0.05;
      velocities[i * 3 + 1] = 0.2 + Math.random() * 0.3;
      velocities[i * 3 + 2] = (Math.random() * 2 - 1) * 0.05;

      seeds[i * 3 + 0] = Math.random();
      seeds[i * 3 + 1] = Math.random();
      seeds[i * 3 + 2] = Math.random();
    }

    const shapePoints = sampleTextShape(text);
    const targets = buildTargetPositions(n, shapePoints);

    return { positions, velocities, targets, seeds };
  }

  private makeUpdateVao(index: number): WebGLVertexArrayObject {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    if (!vao) throw new Error('Failed to create VAO');
    gl.bindVertexArray(vao);
    this.bindVec3Attrib(0, this.posBuffers[index]!);
    this.bindVec3Attrib(1, this.velBuffers[index]!);
    this.bindVec3Attrib(2, this.targetBuffer);
    this.bindVec3Attrib(3, this.seedBuffer);
    gl.bindVertexArray(null);
    return vao;
  }

  private makeRenderVao(index: number): WebGLVertexArrayObject {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    if (!vao) throw new Error('Failed to create VAO');
    gl.bindVertexArray(vao);
    this.bindVec3Attrib(0, this.posBuffers[index]!);
    this.bindVec3Attrib(1, this.seedBuffer);
    gl.bindVertexArray(null);
    return vao;
  }

  private bindVec3Attrib(location: number, buffer: WebGLBuffer): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 0, 0);
  }

  /** Compute animation parameters for a given elapsed time (seconds). */
  private timelineParams(t: number) {
    let formStrength: number;
    let noiseStrength: number;
    let buoyancy: number;
    let opacity: number;

    if (t < TIMELINE.emitEnd) {
      // Emit: dense chaotic puff rising from the pipe.
      formStrength = 0;
      noiseStrength = 1.1;
      buoyancy = 0.5;
      opacity = lerp(0, 1, t / TIMELINE.emitEnd);
    } else if (t < TIMELINE.flowEnd) {
      // Flow: drift and swirl, begin pulling toward the shape.
      const p = (t - TIMELINE.emitEnd) / (TIMELINE.flowEnd - TIMELINE.emitEnd);
      formStrength = lerp(0, 0.35, p);
      noiseStrength = lerp(1.1, 0.6, p);
      buoyancy = 0.35;
      opacity = 1;
    } else if (t < TIMELINE.formEnd) {
      // Form: attraction dominates, silhouette resolves.
      const p = (t - TIMELINE.flowEnd) / (TIMELINE.formEnd - TIMELINE.flowEnd);
      formStrength = lerp(0.35, 1, p);
      noiseStrength = lerp(0.6, 0.12, p);
      buoyancy = lerp(0.35, 0, p);
      opacity = 1;
    } else if (t < TIMELINE.holdEnd) {
      // Hold: shape is stable with a gentle shimmer.
      formStrength = 1;
      noiseStrength = 0.14;
      buoyancy = 0;
      opacity = 1;
    } else {
      // Dissipate: release, drift up, fade out.
      const p = (t - TIMELINE.holdEnd) / (TIMELINE.dissipateEnd - TIMELINE.holdEnd);
      formStrength = lerp(1, 0, p);
      noiseStrength = lerp(0.14, 1.4, p);
      buoyancy = lerp(0, 1.2, p);
      opacity = lerp(1, 0, p);
    }

    return { formStrength, noiseStrength, buoyancy, opacity };
  }

  private resize(): void {
    const gl = this.gl;
    const canvas = gl.canvas as HTMLCanvasElement;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.floor(canvas.clientWidth * this.dpr);
    const height = Math.floor(canvas.clientHeight * this.dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  private frame = (now: number): void => {
    if (this.disposed) return;
    const gl = this.gl;

    if (this.startTime === 0) {
      this.startTime = now;
      this.lastTime = now;
    }
    const elapsed = (now - this.startTime) / 1000;
    // Clamp dt to keep the sim stable if a frame is dropped / tab was hidden.
    const dt = Math.min((now - this.lastTime) / 1000, 1 / 30);
    this.lastTime = now;

    this.resize();

    const params = this.timelineParams(elapsed);
    const src = this.current;
    const dst = 1 - this.current;

    // --- Simulation pass (transform feedback, no rasterization) ---
    gl.useProgram(this.updateProgram);
    gl.uniform1f(this.uUpdate.dt, dt);
    gl.uniform1f(this.uUpdate.time, elapsed);
    gl.uniform1f(this.uUpdate.formStrength, params.formStrength);
    gl.uniform1f(this.uUpdate.noiseStrength, params.noiseStrength);
    gl.uniform1f(this.uUpdate.buoyancy, params.buoyancy);
    gl.uniform1f(this.uUpdate.damping, 0.94);

    gl.bindVertexArray(this.updateVaos[src]!);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.transformFeedback);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.posBuffers[dst]!);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, this.velBuffers[dst]!);

    gl.enable(gl.RASTERIZER_DISCARD);
    gl.beginTransformFeedback(gl.POINTS);
    gl.drawArrays(gl.POINTS, 0, this.count);
    gl.endTransformFeedback();
    gl.disable(gl.RASTERIZER_DISCARD);

    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, null);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
    gl.bindVertexArray(null);

    // --- Render pass (soft additive points) ---
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE); // additive (premultiplied color from shader)

    gl.useProgram(this.renderProgram);
    const canvas = gl.canvas as HTMLCanvasElement;
    gl.uniform1f(this.uRender.aspect, canvas.width / canvas.height);
    gl.uniform1f(this.uRender.pointSize, this.pointSize * this.dpr);
    gl.uniform1f(this.uRender.opacity, params.opacity);

    gl.bindVertexArray(this.renderVaos[dst]!);
    gl.drawArrays(gl.POINTS, 0, this.count);
    gl.bindVertexArray(null);

    this.current = dst;

    if (elapsed >= TIMELINE.dissipateEnd) {
      this.onComplete?.();
      return;
    }
    this.rafId = requestAnimationFrame(this.frame);
  };

  /** Start the animation loop. */
  start(): void {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.frame);
  }

  /** Stop the loop and release all GPU resources. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.rafId);

    const gl = this.gl;
    gl.deleteProgram(this.updateProgram);
    gl.deleteProgram(this.renderProgram);
    gl.deleteBuffer(this.posBuffers[0]);
    gl.deleteBuffer(this.posBuffers[1]);
    gl.deleteBuffer(this.velBuffers[0]);
    gl.deleteBuffer(this.velBuffers[1]);
    gl.deleteBuffer(this.targetBuffer);
    gl.deleteBuffer(this.seedBuffer);
    gl.deleteVertexArray(this.updateVaos[0]);
    gl.deleteVertexArray(this.updateVaos[1]);
    gl.deleteVertexArray(this.renderVaos[0]);
    gl.deleteVertexArray(this.renderVaos[1]);
    gl.deleteTransformFeedback(this.transformFeedback);
  }
}
