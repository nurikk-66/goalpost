"use client";

import { useState } from "react";
import { TXORACLE_PROGRAM_ID } from "@goalpost/sdk";
import { shortAddress } from "@/lib/format";

function bytesToHex(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function truncateHex(hex: string): string {
  return `${hex.slice(0, 8)}…${hex.slice(-8)}`;
}

/** Stagger step between rows "printing" in sequence - see globals.css's receipt-row-print keyframe and the stamp/glow-pulse delays, which are tuned to fire after ROW_COUNT * ROW_STAGGER_MS (8 rows here). */
const ROW_STAGGER_MS = 90;
function rowDelay(index: number) {
  return `${index * ROW_STAGGER_MS}ms`;
}

/**
 * The signature element (docs/POSITIONING.md §5, §1: "every result comes
 * with a receipt"): styled as a thermal-printer receipt - perforated top
 * edge, monospace tabular content, a rotated VERIFIED stamp, and a real
 * devnet explorer link so the verification is checkable, not just claimed.
 * Per docs/DESIGN.md's revised Motion section, it assembles line-by-line as
 * if printing rather than revealing as one block.
 */
export function VerificationReceipt({
  fixtureId,
  homeGoals,
  awayGoals,
  eventStatRoot,
  settleSignature,
}: {
  fixtureId: number;
  homeGoals: number;
  awayGoals: number;
  eventStatRoot: number[];
  settleSignature: string;
}) {
  const [copied, setCopied] = useState(false);
  const rootHex = bytesToHex(eventStatRoot);

  return (
    <div className="receipt-panel relative border border-gp-amber/30 bg-gp-surface-raised px-5 pb-5 pt-2 font-mono text-gp-text">
      <div className="receipt-perforation -mx-5 mb-3" aria-hidden />

      <div
        className="receipt-stamp absolute right-5 top-8 border-2 border-gp-verified px-3 py-1 text-xs font-bold tracking-widest text-gp-verified"
        style={{ transform: "rotate(-8deg)" }}
      >
        VERIFIED ✓
      </div>

      <p className="receipt-row text-[10px] tracking-[0.2em] text-gp-text-faint uppercase" style={{ animationDelay: rowDelay(0) }}>
        Verification receipt
      </p>
      <p className="receipt-row mt-1 text-lg font-bold text-gp-amber" style={{ animationDelay: rowDelay(1) }}>
        Fixture #{fixtureId}
      </p>

      <dl className="tabular mt-4 space-y-1.5 text-xs">
        <Row delay={2} label="Final score" value={`${homeGoals} – ${awayGoals}`} />
        <Row delay={3} label="TxLINE program" value={shortAddress(TXORACLE_PROGRAM_ID.toBase58())} />
        <Row
          delay={4}
          label="Merkle root"
          value={
            <button
              onClick={() => {
                void navigator.clipboard.writeText(rootHex);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="underline decoration-dotted hover:text-gp-amber"
              title={rootHex}
            >
              {copied ? "copied" : truncateHex(rootHex)}
            </button>
          }
        />
        <Row
          delay={5}
          label="Settle tx"
          value={
            <a
              href={`https://explorer.solana.com/tx/${settleSignature}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
              className="text-gp-amber underline decoration-dotted hover:opacity-80"
            >
              {shortAddress(settleSignature)} ↗
            </a>
          }
        />
      </dl>

      <p className="receipt-row mt-4 text-[10px] leading-relaxed text-gp-text-faint" style={{ animationDelay: rowDelay(6) }}>
        No one told this contract who won. It CPI&apos;d into TxLINE&apos;s real <code>validate_stat_v2</code> on-chain and
        derived the outcome from the proven values itself.
      </p>

      {/* decorative, non-scannable */}
      <div className="receipt-row mt-3 flex h-6 items-end gap-[2px] opacity-40" style={{ animationDelay: rowDelay(7) }} aria-hidden>
        {Array.from({ length: 40 }).map((_, i) => (
          <div key={i} className="bg-gp-text" style={{ width: 1, height: `${((i * 37) % 20) + 6}px` }} />
        ))}
      </div>
    </div>
  );
}

function Row({ label, value, delay }: { label: string; value: React.ReactNode; delay: number }) {
  return (
    <div className="receipt-row flex items-center justify-between gap-4 border-b border-dashed border-gp-line pb-1.5" style={{ animationDelay: rowDelay(delay) }}>
      <dt className="text-gp-text-faint">{label}</dt>
      <dd className="text-right text-gp-text">{value}</dd>
    </div>
  );
}
