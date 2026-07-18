"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Explicit state machine for every money-touching action (MASTER_PLAN
 * §3.1): idle -> signing -> confirming -> confirmed | failed. No
 * spinner-forever states - `run()` always resolves to `failed` if `action`
 * doesn't settle within `timeoutMs`, with a human-readable message instead
 * of a raw exception.
 */
export type TxState =
  | { status: "idle" }
  | { status: "signing" }
  | { status: "confirming"; signature?: string }
  | { status: "confirmed"; signature: string }
  | { status: "failed"; message: string; cause?: unknown };

const DEFAULT_TIMEOUT_MS = 60_000;

export function useTxState() {
  const [state, setState] = useState<TxState>({ status: "idle" });
  const runIdRef = useRef(0);

  const run = useCallback(async (action: () => Promise<string>, opts: { timeoutMs?: number } = {}) => {
    const runId = ++runIdRef.current;
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    setState({ status: "signing" });

    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      if (runIdRef.current === runId) {
        setState({ status: "failed", message: "Timed out waiting for confirmation - check the explorer, it may still land." });
      }
    }, timeoutMs);

    try {
      setState({ status: "confirming" });
      const signature = await action();
      clearTimeout(timeout);
      if (timedOut || runIdRef.current !== runId) return; // stale
      setState({ status: "confirmed", signature });
      return signature;
    } catch (e) {
      clearTimeout(timeout);
      if (timedOut || runIdRef.current !== runId) return; // stale
      setState({ status: "failed", message: humanizeError(e), cause: e });
      return undefined;
    }
  }, []);

  const reset = useCallback(() => setState({ status: "idle" }), []);

  return { state, run, reset };
}

/** Human-readable messages for the typed errors the SDK throws (packages/sdk/src/errors.ts), falling back to a generic one instead of a raw stack trace. */
function humanizeError(e: unknown): string {
  const name = (e as any)?.name;
  const messages: Record<string, string> = {
    ZeroAmount: "Stake must be greater than zero.",
    InvalidLockTime: "Lock time must be in the future.",
    MarketNotOpen: "This market is no longer open for joining.",
    MarketAlreadyLocked: "This market is already locked, settled, or claimed.",
    LockTimeNotReached: "The lock time hasn't passed yet.",
    MarketNotLocked: "The market must be locked before it can be settled.",
    MarketNotSettled: "The market hasn't been settled yet.",
    OutcomeMismatch: "This wallet already backed a different outcome in this market.",
    FixtureMismatch: "The proof doesn't match this market's fixture.",
    NotFinalResult: "That stat isn't from the finalized full-time result yet.",
    StatValidationFailed: "TxLINE rejected the proof - the submitted value doesn't match the real Merkle root.",
    AlreadyClaimed: "This position has already been claimed.",
    NothingToClaim: "This position didn't back the winning outcome.",
  };
  if (name && messages[name]) return messages[name];
  if (name === "Unknown" && (e as any)?.cause) return humanizeRaw((e as any).cause);
  return humanizeRaw(e);
}

function humanizeRaw(e: unknown): string {
  const raw = String((e as any)?.message ?? e);
  if (/user rejected/i.test(raw)) return "Rejected in wallet.";
  if (/insufficient/i.test(raw)) return "Insufficient balance for this transaction.";
  if (/blockhash/i.test(raw)) return "Network was too slow to confirm in time - try again.";
  return "Something went wrong. Check the explorer for details.";
}
