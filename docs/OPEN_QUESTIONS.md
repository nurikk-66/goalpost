# Open Questions

Running list of uncertain interfaces/decisions, per MASTER_PLAN.md working rules.
Update as answered.

## Unanswered

- **Does `settle` need `validate_fixture` in addition to `validate_stat_v2`?**
  `validate_stat_v2` proves a stat value against the daily scores Merkle root for a
  `fixture_id`; it does not independently prove the fixture itself (teams, kickoff
  time, competition) is the one our market claims it is. `validate_fixture` proves
  fixture metadata against the ten-daily fixtures root. Implemented as: skip it —
  `market.fixture_id` is fixed at `create_market` time and `settle` re-checks
  `fixture_summary.fixture_id == market.fixture_id` before the CPI, so a
  mismatched fixture_id is already rejected without needing a second CPI.
  Revisit if that reasoning doesn't hold up once CI actually runs it.
- **Full soccer stat-key table** beyond base keys 1–8 (goals/cards/corners) — PDF at
  `txodds.github.io/tx-on-chain/assets/txodds-soccer-feed-v1.1.pdf` not yet mirrored.
  Not blocking: keys 1–8 are enough for a home/draw/away market.
- **Does `validate_stat_v2` revert on a false/failed check, or return a value the
  caller must check?** Our `txoracle::validate_stat_v2` CPI helper assumes any
  failure surfaces as a CPI `Err`. Untestable without a real Anchor build —
  first thing the wrong-result-rejected test will confirm or disprove once CI runs.
- **Does the `validate_stat_v2` CPI fit Solana's compute budget** when called from
  inside our own `settle` instruction (our own Phase 0 recon needed a 1.4M compute
  unit budget just to simulate it off-chain)? See `docs/ARCHITECTURE.md` §3 for the
  fallback if not. First real signal will come from the CI run.
- **Program source is complete but has never been compiled** (no local
  Rust/Solana/Anchor toolchain in this environment - see
  `docs/TRUST_MODEL.md` "Status"). `.github/workflows/anchor-ci.yml` is the
  first real compiler/test pass; there may be straightforward syntax/type
  errors it surfaces that a local `cargo check` would normally catch first.

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
- **`validate_stat` (legacy) vs `validate_stat_v2`** — our real captured proof
  (`fixtures/samples/scores_stat_validation.json`, fetched with `?statKeys=1,2`)
  came back in the **V2** response shape (`statsToProve[]`/`statProofs[][]`), not
  legacy's singular `statToProve`. `settle` uses `validate_stat_v2` accordingly —
  see `docs/ARCHITECTURE.md` §3.
- **What does the `period` field on a `ScoreStat` actually mean?** Not the
  "period prefix" stat-key scheme from `docs/TXLINE_NOTES.md` §4 (that's a
  different mechanism, encoded into the *key*, e.g. `1001` = H1 goals). The real
  captured `game_finalised` record returns `period: 100` on its stats, matching
  `statusId: 100` — confirmed from real data, not docs prose. `settle` requires
  `period == 100` on both submitted stats. See `docs/TRUST_MODEL.md`.
- **REST JSON field names vs on-chain IDL field names for the same data** — they
  differ (`summary.eventStatsSubTreeRoot` in REST vs `events_sub_tree_root` in the
  IDL; `subTreeProof` in REST is the `fixture_proof` CPI argument). Mapped
  explicitly in `tests/goalpost.ts`'s `realSettleArgs()`. Will need the same
  mapping in `packages/sdk` (Phase 3).
