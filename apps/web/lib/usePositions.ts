"use client";

import { useCallback, useEffect, useState } from "react";
import type { PublicKey } from "@solana/web3.js";
import type { Program } from "@coral-xyz/anchor";
import type { Goalpost } from "@goalpost/sdk";

export type PositionAccountData = Awaited<ReturnType<Program<Goalpost>["account"]["position"]["fetch"]>>;

export interface PositionEntry {
  publicKey: PublicKey;
  account: PositionAccountData;
}

/**
 * Enumerates every Position account for a market via a memcmp filter on
 * `market` (offset 8 - right after Anchor's 8-byte account discriminator,
 * and `market` is Position's first field). Pure read-only client-side
 * aggregation, no new on-chain instruction needed: Market only tracks a
 * total `participantCount`, not a per-outcome breakdown, and Position
 * already stores participant/outcome/amount individually - this is the
 * fastest safe path to "who's backing what" without touching the deployed
 * program.
 */
export function usePositions(program: Program<Goalpost> | undefined, market: PublicKey | undefined) {
  const [positions, setPositions] = useState<PositionEntry[]>([]);

  const refetch = useCallback(async () => {
    if (!program || !market) return;
    const results = await program.account.position.all([{ memcmp: { offset: 8, bytes: market.toBase58() } }]);
    setPositions(results);
  }, [program, market]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { positions, refetch };
}
