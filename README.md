# Dhun — Bollywood-first song recognition

Gaana yaad hai, naam nahi? Hum it, type half a lyric (Romanized or Devanagari), or describe the scene ("SRK on a train"). Dhun answers with the song, the film, and the singer — filmi-first.

## What works today
- **Hum capture** — real microphone recording with live waveform (MediaRecorder + Web Audio analyser)
- **Lyric search** — fuzzy, romanization-tolerant, Devanagari-aware search over a curated 239-song Bollywood catalogue (1951–2024)
- **Scene search** — describe the video (actor, place, what happens); matched against a hand-written scene index
- **Results** — song + movie + singer first-class, match confidence, refine loop (era / mood hints)
- **History** — local, on-device (localStorage), clearable
- **Song detail** — lyric card, credits, scene notes, YouTube deep link

## What is deliberately gated
True humming recognition sits behind the `MusicIdProvider` interface (`src/lib/identify.ts`). It currently runs a clearly-labelled **demo matcher** (deterministic acoustic fingerprint → catalogue) so the whole UX is testable. The real backend — ACRCloud query-by-humming with a custom Bollywood reference database — is gated on the 500-track pilot in `PILOT.md`. No paid music-ID API calls are made.

## Stack
Vite + React + TypeScript, hand-rolled CSS (no UI framework), zero runtime dependencies beyond React. Deploys on Vercel.

## Develop
```
npm install
npm run dev
npm run build
```
