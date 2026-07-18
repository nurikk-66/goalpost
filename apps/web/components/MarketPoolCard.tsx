"use client";

import { useEffect, useState } from "react";
import type { PublicKey } from "@solana/web3.js";
import type { MarketAccountData } from "@/lib/useMarketAccount";
import type { PositionEntry } from "@/lib/usePositions";
import { formatTokenAmount, formatCountdown, outcomeLabel } from "@/lib/format";

function statusLabel(status: MarketAccountData["status"]): string {
  if ("open" in status) return "Open";
  if ("locked" in status) return "Locked";
  if ("settled" in status) return "Settled";
  if ("claimed" in status) return "Claimed";
  return "Unknown";
}

/** "You're backing Home. 2 others on Home, 1 on Away." - derived entirely
 * from the enumerated Position accounts (see usePositions.ts), since the
 * Market account itself only tracks an aggregate participantCount. */
function ParticipantsBreakdown({ positions, walletPublicKey }: { positions: PositionEntry[]; walletPublicKey?: PublicKey }) {
  if (positions.length === 0) return null;

  const own = walletPublicKey ? positions.find((p) => p.account.participant.equals(walletPublicKey)) : undefined;
  const others = own ? positions.filter((p) => p.publicKey.toBase58() !== own.publicKey.toBase58()) : positions;

  const counts = { Home: 0, Draw: 0, Away: 0 };
  for (const p of others) counts[outcomeLabel(p.account.outcome)]++;

  const summary = (["Home", "Draw", "Away"] as const)
    .filter((label) => counts[label] > 0)
    .map((label) => `${counts[label]} on ${label}`)
    .join(", ");

  return (
    <p className="mt-2 text-center font-mono text-[11px] text-gp-text-faint">
      {own && <span className="text-gp-amber">You&apos;re backing {outcomeLabel(own.account.outcome)}. </span>}
      {summary ? summary : own ? "No one else has joined yet." : "Nobody has joined yet."}
    </p>
  );
}

export function MarketPoolCard({ account, positions = [], walletPublicKey }: { account: MarketAccountData; positions?: PositionEntry[]; walletPublicKey?: PublicKey }) {
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

      <p className="tabular mt-3 text-center font-mono text-xs text-gp-text-dim">
        {account.participantCount} {account.participantCount === 1 ? "participant" : "participants"}
        {isOpen && (
          <>
            {" · locks in "}
            <span className="text-gp-amber">{formatCountdown(account.lockTime.toNumber(), now)}</span>
          </>
        )}
      </p>
      <ParticipantsBreakdown positions={positions} walletPublicKey={walletPublicKey} />
    </div>
  );
}
