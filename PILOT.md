# The humming engine: go / no-go pilot

## Why gated
- ACRCloud query-by-humming is the only mature commercial humming API. Its public humming database (1M+ tracks) lists English/Chinese/Japanese/French/Spanish/Portuguese — **not Hindi**. Bollywood depth needs their custom-database option (upload your own reference audio).
- Google hum-to-search has **no public API** (consumer feature only). It is the accuracy bar, not a building block.
- AudD (160M-track DB) is the fallback / second opinion. ShazamKit covers "song playing nearby", not humming.

## The pilot (spend gate)
1. Assemble a **500-track Bollywood reference set** — licensed reference audio, spread across eras (60s→2020s), singers, and moods.
2. Upload to an **ACRCloud custom humming database** on the free trial tier.
3. Blind test: 50+ people humming 20 target songs; measure top-1 and top-5 hit rate.
4. **Go** only if top-5 clears ~70%. Otherwise fall back to AudD as second opinion and keep humming labelled beta.

## What flips on go
`AcrCloudHumProvider` is stubbed in `src/lib/identify.ts`. Going live needs:
- a small server proxy (Vercel function) so ACRCloud credentials never ship to the client
- a config flag swapping `activeProvider` from `DemoHumProvider` to `AcrCloudHumProvider`
No UI changes required.
