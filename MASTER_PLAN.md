# PROJECT GOALPOST — Master Build Document
### Trustless World Cup settlement engine + SDK + demo apps (TxODDS World Cup Hackathon, deadline July 19 2026 23:59 UTC)

You are the senior architect and lead engineer on this project. Read this ENTIRE document before writing any code. Do not deviate from the phase order. Do not mark a phase complete until its acceptance criteria pass.

---

## 0. CONTEXT & STRATEGY (why we build this)

- Hackathon: TxODDS World Cup Hackathon on Superteam Earn. One codebase, submitted to up to 3 global tracks (Prediction Markets & Settlement — primary; Trading Tools & Agents; Consumer & Fan Experiences) + Malaysia local listing.
- The sponsor explicitly stated: teams that build **custom verification/validation logic using TxLINE's cryptographic Merkle proofs will be highly valued by judges**. Their docs invite contestants to write on-chain settlement engines that **CPI into TxLINE's `validate_stat` instruction** to confirm outcomes trustlessly and release funds. This is our core.
- Constraint from sponsor: the internal TxLINE credit token CANNOT be used for wagering/P2P transfers. All escrow/settlement must use other tokens (devnet USDC).
- Judging weights: core functionality & data ingestion, autonomous/reliable operation, code quality & logic, demo video quality. Matches end before judging — **the demo must run on simulated/replayed data**, which the rules explicitly allow ("live or simulated TxLINE data feeds").
- Prior local winners were judged to favor: production-looking polish, clean landing/README, `npm install`-able SDKs, understandable 2–5 min demos. Clarity beats depth in the demo; depth must still exist in the repo.

## 1. WHAT WE ARE BUILDING (one core, three packages)

**Core: "Goalpost" — a trustless settlement engine for World Cup outcomes on Solana.**

Deliverables, in strict priority order (if time runs out, cut from the bottom):

1. **`programs/goalpost`** — Anchor program (Rust, Solana devnet):
   - Market account: fixture id, outcome type (home/draw/away to start; extensible), USDC escrow vault (PDA), participant positions, state machine (Open → Locked → Settled → Claimed).
   - `settle` instruction that verifies the match result against TxLINE's on-chain validation (CPI into their `validate_stat` instruction per their docs; if CPI is not feasible on devnet within time, fall back to verifying the TxLINE Merkle proof / signature inside our program and DOCUMENT the tradeoff honestly in README — never fake verification).
   - Automatic payout routing to winners on settlement. No admin key can move user funds (document the trust model).
2. **`packages/sdk`** — TypeScript SDK (`@goalpost/sdk`):
   - `createMarket()`, `join()`, `settle()`, `claim()`, `getMarket()`, plus `txline` helpers: `getFixtures()`, `streamOdds()` (SSE), `getResultWithProof()`.
   - Zero runtime deps beyond @solana/web3.js + anchor client. Fully typed. JSDoc on every public function. A README that a stranger can follow in 5 minutes.
3. **`apps/replay`** — Replay simulator (Node):
   - Records a real TxLINE match feed (or fetches historical data) to a JSONL file; replays it as a local SSE server with configurable speed (1x, 10x, 60x). This is our demo backbone AND a genuinely useful dev tool (judging happens after the tournament ends — everyone has this problem).
4. **`apps/web`** — Demo web app (Next.js) built ON the SDK:
   - Fixture list → market page → join with wallet → watch replay drive live odds/score → settlement fires on final whistle → payout visible, with a "verification receipt" panel showing the TxLINE proof and the Solana explorer link.
5. **`apps/agent`** — Thin trading agent (Node, built on the SDK): reads the odds stream, applies a simple transparent strategy (e.g., enter when implied probability diverges from model by X%), places positions in our markets, logs every decision with the TxLINE data snapshot that justified it. ~1 day of work AFTER the SDK exists. This is the Trading track package.
6. **`apps/landing`** — Static landing page for the SDK (PayJaga-style: hero, 4-step "how it works", quickstart code block, decision/receipt example). Only if time permits; otherwise the web app's homepage doubles as landing.

Monorepo: pnpm workspaces + Turborepo optional. Layout:
```
goalpost/
  programs/goalpost/        # Anchor
  packages/sdk/
  apps/web/  apps/agent/  apps/replay/  apps/landing/
  docs/ARCHITECTURE.md  docs/TRUST_MODEL.md  docs/DEMO_SCRIPT.md
```

## 2. TECH STACK (do not improvise alternatives)

- Solana: Anchor (latest stable), devnet. Devnet USDC: use the standard devnet USDC mint or create a demo mint via `spl-token`; document which.
- SDK: TypeScript, tsup build, vitest tests.
- Web: Next.js (App Router), React, Tailwind, @solana/wallet-adapter. NO heavy UI kits; components hand-rolled per design system below.
- Agent/replay: Node 20+, TypeScript, no framework.
- Data: TxLINE REST + SSE per https://txline.txodds.com/documentation/quickstart and /worldcup. FIRST TASK of Phase 1 is to read these docs and write `docs/TXLINE_NOTES.md` summarizing: auth, fixture endpoints, odds stream shape, scores, the validation/proof primitives, and the exact name/interface of the on-chain validation program. Never guess an endpoint — verify against docs, and if something is unclear, stub it behind an interface and flag it.

MCP/tooling guidance: no exotic MCPs are required. Use built-in file/bash/web tools. If available, a Solana docs MCP or `context7` for library docs is a nice-to-have, not a blocker. Do not spend more than 15 minutes on tool setup.

## 3. QUALITY GATES (the three chronic failure modes — treat as hard requirements)

These address known past failures: templated/ugly design, sluggish performance, and crashes. Every phase ends with a gate check against all three.

### 3.1 Reliability ("must behave like a normal app, always")
- Every external call (TxLINE, RPC, wallet) wrapped with: timeout, one retry with backoff where idempotent, and a typed error surfaced to the UI as a human-readable message with a retry action. The app must NEVER white-screen: add a React error boundary at the route level with a friendly fallback.
- SSE stream: auto-reconnect with exponential backoff, visible connection status pill (Live / Reconnecting / Replay), and the UI keeps last-known-good data instead of blanking.
- All money-touching flows are state machines with explicit states (idle → signing → confirming → confirmed → failed) rendered in the UI. No spinner-forever states: every pending state has a timeout path.
- Zod-validate every external payload at the boundary (TxLINE responses, on-chain account data after decode). Malformed data → logged, skipped, UI unaffected.
- Anchor program: checked math only, explicit account constraint checks, no `unwrap()` on user-influenced paths; write at least: one happy-path test, one wrong-result-rejected test, one double-claim-rejected test, one non-participant-claim-rejected test (anchor test suite).
- Before the demo video: run the full replay demo 3 times back-to-back with zero manual intervention. If it fails once, fix before proceeding.

### 3.2 Performance ("must feel instant")
- Next.js: server components by default; client components only where interactivity requires. No client-side fetch waterfalls — parallelize with Promise.all.
- Streaming updates: batch SSE-driven state updates (e.g., flush at most every 250ms), memoize row components; the fixture list must not re-render entirely on every odds tick.
- Optimistic UI on user actions (joining a market shows immediately in "confirming" state).
- Bundle discipline: no moment.js, no lodash-everything, no chart library heavier than needed (prefer a hand-rolled sparkline or lightweight lib). Target: interactive < 3s on a mid phone, route transitions instant.
- RPC: reuse a single connection; never poll faster than 2s; prefer websocket account subscription for market state.

### 3.3 Design ("must not look AI-generated")
Act as a design lead with a point of view. Before writing UI code, produce a short design plan (tokens: 4–6 named hex colors, type pairing, layout concept, one signature element) and CRITIQUE it: if it looks like the default you'd produce for any dashboard (cream background + serif + terracotta; or near-black + acid green accent; or hairline-rule broadsheet), revise before building.
- Ground the aesthetic in the subject: football + market data + cryptographic verification. Ideas to riff on (choose and commit, don't mix all): broadcast-graphics energy (scoreboard typography, team-color accents), or terminal/trading-desk precision, or ticket/receipt motif for the verification proofs ("every result comes with a receipt" is our story — a receipt-styled proof panel is a strong signature-element candidate).
- Typography: one characterful display face (used sparingly — numbers/scores/headlines) + one clean body face. Set a real type scale. Tabular numerals for odds and scores.
- Motion: one orchestrated moment (e.g., settlement moment: whistle → proof verified → funds released, animated once, respecting prefers-reduced-motion). No scattered hover gimmicks.
- Quality floor: responsive to 380px, visible focus states, consistent spacing scale, dark-mode-first is fine if committed. Empty states and error states designed, not defaulted.
- After building each screen, screenshot it (if tooling allows) or re-read the JSX against the plan and remove one decoration (Chanel rule).

## 4. PHASED PLAN (7 days; each phase has acceptance criteria)

**Phase 0 — Recon (0.5 day):** Read TxLINE quickstart + World Cup docs with the API key. Write docs/TXLINE_NOTES.md. Hit fixtures, odds snapshot, scores, and the validation/proof endpoints with real curl calls; save sample payloads to `fixtures/samples/`. ✅ Done when: sample JSON for every endpoint we need is committed and the on-chain validation interface is documented (or its absence is documented with the fallback plan).

**Phase 1 — Replay simulator (0.5 day):** Build apps/replay: record + replay SSE with speed control. ✅ Done when: `pnpm replay --file samples/match1.jsonl --speed 60` serves a local stream the SDK can consume, and one full recorded match exists.

**Phase 2 — Anchor program (2 days):** Market lifecycle + escrow + settle-with-verification + claim. Write the 4 required tests. Deploy to devnet. ✅ Done when: anchor tests green; a scripted end-to-end (create → two wallets join → feed result → settle → both claims behave correctly) passes on devnet; TRUST_MODEL.md written.

**Phase 3 — SDK (1 day):** Wrap program + TxLINE helpers. tsup build, vitest unit tests for encoding/decoding and error paths, README with a 20-line quickstart that actually runs. ✅ Done when: `examples/quickstart.ts` runs green against devnet + replay stream from a clean clone.

**Phase 4 — Web demo (1.5 days):** The full user journey on the SDK, styled per the design plan, driven by the replay simulator. ✅ Done when: the 3x back-to-back no-touch demo run passes; Lighthouse perf ≥ 85 mobile; error/empty states exist; verification receipt panel links to a real devnet tx.

**Phase 5 — Agent (0.5–1 day):** Strategy loop + decision log + simple status page or CLI output. ✅ Done when: agent runs through a full replayed match, places ≥ 2 positions, logs decisions with data snapshots, and ends with a P&L summary.

**Phase 6 — Packaging (1 day, protected — do not steal from this):** Three README variants framing the same repo per track; landing page if time; record demo videos (script in docs/DEMO_SCRIPT.md: problem → live walkthrough → how TxLINE powers it → the verification moment as climax; ≤ 5 min each, distinct per track); technical documentation (core idea, highlights, exact TxLINE endpoints used); TxLINE feedback writeup; submit to global tracks + Malaysia local listing.

Buffer: any overrun eats packages in reverse priority (landing → agent → never the core).

## 5. WORKING RULES FOR CLAUDE CODE

- Work phase by phase. At the start of each phase, restate the acceptance criteria; at the end, verify them explicitly (run the commands, show output). Do not silently skip criteria.
- Commit at every green milestone with descriptive messages. Never leave the repo in a broken state at a stopping point.
- When an external interface is uncertain (TxLINE shapes, validation program), isolate it behind an adapter interface + fake implementation so the rest proceeds; keep a `docs/OPEN_QUESTIONS.md` list.
- Prefer boring, deterministic code over clever code. This is judged on "clean, well-documented, deterministic" resolution logic — the sponsor's own words.
- Security honesty: never claim verification we don't perform. The verification receipt must reflect what the program actually checked.
- Keep secrets in .env.local only; commit .env.example.
