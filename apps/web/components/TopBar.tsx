"use client";

import { WalletConnectButton } from "@/components/WalletConnectButton";
import { MenuIcon } from "@/components/icons";
import { useMarketContext } from "@/lib/marketContext";

/**
 * Persistent top bar (Jupiter reference): a live-ish ticker on pages that
 * have one (populated by MarketExperience.tsx via MarketContext), a
 * restyled Devnet badge, and the wallet connect button, all in one place
 * on every page - not just a thin strip above otherwise-empty space.
 */
export function TopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { ticker } = useMarketContext();

  return (
    <header className="sticky top-0 z-40 border-b border-gp-line bg-gp-bg/95 backdrop-blur">
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button onClick={onOpenMenu} aria-label="Open menu" className="text-gp-text-dim hover:text-gp-text lg:hidden">
            <MenuIcon className="h-5 w-5" />
          </button>
          {ticker ? (
            <div className="tabular flex min-w-0 items-center gap-3 overflow-hidden font-mono text-[11px] text-gp-text-dim">
              <span className="truncate text-gp-text">{ticker.fixtureLabel}</span>
              <span className="hidden text-gp-amber sm:inline">{ticker.score}</span>
              {ticker.homeWinPct && <span className="hidden md:inline">Home {ticker.homeWinPct}%</span>}
              <span className="hidden md:inline">Pool {ticker.poolTotal}</span>
              <span className="hidden text-gp-verified sm:inline">{ticker.connectionLabel}</span>
            </div>
          ) : (
            <span className="font-mono text-[11px] tracking-wide text-gp-text-faint">Prediction Markets · Settlement Engine</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="border border-gp-verified/40 px-1.5 py-0.5 font-mono text-[9px] tracking-wider text-gp-verified uppercase">Devnet</span>
          <WalletConnectButton />
        </div>
      </div>
    </header>
  );
}
