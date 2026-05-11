'use client';
import { useEffect, useRef, useCallback } from 'react';
import { patternToTiles, TileState } from '@/lib/types';

interface Props {
  pattern: number | null;
  triggerKey: number;
}

/**
 * Read --tile-correct and --tile-present from the document root at call time.
 * Returns [r, g, b] in 0–1 range, falling back to the light-theme values.
 */
function getCSSColor(varName: string, fallbackHex: string): [number, number, number] {
  let hex = fallbackHex;
  if (typeof document !== 'undefined') {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue(varName)
      .trim();
    if (raw) hex = raw;
  }
  // Strip leading #
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  return [r, g, b];
}

function getShaderColor(pattern: number): [number, number, number] {
  const tiles = patternToTiles(pattern);
  const green  = tiles.filter((t: TileState) => t === 'correct').length;
  const yellow = tiles.filter((t: TileState) => t === 'present').length;

  const allGray = green === 0 && yellow === 0;
  if (allGray) {
    // Very muted tint — light theme gray
    return [0.47, 0.49, 0.49];
  }

  const total = green + yellow || 1;
  const gW = green / total;
  const yW = yellow / total;

  // Read live CSS vars so this works in both light and dark themes
  const [gr, gg, gb] = getCSSColor('--tile-correct', '#6aaa64');
  const [yr, yg, yb] = getCSSColor('--tile-present', '#c9b458');

  return [
    gW * gr + yW * yr,
    gW * gg + yW * yg,
    gW * gb + yW * yb,
  ];
}

const VERT = `attribute vec2 a_position;
void main(){gl_Position=vec4(a_position,0.0,1.0);}`;

const FRAG = `
precision highp float;
uniform vec2  u_resolution;
uniform float u_time;
uniform float u_fade;
uniform vec3  u_tint;

void main(){
  vec2 uv=(gl_FragCoord.xy*2.0-u_resolution)/min(u_resolution.x,u_resolution.y);

  // Shift origin upward toward the board area (top third of screen)
  uv.y -= 0.45;

  float t=u_time*0.35;

  // Compute monochrome rings from the shifted origin
  float lum=0.0;
  for(int i=0;i<5;i++){
    float fi=float(i);
    lum+=0.002*fi*fi
      /abs(fract(t+fi*0.01)*5.0
           -length(uv)+mod(uv.x+uv.y,0.2));
  }

  // Colour the rings with the guess tint
  vec3 col=lum*u_tint;
  col*=u_fade;

  float a=clamp(max(max(col.r,col.g),col.b)*1.5, 0.0, 1.0);
  gl_FragColor=vec4(col*a, a);
}`;

const FADE_DURATION = 1.8;

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    gl.deleteShader(s);
    return null;
  }
  return s;
}

export default function GuessWaveEffect({ pattern, triggerKey }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const locsRef = useRef<Record<string, WebGLUniformLocation | null>>({});
  const rafRef = useRef(0);
  const activeRef = useRef(false);
  const failedRef = useRef(false);

  // Respect prefers-reduced-motion — no-op if matched
  const prefersReducedMotion =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  const ensureGL = useCallback(() => {
    if (failedRef.current) return null;
    if (glRef.current) return glRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true });
    if (!gl) { failedRef.current = true; return null; }

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERT);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) { failedRef.current = true; return null; }

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      failedRef.current = true;
      return null;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(prog, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    locsRef.current = {
      u_resolution: gl.getUniformLocation(prog, 'u_resolution'),
      u_time:       gl.getUniformLocation(prog, 'u_time'),
      u_fade:       gl.getUniformLocation(prog, 'u_fade'),
      u_tint:       gl.getUniformLocation(prog, 'u_tint'),
    };

    glRef.current = gl;
    return gl;
  }, []);

  useEffect(() => {
    // Skip entirely when reduced-motion is requested
    if (prefersReducedMotion) return;
    if (pattern === null) return;

    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);

    const gl = ensureGL();
    if (!gl) return;
    const canvas = canvasRef.current!;
    const locs = locsRef.current;

    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    gl.viewport(0, 0, canvas.width, canvas.height);

    // Read CSS vars at trigger time so light/dark theme is respected
    const tint = getShaderColor(pattern);
    gl.uniform2f(locs.u_resolution!, canvas.width, canvas.height);
    gl.uniform3f(locs.u_tint!, tint[0], tint[1], tint[2]);

    let cancelled = false;
    const startTimer = setTimeout(() => {
      if (cancelled) return;
      activeRef.current = true;
      canvas.style.display = 'block';
      const startTime = performance.now();

      const draw = () => {
        if (!activeRef.current) return;
        const elapsed = (performance.now() - startTime) / 1000;

        let fade: number;
        if (elapsed < 0.1) {
          fade = elapsed / 0.1;
        } else if (elapsed < FADE_DURATION * 0.5) {
          fade = 1.0;
        } else if (elapsed < FADE_DURATION) {
          fade = 1.0 - (elapsed - FADE_DURATION * 0.5) / (FADE_DURATION * 0.5);
        } else {
          activeRef.current = false;
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
          canvas.style.display = 'none';
          return;
        }

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform1f(locs.u_time!, elapsed);
        gl.uniform1f(locs.u_fade!, Math.max(0.001, fade));
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        rafRef.current = requestAnimationFrame(draw);
      };

      rafRef.current = requestAnimationFrame(draw);
    }, 30);

    return () => {
      cancelled = true;
      clearTimeout(startTimer);
      activeRef.current = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [pattern, triggerKey, ensureGL, prefersReducedMotion]);

  // When reduced motion is active, render nothing
  if (prefersReducedMotion) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none"
      style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: -1, display: 'none' }}
    />
  );
}
