import { DECADES } from "../data/songs";
import { allMoods } from "../lib/search";
import type { Hints } from "../lib/search";

const MOOD_PICKS = ["romantic", "sad", "dance", "sufi", "wedding", "rain", "friendship", "party", "patriotic", "heartbreak"];

export function RefineBar({ hints, onChange }: { hints: Hints; onChange: (h: Hints) => void }) {
  const moods = allMoods().length ? MOOD_PICKS : [];
  const toggle = (key: keyof Hints, val: string) => {
    onChange({ ...hints, [key]: hints[key] === val ? undefined : val });
  };
  return (
    <div className="refine">
      <div className="refine-title">Narrow it down</div>
      <div className="refine-row">
        <span className="refine-label">Era</span>
        <div className="chips">
          {DECADES.map((d) => (
            <button key={d} className={"chip" + (hints.decade === d ? " chip-on" : "")} onClick={() => toggle("decade", d)}>{d}</button>
          ))}
        </div>
      </div>
      <div className="refine-row">
        <span className="refine-label">Mood</span>
        <div className="chips">
          {moods.map((m) => (
            <button key={m} className={"chip" + (hints.mood === m ? " chip-on" : "")} onClick={() => toggle("mood", m)}>{m}</button>
          ))}
        </div>
      </div>
      {(hints.decade || hints.mood) && (
        <button className="chip chip-clear" onClick={() => onChange({})}>Clear hints</button>
      )}
    </div>
  );
}
