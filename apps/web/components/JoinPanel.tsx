"use client";

import { useState } from "react";
import type { OutcomeArg } from "@goalpost/sdk";
import { useTxState } from "@/lib/useTxState";
import { ErrorBanner } from "@/components/ErrorBanner";

const OPTIONS: { value: OutcomeArg; label: string }[] = [
  { value: "home", label: "Home" },
  { value: "draw", label: "Draw" },
  { value: "away", label: "Away" },
];

export function JoinPanel({ onJoin }: { onJoin: (outcome: OutcomeArg) => Promise<string> }) {
  const [outcome, setOutcome] = useState<OutcomeArg>("home");
  const { state, run } = useTxState();

  if (state.status === "confirmed") {
    return <p className="border border-gp-verified/40 bg-gp-verified/10 px-4 py-3 text-sm text-gp-verified">Joined, backing {outcome}. 1.00 demo tokens staked.</p>;
  }

  const busy = state.status === "signing" || state.status === "confirming";

  return (
    <div className="border border-gp-line bg-gp-surface px-5 py-4">
      <p className="mb-3 font-mono text-[11px] tracking-[0.2em] text-gp-text-dim uppercase">Back an outcome</p>
      <div className="mb-3 flex gap-2">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setOutcome(opt.value)}
            disabled={busy}
            className={`flex-1 border px-3 py-2 font-mono text-xs tracking-wide uppercase transition-colors ${
              outcome === opt.value ? "border-gp-amber bg-gp-amber text-gp-bg" : "border-gp-line text-gp-text-dim hover:border-gp-line-strong"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <button
        onClick={() => run(() => onJoin(outcome))}
        disabled={busy}
        className="w-full border border-gp-amber bg-gp-amber px-4 py-2 font-mono text-xs font-semibold tracking-wide text-gp-bg transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {state.status === "signing" ? "Confirm in wallet…" : state.status === "confirming" ? "Confirming…" : "Join with 1.00 demo tokens"}
      </button>
      {state.status === "failed" && <ErrorBanner message={state.message} onRetry={() => run(() => onJoin(outcome))} />}
    </div>
  );
}
