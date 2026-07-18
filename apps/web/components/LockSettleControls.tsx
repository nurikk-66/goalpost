"use client";

import { useEffect, useState } from "react";
import type { MarketAccountData } from "@/lib/useMarketAccount";
import { useTxState } from "@/lib/useTxState";
import { ErrorBanner } from "@/components/ErrorBanner";

export function LockSettleControls({
  account,
  onLock,
  onSettle,
  onSettled,
}: {
  account: MarketAccountData;
  onLock: () => Promise<string>;
  onSettle: () => Promise<string>;
  /** Called with the settle transaction's signature once confirmed, so a parent can render the verification receipt. */
  onSettled?: (signature: string) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const lockTx = useTxState();
  const settleTx = useTxState();

  const isOpen = "open" in account.status;
  const isLocked = "locked" in account.status;
  const lockTimePassed = now / 1000 >= account.lockTime.toNumber();

  useEffect(() => {
    if (!isOpen) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isOpen]);

  if (isOpen) {
    if (!lockTimePassed) return null;
    const busy = lockTx.state.status === "signing" || lockTx.state.status === "confirming";
    return (
      <div className="border border-gp-line bg-gp-surface px-5 py-4">
        <p className="mb-3 text-sm text-gp-text-dim">
          Lock time has passed. Anyone can lock this market - no admin required.
        </p>
        <button
          onClick={() => lockTx.run(onLock)}
          disabled={busy}
          className="w-full border border-gp-amber bg-gp-amber px-4 py-2 font-mono text-xs font-semibold tracking-wide text-gp-bg transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Locking…" : "Lock market"}
        </button>
        {lockTx.state.status === "failed" && <ErrorBanner message={lockTx.state.message} onRetry={() => lockTx.run(onLock)} />}
      </div>
    );
  }

  if (isLocked) {
    const busy = settleTx.state.status === "signing" || settleTx.state.status === "confirming";
    return (
      <div className="border border-gp-line bg-gp-surface px-5 py-4">
        <p className="mb-3 text-sm text-gp-text-dim">
          Settle with the real captured Merkle proof - this CPIs into TxLINE&apos;s <code className="font-mono text-gp-amber">validate_stat_v2</code> on-chain.
        </p>
        <button
          onClick={() => settleTx.run(onSettle).then((sig) => sig && onSettled?.(sig))}
          disabled={busy}
          className="w-full border border-gp-amber bg-gp-amber px-4 py-2 font-mono text-xs font-semibold tracking-wide text-gp-bg transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {settleTx.state.status === "signing" ? "Confirm in wallet…" : settleTx.state.status === "confirming" ? "Verifying on-chain…" : "Settle market"}
        </button>
        {settleTx.state.status === "failed" && <ErrorBanner message={settleTx.state.message} onRetry={() => settleTx.run(onSettle)} />}
      </div>
    );
  }

  return null;
}
