import * as anchor from "@coral-xyz/anchor";
import { ComputeBudgetProgram, PublicKey } from "@solana/web3.js";
import type { Goalpost } from "./generated/goalpost.js";
import type { SettleArgs } from "./proof.js";
import { dailyScoresMerkleRootsPda, epochDayFromTimestampMs } from "./pda.js";
import { SETTLE_COMPUTE_UNIT_LIMIT } from "./constants.js";
import { parseGoalpostError } from "./errors.js";

export interface SettleParams {
  settler: PublicKey;
  market: PublicKey;
  proof: SettleArgs;
}

/**
 * Settles a Locked market by CPI-ing into TxLINE's real `validate_stat_v2`
 * (docs/TRUST_MODEL.md). No signer privilege is required - anyone holding a
 * valid proof can call this; the outcome is derived from the authenticated
 * stat values, never trusted from the caller.
 *
 * Automatically raises the compute budget to `SETTLE_COMPUTE_UNIT_LIMIT`
 * (1.4M CU) via a `preInstruction`, so callers never have to discover this
 * the way the test suite originally did ("exceeded CUs meter at BPF
 * instruction" against Solana's default 200,000 CU - see
 * docs/OPEN_QUESTIONS.md).
 *
 * `txoracleProgram` is deliberately absent from the accounts passed to
 * Anchor: it's constrained to a constant address in the IDL
 * (`#[account(address = txoracle::TXORACLE_PROGRAM_ID)]`), so the typed
 * client resolves it itself.
 */
export async function settle(program: anchor.Program<Goalpost>, params: SettleParams): Promise<void> {
  const { proof } = params;
  const epochDay = epochDayFromTimestampMs(proof.ts.toNumber());
  const dailyScoresMerkleRoots = dailyScoresMerkleRootsPda(epochDay);

  try {
    await program.methods
      .settle(
        proof.ts,
        proof.fixtureSummary,
        proof.fixtureProof,
        proof.mainTreeProof,
        proof.eventStatRoot,
        proof.homeStat,
        proof.awayStat
      )
      .accountsPartial({
        settler: params.settler,
        market: params.market,
        dailyScoresMerkleRoots,
      })
      .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: SETTLE_COMPUTE_UNIT_LIMIT })])
      .rpc();
  } catch (e) {
    throw parseGoalpostError(e);
  }
}

export interface ClaimParams {
  participant: PublicKey;
  market: PublicKey;
  vault: PublicKey;
  /** Token account the payout (or refund) is sent to. Must be owned by `participant`. */
  destination: PublicKey;
}

/**
 * Pays a winning (or, if no one backed the winning outcome, any) position.
 * Throws `NothingToClaim` / `AlreadyClaimed` as typed `GoalpostProgramError`s.
 *
 * `position` and `tokenProgram` are deliberately absent from the accounts
 * passed to Anchor: `position` is PDA-auto-derived (seeds: "position" +
 * market + participant) and `tokenProgram` is a constant address in the
 * IDL - the typed client resolves both itself.
 */
export async function claim(program: anchor.Program<Goalpost>, params: ClaimParams): Promise<void> {
  try {
    await program.methods
      .claim()
      .accountsPartial({
        participant: params.participant,
        market: params.market,
        vault: params.vault,
        destination: params.destination,
      })
      .rpc();
  } catch (e) {
    throw parseGoalpostError(e);
  }
}
