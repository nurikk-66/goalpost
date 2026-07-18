# TxLINE feedback

Short, honest notes from building against TxLINE across the full hackathon
(Phases 0-4) — meant to be copy-pasted into the submission form's feedback
field.

## What worked well

- **The free World Cup tier is genuinely frictionless.** No purchase, no
  credit card, no commitment — just a guest JWT and an on-chain
  `subscribe(1, 4)` call that transfers 0 tokens. This mattered a lot for a
  time-boxed hackathon.
- **The on-chain validation instructions are real and callable, not a
  stub.** `validate_stat` / `validate_stat_v2` / `validate_stat_v3` are
  plain Anchor instructions with public discriminators — any program can
  CPI into them. That's the entire premise our submission is built on, and
  it held up under real, repeated on-chain use.
- **The public IDL + example repo (`github.com/txodds/tx-on-chain`) is
  enough to build against without an official SDK.** We hand-built our CPI
  instruction from the vendored IDL and it worked first try against real
  devnet.
- **The same client code works against the live API and a recorded/
  replayed feed**, since the REST/SSE response shapes are consistent — this
  let us build a fully repeatable demo (`apps/replay`) without depending on
  a live match being in progress at judging time.

## Friction points

- **Some doc pages omit required query parameters that the actual OpenAPI
  spec requires.** `/api/fixtures/batch-validation` needed both `epochDay`
  *and* `hourOfDay`, not just `epochDay` as the doc page implied; `/api/
  odds/validation` needed both `messageId` and `ts`. We only found this by
  cross-checking the full spec (`docs.yaml`) after the doc page's example
  didn't work — worth reconciling the doc pages against the spec.
- **The CPI's real compute-unit cost isn't documented anywhere we found.**
  `validate_stat_v2` needs ~1.4M compute units against Solana's 200,000
  default — we only discovered this by hitting "exceeded CUs meter" on real
  devnet and raising the budget until it passed. A note in the CPI
  integration docs would save every integrator this same trial-and-error.
- **"period" means two different things in the same API** — a prefix baked
  into stat *keys* (`1001` = home first-half goals) versus a `period` field
  on `ScoreStat` itself (`100` = the finalized full-time record). Easy to
  conflate; cost us real debugging time until we separated the two
  concepts explicitly in our own notes.
- **No official Anchor CPI crate for the txoracle program** — every
  integrator has to hand-build the CPI instruction (discriminator bytes +
  Borsh-encoded args) from the IDL themselves. A published crate (even
  unofficial/community) would remove a real barrier to building on top of
  TxLINE's on-chain verification.
- **The public devnet faucet is IP-rate-limited enough to be real friction
  under hackathon-day load** (many teams hitting it at once). Not TxLINE's
  fault directly, but worth acknowledging in devnet-onboarding docs, with
  wallet-to-wallet transfer suggested as a workaround for multi-wallet
  demos (what we ended up doing).

None of this blocked us — every issue above was solvable by cross-checking
the OpenAPI spec or the example repo, and the core mechanism (real,
CPI-callable, cryptographically-verified sports data on-chain) is exactly
what let this submission's core idea exist at all.
