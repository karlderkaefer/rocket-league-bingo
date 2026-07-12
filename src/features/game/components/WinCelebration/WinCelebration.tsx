import { useEffect, useRef, useState } from 'react';

import { SmokeEngine } from './SmokeEngine';

interface WinCelebrationProps {
  /** Whether the celebration should be playing right now. */
  show: boolean;
  /** Text to form out of smoke. */
  text?: string;
  /** Called when the animation finishes (or is skipped). */
  onDone?: () => void;
}

/** True when the user prefers reduced motion. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Choose a particle budget based on device capability. */
function pickParticleCount(): number {
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  const small = window.innerWidth < 640;
  if (small || mem <= 2 || cores <= 2) return 20_000;
  if (mem <= 4 || cores <= 4) return 45_000;
  return 80_000;
}

/**
 * Full-screen GPU smoke celebration overlay. Emits a warm cloud of particles
 * that coalesces into the given text, holds, then dissipates — inspired by
 * Gandalf's smoke ship. Renders on a WebGL2 canvas layered above the app.
 *
 * Respects `prefers-reduced-motion` (shows a simple static banner instead) and
 * gracefully skips if WebGL2 is unavailable. The canvas mounts only while
 * playing and all GPU resources are released on teardown.
 */
export function WinCelebration({ show, text = 'BINGO!', onDone }: WinCelebrationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [reduced] = useState(prefersReducedMotion);

  // Keep the latest onDone in a ref so unrelated parent re-renders don't tear
  // down and recreate the WebGL engine mid-animation. The animation effect
  // must only run on the rising edge of `show`.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!show || reduced) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let engine: SmokeEngine | null = null;
    try {
      engine = new SmokeEngine(canvas, {
        particleCount: pickParticleCount(),
        text,
        onComplete: () => onDoneRef.current?.(),
      });
      engine.start();
    } catch (err) {
      // WebGL2 unavailable or shader failure — fail gracefully.
      console.error('Win celebration failed to start:', err);
      onDoneRef.current?.();
    }

    return () => {
      engine?.dispose();
    };
  }, [show, reduced, text]);

  // Reduced-motion path: auto-dismiss a static banner after a short beat.
  useEffect(() => {
    if (!show || !reduced) return;
    const timer = window.setTimeout(() => onDoneRef.current?.(), 4000);
    return () => window.clearTimeout(timer);
  }, [show, reduced]);

  if (!show) return null;

  if (reduced) {
    return (
      <div
        className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center"
        role="status"
        aria-label={`${text} You win`}
      >
        <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 px-10 py-6 text-4xl font-black tracking-tight text-white shadow-2xl">
          🏆 {text}
        </div>
      </div>
    );
  }

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[60]"
      aria-hidden="true"
      style={{
        // Warm radial vignette so the additive smoke pops against the app.
        background:
          'radial-gradient(circle at 50% 60%, rgba(20,10,0,0.55) 0%, rgba(0,0,0,0.75) 100%)',
        animation: 'win-celebration-fade 7.2s ease-out forwards',
      }}
    >
      <style>{`
        @keyframes win-celebration-fade {
          0% { opacity: 0; }
          8% { opacity: 1; }
          80% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
