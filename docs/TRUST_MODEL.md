# Trust Model

What `programs/goalpost` actually checks on-chain, and what it deliberately
does not. Written against the real implementation in `programs/goalpost/src/`
(not just the design) — see `docs/ARCHITECTURE.md` for the design rationale.

Status: program source is complete; **not yet verified by a passing
`anchor test` run or a devnet deployment** (blocked on GitHub Actions CI —
see `.github/workflows/anchor-ci.yml` — and a manual deploy via Solana
Playground, since this environment has no local Rust/Solana/Anchor
toolchain). This document describes what the code is written to do; it will
be re-confirmed once CI is green and a devnet end-to-end script has run
against a real deployment.

## No admin key can move user funds

Every instruction's only signer is the party acting for themselves:

- `create_market` — the creator signs and pays rent, but gets no special
  privilege afterward; `Market.creator` is stored for display only and is
  never checked by any other instruction.
- `join` — only the depositing participant signs; funds move from their own
  token account into the market's escrow vault.
- `lock_market` — **no signer requirement at all** beyond the transaction
  fee payer; it's a pure state-transition anyone can trigger once
  `lock_time` has passed.
- `settle` — **no signer requirement tied to any privileged role**; anyone
  holding a valid TxLINE Merkle proof can call it. The instruction cannot be
  used to move funds directly — it only writes the verified outcome.
- `claim` — only the position's own owner (`has_one = participant`, and the
  PDA itself is seeded from that wallet's pubkey) can trigger a payout, and
  only to a token account they themselves own (`destination.owner ==
  participant.key()`, checked, not caller-supplied trust).

There is no upgrade-authority-gated instruction, no pause switch, no
fee-recipient override, no way for the program's own deploy/upgrade
authority to touch the vault. The vault's only authority is the `Market` PDA
itself, and the PDA only signs outbound transfers inside `claim`, using the
payout formula below — never an arbitrary amount or destination.

## What `settle` actually verifies

`settle` CPIs into TxLINE's real, deployed `validate_stat_v2` instruction
(devnet program `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`), passing the
caller-supplied Merkle proof and the on-chain `daily_scores_merkle_roots`
account for the day derived from the claimed timestamp. That CPI
cryptographically authenticates two things:

1. The submitted home/away goal **values** genuinely appear in TxLINE's
   published Merkle root for that day (a caller cannot fabricate a
   scoreline — an incorrect value fails to reconstruct the real root and the
   CPI itself fails, which our test suite exercises directly).
2. The submitted values are attached to the exact `fixture_id` our program
   independently checks against `Market.fixture_id` *before* even attempting
   the CPI (`FixtureMismatch` if they don't match).

On top of what the CPI authenticates, `settle` enforces two things TxLINE's
proof alone doesn't guarantee:

- **`period == 100` on both stats** — the CPI can just as validly
  authenticate an *in-progress* snapshot (e.g. the real 1-0 halftime score)
  as it can the final score, since both are genuinely-published data at some
  point in the match. Without this check, `settle` could be called the
  moment *any* real, provable scoreline exists, locking in the wrong result.
  `period == 100` is TxLINE's own marker for the `game_finalised` record
  (see `docs/TXLINE_NOTES.md` §4/§9) — checked explicitly, not assumed.
- **The outcome is derived from the proven values, not asserted by the
  caller.** `settle` never accepts "this was a home win" as an argument.
  The strategy passed to `validate_stat_v2` carries exactly one predicate,
  and it's structurally always-true (see `docs/ARCHITECTURE.md` §3) —
  its only purpose is satisfying TxLINE's "every stat must be referenced"
  requirement, not asserting a result. After the CPI succeeds, the program
  compares the two authenticated values itself
  (`home_goals.cmp(&away_goals)`) to compute `Outcome`. A malicious caller
  gains nothing by lying about the outcome, because there is no argument
  where they could.

**What `settle` does not independently verify**: that `fixture_id
18222446` really is "Argentina vs Switzerland, World Cup 2026" as opposed to
some other real match with that numeric ID — it trusts TxLINE's own
`fixture_id` numbering, and doesn't call `validate_fixture` (see
`docs/OPEN_QUESTIONS.md` for the reasoning: `Market.fixture_id` is fixed at
`create_market` time by whoever created the market, and the UI is expected
to show the real fixture details from TxLINE's `/fixtures/snapshot` at
market-creation time — the code doesn't independently prove team names,
only that the *stat proof* is genuinely tied to that fixture ID).

## Payout math

Pari-mutuel, no house edge: `claim` pays each winning position
`position.amount * total_pool / winning_pool`, computed with `u128`
intermediates and `checked_mul`/`checked_div` throughout — no unchecked
arithmetic on user-supplied or pool values anywhere in the program. If
nobody backed the winning outcome, every position gets a full 1:1 refund of
their own stake instead of the payout formula (documented rule, not a silent
edge case — see `docs/ARCHITECTURE.md` §4).

## Devnet USDC

`Market.mint` is checked against every token account passed to `join` and
`claim` (`constraint = ... .mint == market.mint`), but the program does not
hardcode a specific mint — `create_market` accepts whatever mint is passed
in. For the demo, this will be our own minted devnet SPL token (see
`docs/ARCHITECTURE.md` §5) rather than a shared devnet USDC faucet; the
exact mint address will be recorded here once created (Phase 2 execution /
deploy step).

## Known limitations, honestly stated

- Not yet compiled or run — see "Status" above. This document describes
  intent backed by real, complete source code, not a verified binary.
- CPI compute-budget fit is unverified (flagged in
  `docs/ARCHITECTURE.md` §3 as a real risk to test early).
- `validate_stat_v2`'s exact failure behavior (revert vs. a return value we'd
  need to check) is assumed to be "CPI `Err` on any authentication or
  coverage failure" based on how Anchor CPIs conventionally behave; this is
  exactly what the wrong-result-rejected test is designed to catch if that
  assumption is wrong.
