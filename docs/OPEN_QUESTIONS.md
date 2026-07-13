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
- **Why did the local solana-test-validator actually fail?** Never fully
  root-caused - see "Answered" below for what's known and why we stopped
  digging.
- **Devnet-direct test run not yet green** (see "Answered": pivot decision).
  Blocked on `programs/goalpost` actually being deployed to devnet - until
  then `anchor test --skip-local-validator` is expected to fail at whatever
  instruction first touches the program account (most likely
  `create_market`), with a program-not-found-style error, not a code bug.
  This is a real, external blocker, not something to guess around.
- **Does devnet-direct testing burn through the funded wallet's balance
  over many CI iterations?** Each full run creates a fresh mint + 2-3
  funded keypairs + market/position accounts (~0.15-0.2 SOL all in). Wallet
  had ~5 SOL as of 2026-07-13. Fine for now; revisit (refund the wallet, or
  add account-closing to reclaim rent) if it becomes a real constraint.

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
- **Local test-validator abandoned; pivoted to devnet-direct testing
  (2026-07-13).** After the program itself finally compiled clean (5 real
  fixes: `libudev-dev`, Node version, Solana CLI version, glob re-exports,
  `idl-build` feature), `anchor test` hit two different unrelated
  `solana-test-validator` startup failures in a row: first a clear panic
  (`UnspecifiedIpAddr(0.0.0.0)` in `solana_gossip::node::Node::new_with_external_ip`,
  fixed by pinning `bind_address`/`gossip_host` to `127.0.0.1`), then a
  second run where the validator process didn't even reach genesis (no
  `validator.log` at all) - a different failure mode, not obviously caused
  by the same fix or an obvious next one. Per a user-set hard limit (one
  diagnostic run + one fix attempt), stopped fighting the local validator
  rather than keep guessing. Switched to running `anchor test
  --skip-local-validator` directly against real devnet: the real TxLINE
  program and the real `daily_scores_merkle_roots` account are already
  there, so nothing needs cloning, and it sidesteps the local-validator
  startup problem entirely. Trade-off: real devnet latency instead of a
  local validator's near-instant blocks, and a real funded wallet is
  required (CI restores it from the `DEVNET_WALLET_SECRET_KEY` repo secret
  - the same wallet Phase 0 funded and used). See `docs/DEPLOY.md` and
  `Anchor.toml`.
