"use client";

import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";

// Phantom and Solflare are both Wallet Standard-compliant, so they
// auto-register with an empty adapter list (@solana/wallet-adapter-react
// >=0.15.32) - no need for explicit adapter instances. Deliberately NOT
// importing from @solana/wallet-adapter-wallets: that barrel package covers
// every supported wallet including WalletConnect, which drags in
// @reown/appkit -> viem -> ox plus pino/pino-pretty. Next dev mode doesn't
// tree-shake, so that whole multi-chain dependency graph was getting
// compiled on every hit to this route - the actual cause of the
// "Jest worker encountered N child process exceptions" OOM crash on this
// machine's limited RAM, not a test runner (there is none wired in here).
export function SolanaProvider({ children }: { children: React.ReactNode }) {
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={RPC_URL} config={{ commitment: "confirmed" }}>
      <WalletProvider wallets={wallets} autoConnect onError={(error) => console.error("[wallet]", error)}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
