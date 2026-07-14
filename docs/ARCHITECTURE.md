# Goalpost — Program Architecture (Phase 2 design)

Design for `programs/goalpost`, written ahead of the actual Rust implementation
so Phase 2 can move straight to coding once the Solana/Anchor toolchain is
installed. Grounded in the real TxLINE interface documented in
`docs/TXLINE_NOTES.md` (IDL, real captured proof in
`fixtures/samples/scores_stat_validation.json`) — nothing here is speculative
about what TxLINE exposes, only about how our program uses it.

**Verified (2026-07-14) against real devnet, not just design**: CPI compute
cost (`validate_stat_v2` needs ~1.4M compute units — client must set
`ComputeBudgetProgram.setComputeUnitLimit` before calling `settle`) and
`validate_stat_v2` does revert (CPI `Err`) on a failed predicate, surfaced as
TxLINE's own `InvalidStatProof`. All 4 required tests pass live on devnet
(`6e6iXff86RZ6ryB7TeJSdn4GfGNDM5xtRz9h1oBQzLNr`) — see `docs/TRUST_MODEL.md`
"Status" for the full result.

## 1. State machine & accounts

### `Market` (PDA)

Seeds: `["market", fixture_id: u64 LE, market_type: u8]`. Keying on
`market_type` too (not just `fixture_id`) is the "extensible" hook from
MASTER_PLAN §1 — a future spread/props market on the same fixture gets its own
Market account for free, no schema change needed.

```rust
pub struct Market {
    pub fixture_id: u64,         // TxLINE FixtureId
    pub market_type: u8,         // 0 = HomeDrawAway (only variant for v1)
    pub status: MarketStatus,    // Open | Locked | Settled | Claimed
    pub outcome: Option<Outcome>,// set at settle time; None until then
    pub creator: Pubkey,         // record-keeping only, no special privilege
    pub mint: Pubkey,            // devnet USDC mint (see §5)
    pub vault: Pubkey,           // market PDA's own ATA for `mint`
    pub lock_time: i64,          // unix ts; joins close at/after this
    pub total_home: u64,
    pub total_draw: u64,
    pub total_away: u64,
    pub participant_count: u32,
    pub claimed_count: u32,
    pub settled_at: Option<i64>,
    pub settlement_epoch_day: u32,   // for the verification receipt panel
    pub settlement_home_goals: i32,
    pub settlement_away_goals: i32,
    pub bump: u8,
}

pub enum MarketStatus { Open, Locked, Settled, Claimed }
pub enum Outcome { Home, Draw, Away }
```

`status: Claimed` is a cosmetic terminal state (`claimed_count ==
participant_count`) for the UI, not a security boundary — double-claim
protection lives on `Position.claimed`, not `Market.status`.

### `Position` (PDA)

Seeds: `["position", market: Pubkey, participant: Pubkey]`. One position per
wallet per market — a wallet backs exactly one outcome per market (no
same-market hedging; keeps settlement math and the UI simple, matches the
"clean, deterministic" judging note).

```rust
pub struct Position {
    pub market: Pubkey,
    pub participant: Pubkey,
    pub outcome: Outcome,
    pub amount: u64,     // cumulative stake, base units
    pub claimed: bool,
    pub bump: u8,
}
```

`join()` is `init_if_needed`: a second `join()` call from the same wallet on
the same market tops up `amount` rather than failing, but rejects a different
`outcome` than the one already recorded (`OutcomeMismatch` error) — no
after-the-fact hedging.

### Vault

The market's own associated token account (`mint` = devnet USDC, owner =
Market PDA). No separate vault PDA/bump needed — the Market PDA is both the
market's identity and the vault's authority, so `claim()`'s outbound transfer
signs with the Market PDA's seeds.

## 2. Instructions

| Instruction | Signer | Effect |
|---|---|---|
| `create_market(fixture_id, market_type, lock_time)` | creator (pays rent) | inits `Market` + its vault ATA, `status = Open` |
| `join(outcome, amount)` | participant | transfers `amount` USDC participant → vault; inits/tops-up `Position`; updates pool totals |
| `lock_market()` | anyone, permissionless | `Open → Locked`, only once `clock.unix_timestamp >= lock_time` |
| `settle(...)` | anyone, permissionless | CPI-verifies the real match result, computes `Outcome` itself, `Locked → Settled` |
| `claim()` | participant (must own the `Position`) | pays out (or refunds), `Position.claimed = true` |

No instruction has an admin/authority signer beyond the acting party
themselves — see `docs/TRUST_MODEL.md` (written once the program is deployed
and this is verified against the real binary, not just the design).

## 3. `settle` — the core mechanism

**Design decision: the program computes the outcome itself from
cryptographically-proven stat values; it never trusts a caller-supplied
"this is a home win" claim.**

Reasoning: `validate_stat_v2`'s Merkle proof authenticates the exact `value`
inside each `StatLeaf.stat` (a caller can't lie about the value — a wrong
value fails to reconstruct the real on-chain root; the wrong-result-rejected
test in `tests/goalpost.ts` exercises exactly this). V2 also requires every
stat passed in `payload.stats` to be referenced by exactly one predicate in
`strategy.discrete_predicates` or it rejects with `IncompleteStatCoverage` —
but instead of using that predicate to assert a specific outcome (which
would mean trusting whichever outcome the transaction's sender chose to
assert), we pass a single `Binary` predicate that's structurally always-true
(`threshold: -999_999, comparison: GreaterThan` on the home−away
subtraction — true for any realistic scoreline), purely to satisfy V2's
coverage requirement. The predicate is a no-op by design; **we derive
`Outcome` ourselves**, in our own instruction, by comparing the two
authenticated values directly:

```rust
let outcome = match home_goals.cmp(&away_goals) {
    Greater => Outcome::Home,
    Less => Outcome::Away,
    Equal => Outcome::Draw,
};
```

This is more auditable than trusting a claimed outcome + predicate match, and
it's exactly the "clean, well-documented, deterministic resolution logic" the
sponsor's docs call out as what judges value.

### Wiring (real, implemented — matches the captured proof exactly)

Confirmed against the actual captured proof
(`fixtures/samples/scores_stat_validation.json`, requested via
`?statKeys=1,2`, i.e. the **V2** REST shape) rather than assumed from the
docs pages alone:

1. Caller supplies the full `StatValidationInput` for the two stats: stat
   key `1` (home total goals) and `2` (away total goals), **`period == 100`**
   on both — not `0`. The generic "period prefix" scheme in
   `docs/TXLINE_NOTES.md` §4 (`0` = total game, `1000` = first half, …)
   describes how *stat keys* like `1001` encode a period; the separate
   `period` *field* on `ScoreStat` is a different signal entirely — it's
   TxLINE's own marker for which record the value came from, and `100` is
   what a real `game_finalised` record actually returns (confirmed directly
   from the captured sample, not the docs prose). `settle` requires
   `period == 100` explicitly — see `docs/TRUST_MODEL.md` for why this
   matters (without it, any real-but-non-final scoreline could settle a
   market).
2. Program derives `epoch_day = ts / 86_400_000` and the
   `daily_scores_merkle_roots` PDA (seeds `["daily_scores_roots", epoch_day:
   u16 LE]`, owned by the **TxLINE program**, not ours) — verified as a real
   devnet account (`FtnZq4V8mp56GUNEGGXfL1MuyT81cvoz59yeKn192HdH` for our
   captured match's epoch day, 20646) during design, and cloned into the
   local test validator for `anchor test` (see `Anchor.toml`).
3. Program asserts `fixture_summary.fixture_id == market.fixture_id` *before*
   the CPI (cheap, avoids wasting compute on a proof for the wrong match).
4. CPI into TxLINE's `validate_stat_v2` (devnet program
   `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`, discriminator
   `[208,215,194,214,241,71,246,178]` from the real IDL), passing the
   `daily_scores_merkle_roots` account plus the payload/strategy above. The
   `Settle` accounts struct also lists the txoracle program itself
   (`txoracle_program`, constrained via `address =
   txoracle::TXORACLE_PROGRAM_ID`) — without it, Solana's runtime can't
   resolve the CPI target at all (`invoke()` fails with "Unknown program
   ...", not a proof-verification error; this was the actual bug behind
   `anchor test`'s first real failures against live devnet — see
   `docs/OPEN_QUESTIONS.md`). There's no published Anchor CPI crate for
   txoracle, so this is a plain `UncheckedAccount` with an address
   constraint rather than the typed `Program<'info, T>` wrapper
   `token_program` gets for free from `anchor-spl`.
5. On CPI success: compute `Outcome` as above, write `market.outcome`,
   `settlement_home_goals`/`settlement_away_goals`,
   `settlement_epoch_day`, `settled_at`, `status = Settled`.
6. On CPI failure: propagate the error; market stays `Locked`, retriable by
   anyone with a valid proof (transient failures cost only the tx fee, not
   funds).

**REST-vs-IDL naming gotcha** (worth remembering for the SDK in Phase 3): the
REST proof endpoint's JSON uses different field names than the on-chain IDL
for the same data — `summary.eventStatsSubTreeRoot` (REST) is
`events_sub_tree_root` (IDL/Rust) / `eventsSubTreeRoot` (Anchor TS client);
`subTreeProof` (REST) is the `fixture_proof` argument; `mainTreeProof` maps
straight across to `main_tree_proof`. `tests/goalpost.ts`'s `realSettleArgs()`
does this mapping explicitly and is the reference implementation for it.

**Open risk, not yet verified (needs CI)**: our own Phase 0 recon script
needed `ComputeBudgetProgram.setComputeUnitLimit(1_400_000)` just to
*simulate* `validate_stat_v2` off-chain. A real on-chain CPI from inside
`settle()` adds our own instruction's overhead on top of that. If it doesn't
fit Solana's compute budget, the fallback is splitting proof verification
across multiple instructions/transactions — decide once
`.github/workflows/anchor-ci.yml` actually measures it, don't pre-optimize.

**Not yet decided**: whether to also CPI `validate_fixture` (proves the
fixture metadata itself, not just the stat) — see `docs/OPEN_QUESTIONS.md`
and `docs/TRUST_MODEL.md`. Current implementation: skipped for v1, because
`market.fixture_id` is already fixed at `create_market` time and
`validate_stat_v2`'s own `fixture_summary.fixture_id` check (step 3 above)
already binds the proof to the right match.

## 4. `claim` — payout math

Pari-mutuel, no house edge: every loser's stake is redistributed to winners
proportional to their stake in the winning pool.

```rust
let total_pool = market.total_home + market.total_draw + market.total_away;
let winning_pool = match market.outcome {
    Home => market.total_home,
    Draw => market.total_draw,
    Away => market.total_away,
};

let payout = if winning_pool == 0 {
    // Nobody backed the winning outcome (e.g. everyone bet home/away, result
    // was a draw). Documented rule, not a silent edge case: full refund to
    // everyone rather than stuck funds.
    position.amount
} else {
    require!(position.outcome == market.outcome, NothingToClaim);
    (position.amount as u128)
        .checked_mul(total_pool as u128)?
        .checked_div(winning_pool as u128)? as u64
};
```

Checked math throughout (`checked_mul`/`checked_div`, u128 intermediate to
avoid overflow), per MASTER_PLAN §3.1. Transfer signs with the Market PDA's
seeds (`invoke_signed`); destination must be the claiming participant's own
token account (enforced via Anchor account constraints, not a
caller-supplied address) so the CPI can't be redirected.

## 5. Devnet USDC

Recommendation: **mint our own devnet SPL token** ("Goalpost Demo USDC",
symbol `dUSDC`, 6 decimals, mint authority = our deployer wallet) rather than
depending on a third-party devnet USDC faucet. Phase 0 already hit a real
rate-limited/dry public faucet for plain SOL — a shared USDC faucet is a
worse dependency to build a demo around. Minting our own means we can fund
every demo/test wallet on demand, with no external liquidity risk, and it's
honestly labeled as demo money (not pretending to be a "real" USDC on devnet,
which doesn't meaningfully exist anyway). Document the exact mint address in
`docs/TRUST_MODEL.md` once created (`spl-token create-token`, Phase 2
execution).

## 6. The 4 required tests (MASTER_PLAN §3.1)

All four use the real captured devnet data from Phase 0
(`fixtures/samples/scores_stat_validation.json` — Argentina 3–1 Switzerland,
`fixtureId=18222446`, home win):

1. **Happy path**: `create_market` → two wallets `join` (one backs Home, one
   backs Away) → `lock_market` → `settle` with the real proof → Home-backer
   `claim`s the full pool (proportional payout, `winning_pool` = their own
   stake since they're the only Home backer) → Away-backer's `claim` fails
   with `NothingToClaim`.
2. **Wrong-result rejected**: `settle` called with a tampered stat value
   (home goals = 99 instead of the real 3) against the real Merkle proof
   nodes → CPI fails to reconstruct the true root → `settle` instruction
   fails, `Market.status` stays `Locked`.
3. **Double-claim rejected**: winning wallet calls `claim` twice → second
   call fails, `Position.claimed` already `true`.
4. **Non-participant claim rejected**: a wallet that never called `join`
   calls `claim` → fails because no `Position` PDA exists at that wallet's
   derived seeds (account-not-found / seeds constraint violation, not a
   soft/logical check we could get wrong).

## 7. What's still open

Source is complete (`programs/goalpost/src/`, `tests/goalpost.ts`); nothing
has actually run yet. Tracked in `docs/OPEN_QUESTIONS.md`:
- **`anchor build`/`anchor test` haven't executed anywhere yet** — pending
  the first GitHub Actions CI run (`.github/workflows/anchor-ci.yml`).
- `validate_stat_v2` revert-on-false vs. return-value-to-check (our CPI
  helper assumes "any failure is a CPI `Err`"; the wrong-result-rejected test
  is exactly what would catch this assumption being wrong).
- CPI compute budget fit inside `settle`.
- Whether to also CPI `validate_fixture` (currently: no, see §3).
- A scripted devnet end-to-end run — blocked on a manual deploy via Solana
  Playground (see `docs/TRUST_MODEL.md` "Status").
