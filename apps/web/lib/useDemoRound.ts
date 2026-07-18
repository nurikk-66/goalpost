"use client";

import { useCallback, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import {
  loadProgram,
  createMarket,
  join as sdkJoin,
  lockMarket as sdkLockMarket,
  settle as sdkSettle,
  claim as sdkClaim,
  marketPda,
  type OutcomeArg,
} from "@goalpost/sdk";
import { createDemoMint, ensureFundedAta } from "@/lib/onchain";
import { getBundledResult } from "@/lib/proof";

const LOCK_TIME_BUFFER_SECONDS = 60;
const DEMO_STAKE = 1_000_000; // 1.00 token at 6 decimals

interface RoundState {
  marketType: number;
  market: PublicKey;
  mint: PublicKey;
  vault: PublicKey;
}

function sessionKey(fixtureId: number) {
  return `gp:round:${fixtureId}`;
}

/**
 * Orchestrates one demo round for a fixture: a fresh Market + escrow mint
 * per round (so "3x back-to-back" runs never collide with a previous
 * settled/claimed market), tracked in sessionStorage so a page reload
 * mid-round doesn't lose track of it. The connected wallet plays every role
 * - creator, backer, locker, settler, claimant (Phase 4 plan decisions 1-2).
 */
export function useDemoRound(fixtureId: number) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [round, setRound] = useState<RoundState | null>(() => loadFromSession(fixtureId));

  const program = useMemo(() => {
    if (!wallet.publicKey || !wallet.signTransaction) return undefined;
    // wallet-adapter's WalletContextState is structurally compatible with
    // Anchor's Wallet interface (publicKey/signTransaction/signAllTransactions)
    // but typed as individually-optional fields; the guard above already
    // confirmed the ones Anchor actually needs are present.
    const provider = new AnchorProvider(connection, wallet as AnchorProvider["wallet"], { commitment: "confirmed" });
    return loadProgram(provider);
  }, [connection, wallet]);

  const startRound = useCallback(async () => {
    if (!program || !wallet.publicKey) throw new Error("Wallet not connected");

    const marketType = await pickUnusedMarketType(connection, new BN(fixtureId));
    const mint = await createDemoMint(connection, wallet);
    const lockTime = Math.floor(Date.now() / 1000) + LOCK_TIME_BUFFER_SECONDS;
    const { market, vault } = await createMarket(program, {
      creator: wallet.publicKey,
      fixtureId,
      marketType,
      lockTime,
      mint,
    });

    const next: RoundState = { marketType, market, mint, vault };
    setRound(next);
    saveToSession(fixtureId, next);
    return next;
  }, [program, wallet, connection, fixtureId]);

  const joinRound = useCallback(
    async (outcome: OutcomeArg) => {
      if (!program || !wallet.publicKey || !round) throw new Error("No active round");
      const ata = await ensureFundedAta(connection, wallet, round.mint, wallet.publicKey, DEMO_STAKE);
      const { signature } = await sdkJoin(program, {
        participant: wallet.publicKey,
        market: round.market,
        outcome,
        amount: DEMO_STAKE,
        participantTokenAccount: ata,
        vault: round.vault,
      });
      return signature;
    },
    [program, wallet, round, connection]
  );

  const lockRound = useCallback(async () => {
    if (!program || !round) throw new Error("No active round");
    return sdkLockMarket(program, round.market);
  }, [program, round]);

  const settleRound = useCallback(async () => {
    if (!program || !wallet.publicKey || !round) throw new Error("No active round");
    const { settleArgs } = getBundledResult();
    return sdkSettle(program, { settler: wallet.publicKey, market: round.market, proof: settleArgs });
  }, [program, wallet, round]);

  const claimRound = useCallback(async () => {
    if (!program || !wallet.publicKey || !round) throw new Error("No active round");
    const destination = await ensureFundedAta(connection, wallet, round.mint, wallet.publicKey, 0);
    return sdkClaim(program, { participant: wallet.publicKey, market: round.market, vault: round.vault, destination });
  }, [program, wallet, round, connection]);

  return { program, round, startRound, joinRound, lockRound, settleRound, claimRound };
}

// Tests run against real, persistent devnet state (not a resettable local
// validator - see docs/OPEN_QUESTIONS.md), so a fixed market_type risks
// colliding with a leftover market from a previous round.
async function pickUnusedMarketType(connection: Connection, fixtureId: BN): Promise<number> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = Math.floor(Math.random() * 256);
    const pda = marketPda(fixtureId, candidate);
    if (!(await connection.getAccountInfo(pda))) return candidate;
  }
  throw new Error("Could not find an unused market slot - try again.");
}

function loadFromSession(fixtureId: number): RoundState | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(sessionKey(fixtureId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return {
      marketType: parsed.marketType,
      market: new PublicKey(parsed.market),
      mint: new PublicKey(parsed.mint),
      vault: new PublicKey(parsed.vault),
    };
  } catch {
    return null;
  }
}

function saveToSession(fixtureId: number, round: RoundState) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    sessionKey(fixtureId),
    JSON.stringify({
      marketType: round.marketType,
      market: round.market.toBase58(),
      mint: round.mint.toBase58(),
      vault: round.vault.toBase58(),
    })
  );
}
