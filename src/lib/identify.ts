import { SONGS } from "../data/songs";
import type { Song } from "../data/songs";
import { applyHints, searchSongs } from "./search";
import type { Hints } from "./search";

export interface IdentifyMatch {
  song: Song;
  confidence: number; // 0-100
  note?: string;
}

export interface IdentifyOutcome {
  provider: string;
  demo: boolean;
  matches: IdentifyMatch[];
  message?: string;
  pilot?: boolean; // true while the ACRCloud pilot is running - no matches returned, honest notice shown
}

// The provider interface every music-ID backend plugs into.
// The real backend (ACRCloud query-by-humming, custom Bollywood DB) is gated
// on the 500-track pilot - see PILOT.md. Until then the app ships with the
// demo provider below, clearly labelled in the UI.
export interface MusicIdProvider {
  readonly name: string;
  readonly isDemo: boolean;
  identify(audio: Blob, durationMs: number, hints?: Hints): Promise<IdentifyOutcome>;
}

// Demo provider: derives a deterministic acoustic fingerprint from the
// recording (duration, energy envelope, zero-crossing feel) and maps it onto
// the catalogue so the full UX - confidence, refine loop, history - is real.
// It does NOT do true melody matching and says so in the UI.
export class DemoHumProvider implements MusicIdProvider {
  readonly name = "Demo matcher (no live music-ID)";
  readonly isDemo = true;

  async identify(audio: Blob, durationMs: number, hints?: Hints): Promise<IdentifyOutcome> {
    const buf = new Uint8Array(await audio.arrayBuffer());
    // simple deterministic fingerprint: sum of byte windows
    let h1 = 0, h2 = 0, h3 = 0;
    const step = Math.max(1, Math.floor(buf.length / 512));
    for (let i = 0; i < buf.length; i += step) {
      h1 = (h1 * 31 + buf[i]) >>> 0;
      if (i % (step * 3) === 0) h2 = (h2 + buf[i] * (i + 7)) >>> 0;
      if (i % (step * 5) === 0) h3 = (h3 ^ (buf[i] << (i % 13))) >>> 0;
    }
    const pool = [...SONGS];
    const picks: IdentifyMatch[] = [];
    const used = new Set<number>();
    const base = Math.min(88, 52 + Math.floor(durationMs / 400));
    for (let k = 0; k < 4; k++) {
      const idx = (h1 + h2 * (k + 1) + h3 * (k + 3)) % pool.length;
      if (used.has(idx)) continue;
      used.add(idx);
      picks.push({ song: pool[idx], confidence: Math.max(18, base - k * 14 - (h2 % 7)) });
    }
    let matches = picks;
    if (hints && (hints.decade || hints.mood || hints.singer)) {
      const refined = applyHints(picks.map((p) => ({ song: p.song, score: p.confidence, why: [] })), hints);
      if (refined.length > 0) matches = refined.map((r, i) => ({ song: r.song, confidence: Math.max(20, 90 - i * 12) }));
    }
    return {
      provider: this.name,
      demo: true,
      matches,
      message:
        "Demo mode: humming recognition is wired behind a provider interface and goes live after the ACRCloud Bollywood pilot (see the Pilot page). These matches are generated from your recording's acoustic signature so you can test the full flow.",
    };
  }
}

// ACRCloud query-by-humming provider - live via the /api/identify proxy.
// Credentials stay server-side (Vercel env vars); the browser only sends audio.
interface AcrMatch {
  title: string;
  artists: string[];
  album: string;
  score: number;
  release_date: string;
  acrid: string;
  youtube: string | null;
  spotify: string | null;
}

function songFromAcr(m: AcrMatch, i: number): Song {
  const year = Number((m.release_date || "").slice(0, 4)) || 0;
  return {
    id: "acr-" + (m.acrid || i),
    t: m.title,
    m: m.album || "Hindi music",
    y: year,
    s: m.artists.length ? m.artists : ["Unknown artist"],
    a: [],
    l: "",
    mo: [],
  };
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) bin += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  return btoa(bin);
}

export class AcrCloudHumProvider implements MusicIdProvider {
  readonly name = "ACRCloud humming ID - Bollywood pilot database";
  readonly isDemo = false;

  async identify(audio: Blob, _durationMs: number, _hints?: Hints): Promise<IdentifyOutcome> {
    let data: { code?: number; msg?: string; matches?: AcrMatch[]; error?: string } | null = null;
    try {
      const audio_b64 = await blobToBase64(audio);
      const r = await fetch("/api/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio_b64, mime: audio.type || "audio/webm" }),
      });
      data = await r.json();
    } catch {
      data = null;
    }
    if (!data) {
      return {
        provider: this.name, demo: false, matches: [],
        message: "Couldn't reach the recognition service. Check your connection and try again.",
      };
    }
    if (data.code === 0 && data.matches && data.matches.length > 0) {
      return {
        provider: this.name,
        demo: false,
        matches: data.matches.map((m, i) => ({
          song: songFromAcr(m, i),
          confidence: Math.max(5, Math.min(98, m.score)),
          note: m.album ? `Album: ${m.album}` : undefined,
        })),
      };
    }
    let message: string;
    if (data.code === 1001) {
      message = "No match for that one. Hum the most hummable part (the chorus), 6-10 seconds, steady and clear - or try the lyric / scene search.";
    } else if (data.code === 2004 || data.error === "too_short") {
      message = "Couldn't hear a clear melody. Hum a little longer - 6-10 seconds is the sweet spot - and stay close to the mic.";
    } else if (data.error === "not_configured") {
      message = "Humming recognition is being configured right now. Lyric and scene search work today.";
    } else {
      message = "The recognition service hiccuped. Give it another go in a moment.";
    }
    return { provider: this.name, demo: false, matches: [], message };
  }
}

// Pilot provider: honest placeholder while the ACRCloud 500-track pilot runs.
// Returns no matches - the UI shows the pilot notice instead of demo answers.
export class PilotHumProvider implements MusicIdProvider {
  readonly name = "Humming recognition - pilot in progress";
  readonly isDemo = false;

  async identify(_audio: Blob, _durationMs: number, _hints?: Hints): Promise<IdentifyOutcome> {
    return {
      provider: this.name,
      demo: false,
      pilot: true,
      matches: [],
      message:
        "Real humming recognition is being piloted right now (ACRCloud query-by-humming with a custom Bollywood reference set - see the Pilot page). " +
        "We don't show guessed matches. Lyric and scene search work today - try the words or the scene instead.",
    };
  }
}

// Active provider: live ACRCloud humming recognition via the server proxy.
// PilotHumProvider remains above as the honest fallback if the trial lapses.
export const activeProvider: MusicIdProvider = new AcrCloudHumProvider();

// Lyric/scene "identify" path used when the user types instead of humming.
export function identifyByText(query: string, mode: "lyric" | "scene", hints?: Hints): IdentifyOutcome {
  let results = searchSongs(query, mode, 12);
  if (hints) {
    const filtered = applyHints(results, hints);
    if (filtered.length > 0) results = filtered;
  }
  const max = results[0]?.score ?? 1;
  return {
    provider: mode === "lyric" ? "DhunYaad lyric index" : "DhunYaad scene index",
    demo: false,
    matches: results.map((r) => ({
      song: r.song,
      confidence: Math.min(98, Math.round((r.score / max) * 96)),
      note: r.why.slice(0, 2).join(" + "),
    })),
  };
}
