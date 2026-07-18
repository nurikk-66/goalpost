"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export interface MarketTicker {
  fixtureLabel: string;
  score: string;
  homeWinPct: string | null;
  poolTotal: string;
  connectionLabel: string;
}

export interface PositionSummary {
  outcome: "Home" | "Draw" | "Away";
  stake: string;
  nextStep: string;
}

interface MarketContextValue {
  ticker: MarketTicker | null;
  setTicker: (t: MarketTicker | null) => void;
  position: PositionSummary | null;
  setPosition: (p: PositionSummary | null) => void;
}

const MarketContext = createContext<MarketContextValue | null>(null);

/**
 * The persistent top bar and right-side "position at a glance" panel
 * (app/layout.tsx, rendered on every page) need "current fixture" data
 * that only actually exists on the fixture/market page. Rather than
 * prop-drilling through the server-rendered root layout, the market page
 * (MarketExperience.tsx) pushes its live ticker/position state into this
 * context, and the shell reads whatever's there - null everywhere else,
 * which the shell renders as a neutral default rather than faking data.
 */
export function MarketContextProvider({ children }: { children: ReactNode }) {
  const [ticker, setTicker] = useState<MarketTicker | null>(null);
  const [position, setPosition] = useState<PositionSummary | null>(null);
  const value = useMemo(() => ({ ticker, setTicker, position, setPosition }), [ticker, position]);
  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

export function useMarketContext(): MarketContextValue {
  const ctx = useContext(MarketContext);
  if (!ctx) throw new Error("useMarketContext must be used within MarketContextProvider");
  return ctx;
}
