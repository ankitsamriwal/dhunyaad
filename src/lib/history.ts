export interface HistoryEntry {
  id: string;
  kind: "hum" | "lyric" | "scene";
  label: string; // query text or "hummed 8s"
  ts: number;
  top: { title: string; movie: string; year: number; confidence: number }[];
}

const KEY = "dhun.history.v1";

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch { return []; }
}

export function addHistory(e: Omit<HistoryEntry, "id" | "ts">): HistoryEntry[] {
  const entry: HistoryEntry = { ...e, id: Math.random().toString(36).slice(2), ts: Date.now() };
  const list = [entry, ...loadHistory()].slice(0, 60);
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* full */ }
  return list;
}

export function clearHistory(): void {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
}
