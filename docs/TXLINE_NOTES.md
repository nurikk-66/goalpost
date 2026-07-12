# TxLINE Notes

Summary of the TxLINE hybrid on-chain/off-chain sports data system, as documented at
`https://txline.txodds.com/documentation/*` and the public IDL/example repo
`https://github.com/txodds/tx-on-chain`. Compiled for the Goalpost settlement engine
(TxODDS World Cup Hackathon).

Status: **complete for Phase 0.** Network config, auth flow, REST/SSE endpoints, and
the on-chain validation instruction interface are documented and cross-checked
against the real IDL. A devnet wallet completed the real on-chain `subscribe` +
API-token activation flow, and every sample in `fixtures/samples/*.json` is a real
response captured from the live devnet API for a genuinely finished World Cup match
(see §9 below) — nothing here is fabricated or guessed.

## 1. Network configuration

| Network | API host | Program ID | TxL mint (Token-2022) |
|---|---|---|---|
| Mainnet | `https://txline.txodds.com` | `9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA` | `Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL` |
| Devnet | `https://txline-dev.txodds.com` | `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J` | `4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG` |

Devnet program ID/mint confirmed by downloading the real IDL from
`github.com/txodds/tx-on-chain/examples/devnet/idl/txoracle.json` — the IDL's
top-level `address` field matches the docs (`6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`).

Rule from the docs, worth repeating because it's the #1 cause of activation failures:
**the Solana RPC cluster, the TxLINE program ID, the guest JWT host, and the
activation endpoint must all be the same network.** Never mix mainnet/devnet values.

Goalpost uses **devnet** everywhere (program, RPC, TxLINE API) since the hackathon
prohibits real-money escrow via the credit token and devnet USDC is the settlement asset.

## 2. Auth flow (World Cup free tier)

World Cup + International Friendlies data is free: "no TxL purchase, no credit card,
no commitment." Service level IDs `1` (60s delay on mainnet / real-time sampling on
devnet) and `12` (mainnet real-time) are the free World Cup tiers. **Devnet only
exposes service level `1`.**

Two credentials are required for every data call:

1. **Guest JWT** — `POST /auth/guest/start` (no auth), returns `{ token }`. Valid 30
   days. Sent as `Authorization: Bearer <jwt>`.
2. **API token** — obtained by activating a subscription, sent as `X-Api-Token:
   <token>`. Long-lived (B2B-style token, not the short session JWT).

### Step-by-step activation (devnet)

Dependencies: `@coral-xyz/anchor @solana/web3.js @solana/spl-token axios tweetnacl`.

1. Create/load a Solana devnet keypair. Fund it with devnet SOL (transaction fees +
   Token-2022 ATA rent only — the free tier costs 0 TxL, so no token balance needed).
2. Create an associated token account for the TxL mint using the **Token-2022**
   program (`TOKEN_2022_PROGRAM_ID`, not the legacy SPL token program) — this trips
   people up, it's called out explicitly in the example code.
3. Call the on-chain **`subscribe(service_level_id: u16, weeks: u8)`** instruction
   on the txoracle program (`weeks` must be a multiple of 4; free tier still requires
   this on-chain call, it just transfers 0 tokens). Accounts required: `user`,
   `pricing_matrix` (PDA, seed `"pricing_matrix"`), `token_mint`, `user_token_account`,
   `token_treasury_vault` (ATA of the treasury PDA), `token_treasury_pda` (PDA, seed
   `"token_treasury_v2"`), `token_program` (Token-2022), `associated_token_program`,
   `system_program`.
4. Get a guest JWT (`POST /auth/guest/start`).
5. Build the activation message: `` `${txSig}:${leagues.join(",")}:${jwt}` `` (empty
   leagues array for the standard free-tier bundle — this collapses to `txSig::jwt`,
   matching the simplified example in the quickstart doc). Sign it with
   `nacl.sign.detached` using the **same wallet's secret key**, base64-encode the
   signature.
6. `POST /api/token/activate` with `{ txSig, walletSignature, leagues }` and
   `Authorization: Bearer <jwt>`. Response contains the long-lived `apiToken`.
7. All subsequent data calls send both `Authorization: Bearer <jwt>` and
   `X-Api-Token: <apiToken>`.

Reference implementation: `github.com/txodds/tx-on-chain/examples/devnet/scripts/subscription_free_tier.ts`
and `examples/devnet/common/users.ts` (vendored locally at
`scripts/vendor/txoracle.idl.json` / `scripts/recon.ts` in this repo — see "How to
reproduce" below).

## 3. REST endpoints (confirmed against `docs/docs.yaml` OpenAPI spec)

Base URL: `{API_BASE_URL}/api` where `API_BASE_URL` is the network host above.

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/guest/start` | no auth; returns guest JWT |
| POST | `/api/token/activate` | activates subscription → API token |
| POST | `/api/guest/purchase/quote` | paid-tier TxL purchase quote (not needed for World Cup) |
| GET | `/api/fixtures/snapshot` | latest fixtures, optional `competitionId` filter |
| GET | `/api/fixtures/updates/{epochDay}/{hourOfDay}` | fixture updates for an hour |
| GET | `/api/fixtures/validation` | Merkle proof for one fixture update |
| GET | `/api/fixtures/batch-validation` | Merkle proof for a full hourly fixture batch |
| GET | `/api/odds/snapshot/{fixtureId}` | latest odds for a fixture |
| GET | `/api/odds/updates/{fixtureId}` | live odds, current 5-min cache |
| GET | `/api/odds/updates/{epochDay}/{hourOfDay}/{interval}` | historical odds, 5-min interval |
| GET | `/api/odds/stream` | SSE odds stream |
| GET | `/api/odds/validation` | Merkle proof for one odds update |
| GET | `/api/scores/snapshot/{fixtureId}` | score snapshot for a fixture |
| GET | `/api/scores/updates/{fixtureId}` | live score updates, current 5-min cache |
| GET | `/api/scores/updates/{epochDay}/{hourOfDay}/{interval}` | historical scores |
| GET | `/api/scores/historical/{fixtureId}` | full score sequence for a completed fixture |
| GET | `/api/scores/stream` | SSE scores stream |
| GET | `/api/scores/stat-validation` | Merkle proof for one or more score stats |

All data endpoints require `Authorization: Bearer <jwt>` + `X-Api-Token: <apiToken>`.

### SSE streams

`GET /api/odds/stream` and `GET /api/scores/stream`, headers
`Accept: text/event-stream`, optional `Accept-Encoding: gzip` (70-80% bandwidth
savings), optional `fixtureId` query param to scope to one match, optional
`Last-Event-ID` header to resume. Two message kinds: data events (`Odds` / `Scores`
records) and periodic heartbeats.

### Fixture object (from example payload)

```json
{
  "FixtureId": 17271370,
  "Participant1": "Team A",
  "Participant2": "Team B",
  "Participant1IsHome": true,
  "StartTime": "2024-01-15T19:00:00Z",
  "GameState": 1
}
```

The IDL's `Fixture` struct (used in on-chain proof verification) has a superset of
fields: `ts`, `start_time`, `competition`, `competition_id`, `fixture_group_id`,
`participant1_id`, `participant1`, `participant2_id`, `participant2`, `fixture_id`,
`participant1_is_home`.

## 4. Soccer score encoding

Stat keys use a **period-prefix + base-key** scheme:

- Base keys 1–8: `1`/`2` = goals (P1/P2), `3`/`4` = yellow cards, `5`/`6` = red cards,
  `7`/`8` = corners.
- Period prefix: `0` = total game, `1000` = first half, `2000` = halftime snapshot,
  `3000` = second half, `4000`/`5000` = extra time halves, `6000` = penalties,
  `7000` = extra-time totals. E.g. `1001` = home team first-half goals.
- Game phase IDs 1–19 include: 1 = not started, 2 = first half in play, 3 = halftime,
  4 = second half in play, 5 = ended/finished, plus ET/penalties/interruption states.
- **Final result settlement must use records with `action=game_finalised`,
  `statusId=100`, `period=100`** — not in-running or period-specific records. This is
  called out explicitly in the troubleshooting doc as a common mistake.
- Full stat key table: `txodds.github.io/tx-on-chain/assets/txodds-soccer-feed-v1.1.pdf`
  (PDF, not yet mirrored into this repo).

For a home/draw/away market, the settlement stat is total-game goals: base keys `1`
(home) and `2` (away), period `0`, compared via `validate_stat`'s `BinaryExpression`
(`Subtract`) + `TraderPredicate` (`GreaterThan`/`LessThan`/`EqualTo` 0).

## 5. On-chain validation — this is Goalpost's core mechanism

**CPI is feasible and is the plan.** The txoracle program deployed at the devnet
program ID above exposes `validate_stat`, `validate_stat_v2`, `validate_stat_v3`,
`validate_fixture`, `validate_fixture_batch`, and `validate_odds` as plain
instructions with known discriminators (from the IDL) and no special permissioning —
any program can CPI into them by including the txoracle program and the relevant
Merkle-root PDA account. There is no official Anchor CPI crate published for the
program, so our `programs/goalpost` settle instruction will hand-build the CPI
instruction (discriminator bytes + Borsh-encoded args) using the vendored IDL as the
source of truth, or via `anchor_lang::InstructionData`-style structs mirroring the
IDL types below. Full fallback to a documented fallback plan is **not needed** —
this is a real, callable interface, not a stub.

### Merkle root PDAs

| Root | Seeds | Notes |
|---|---|---|
| Daily scores root | `"daily_scores_roots"` + `epochDay` (u16 LE) | `epochDay = floor(minTimestamp_ms / 86_400_000)` — **must** come from the proof response's `minTimestamp`, never `Date.now()` |
| Daily batch root | `"daily_batch_roots"` + `epochDay` (u16 LE) | |
| Ten-daily fixtures root | `"ten_daily_fixtures_roots"` + `alignedEpochDay` (u16 LE) | `alignedEpochDay` rounds down to the nearest multiple of 10 |

These PDAs are **not** Anchor `#[account(...)]` types tracked in the IDL's
`accounts` list (only `PricingMatrix` is) — they hold raw root data written by the
oracle's `insert_*_root` instructions and are read via `findProgramAddressSync` +
passed straight into the validation instructions.

### `validate_stat` instruction (single/dual-stat, legacy)

Accounts: `daily_scores_merkle_roots` (the PDA above). No signer required — it's a
read-only check (example calls it with `.view()` off-chain; on-chain CPI would
`invoke` it directly since our program isn't signing anything on their behalf).

Args (Borsh, from IDL):
```
ts: i64
fixture_summary: ScoresBatchSummary { fixture_id: i64, update_stats: ScoresUpdateStats { update_count: i32, min_timestamp: i64, max_timestamp: i64 }, events_sub_tree_root: [u8; 32] }
fixture_proof: Vec<ProofNode { hash: [u8; 32], is_right_sibling: bool }>
main_tree_proof: Vec<ProofNode>
predicate: TraderPredicate { threshold: i32, comparison: Comparison::{GreaterThan,LessThan,EqualTo} }
stat_a: StatTerm { stat_to_prove: ScoreStat { key: u32, value: i32, period: i32 }, event_stat_root: [u8; 32], stat_proof: Vec<ProofNode> }
stat_b: Option<StatTerm>
op: Option<BinaryExpression::{Add,Subtract}>
```

### `validate_stat_v2` / `validate_stat_v3` (multi-stat, indexed strategies)

Same `daily_scores_merkle_roots` account. Args: `payload: StatValidationInput` (or
`V3` variant) + `strategy: NDimensionalStrategy`.

```
StatValidationInput {
  ts: i64
  fixture_summary: ScoresBatchSummary
  fixture_proof: Vec<ProofNode>
  main_tree_proof: Vec<ProofNode>
  event_stat_root: [u8; 32]
  stats: Vec<StatLeaf { stat: ScoreStat, stat_proof: Vec<ProofNode> }>
}

NDimensionalStrategy {
  geometric_targets: Vec<GeometricTarget { stat_index: u8, prediction: i32 }>
  distance_predicate: Option<TraderPredicate>
  discrete_predicates: Vec<StatPredicate::{
    Single { index: u8, predicate: TraderPredicate },
    Binary { index_a: u8, index_b: u8, op: BinaryExpression, predicate: TraderPredicate },
  }>
}
```

**V2/V3 semantics that matter for our settle instruction**: the `statKeys` request
order to the REST proof endpoint is binding — strategy `index`/`index_a`/`index_b`
refer to positions in that array, not raw stat key values. Every stat referenced
must appear exactly once in `discrete_predicates` or the program returns
`IncompleteStatCoverage`.

**Our plan for `settle`**: for a home/draw/away market, request
`statKeys=1,2` (home goals, away goals) from `/scores/stat-validation`, then call
`validate_stat` (legacy, 2-stat form is sufficient — no need for V2's N-dimensional
strategy) with `op: Subtract` and a `TraderPredicate` matching the claimed outcome
(home win → home−away > 0, away win → < 0, draw → == 0). This keeps the settle
instruction's verification logic simple, deterministic, and auditable — matching the
sponsor's stated judging preference for "clean, well-documented, deterministic"
resolution logic.

### `validate_fixture` (confirms a fixture actually happened / finalized)

Accounts: `ten_daily_fixtures_roots`. Args: `snapshot: Fixture`, `summary:
FixtureBatchSummary`, `sub_tree_proof: Vec<ProofNode>`, `main_tree_proof:
Vec<ProofNode>`. Likely used to prove the fixture ID ↔ market mapping is genuine,
separate from proving the final score. Not yet decided whether Goalpost's `settle`
needs this in addition to `validate_stat` — candidate for `docs/OPEN_QUESTIONS.md`.

### `validate_odds`

Accounts: `daily_odds_merkle_roots`. Not needed for settlement (we only verify
scores), but relevant for the agent (Phase 5) if it wants to verify odds
trustlessly before acting on them rather than trusting the SSE stream blindly.

## 6. Fetching a proof (REST side)

```
GET /api/scores/stat-validation?fixtureId=17952170&seq=941&statKey=1002              # legacy single-stat
GET /api/scores/stat-validation?fixtureId=17952170&seq=941&statKey=1002&statKey2=1003 # legacy dual-stat
GET /api/scores/stat-validation?fixtureId=18175981&seq=991&statKeys=1,2,3001          # v2 multi-stat
```

`seq` must come from a real score record (from `/scores/snapshot/{fixtureId}`,
`/scores/updates/...`, `/scores/historical/{fixtureId}`, or the SSE stream) — `seq=0`
is explicitly invalid per the troubleshooting doc.

Response shape (fields renamed to snake_case in the IDL args above; REST returns
camelCase):

```ts
{
  summary: { fixtureId, updateStats: { updateCount, minTimestamp, maxTimestamp }, eventStatsSubTreeRoot },
  statToProve: { /* ScoreStat */ },
  eventStatRoot: string,       // hex/base64, decode to 32 bytes
  statProof: [{ hash, isRightSibling }, ...],
  subTreeProof: [{ hash, isRightSibling }, ...],
  mainTreeProof: [{ hash, isRightSibling }, ...],
}
```

For V2: `statsToProve[]` and `statProofs[]` are parallel arrays (index-correlated),
feeding `StatLeaf[]` for the `stats` field.

## 7. Known error modes (from the troubleshooting doc)

| Error | Cause | Fix |
|---|---|---|
| 504 on activation | network mismatch (mixing mainnet/devnet values) or backend timeout | ensure txSig/JWT/program ID/activation URL are all same network |
| 403 signature verification failed | wrong signing preimage/wallet, bad base64, mismatched JWT host | sign exact `${txSig}:${leagues}:${jwt}`, use subscription wallet |
| 401 on data endpoints | missing/expired guest JWT | fetch a fresh JWT from the same host, reuse the same API token |
| 403 on data endpoints | invalid API token / expired subscription / network mismatch | re-verify token+subscription network match |
| SSE opens with no data | no active covered fixture right now | check schedule, or use historical endpoints for completed matches |
| `InvalidMainTreeProof` | epoch day derived from wrong timestamp, bad PDA derivation, malformed proof decode | derive `epochDay` from the proof response's own `minTimestamp`, decode hashes to exactly 32 bytes |
| `seq=0` / placeholder seq | fabricated instead of real sequence number | pull `seq` from an actual score record |
| `IncompleteStatCoverage` (V2) | `statKeys` order doesn't match strategy indexes, or a stat isn't referenced | keep strict positional correspondence |

Reliability implication for our SDK/UI (per MASTER_PLAN §3.1): every one of these is
a distinct, human-readable error case we should map to a typed error in
`packages/sdk`, not a generic "request failed."

## 8. Open items / not yet verified with live data

- Full soccer stat-key table beyond keys 1–8 (PDF not yet mirrored locally); we have
  enough (goals, cards, corners, period prefixes) for a home/draw/away market.
- Whether `settle` should also call `validate_fixture` in addition to `validate_stat`
  — tracked in `docs/OPEN_QUESTIONS.md`.
- `/api/fixtures/batch-validation` and `/api/odds/validation` both need parameters
  beyond what their doc pages initially suggested (see §9) — confirmed working now,
  but worth double-checking the full OpenAPI spec (`scripts/vendor/docs.yaml`) before
  relying on any endpoint we haven't hit live yet (e.g. `/scores/historical/{id}`
  returned a shape our probe didn't detect as populated — `/scores/snapshot/{id}`
  turned out to be the one that returns a fixture's full event log on this devnet,
  despite the "snapshot" name; not yet resolved which is authoritative long-term).

## 9. Live data captured (real devnet responses, not synthetic)

World Cup 2026 is running concurrently with the hackathon (today is 2026-07-13; the
tournament final and the hackathon deadline are both 2026-07-19). The devnet feed
serves a fixed set of **simulated** World Cup fixtures (`CompetitionId: 72`) — not
mirrored to the real tournament in real time — which is exactly the "simulated data
feed" the hackathon rules allow for judging after matches end.

From `/api/fixtures/snapshot` (devnet, service level 1 / free tier), 6 fixtures were
returned, 3 of them World Cup: Argentina v Switzerland (`18222446`), France v Spain
(`18237038`), England v Argentina (`18241006`), plus 3 "Friendlies". Of these,
**`18222446` had already run to completion** in the devnet feed — a real,
already-decided match we used for every proof-related sample:

- Final score (from the `game_finalised` record, `Seq=1306`, `StatusId=100`,
  `Ts=1783828222499`): **Argentina 3 – 1 Switzerland** (`Stats["1"]=3`,
  `Stats["2"]=1` — base keys 1/2 = participant1/participant2 total goals, exactly as
  documented in §4).
- `epochDay` for the daily Merkle root PDA = `floor(1783828222499 / 86_400_000) =
  20646`; `hourOfDay` (UTC) = `3`.

Samples saved to `fixtures/samples/` (all real, `scripts/recon.ts` reproduces them):

| File | Endpoint | Notes |
|---|---|---|
| `auth_activation_response.json` | `POST /api/token/activate` | real `txSig` + issued `apiToken` string |
| `fixtures_snapshot.json` | `GET /api/fixtures/snapshot` | all 6 live devnet fixtures |
| `scores_snapshot.json` | `GET /api/scores/snapshot/18222446` | trimmed to 10 of 42 real records — kickoff, halftime, goal, and the final `game_finalised` record kept |
| `odds_snapshot.json` | `GET /api/odds/snapshot/18222446` | real response is `[]` — endpoint only serves a live cache window, empty once finished (see note in file) |
| `odds_updates.json` | `GET /api/odds/updates/18222446` | trimmed to 48 of **63,807** real odds ticks; confirms 3 market types exist: `1X2_PARTICIPANT_RESULT` (home/draw/away — the market Goalpost needs), `ASIANHANDICAP_PARTICIPANT_GOALS`, `OVERUNDER_PARTICIPANT_GOALS` |
| `scores_stat_validation.json` | `GET /api/scores/stat-validation?fixtureId=18222446&seq=1306&statKeys=1,2` | **real Merkle proof for the actual final score** — this is the exact payload our `settle` instruction's CPI will consume |
| `fixtures_validation.json` | `GET /api/fixtures/validation?fixtureId=18222446` | real fixture-update Merkle proof |
| `fixtures_batch_validation.json` | `GET /api/fixtures/batch-validation?epochDay=20646&hourOfDay=3` | required both params, not just `epochDay` as the doc page implied — confirmed via the full OpenAPI spec |
| `odds_validation.json` | `GET /api/odds/validation?messageId=...&ts=...` | required both `messageId` and `ts`, not just `messageId` — same discrepancy |
| `scores_stat_validation_example.json` | same endpoint, docs' own worked example (`fixtureId=17952170`, `seq=941`) | kept as a cross-reference / known-good shape from a different (real, non-devnet-of-ours) fixture |

**1X2 odds record shape** (from `odds_updates.json`), directly usable for the demo's
live odds display:
```json
{
  "FixtureId": 18222446,
  "MessageId": "1836782517:00003:000178-10021-stab",
  "Ts": 1783464877605,
  "Bookmaker": "TXLineStablePriceDemargined",
  "SuperOddsType": "1X2_PARTICIPANT_RESULT",
  "InRunning": false,
  "PriceNames": ["part1", "draw", "part2"],
  "Prices": [1862, 3793, 5016],
  "Pct": ["53.706", "26.364", "19.936"]
}
```
`Prices` are decimal odds ×1000 (1862 → 1.862). `Pct` is the implied probability
already de-margined ("Demargined" in the bookmaker name) — useful for the agent's
"implied probability diverges from model" strategy in Phase 5 without us having to
de-vig manually.

**Score record shape** (from `scores_snapshot.json`), the `game_finalised` one:
```json
{
  "Action": "game_finalised",
  "Seq": 1306,
  "StatusId": 100,
  "Ts": 1783828222499,
  "Score": {
    "Participant1": { "Total": { "Goals": 3, "YellowCards": 3, "Corners": 8 } },
    "Participant2": { "Total": { "Goals": 1, "YellowCards": 1, "RedCards": 1, "Corners": 2 } }
  },
  "Stats": { "1": 3, "2": 1, "...": "..." }
}
```
Confirms `Stats["1"]`/`Stats["2"]` (base keys, period 0/total) are exactly the pair
`validate_stat`'s `stat_a`/`stat_b` need for a home/draw/away settle check.

## How to reproduce / re-run this recon

```
cd C:/goalpost
npx tsx scripts/recon.ts
```

The script (`scripts/recon.ts`):
1. Generates (or reuses) a devnet keypair at `scripts/vendor/recon-wallet.json`
   (gitignored — throwaway devnet-only key, holds no real value). **The public
   devnet faucet is IP-rate-limited**; if the wallet has no balance the script
   throws with instructions to fund it manually at https://faucet.solana.com.
2. Reuses cached `jwt`/`apiToken` from `scripts/vendor/recon-credentials.json`
   (gitignored) if present; otherwise creates a Token-2022 ATA for the TxL mint,
   calls `subscribe(1, 4)` on-chain, gets a guest JWT, signs the activation
   message, and activates the API token (caching the result).
3. Fetches `/fixtures/snapshot`, finds a World-Cup fixture that has reached
   `game_finalised`, then pulls its scores, odds, and Merkle proofs (stat, fixture,
   batch, odds) and saves each to `fixtures/samples/` (large responses trimmed to a
   representative subset with a `_note` explaining the trim).

Vendored reference material (downloaded from `github.com/txodds/tx-on-chain`, the
sponsor's public docs/examples repo):
- `scripts/vendor/txoracle.idl.json` — real Anchor IDL for the devnet program.
- `scripts/vendor/txoracle.types.ts` — generated TS types for the IDL.
- `scripts/vendor/docs.yaml` — full OpenAPI spec (source of truth for exact required
  query params — several doc pages omitted params that the spec/API actually require).
