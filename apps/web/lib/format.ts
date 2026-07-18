import type BN from "bn.js";

const DEMO_MINT_DECIMALS = 6;

export function formatTokenAmount(amount: BN, decimals = DEMO_MINT_DECIMALS): string {
  const divisor = Math.pow(10, decimals);
  return (amount.toNumber() / divisor).toFixed(2);
}

export function formatCountdown(targetUnixSeconds: number, nowMs: number): string {
  const remainingMs = targetUnixSeconds * 1000 - nowMs;
  if (remainingMs <= 0) return "0:00";
  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}
