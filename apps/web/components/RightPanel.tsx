"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { useMarketContext } from "@/lib/marketContext";

/** "Your position at a glance" - desktop-only context panel (Jupiter reference). */
export function RightPanel() {
  const { publicKey } = useWallet();
  const { position } = useMarketContext();

  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-l border-gp-line bg-gp-bg xl:block">
      <div className="px-5 py-6">
        <p className="font-mono text-[11px] tracking-[0.2em] text-gp-text-dim uppercase">Your position</p>

        {!publicKey && (
          <div className="mt-4 border border-dashed border-gp-line px-4 py-6 text-center">
            <p className="mb-3 text-xs text-gp-text-dim">Connect to track your positions across markets.</p>
            <WalletConnectButton />
          </div>
        )}

        {publicKey && (
          <div className="mt-4 border border-gp-line bg-gp-surface px-4 py-4">
            <p className="font-mono text-sm font-bold text-gp-text">
              {publicKey.toBase58().slice(0, 4)}…{publicKey.toBase58().slice(-4)}
            </p>
            {position ? (
              <div className="mt-3 border-t border-gp-line-soft pt-3">
                <p className="font-mono text-xs text-gp-text-dim">
                  Backing <span className="text-gp-amber">{position.outcome}</span> · {position.stake} tokens
                </p>
                <p className="mt-1 font-mono text-[11px] text-gp-text-faint">{position.nextStep}</p>
              </div>
            ) : (
              <p className="mt-3 border-t border-gp-line-soft pt-3 font-mono text-xs text-gp-text-faint">No active position on this fixture yet.</p>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
