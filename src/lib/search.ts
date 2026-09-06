import { SONGS, decadeOf } from "../data/songs";
import type { Song } from "../data/songs";

// Normalize romanized Hindi: fold vowel-length and spelling variants so
// "chaiya", "chaiyya", "chaiyaan" all land near each other.
export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\u0900-\u097F\s]/g, " ")
    .replace(/aa/g, "a")
    .replace(/ee/g, "i")
    .replace(/oo/g, "u")
    .replace(/kh/g, "kh")
    .replace(/bh/g, "bh")
    .replace(/dh/g, "dh")
    .replace(/gh/g, "gh")
    .replace(/th/g, "th")
    .replace(/ph/g, "ph")
    .replace(/sh|shh/g, "sh")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): string[] {
  return norm(s).split(" ").filter((t) => t.length > 1);
}

// cheap edit distance, capped
function edit1(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    edits++;
    if (edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

export interface ScoredSong {
  song: Song;
  score: number;
  why: string[];
}

const STOP = new Set(["ka", "ki", "ke", "ko", "se", "mein", "me", "hai", "ho", "to", "na", "hi", "re", "o", "ye", "yeh", "woh", "wo", "the", "a", "of", "in", "on", "and", "song", "gaana"]);

function scoreSong(song: Song, qTokens: string[], rawQ: string, mode: "lyric" | "scene" | "any"): ScoredSong | null {
  let score = 0;
  const why: string[] = [];
  const nTitle = norm(song.t);
  const nMovie = norm(song.m);
  const nLyric = norm(song.l);
  const nSingers = norm(song.s.join(" "));
  const nActors = norm(song.a.join(" "));
  const nScenes = norm((song.sc ?? []).join(" "));
  const nMoods = norm(song.mo.join(" "));
  const nMd = norm(song.md ?? "");
  const rawNorm = norm(rawQ);

  // phrase-level boosts
  if (rawNorm.length > 3 && nLyric.includes(rawNorm)) { score += 60; why.push("lyric line match"); }
  if (rawNorm.length > 3 && nTitle.includes(rawNorm)) { score += 50; why.push("title match"); }
  if (rawNorm.length > 3 && nMovie === rawNorm) { score += 30; why.push("movie"); }
  if (song.d && /[\u0900-\u097F]/.test(rawQ) && song.d.includes(rawQ.trim())) { score += 60; why.push("devanagari lyric match"); }

  let hits = 0;
  for (const qt of qTokens) {
    if (STOP.has(qt)) continue;
    let best = 0;
    let where = "";
    const fields: [string, number, string][] =
      mode === "scene"
        ? [[nScenes, 9, "scene"], [nActors, 8, "on screen"], [nTitle, 7, "title"], [nMovie, 6, "movie"], [nMoods, 4, "mood"], [nLyric, 3, "lyric"], [nSingers, 3, "singer"]]
        : mode === "lyric"
        ? [[nLyric, 9, "lyric"], [nTitle, 8, "title"], [nMovie, 5, "movie"], [nSingers, 4, "singer"], [nMd, 3, "composer"], [nActors, 2, "on screen"], [nMoods, 2, "mood"]]
        : [[nTitle, 8, "title"], [nLyric, 7, "lyric"], [nMovie, 6, "movie"], [nSingers, 5, "singer"], [nActors, 4, "on screen"], [nScenes, 4, "scene"], [nMoods, 2, "mood"]];
    for (const [text, w, label] of fields) {
      if (!text) continue;
      if (text.includes(qt)) { if (w > best) { best = w; where = label; } continue; }
      // fuzzy: token-level edit distance 1 for longer tokens
      if (qt.length >= 5) {
        for (const ft of text.split(" ")) {
          if (Math.abs(ft.length - qt.length) <= 1 && edit1(qt, ft)) {
            if (w * 0.6 > best) { best = w * 0.6; where = label + " (close)"; }
            break;
          }
        }
      }
    }
    if (best > 0) { hits++; score += best; if (where && !why.includes(where)) why.push(where); }
  }
  if (hits === 0) return null;
  // coverage boost: reward matching more of the query
  const contentTokens = qTokens.filter((t) => !STOP.has(t)).length;
  if (contentTokens > 0) score *= 0.5 + 0.5 * (hits / contentTokens);
  return { song, score, why };
}

export function searchSongs(query: string, mode: "lyric" | "scene" | "any" = "any", limit = 12): ScoredSong[] {
  const qTokens = tokens(query);
  if (qTokens.length === 0 && !/[\u0900-\u097F]/.test(query)) return [];
  const out: ScoredSong[] = [];
  for (const song of SONGS) {
    const r = scoreSong(song, qTokens, query, mode);
    if (r) out.push(r);
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}

export interface Hints { decade?: string; mood?: string; singer?: string }

export function applyHints(results: ScoredSong[], hints: Hints): ScoredSong[] {
  let r = results;
  if (hints.decade) r = r.filter((x) => decadeOf(x.song.y) === hints.decade);
  if (hints.mood) r = r.filter((x) => x.song.mo.includes(hints.mood!));
  if (hints.singer) {
    const ns = norm(hints.singer);
    r = r.filter((x) => norm(x.song.s.join(" ")).includes(ns));
  }
  return r;
}

export function allSingers(): string[] {
  const set = new Map<string, string>();
  for (const s of SONGS) for (const name of s.s) set.set(norm(name), name);
  return [...set.values()].sort();
}

export function allMoods(): string[] {
  const set = new Set<string>();
  for (const s of SONGS) for (const m of s.mo) set.add(m);
  return [...set].sort();
}

export { SONGS, decadeOf };
