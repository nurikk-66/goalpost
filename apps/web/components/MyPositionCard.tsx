import type { MarketAccountData } from "@/lib/useMarketAccount";
import type { PositionEntry } from "@/lib/usePositions";
import { formatTokenAmount, outcomeLabel } from "@/lib/format";

function nextStepLabel(status: MarketAccountData["status"]): string {
  if ("open" in status) return "Waiting for lock.";
  if ("locked" in status) return "Waiting for settlement.";
  if ("settled" in status) return "Settled - ready to claim below.";
  return "Claimed.";
}

/**
 * Replaces the join form once the connected wallet already has a Position
 * (derived from the real on-chain account via usePositions - not local
 * component state, so it survives a page reload unlike the old
 * useTxState-only "confirmed" message). Keeps the "You're backing X"
 * pattern from the participants breakdown consistent everywhere state
 * changes, per the final-polish-pass state-clarity request.
 */
export function MyPositionCard({ position, status }: { position: PositionEntry; status: MarketAccountData["status"] }) {
  return (
    <div className="border border-gp-amber/40 bg-gp-surface px-5 py-4">
      <p className="font-mono text-[11px] tracking-[0.2em] text-gp-text-dim uppercase">Your position</p>
      <p className="mt-1 font-mono text-lg font-bold text-gp-amber">
        Backing {outcomeLabel(position.account.outcome)} · {formatTokenAmount(position.account.amount)} tokens
      </p>
      <p className="mt-1 font-mono text-xs text-gp-text-dim">{nextStepLabel(status)}</p>
    </div>
  );
}
