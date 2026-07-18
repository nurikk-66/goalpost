# Goalpost

**Every result comes with a receipt.**

Built for the TxODDS World Cup Hackathon — Prediction Markets & Settlement track.

## What this is

Goalpost is a trustless settlement engine for World Cup prediction markets.
Two people back opposite outcomes of a real match; when it ends, the smart
contract doesn't ask anyone who won — it verifies TxLINE's cryptographic
proof of the final score on-chain and pays out by math, not by permission.
No admin key, no oracle you have to trust, no "resolver" who could be wrong,
bribed, or offline. The contract checks the receipt itself.

## The trustless-verification story

Every prediction market has the same weak point: someone has to say who won,
and you have to trust them. Goalpost's `settle` instruction removes that
person. It CPIs directly into TxLINE's own deployed `validate_stat_v2`
instruction (devnet program `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`),
passing the caller-supplied Merkle proof against TxLINE's on-chain
`daily_scores_merkle_roots` account. That CPI cryptographically authenticates
the submitted goal counts against TxLINE's own published root — a caller
cannot fabricate a scoreline; an incorrect value fails to reconstruct the
real root and the CPI itself fails. `settle` then derives the outcome
(`home_goals.cmp(&away_goals)`) from the *authenticated* values — it never
accepts "this was a home win" as an argument, so there's no field a
malicious caller could lie in even if they wanted to.

**This isn't a claim on a slide.** `tests/goalpost.ts` has a test —
`"rejects settle() when the submitted stat value doesn't match the real
Merkle proof"` — that deliberately tampers a stat value and calls `settle()`
against real devnet. The transaction fails with TxLINE's own on-chain error,
`InvalidStatProof` (or our wrapping `StatValidationFailed`, depending on
which layer surfaces first) — the rejection comes from the sponsor's real
validation logic running live on devnet, on every CI run, not from a
shortcut in our own code. See `docs/TRUST_MODEL.md` for the full account of
what `settle` does and does not independently verify.

## Architecture

```
TxLINE (sponsor's data + proof API, devnet)
   |  REST: /fixtures/snapshot, /scores/stat-validation, ...
   |  SSE:  /odds/stream, /scores/stream
   v
apps/replay  --------------------------->  packages/sdk (TxLineClient)
(records a real match once, replays it        |  same client works against
 over the same SSE shape for repeatable        |  TxLINE live or the replay
 demos - see docs/ARCHITECTURE.md)             |  simulator, unchanged
                                                v
                                     apps/web (Next.js demo UI)
                                     connect wallet -> create/join market
                                     -> watch live odds/score -> settle
                                     -> verification receipt -> claim
                                                |
                                                v  Anchor instructions
                              programs/goalpost (deployed on devnet)
                              create_market / join / lock_market / settle / claim
                                                |
                                                v  CPI (settle only)
                        TxLINE's validate_stat_v2 (devnet program
                        6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J)
                        checks the proof against daily_scores_merkle_roots
```

`settle` is the only instruction that talks to TxLINE. Every other
instruction (`create_market`, `join`, `lock_market`, `claim`) only touches
Goalpost's own accounts and a caller-owned SPL token account — see
`docs/TRUST_MODEL.md` for exactly who can sign what.

## Exact TxLINE endpoints used

| Endpoint | Used for |
|---|---|
| `POST /auth/guest/start` | guest JWT (session auth) |
| `POST /api/token/activate` | long-lived API token, free World Cup tier |
| `GET /api/fixtures/snapshot` | fixture list (`fixtureId`, teams, kickoff) |
| `GET /api/scores/stat-validation?fixtureId=&seq=&statKeys=1,2` | the real Merkle proof `settle` submits on-chain |
| `GET /api/odds/stream` (SSE) | live odds ticks, replayed by `apps/replay` |
| `GET /api/scores/stream` (SSE) | live score ticks, replayed by `apps/replay` |

On-chain CPI target: `validate_stat_v2` on TxLINE's devnet program
`6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`. Full endpoint inventory and
the exact request/response shapes we verified against live data are in
`docs/TXLINE_NOTES.md`.

## Live devnet program

```
6e6iXff86RZ6ryB7TeJSdn4GfGNDM5xtRz9h1oBQzLNr
```

`https://explorer.solana.com/address/6e6iXff86RZ6ryB7TeJSdn4GfGNDM5xtRz9h1oBQzLNr?cluster=devnet`

Deployed via CI (`.github/workflows/anchor-ci.yml`); all required tests
(happy path, wrong-result-rejected, double-claim-rejected,
non-participant-claim-rejected) pass against this exact live deployment, not
a local validator — see `docs/TRUST_MODEL.md` "Status" for the CI run.

## Quickstart

Prerequisites: Node 20+, pnpm, a devnet-funded Solana keypair.

```bash
git clone <this repo>
cd goalpost
pnpm install

# One-wallet walkthrough: auth -> create -> join -> lock -> settle -> claim
# -> a few replayed odds ticks, all against real devnet.
cd examples && pnpm start

# Two-wallet walkthrough: a genuinely separate second keypair joins and
# claims, proving the protocol doesn't require one signer throughout.
pnpm two-wallet
```

Both scripts reuse (or create) a throwaway devnet keypair at
`scripts/vendor/recon-wallet.json` — fund it at https://faucet.solana.com if
it prints a 0-balance error.

For the web demo app:

```bash
pnpm --filter @goalpost/web dev
# open http://localhost:3000/fixtures/18222446
```

The replay simulator starts in-process (see `apps/web/instrumentation.ts`) —
one command, no second terminal. Connect a devnet wallet (Phantom or
Solflare), then: create market -> join -> watch the replay drive live
odds/score -> lock -> settle -> read the verification receipt -> claim.

## What's implemented vs. roadmap

**Implemented and verified against real devnet:**
- `programs/goalpost`: `create_market`, `join`, `lock_market`, `settle`
  (real CPI into TxLINE's `validate_stat_v2`), `claim` (pari-mutuel payout,
  full-refund fallback if nobody backed the winning outcome). Deployed and
  tested live on devnet (see `docs/TRUST_MODEL.md`).
- `packages/sdk`: typed TypeScript wrapper over every instruction plus a
  `TxLineClient` that works unchanged against TxLINE live or
  `apps/replay`'s recorded feed. 20/20 unit tests passing.
- `apps/replay`: records a real TxLINE match once, replays the same SSE
  shape at adjustable speed — the demo doesn't depend on a live match being
  in progress at judging time.
- `apps/web`: full user journey (connect wallet, create/join a market,
  live odds/score, settle with the real captured proof, verification
  receipt with a real devnet explorer link, claim), dark protocol-grade UI
  per `docs/DESIGN.md`.
- Two independent, genuinely-separate-wallet end-to-end runs against real
  devnet (`examples/quickstart.ts`, `examples/two-wallet-demo.ts`) —
  see the real transaction signatures below.

**Roadmap, honestly not built yet:**
- Phase 5 (trading agent) and Phase 6 (multi-track packaging) were
  explicitly descoped for this submission to focus on one polished
  Prediction Markets & Settlement entry rather than spreading thin — see
  `docs/OPEN_QUESTIONS.md`.
- Single data source: TxLINE is the only oracle. The trust model document
  says this plainly rather than hiding it — multi-source verification is a
  natural next step, not a claimed feature.
- `settle` doesn't independently call `validate_fixture` to prove the
  fixture ID corresponds to the named teams — it trusts TxLINE's own
  fixture numbering (rationale in `docs/TRUST_MODEL.md`).
- No mainnet deployment; devnet only, using a program-minted devnet SPL
  token rather than shared devnet USDC (rationale in `docs/TRUST_MODEL.md`
  "Devnet USDC").
- Lighthouse mobile performance score not yet run in this environment
  (see `docs/OPEN_QUESTIONS.md`) — pending a manual Chrome DevTools check.

## Real transaction evidence

From a real run of `examples/two-wallet-demo.ts` on 2026-07-18 — two
genuinely separate keypairs (a creator and a backer, not the same wallet
throughout), real devnet, the real captured Merkle proof for Argentina 3-1
Switzerland:

| Step | Signer | Link |
|---|---|---|
| Market created | creator | `https://explorer.solana.com/address/CpwHSdZeGehApAvahgFZd1JZ4acgNBnpu3THZ4kgxR1D?cluster=devnet` |
| Backer joins, backs Home | backer (separate wallet) | `https://explorer.solana.com/tx/2R7AseEiz6oHCeruJTDrAxo5V8GfhveBXD3EiapbBj7gvmCB4gc3xW8h9pRQmedhcTpeYRZvHJMP63Ju4czTVtP1?cluster=devnet` |
| Settle (real CPI into TxLINE's `validate_stat_v2`) | creator | `https://explorer.solana.com/tx/7NJJHuNkjTdJeA8DpoGskBMn77nWDRdfu2U7XTWoovXdVXfwj6oqUBsMs7gSxiEUq4XYzRAzzjPega4kAB7HGEM?cluster=devnet` |
| Backer claims payout | backer (separate wallet) | `https://explorer.solana.com/tx/3nTz9PFByb468QiHmpFPFqFvm57Sqq3JJyduUD63XddrZrAhheYLuozQDnb1FifwkAcjCUjH3gLx7k7z9hTzusTe?cluster=devnet` |

On-chain outcome after settle: `{"home":{}}` — correctly derived from the
authenticated proof (Argentina, the home team, won 3-1), not asserted by
either wallet.

**What this proves vs. what it doesn't:** this confirms the full protocol
and SDK layer works correctly end-to-end for two genuinely independent
parties against real devnet. It does not substitute for a literal
browser-driven click-through with two separate wallet extensions — this
machine has no Chromium/Playwright available for that, so the actual
`apps/web` UI QA (connect wallet -> create -> join -> lock -> settle ->
claim) was run manually by the developer, not scripted. See
`docs/OPEN_QUESTIONS.md` for this distinction stated explicitly.
