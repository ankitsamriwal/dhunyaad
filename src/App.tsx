import { useMemo, useState } from "react";
import { SONGS } from "./data/songs";
import type { Song } from "./data/songs";
import { HumCapture } from "./components/HumCapture";
import { SongCard, SongDetail } from "./components/SongCard";
import { RefineBar } from "./components/RefineBar";
import { activeProvider, identifyByText } from "./lib/identify";
import type { IdentifyOutcome } from "./lib/identify";
import type { Hints } from "./lib/search";
import { addHistory, clearHistory, loadHistory } from "./lib/history";

type Screen = "home" | "results" | "search" | "history" | "pilot";
type SearchMode = "lyric" | "scene";

const LYRIC_EXAMPLES = ["tujhe dekha to yeh jaana sanam", "तुम ही हो", "kuch kuch hota hai", "raataan lambiyan", "chura liya hai tumne jo dil ko"];
const SCENE_EXAMPLES = ["SRK dancing on a train", "couple in the rain under one umbrella", "wedding dance with the whole family", "girl with a pigeon on her head", "pyramids of Egypt romance", "slum rapper in Mumbai"];

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [capturing, setCapturing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [outcome, setOutcome] = useState<IdentifyOutcome | null>(null);
  const [outcomeLabel, setOutcomeLabel] = useState("");
  const [outcomeKind, setOutcomeKind] = useState<"hum" | "lyric" | "scene">("hum");
  const [hints, setHints] = useState<Hints>({});
  const [detail, setDetail] = useState<Song | null>(null);
  const [searchMode, setSearchMode] = useState<SearchMode>("lyric");
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState(loadHistory());
  const [lastAudio, setLastAudio] = useState<{ blob: Blob; ms: number } | null>(null);

  const goResults = (o: IdentifyOutcome, kind: "hum" | "lyric" | "scene", label: string) => {
    setOutcome(o); setOutcomeKind(kind); setOutcomeLabel(label); setHints({});
    setHistory(addHistory({
      kind, label,
      top: o.matches.slice(0, 3).map((m) => ({ title: m.song.t, movie: m.song.m, year: m.song.y, confidence: m.confidence })),
    }));
    setScreen("results");
  };

  const onHumDone = (blob: Blob, ms: number) => {
    setCapturing(false); setAnalyzing(true); setLastAudio({ blob, ms });
    activeProvider
      .identify(blob, ms)
      .then((o) => { setAnalyzing(false); goResults(o, "hum", `hummed ${Math.round(ms / 1000)}s`); })
      .catch(() => {
        setAnalyzing(false);
        goResults({ provider: "Humming recognition", demo: false, matches: [], message: "Something went wrong on our side. Try again in a moment." }, "hum", `hummed ${Math.round(ms / 1000)}s`);
      });
  };

  const runTextSearch = (q: string, mode: SearchMode) => {
    if (q.trim().length < 2) return;
    goResults(identifyByText(q, mode), mode, mode === "lyric" ? `lyric: “${q}”` : `scene: “${q}”`);
  };

  const applyHints = (h: Hints) => {
    setHints(h);
    if (outcomeKind === "hum" && lastAudio) {
      activeProvider.identify(lastAudio.blob, lastAudio.ms, h).then(setOutcome);
    } else if (outcomeKind !== "hum") {
      const q = outcomeLabel.replace(/^(lyric|scene): [“"]/, "").replace(/[”"]$/, "");
      setOutcome(identifyByText(q, outcomeKind, h));
    }
  };

  const trending = useMemo(() => [...SONGS].sort(() => 0.5 - Math.random()).slice(0, 6), []);

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => setScreen("home")}>
          <span className="brand-mark">ध</span>
          <span className="brand-name">DhunYaad</span>
        </button>
        <nav className="topnav">
          <button className={screen === "search" ? "on" : ""} onClick={() => setScreen("search")}>Search</button>
          <button className={screen === "history" ? "on" : ""} onClick={() => setScreen("history")}>History</button>
          <button className={screen === "pilot" ? "on" : ""} onClick={() => setScreen("pilot")}>Pilot</button>
        </nav>
      </header>

      {screen === "home" && (
        <main className="page">
          <section className="hero">
            <div className="hero-kicker">Bollywood-first song recognition</div>
            <h1 className="hero-title">Gaana yaad hai,<br /><em>naam nahi?</em></h1>
            <p className="hero-sub">Hum it, type half a lyric, or describe the scene. DhunYaad tells you the song, the film, and who sang it.</p>
            <button className="hum-button" onClick={() => setCapturing(true)}>
              <span className="hum-button-ring" />
              <span className="hum-button-label">🎙<br />Hum it</span>
              <span className="hum-pilot-pill">Beta</span>
            </button>
            <div className="hero-alt">
              <button className="mode-card" onClick={() => { setSearchMode("lyric"); setScreen("search"); }}>
                <span className="mode-icon">✍️</span>
                <span className="mode-name">Type a lyric</span>
                <span className="mode-sub">Romanized or देवनागरी</span>
              </button>
              <button className="mode-card" onClick={() => { setSearchMode("scene"); setScreen("search"); }}>
                <span className="mode-icon">🎬</span>
                <span className="mode-name">Describe the scene</span>
                <span className="mode-sub">"SRK on a train"</span>
              </button>
            </div>
          </section>

          <section className="section">
            <h2 className="section-title">Tonight in the catalogue</h2>
            <div className="trend-list">
              {trending.map((s) => (
                <button key={s.id} className="trend-item" onClick={() => setDetail(s)}>
                  <span className="trend-title">{s.t}</span>
                  <span className="trend-meta">{s.m} · {s.y}</span>
                </button>
              ))}
            </div>
            <p className="catalogue-note">{SONGS.length} hand-curated songs, 1951-2024. The catalogue grows with the pilot.</p>
          </section>
        </main>
      )}

      {screen === "search" && (
        <main className="page">
          <div className="seg">
            <button className={searchMode === "lyric" ? "on" : ""} onClick={() => setSearchMode("lyric")}>Lyric</button>
            <button className={searchMode === "scene" ? "on" : ""} onClick={() => setSearchMode("scene")}>Scene</button>
          </div>
          <form className="searchbar" onSubmit={(e) => { e.preventDefault(); runTextSearch(query, searchMode); }}>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchMode === "lyric" ? "Type the line you remember…" : "Describe the video, the actor, the place…"}
            />
            <button className="btn btn-primary" type="submit">Find</button>
          </form>
          <div className="examples">
            <span className="examples-label">Try</span>
            {(searchMode === "lyric" ? LYRIC_EXAMPLES : SCENE_EXAMPLES).map((x) => (
              <button key={x} className="chip" onClick={() => { setQuery(x); runTextSearch(x, searchMode); }}>{x}</button>
            ))}
          </div>
          <p className="search-hint">
            {searchMode === "lyric"
              ? "Half-remembered is fine. Spelling doesn't matter - 'chaiya', 'chaiyya' and 'छैयाँ' all find Chaiyya Chaiyya."
              : "Mention the actor, the place, what happens. 'SRK on a train' really works."}
          </p>
        </main>
      )}

      {screen === "results" && outcome && (
        <main className="page">
          <div className="results-head">
            <div className="results-kicker">{outcomeLabel}</div>
            <h2 className="results-title">{outcome.pilot ? "Humming is in pilot right now" : outcome.matches.length ? "Is it one of these?" : outcomeKind === "hum" ? "No match - hum it longer?" : "No match in the catalogue yet"}</h2>
            <div className={"provider-tag" + (outcome.demo ? " demo" : "")}>{outcome.provider}</div>
            {outcome.message && <p className="demo-note">{outcome.message}</p>}
          </div>
          {outcomeKind !== "hum" && !outcome.pilot && <RefineBar hints={hints} onChange={applyHints} />}
          <div className="results-list">
            {outcome.matches.map((m, i) => (
              <SongCard key={m.song.id} match={m} rank={i + 1} onOpen={setDetail} />
            ))}
          </div>
          <div className="results-actions">
            <button className="btn btn-primary" onClick={() => setCapturing(true)}>Hum longer</button>
            <button className="btn btn-ghost" onClick={() => setScreen("search")}>Try words instead</button>
          </div>
        </main>
      )}

      {screen === "history" && (
        <main className="page">
          <div className="history-head">
            <h2 className="section-title">Your dhuns</h2>
            {history.length > 0 && <button className="chip chip-clear" onClick={() => { clearHistory(); setHistory([]); }}>Clear all</button>}
          </div>
          {history.length === 0 && <p className="empty">Nothing yet. Hum something and it lands here.</p>}
          <div className="history-list">
            {history.map((h) => (
              <div key={h.id} className="history-item">
                <div className="history-top">
                  <span className={"history-kind k-" + h.kind}>{h.kind}</span>
                  <span className="history-label">{h.label}</span>
                  <span className="history-time">{new Date(h.ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                {h.top.map((t, i) => (
                  <div key={i} className="history-match">
                    <span className="history-match-title">{t.title}</span>
                    <span className="history-match-meta">{t.movie} · {t.year} · {t.confidence}%</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </main>
      )}

      {screen === "pilot" && (
        <main className="page">
          <h2 className="section-title">The humming engine: live in beta</h2>
          <div className="pilot-card">
            <h3>Where things stand</h3>
            <p>Humming recognition is live in beta: your hum goes to ACRCloud's query-by-humming engine (through our server proxy - credentials never touch your phone) and matches against a Bollywood reference database that is still growing. Early probes identified 11 of 12 tracks correctly, but real-world humming is the true test - expect misses while the reference set scales toward 500 tracks.</p>
            <h3>Why it's gated</h3>
            <p>Only one mature commercial humming API exists - ACRCloud query-by-humming - and its public humming database does not list Hindi. Google's hum-to-search has no public API at all. So Bollywood humming needs ACRCloud's custom-database option, and nobody should pay for that before it is proven on Bollywood melodies.</p>
            <h3>The go / no-go gate</h3>
            <ol>
              <li>Assemble a 500-track Bollywood reference set (licensed reference audio, spread across eras and singers).</li>
              <li>Upload to an ACRCloud custom humming database on the free trial.</li>
              <li>Run a blind test: 50+ people humming 20 target songs, measure top-1 and top-5 hit rate.</li>
              <li>Go only if top-5 clears ~70%. Otherwise fall back to AudD as a second opinion and keep humming as "beta".</li>
            </ol>
            <h3>What flips on go</h3>
            <p>Live now: <code>AcrCloudHumProvider</code> + the <code>/api/identify</code> server proxy on the ACRCloud free trial. The reference database and the blind human-hum test are still in progress - that is why the button says Beta.</p>
          </div>
        </main>
      )}

      {capturing && (
        <div className="overlay">
          <HumCapture onDone={onHumDone} onCancel={() => setCapturing(false)} />
        </div>
      )}
      {analyzing && (
        <div className="overlay">
          <div className="analyzing">
            <div className="analyzing-disc"><span /></div>
            <div className="analyzing-text">Sunti hai…<br /><small>matching your dhun</small></div>
          </div>
        </div>
      )}
      {detail && <SongDetail song={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
