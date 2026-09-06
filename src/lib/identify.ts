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

// ACRCloud query-by-humming provider - stubbed, no network calls.
// Flipping this on requires: ACRCloud account, custom Bollywood reference DB
// (the 500-track pilot), and a small server proxy so credentials never ship
// to the client. See PILOT.md.
export class AcrCloudHumProvider implements MusicIdProvider {
  readonly name = "ACRCloud (query-by-humming)";
  readonly isDemo = false;
  private endpoint: string;
  private token: string;
  constructor(endpoint: string, token: string) { this.endpoint = endpoint; this.token = token; }
  async identify(): Promise<IdentifyOutcome> {
    void this.endpoint; void this.token;
    throw new Error("ACRCloud provider is not configured yet - pending the Bollywood pilot. See PILOT.md.");
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

// Active provider: pilot notice while the ACRCloud go/no-go pilot runs.
// Flip to AcrCloudHumProvider (via the server proxy) on a "go" verdict.
export const activeProvider: MusicIdProvider = new PilotHumProvider();

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
