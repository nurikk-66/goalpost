import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import { GOALPOST_PROGRAM_ID, TXORACLE_PROGRAM_ID } from "./constants.js";

export function marketPda(fixtureId: BN, marketType: number): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("market"), fixtureId.toArrayLike(Buffer, "le", 8), Buffer.from([marketType])],
    GOALPOST_PROGRAM_ID
  );
  return pda;
}

export function positionPda(market: PublicKey, participant: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("position"), market.toBuffer(), participant.toBuffer()],
    GOALPOST_PROGRAM_ID
  );
  return pda;
}

/**
 * TxLINE's daily scores Merkle root PDA (docs/TXLINE_NOTES.md §5). `epochDay`
 * must come from a proof response's own `minTimestamp` / `ts`, never
 * `Date.now()` - deriving it from the wrong timestamp is the documented
 * #1 cause of `InvalidMainTreeProof`.
 */
export function dailyScoresMerkleRootsPda(epochDay: number): PublicKey {
  const buf = Buffer.alloc(2);
  buf.writeUInt16LE(epochDay, 0);
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from("daily_scores_roots"), buf], TXORACLE_PROGRAM_ID);
  return pda;
}

/** `epochDay = floor(timestampMs / 86_400_000)` - see docs/TXLINE_NOTES.md §5/§9. */
export function epochDayFromTimestampMs(timestampMs: number): number {
  return Math.floor(timestampMs / 86_400_000);
}
