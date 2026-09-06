import { useEffect, useRef, useState } from "react";
import { startCapture } from "../lib/audio";
import type { CaptureSession } from "../lib/audio";

export function HumCapture({ onDone, onCancel }: {
  onDone: (blob: Blob, durationMs: number) => void;
  onCancel: () => void;
}) {
  const [session, setSession] = useState<CaptureSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return; // StrictMode double-mount guard
    startedRef.current = true;
    let alive = true;
    startCapture(setError).then((s) => { if (alive && s) setSession(s); });
    return () => { alive = false; };
  }, []);

  // timer independent of rAF (throttled in some environments)
  useEffect(() => {
    if (!session) return;
    const iv = setInterval(() => setElapsed(Date.now() - session.startedAt), 250);
    return () => clearInterval(iv);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const tick = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        const data = session.levels();
        const { width, height } = canvas;
        ctx!.clearRect(0, 0, width, height);
        ctx!.lineWidth = 2;
        const grad = ctx!.createLinearGradient(0, 0, width, 0);
        grad.addColorStop(0, "#ff9933");
        grad.addColorStop(1, "#ffc46b");
        ctx!.strokeStyle = grad;
        ctx!.beginPath();
        const step = width / data.length;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          const y = height / 2 + v * (height / 2) * 0.9;
          i === 0 ? ctx!.moveTo(0, y) : ctx!.lineTo(i * step, y);
        }
        ctx!.stroke();
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [session]);

  const secs = Math.floor(elapsed / 1000);
  const finish = async () => {
    if (!session) return;
    const { blob, durationMs } = await session.stop();
    onDone(blob, durationMs);
  };

  if (error) {
    return (
      <div className="capture">
        <div className="capture-error">{error}</div>
        <button className="btn btn-ghost btn-block" onClick={onCancel}>Back</button>
      </div>
    );
  }

  return (
    <div className="capture">
      <div className="capture-ring">
        <div className="capture-pulse" />
        <div className="capture-mic">🎙</div>
      </div>
      <div className="capture-timer">{secs}s <span>/ keep humming, 6-10s is the sweet spot</span></div>
      <canvas ref={canvasRef} className="capture-wave" width={640} height={140} />
      <div className="capture-actions">
        <button className="btn btn-ghost" onClick={() => { session?.cancel(); onCancel(); }}>Cancel</button>
        <button className="btn btn-primary" onClick={finish} disabled={!session || secs < 2}>
          {!session ? "Waiting for mic permission…" : secs < 2 ? "Listening…" : "Identify this dhun"}
        </button>
      </div>
    </div>
  );
}
