# Open Questions

Running list of uncertain interfaces/decisions, per MASTER_PLAN.md working rules.
Update as answered.

## Unanswered

- **Does `settle` need `validate_fixture` in addition to `validate_stat`?**
  `validate_stat` proves a stat value against the daily scores Merkle root for a
  `fixture_id`; it does not independently prove the fixture itself (teams, kickoff
  time, competition) is the one our market claims it is. `validate_fixture` proves
  fixture metadata against the ten-daily fixtures root. Current design lean (see
  `docs/ARCHITECTURE.md` §3): skip it for v1 — `market.fixture_id` is fixed at
  `create_market` time and `settle` re-checks `fixture_summary.fixture_id ==
  market.fixture_id` before the CPI, so a mismatched fixture_id is already
  rejected without needing a second CPI. Revisit if that reasoning doesn't hold
  up once implemented.
- **Full soccer stat-key table** beyond base keys 1–8 (goals/cards/corners) — PDF at
  `txodds.github.io/tx-on-chain/assets/txodds-soccer-feed-v1.1.pdf` not yet mirrored.
  Not blocking: keys 1–8 are enough for a home/draw/away market.
- **Exact `validate_stat` CPI field wiring** (which arg maps to which proof array)
  — needs the real toolchain to test against `fixtures/samples/scores_stat_validation.json`.
- **Does `validate_stat` revert on a false predicate, or return a bool the caller
  must check?** Determines error-handling shape in `settle`. Untestable without
  a real Anchor build; first thing to check empirically in Phase 2.
- **Does the `validate_stat` CPI fit Solana's compute budget** when called from
  inside our own `settle` instruction (our own recon needed a 1.4M compute unit
  budget just to simulate it off-chain)? See `docs/ARCHITECTURE.md` §3 for the
  fallback if not.

## Answered

- **Is CPI into on-chain validation feasible?** Yes. `validate_stat` /
  `validate_stat_v2` / `validate_stat_v3` are plain instructions on a deployed
  devnet program (`6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`) with a public IDL,
  no signer/permission requirement beyond passing the right Merkle-root PDA. No
  fallback-to-off-chain-verification plan needed. See `docs/TXLINE_NOTES.md` §5.
- **Which token for escrow?** Devnet USDC, per MASTER_PLAN constraint (TxL credit
  token cannot be used for wagering/P2P transfers).
- **Exact World Cup `competitionId`** — confirmed `72` from a live
  `/fixtures/snapshot` response. See `docs/TXLINE_NOTES.md` §9.
- **Odds record shape** — confirmed from a real `/odds/updates/{fixtureId}` sample:
  3 market types exist (`1X2_PARTICIPANT_RESULT`, `ASIANHANDICAP_PARTICIPANT_GOALS`,
  `OVERUNDER_PARTICIPANT_GOALS`); `1X2_PARTICIPANT_RESULT` is the home/draw/away
  market Goalpost needs. `Prices` are decimal odds ×1000; `Pct` is already
  de-margined implied probability. See `docs/TXLINE_NOTES.md` §9.
