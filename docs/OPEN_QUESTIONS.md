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
- **Why did the local solana-test-validator actually fail?** Never fully
  root-caused - see "Answered" below for what's known and why we stopped
  digging.
- **Test market PDAs use a random `market_type` (u8) to dodge collisions with
  previous CI runs' leftover on-chain state** (see "Answered": persistent
  devnet state). This is a real, if small (1/256), residual collision risk
  with a *previous* run's market - self-diagnosing ("already in use", not
  silently wrong) but not eliminated. A more thorough fix would have the
  test check-and-reuse an existing market instead of always trying to
  `init` one; not done given the random-slot fix was sufficient and the
  user set a 2-fix-cycle limit for this session.
## Answered

- **CI wallet ran out of SOL for the program deploy step (2026-07-14).** Run
  29307499455 failed with `insufficient funds for spend (2.10507288 SOL) +
  fee (0.00159 SOL)` at the `anchor test` deploy-before-test step. Checked
  directly via RPC: wallet balance was 2.0881832 SOL (down from ~5 SOL on
  2026-07-13, spent across many CI iterations at ~0.15-0.2 SOL/run in test
  fixtures); scanned for orphaned/unclosed buffer accounts to reclaim —
  found none, so nothing was lost to a failed deploy, it simply didn't have
  enough to attempt one. An Anchor program this size costs ~2.1 SOL to
  redeploy (rent-exempt reserve on the program data account). Devnet's
  public faucet was rate-limited when self-funding was attempted from this
  environment, so this needed the user's action: user topped up
  `4oRVRLrWtBAV9QVZSLXhb1edW9JTzMBBvz4uhiU4rRky` to 7.088 SOL, the failed
  job was rerun (`gh run rerun 29307499455 --failed`), and it completed
  successfully — 6/6 mocha assertions passing. See below for the
  compute-budget and CPI-revert questions this same run answered.
- **Does `validate_stat_v2` revert on a false/failed check, or return a value
  the caller must check?** Confirmed: it reverts with a genuine CPI `Err`.
  The wrong-result-rejected test genuinely executes the CPI (152.8s runtime,
  not a fast pre-CPI failure) and receives TxLINE's own `InvalidStatProof`
  back through the CPI boundary — our `txoracle::validate_stat_v2` helper's
  assumption was correct.
- **Does the `validate_stat_v2` CPI fit Solana's compute budget?** No, not at
  the default 200,000 CU — confirmed on real devnet with "exceeded CUs meter
  at BPF instruction" before the fix. Needs ~1.4M compute units, matching
  Phase 0's off-chain estimate exactly. Fixed by adding
  `ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 })` as a
  `preInstruction` on every client call to `settle`; the SDK (Phase 3) must
  do this for callers, not leave it to them.
- **Why did `settle`'s CPI into `validate_stat_v2` fail with "Unknown program
  6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J" against real devnet?**
  `Settle`'s `#[derive(Accounts)]` struct never listed the txoracle program
  itself — only `daily_scores_merkle_roots` — so Solana's runtime had no way
  to resolve/load that program when `invoke()` tried to jump into it. Fixed
  by adding a `txoracle_program: UncheckedAccount<'info>` (constrained via
  `#[account(address = txoracle::TXORACLE_PROGRAM_ID)]`) to `Settle`,
  threading it through `invoke()`'s account_infos list in
  `txoracle.rs::validate_stat_v2`, and passing it from the client. Standard
  pattern for CPI-ing into a program with no published Anchor crate
  (`token_program: Program<'info, Token>` gets the typed equivalent for free
  from `anchor-spl`; txoracle has no such wrapper).

  Corollary this also fixed: the "wrong-result-rejected" test previously
  passed for the wrong reason (same missing-account bug meant its settle()
  call failed before the CPI ever ran, not because it detected the tampered
  value) - tightened to assert the failure genuinely names a proof-rejection
  error, matching `/StatValidationFailed|InvalidStatProof/` (our own wrapper
  error or TxLINE's own real error name, both equally valid evidence of
  a genuine on-chain rejection), not just that *some* error was thrown.
  Once the CPI actually ran, it came back with TxLINE's own
  `InvalidStatProof` rather than our wrapper — confirming the CPI reaches
  TxLINE's real validation logic, not just our own account-resolution code.
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

  Consequence discovered while getting `anchor test` itself green: `anchor
  test` deploys the program to whatever cluster `[provider]` names
  *regardless* of `--skip-local-validator` (that flag only skips the local
  validator, not the deploy step) - so the very first devnet-direct run
  deployed `programs/goalpost` for real, making the planned manual Solana
  Playground deploy unnecessary (see `docs/DEPLOY.md`). It also means test
  fixtures now live on **persistent** real devnet state rather than a fresh
  ledger every run - market PDAs need care not to collide with a previous
  run's leftover accounts (see "Unanswered": random `market_type`).

  Getting from "program compiles" to "tests actually execute" surfaced a
  string of small, real, independently-diagnosed bugs, roughly in this
  order: `typescript` pinned to an incompatible `^7.0.2` (ts-mocha/ts-node
  predate its rewrite) → downgraded to 5.6.3; `import { BN } from
  "@coral-xyz/anchor"` fails under real Node ESM (named export not
  statically detected) → derive from the namespace import instead →
  *that* resolves to something that isn't a constructor → import `BN` from
  its own package (`bn.js`) directly; `__dirname` doesn't exist under ESM
  → `path.dirname(fileURLToPath(import.meta.url))`; `tsconfig.json`'s
  `"module": "CommonJS"` rejects `import.meta` outright → `"module"`/
  `"moduleResolution"`: `"NodeNext"`. None of these were toolchain or
  Solana issues - all Node ESM/CJS interop mismatches once the root
  `package.json`'s `"type": "module"` actually mattered for test execution.
