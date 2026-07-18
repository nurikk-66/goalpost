import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // apps/replay is started in-process via instrumentation.ts (see docs/ARCHITECTURE.md
  // Phase 4 notes) - needs Node's instrumentation hook, on by default in Next 15.
  reactStrictMode: true,
  // This machine has ~3.9GB RAM total, often <500MB free - parallel compile
  // workers were OOM-crashing on the wallet-adapter route (jest-worker
  // "child process exceptions, exceeding retry limit"). One worker is
  // slower but survives.
  experimental: { cpus: 1 },
};

export default nextConfig;
