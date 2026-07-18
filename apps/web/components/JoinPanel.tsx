"use client";

import { useState } from "react";
import type { OutcomeArg } from "@goalpost/sdk";
import { useTxState } from "@/lib/useTxState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { MIN_STAKE_DISPLAY, MAX_STAKE_DISPLAY, DEFAULT_STAKE_DISPLAY } from "@/lib/useDemoRound";

const OPTIONS: { value: OutcomeArg; label: string }[] = [
  { value: "home", label: "Home" },
  { value: "draw", label: "Draw" },
  { value: "away", label: "Away" },
];

export function JoinPanel({ onJoin }: { onJoin: (outcome: OutcomeArg, stake: number) => Promise<string> }) {
  const [outcome, setOutcome] = useState<OutcomeArg>("home");
  const [stakeInput, setStakeInput] = useState(String(DEFAULT_STAKE_DISPLAY));
  const { state, run } = useTxState();

  const stake = Number(stakeInput);
  const stakeValid = Number.isFinite(stake) && stake >= MIN_STAKE_DISPLAY && stake <= MAX_STAKE_DISPLAY;

  if (state.status === "confirmed") {
    return <p className="border border-gp-verified/40 bg-gp-verified/10 px-4 py-3 text-sm text-gp-verified">Joined, backing {outcome}. {stake.toFixed(2)} demo tokens staked.</p>;
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

      <label className="mb-3 flex items-center gap-2">
        <span className="font-mono text-[11px] tracking-[0.2em] text-gp-text-dim uppercase">Stake</span>
        <input
          type="number"
          inputMode="decimal"
          min={MIN_STAKE_DISPLAY}
          max={MAX_STAKE_DISPLAY}
          step={0.1}
          value={stakeInput}
          disabled={busy}
          onChange={(e) => setStakeInput(e.target.value)}
          className="w-24 border border-gp-line bg-gp-bg px-2 py-1 font-mono text-sm text-gp-text tabular focus:border-gp-amber focus:outline-none disabled:opacity-50"
        />
        <span className="font-mono text-xs text-gp-text-faint">demo tokens</span>
      </label>
      {!stakeValid && (
        <p className="mb-3 font-mono text-[11px] text-gp-danger">
          Stake must be between {MIN_STAKE_DISPLAY} and {MAX_STAKE_DISPLAY}.
        </p>
      )}

      <button
        onClick={() => run(() => onJoin(outcome, stake))}
        disabled={busy || !stakeValid}
        className="w-full border border-gp-amber bg-gp-amber px-4 py-2 font-mono text-xs font-semibold tracking-wide text-gp-bg transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {state.status === "signing" ? "Confirm in wallet…" : state.status === "confirming" ? "Confirming…" : `Join with ${stakeValid ? stake.toFixed(2) : "—"} demo tokens`}
      </button>
      {state.status === "failed" && <ErrorBanner message={state.message} onRetry={() => run(() => onJoin(outcome, stake))} />}
    </div>
  );
}
