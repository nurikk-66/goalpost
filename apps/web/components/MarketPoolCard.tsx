"use client";

import { useEffect, useState } from "react";
import type { MarketAccountData } from "@/lib/useMarketAccount";
import { formatTokenAmount, formatCountdown } from "@/lib/format";

function statusLabel(status: MarketAccountData["status"]): string {
  if ("open" in status) return "Open";
  if ("locked" in status) return "Locked";
  if ("settled" in status) return "Settled";
  if ("claimed" in status) return "Claimed";
  return "Unknown";
}

export function MarketPoolCard({ account }: { account: MarketAccountData }) {
  const [now, setNow] = useState(() => Date.now());
  const isOpen = "open" in account.status;

  useEffect(() => {
    if (!isOpen) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isOpen]);

  return (
    <div className="border border-gp-line bg-gp-surface px-5 py-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] tracking-[0.2em] text-gp-text-dim uppercase">Market pool</p>
        <span className="border border-gp-amber/40 px-2 py-0.5 font-mono text-[10px] tracking-wider text-gp-amber uppercase">
          {statusLabel(account.status)}
        </span>
      </div>

      <div className="tabular mt-3 grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="font-mono text-xl font-bold text-gp-text">{formatTokenAmount(account.totalHome)}</p>
          <p className="font-mono text-[10px] text-gp-text-dim uppercase">Home</p>
        </div>
        <div>
          <p className="font-mono text-xl font-bold text-gp-text">{formatTokenAmount(account.totalDraw)}</p>
          <p className="font-mono text-[10px] text-gp-text-dim uppercase">Draw</p>
        </div>
        <div>
          <p className="font-mono text-xl font-bold text-gp-text">{formatTokenAmount(account.totalAway)}</p>
          <p className="font-mono text-[10px] text-gp-text-dim uppercase">Away</p>
        </div>
      </div>

      {isOpen && (
        <p className="tabular mt-3 text-center font-mono text-xs text-gp-text-dim">
          Locks in <span className="text-gp-amber">{formatCountdown(account.lockTime.toNumber(), now)}</span>
        </p>
      )}
    </div>
  );
}
