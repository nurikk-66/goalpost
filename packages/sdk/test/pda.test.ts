import { describe, expect, it } from "vitest";
import BN from "bn.js";
import { Keypair, PublicKey } from "@solana/web3.js";
import { marketPda, positionPda, dailyScoresMerkleRootsPda, epochDayFromTimestampMs } from "../src/pda.js";

describe("epochDayFromTimestampMs", () => {
  it("matches the real captured proof's epochDay (docs/TXLINE_NOTES.md §9: floor(1783828222499 / 86_400_000) = 20646)", () => {
    expect(epochDayFromTimestampMs(1783828222499)).toBe(20646);
  });
});

describe("PDA derivation", () => {
  it("marketPda is deterministic for the same (fixtureId, marketType)", () => {
    const fixtureId = new BN(18222446);
    const a = marketPda(fixtureId, 7);
    const b = marketPda(fixtureId, 7);
    expect(a.toBase58()).toBe(b.toBase58());
  });

  it("marketPda differs across market_type for the same fixtureId", () => {
    const fixtureId = new BN(18222446);
    expect(marketPda(fixtureId, 1).toBase58()).not.toBe(marketPda(fixtureId, 2).toBase58());
  });

  it("positionPda is deterministic per (market, participant) and differs across participants", () => {
    const market = Keypair.generate().publicKey;
    const p1 = Keypair.generate().publicKey;
    const p2 = Keypair.generate().publicKey;
    expect(positionPda(market, p1).toBase58()).toBe(positionPda(market, p1).toBase58());
    expect(positionPda(market, p1).toBase58()).not.toBe(positionPda(market, p2).toBase58());
  });

  it("dailyScoresMerkleRootsPda is deterministic and a valid PublicKey for the real epochDay", () => {
    const pda = dailyScoresMerkleRootsPda(20646);
    expect(pda).toBeInstanceOf(PublicKey);
    expect(dailyScoresMerkleRootsPda(20646).toBase58()).toBe(pda.toBase58());
    expect(dailyScoresMerkleRootsPda(20647).toBase58()).not.toBe(pda.toBase58());
  });
});
