"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

// wallet-adapter-react's own `connecting` flag has no timeout - if the
// extension's connect() promise never settles (not installed, popup
// blocked, a stale `autoConnect` attempt against a wallet that's no longer
// there), the button is stuck on "Connecting..." forever with no way out
// short of a reload. MASTER_PLAN's reliability gate requires an explicit
// error/retry path instead, so this window bounds it ourselves.
const CONNECT_TIMEOUT_MS = 20_000;

// Built on the wallet-adapter hooks directly (not the library's default
// <WalletMultiButton>) so it can be styled to match the scoreboard theme
// instead of the library's default look.
export function WalletConnectButton() {
  const { publicKey, disconnect, connecting } = useWallet();
  const { setVisible } = useWalletModal();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!connecting) {
      setTimedOut(false);
      return;
    }
    const timeout = setTimeout(() => setTimedOut(true), CONNECT_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [connecting]);

  if (publicKey) {
    const short = `${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}`;
    return (
      <button
        onClick={() => void disconnect()}
        className="border border-gp-amber/40 px-3 py-1.5 font-mono text-xs tracking-wide text-gp-amber transition-colors hover:border-gp-amber"
      >
        {short}
      </button>
    );
  }

  if (timedOut) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-gp-danger">Wallet didn't respond</span>
        <button
          onClick={() => {
            setTimedOut(false);
            void disconnect().catch(() => {});
            setVisible(true);
          }}
          className="border border-gp-danger px-3 py-1.5 font-mono text-xs text-gp-danger transition-colors hover:bg-gp-danger/10"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setVisible(true)}
      disabled={connecting}
      className="border border-gp-amber bg-gp-amber px-4 py-1.5 font-mono text-xs font-semibold tracking-wide text-gp-bg transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {connecting ? "Connecting…" : "Connect wallet"}
    </button>
  );
}
