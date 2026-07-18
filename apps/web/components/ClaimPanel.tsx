"use client";

import { useTxState } from "@/lib/useTxState";
import { ErrorBanner } from "@/components/ErrorBanner";

export function ClaimPanel({ onClaim }: { onClaim: () => Promise<string> }) {
  const { state, run } = useTxState();

  if (state.status === "confirmed") {
    return <p className="border border-gp-verified/40 bg-gp-verified/10 px-4 py-3 text-sm text-gp-verified">Claimed.</p>;
  }

  const busy = state.status === "signing" || state.status === "confirming";

  return (
    <div className="border border-gp-line bg-gp-surface px-5 py-4">
      <p className="mb-3 text-sm text-gp-text-dim">If your position backed the winning outcome, claim your payout now.</p>
      <button
        onClick={() => run(onClaim)}
        disabled={busy}
        className="w-full border border-gp-amber bg-gp-amber px-4 py-2 font-mono text-xs font-semibold tracking-wide text-gp-bg transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {state.status === "signing" ? "Confirm in wallet…" : state.status === "confirming" ? "Confirming…" : "Claim"}
      </button>
      {state.status === "failed" && <ErrorBanner message={state.message} onRetry={() => run(onClaim)} />}
    </div>
  );
}
