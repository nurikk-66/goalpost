"use client";

import { useEffect, useState } from "react";
import type { PublicKey } from "@solana/web3.js";
import type BN from "bn.js";
import type { OutcomeArg } from "@goalpost/sdk";
import type { MarketAccountData } from "@/lib/useMarketAccount";
import type { PositionEntry } from "@/lib/usePositions";
import type { DemoFixture } from "@/lib/fixtures-data";
import { formatTokenAmount, formatCountdown, outcomeLabel } from "@/lib/format";
import { teamFlag } from "@/lib/teamFlags";
import { useTxState } from "@/lib/useTxState";
import { useMarketContext } from "@/lib/marketContext";
import { ErrorBanner } from "@/components/ErrorBanner";
import { MIN_STAKE_DISPLAY, MAX_STAKE_DISPLAY, DEFAULT_STAKE_DISPLAY } from "@/lib/useDemoRound";

function outcomeRows(fixture: DemoFixture): { value: OutcomeArg; label: "Home" | "Draw" | "Away"; display: string }[] {
  return [
    { value: "home", label: "Home", display: `${teamFlag(fixture.participant1)} ${fixture.participant1}` },
    { value: "draw", label: "Draw", display: "Draw" },
    { value: "away", label: "Away", display: `${teamFlag(fixture.participant2)} ${fixture.participant2}` },
  ];
}

function statusLabel(status: MarketAccountData["status"]): string {
  if ("open" in status) return "Open";
  if ("locked" in status) return "Locked";
  if ("settled" in status) return "Settled";
  if ("claimed" in status) return "Claimed";
  return "Unknown";
}

function nextStepLabel(status: MarketAccountData["status"]): string {
  if ("open" in status) return "Waiting for lock.";
  if ("locked" in status) return "Waiting for settlement.";
  if ("settled" in status) return "Settled - ready to claim below.";
  return "Claimed.";
}

function poolAmount(account: MarketAccountData, outcome: OutcomeArg): BN {
  if (outcome === "home") return account.totalHome;
  if (outcome === "draw") return account.totalDraw;
  return account.totalAway;
}

function poolPercent(account: MarketAccountData, outcome: OutcomeArg): string | null {
  const total = account.totalHome.add(account.totalDraw).add(account.totalAway);
  if (total.isZero()) return null;
  return ((poolAmount(account, outcome).toNumber() / total.toNumber()) * 100).toFixed(0);
}

/**
 * Jupiter Predict-style market card (jup.ag "FIFA World Cup 2026" pattern):
 * one card, each outcome as a selectable ROW (name left, pool share % +
 * staked amount right, chevron/checkmark indicator) instead of three
 * always-visible equal boxes. A single stake-input-plus-join control below
 * ties to whichever row is selected, replacing the old separate
 * MarketPoolCard/JoinPanel/MyPositionCard split. Keeps the same underlying
 * data (pool amounts, participant counts, "you're backing X") - this is a
 * layout change, not a data change.
 */
export function MarketPanel({
  fixture,
  account,
  positions,
  walletPublicKey,
  onJoin,
}: {
  fixture: DemoFixture;
  account: MarketAccountData;
  positions: PositionEntry[];
  walletPublicKey?: PublicKey;
  onJoin: (outcome: OutcomeArg, stake: number) => Promise<string>;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [selected, setSelected] = useState<OutcomeArg>("home");
  const [stakeInput, setStakeInput] = useState(String(DEFAULT_STAKE_DISPLAY));
  const { state, run } = useTxState();
  const { setPosition } = useMarketContext();

  const isOpen = "open" in account.status;
  const rows = outcomeRows(fixture);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const myPosition = walletPublicKey ? positions.find((p) => p.account.participant.equals(walletPublicKey)) : undefined;
  const lockTimePassed = now / 1000 >= account.lockTime.toNumber();
  const canJoin = isOpen && !lockTimePassed && !myPosition;
  const busy = state.status === "signing" || state.status === "confirming";

  // Feeds the persistent right-side "your position at a glance" panel
  // (app/layout.tsx's shell), which has no other way to see fixture-scoped
  // position data since it lives above this page in the tree.
  useEffect(() => {
    if (!myPosition) {
      setPosition(null);
      return;
    }
    setPosition({
      outcome: outcomeLabel(myPosition.account.outcome),
      stake: formatTokenAmount(myPosition.account.amount),
      nextStep: nextStepLabel(account.status),
    });
    return () => setPosition(null);
  }, [myPosition, account.status, setPosition]);

  const stake = Number(stakeInput);
  const stakeValid = Number.isFinite(stake) && stake >= MIN_STAKE_DISPLAY && stake <= MAX_STAKE_DISPLAY;

  const others = myPosition ? positions.filter((p) => p.publicKey.toBase58() !== myPosition.publicKey.toBase58()) : positions;
  const counts = { Home: 0, Draw: 0, Away: 0 };
  for (const p of others) counts[outcomeLabel(p.account.outcome)]++;
  const breakdownSummary = (["Home", "Draw", "Away"] as const)
    .filter((label) => counts[label] > 0)
    .map((label) => `${counts[label]} on ${label}`)
    .join(", ");

  return (
    <div className="border border-gp-line bg-gp-surface px-5 py-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] tracking-[0.2em] text-gp-text-dim uppercase">Market pool</p>
        <span className="border border-gp-amber/40 px-2 py-0.5 font-mono text-[10px] tracking-wider text-gp-amber uppercase">
          {statusLabel(account.status)}
        </span>
      </div>

      <div className="tabular mt-3 divide-y divide-gp-line-soft">
        {rows.map(({ value, label, display }) => {
          const isMine = Boolean(myPosition) && outcomeLabel(myPosition!.account.outcome) === label;
          const isSelected = canJoin && selected === value;
          const pct = poolPercent(account, value);
          return (
            <button
              key={value}
              type="button"
              onClick={canJoin ? () => setSelected(value) : undefined}
              disabled={!canJoin}
              className={`flex w-full items-center justify-between gap-3 border-l-2 py-2.5 pl-2 text-left transition-colors ${
                canJoin ? "hover:bg-gp-surface-raised" : "cursor-default"
              } ${isSelected || isMine ? "border-gp-amber bg-gp-surface-raised" : "border-transparent"}`}
            >
              <span className={`font-mono text-sm font-semibold ${isMine ? "text-gp-amber" : "text-gp-text"}`}>{display}</span>
              <span className="flex items-center gap-2">
                <span className="text-right leading-tight">
                  <span className="block font-mono text-sm font-bold text-gp-text">{pct !== null ? `${pct}%` : "--"}</span>
                  <span className="block font-mono text-[10px] text-gp-text-faint">{formatTokenAmount(poolAmount(account, value))} staked</span>
                </span>
                {isMine ? (
                  <span className="shrink-0 border border-gp-amber px-1.5 py-0.5 font-mono text-[9px] tracking-wider text-gp-amber uppercase">You</span>
                ) : canJoin ? (
                  <span className={`shrink-0 font-mono text-sm ${isSelected ? "text-gp-amber" : "text-gp-text-faint"}`}>{isSelected ? "●" : "›"}</span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>

      <p className="tabular mt-3 text-center font-mono text-xs text-gp-text-dim">
        {account.participantCount} {account.participantCount === 1 ? "participant" : "participants"}
        {isOpen && !lockTimePassed && (
          <>
            {" · locks in "}
            <span className="text-gp-amber">{formatCountdown(account.lockTime.toNumber(), now)}</span>
          </>
        )}
      </p>
      {positions.length > 0 && (
        <p className="mt-1 text-center font-mono text-[11px] text-gp-text-faint">
          {myPosition && <span className="text-gp-amber">You&apos;re backing {outcomeLabel(myPosition.account.outcome)}. </span>}
          {breakdownSummary ? breakdownSummary : myPosition ? "No one else has joined yet." : "Nobody has joined yet."}
        </p>
      )}

      {canJoin && (
        <div className="mt-4 border-t border-gp-line-soft pt-4">
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
            onClick={() => run(() => onJoin(selected, stake))}
            disabled={busy || !stakeValid}
            className="w-full border border-gp-amber bg-gp-amber px-4 py-2 font-mono text-xs font-semibold tracking-wide text-gp-bg transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {state.status === "signing"
              ? "Confirm in wallet…"
              : state.status === "confirming"
                ? "Confirming…"
                : `Join with ${stakeValid ? stake.toFixed(2) : "—"} tokens backing ${rows.find((o) => o.value === selected)?.label}`}
          </button>
          {state.status === "failed" && <ErrorBanner message={state.message} onRetry={() => run(() => onJoin(selected, stake))} />}
        </div>
      )}

      {isOpen && lockTimePassed && !myPosition && (
        <p className="mt-4 border-t border-gp-line-soft pt-4 text-center font-mono text-xs text-gp-text-dim">
          Lock time has passed - waiting for someone to lock this market. Joining is no longer possible.
        </p>
      )}

      {myPosition && (
        <p className="mt-4 border-t border-gp-line-soft pt-4 text-center font-mono text-xs text-gp-text-dim">{nextStepLabel(account.status)}</p>
      )}
    </div>
  );
}
