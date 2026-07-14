import * as anchor from "@coral-xyz/anchor";
import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import type { Goalpost } from "./generated/goalpost.js";
import { marketPda, positionPda } from "./pda.js";
import { parseGoalpostError } from "./errors.js";

export type OutcomeArg = "home" | "draw" | "away";

// A plain `Record<OutcomeArg, {}>` types as "all three keys required", not a
// discriminated union - Anchor's generated client expects exactly one key
// present (`{ home: {} }` xor `{ draw: {} }` xor `{ away: {} }`). A
// per-branch literal return is what actually narrows to that shape.
function outcomeToAnchorEnum(outcome: OutcomeArg): { home: {} } | { draw: {} } | { away: {} } {
  switch (outcome) {
    case "home":
      return { home: {} };
    case "draw":
      return { draw: {} };
    case "away":
      return { away: {} };
  }
}

export interface CreateMarketParams {
  creator: PublicKey;
  fixtureId: BN | number | string;
  marketType: number;
  /** Unix seconds. Must be in the future (`InvalidLockTime` otherwise). */
  lockTime: BN | number;
  mint: PublicKey;
}

export interface CreatedMarket {
  market: PublicKey;
  /** The market's escrow ATA (mint x market PDA) - Anchor derives this on-chain from `market`+`mint`, computed here only so callers don't have to re-derive it themselves. */
  vault: PublicKey;
}

/**
 * Creates a Market PDA and its escrow vault.
 *
 * `vault`, `tokenProgram`, `associatedTokenProgram`, and `systemProgram` are
 * deliberately absent from the accounts passed to Anchor: the IDL marks
 * `vault` as a PDA (seeds: market x mint) and the other three as
 * well-known constant addresses, so Anchor's typed client resolves them
 * itself. `.accountsPartial()` (rather than `.accounts()`) is what actually
 * allows a subset here - Anchor's exact `Accounts<A>` type used by
 * `.accounts()` doesn't type-check cleanly against IDL `relations` on other
 * instructions in this program, so every SDK call uses the more permissive
 * partial form for consistency (see docs/OPEN_QUESTIONS.md for how this was
 * discovered - the untyped `anchor.Program` used in tests/goalpost.ts never
 * caught any of it).
 */
export async function createMarket(program: anchor.Program<Goalpost>, params: CreateMarketParams): Promise<CreatedMarket> {
  const fixtureId = new BN(params.fixtureId);
  const market = marketPda(fixtureId, params.marketType);
  const vault = anchor.utils.token.associatedAddress({ mint: params.mint, owner: market });

  try {
    await program.methods
      .createMarket(fixtureId, params.marketType, new BN(params.lockTime))
      .accountsPartial({
        creator: params.creator,
        market,
        mint: params.mint,
      })
      .rpc();
  } catch (e) {
    throw parseGoalpostError(e);
  }

  return { market, vault };
}

export interface JoinParams {
  participant: PublicKey;
  market: PublicKey;
  outcome: OutcomeArg;
  /** Token amount in the mint's base units (e.g. 1_000_000 = 1.00 for a 6-decimal mint). */
  amount: BN | number | string;
  participantTokenAccount: PublicKey;
  vault: PublicKey;
}

/** Backs an outcome in an Open market. Returns the caller's Position PDA. */
export async function join(program: anchor.Program<Goalpost>, params: JoinParams): Promise<PublicKey> {
  const position = positionPda(params.market, params.participant);

  try {
    await program.methods
      .join(outcomeToAnchorEnum(params.outcome), new BN(params.amount))
      .accountsPartial({
        participant: params.participant,
        market: params.market,
        participantTokenAccount: params.participantTokenAccount,
        vault: params.vault,
      })
      .rpc();
  } catch (e) {
    throw parseGoalpostError(e);
  }

  return position;
}

/**
 * Transitions Open -> Locked once `lock_time` has passed. No signer
 * requirement beyond the fee payer (see docs/TRUST_MODEL.md) - anyone can
 * trigger this, it's a pure state transition.
 */
export async function lockMarket(program: anchor.Program<Goalpost>, market: PublicKey): Promise<void> {
  try {
    await program.methods.lockMarket().accounts({ market }).rpc();
  } catch (e) {
    throw parseGoalpostError(e);
  }
}

export async function getMarket(program: anchor.Program<Goalpost>, market: PublicKey) {
  return program.account.market.fetch(market);
}
