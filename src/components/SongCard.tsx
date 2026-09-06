import type { Song } from "../data/songs";
import type { IdentifyMatch } from "../lib/identify";

export function ConfidenceBar({ value }: { value: number }) {
  const hue = value >= 75 ? "var(--saffron)" : value >= 45 ? "var(--amber)" : "var(--muted)";
  return (
    <div className="conf">
      <div className="conf-track"><div className="conf-fill" style={{ width: `${value}%`, background: hue }} /></div>
      <span className="conf-num">{value}%</span>
    </div>
  );
}

export function SongCard({ match, rank, onOpen }: { match: IdentifyMatch; rank: number; onOpen: (s: Song) => void }) {
  const s = match.song;
  return (
    <button className="song-card" onClick={() => onOpen(s)}>
      <div className="song-rank">{rank}</div>
      <div className="song-main">
        <div className="song-title">{s.t}</div>
        <div className="song-meta"><span className="song-movie">{s.m}</span>{s.y > 0 && <><span className="dot">·</span>{s.y}</>}</div>
        <div className="song-artists">{s.s.join(", ")}</div>
        {match.note && <div className="song-note">{match.note}</div>}
      </div>
      <ConfidenceBar value={match.confidence} />
    </button>
  );
}

export function SongDetail({ song, onClose }: { song: Song; onClose: () => void }) {
  const yt = `https://www.youtube.com/results?search_query=${encodeURIComponent(song.t + " " + song.m)}`;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="detail-kicker">{song.m}{song.y > 0 ? ` · ${song.y}` : ""}</div>
        <h2 className="detail-title">{song.t}</h2>
        {song.l && (
          <div className="detail-lyric">
            <span className="detail-lyric-mark">“</span>{song.l}
            {song.d && <div className="detail-dev">{song.d}</div>}
          </div>
        )}
        <div className="detail-grid">
          <div><label>Singers</label><p>{song.s.join(", ")}</p></div>
          {song.md && <div><label>Music</label><p>{song.md}</p></div>}
          {song.a.length > 0 && <div><label>On screen</label><p>{song.a.join(", ")}</p></div>}
          {song.mo.length > 0 && <div><label>Mood</label><p>{song.mo.join(", ")}</p></div>}
        </div>
        {song.sc && song.sc.length > 0 && (
          <div className="detail-scenes">
            <label>The scene</label>
            {song.sc.map((sc, i) => <p key={i}>{sc}</p>)}
          </div>
        )}
        <a className="btn btn-primary btn-block" href={yt} target="_blank" rel="noreferrer">Play on YouTube</a>
        <button className="btn btn-ghost btn-block" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
