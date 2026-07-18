"use client";

import { useCallback, useEffect, useState } from "react";
import type { PublicKey } from "@solana/web3.js";
import type { Program } from "@coral-xyz/anchor";
import type { Goalpost } from "@goalpost/sdk";

export type MarketAccountData = Awaited<ReturnType<Program<Goalpost>["account"]["market"]["fetch"]>>;

/**
 * Live Market account state via Anchor's websocket account subscription
 * (`program.account.market.subscribe`) rather than polling - MASTER_PLAN
 * §3.2 explicitly prefers this for market state. Falls back to one fetch on
 * mount so the UI has data before the first change event arrives.
 *
 * `refetch` exists because the public devnet RPC endpoint
 * (api.devnet.solana.com) does not reliably deliver `accountSubscribe`
 * notifications - without it, the UI would keep showing the account's state
 * from the initial mount-time fetch (zero pool totals, taken right after
 * create_market) even after a join/lock/settle/claim tx confirms. Callers
 * should call `refetch()` right after their own action's tx confirms
 * instead of relying solely on the passive subscription.
 */
export function useMarketAccount(program: Program<Goalpost> | undefined, market: PublicKey | undefined) {
  const [account, setAccount] = useState<MarketAccountData | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const refetch = useCallback(async () => {
    if (!program || !market) return;
    try {
      const data = await program.account.market.fetch(market);
      setAccount(data);
      setError(undefined);
    } catch (e) {
      setError(String((e as { message?: string })?.message ?? e));
    }
  }, [program, market]);

  useEffect(() => {
    if (!program || !market) return;
    let cancelled = false;

    program.account.market
      .fetch(market)
      .then((data) => {
        if (!cancelled) setAccount(data);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e?.message ?? e));
      });

    const subscriptionId = program.provider.connection.onAccountChange(market, (accountInfo) => {
      try {
        const decoded = program.coder.accounts.decode<MarketAccountData>("Market", accountInfo.data);
        setAccount(decoded);
        setError(undefined);
      } catch (e) {
        // Malformed/partial account data mid-write - log and keep the last
        // known-good state rather than corrupting the UI (reliability gate).
        console.warn("useMarketAccount: failed to decode account change", e);
      }
    }, "confirmed");

    return () => {
      cancelled = true;
      void program.provider.connection.removeAccountChangeListener(subscriptionId);
    };
  }, [program, market]);

  return { account, error, refetch };
}
