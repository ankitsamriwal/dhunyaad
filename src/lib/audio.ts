// Microphone capture with a live waveform feed.
export interface CaptureSession {
  stop: () => Promise<{ blob: Blob; durationMs: number }>;
  cancel: () => void;
  levels: () => Uint8Array; // live frequency/wave data for the visualizer
  startedAt: number;
}

export async function startCapture(onError: (msg: string) => void): Promise<CaptureSession | null> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    src.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
    const rec = new MediaRecorder(stream, MediaRecorder.isTypeSupported(mime) ? { mimeType: mime } : undefined);
    const chunks: BlobPart[] = [];
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    rec.start(250);
    const startedAt = Date.now();

    const teardown = () => {
      stream.getTracks().forEach((t) => t.stop());
      ctx.close().catch(() => undefined);
    };

    return {
      startedAt,
      levels: () => { analyser.getByteTimeDomainData(data); return data; },
      stop: () =>
        new Promise((resolve) => {
          rec.onstop = () => {
            teardown();
            resolve({ blob: new Blob(chunks, { type: rec.mimeType || "audio/webm" }), durationMs: Date.now() - startedAt });
          };
          rec.stop();
        }),
      cancel: () => { try { rec.stop(); } catch { /* already stopped */ } teardown(); },
    };
  } catch (e) {
    onError(e instanceof DOMException && e.name === "NotAllowedError"
      ? "Microphone permission denied. Allow mic access to hum, or use lyric / scene search below."
      : "No microphone available here. Lyric and scene search work without one.");
    return null;
  }
}
