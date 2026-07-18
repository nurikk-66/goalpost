import type { Metadata } from "next";
import localFont from "next/font/local";
import { SolanaProvider } from "@/components/providers/SolanaProvider";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

// Self-hosted rather than next/font/google: both families are variable fonts
// (one file covers every weight), and fetching them from Google's CDN at
// dev-compile time was racing against webpack's own CPU usage on this
// machine and timing out (3s per attempt) well before the request actually
// failed on the network - curl and a bare Node `fetch()` to the same CDN
// both succeeded instantly outside that contention. Self-hosting removes
// the network round-trip from the compile step entirely.
//
// Big Shoulders is scoped to one place only (the scoreboard's live score
// numeral) per docs/DESIGN.md's protocol-grade direction - IBM Plex Mono is
// the dominant voice everywhere else, including body copy that used to be
// IBM Plex Sans.
const bigShoulders = localFont({
  src: "./fonts/BigShoulders-Variable.woff2",
  weight: "700 900",
  variable: "--font-big-shoulders",
  display: "swap",
});

const plexMono = localFont({
  src: "./fonts/IBMPlexMono-Variable.woff2",
  weight: "400 600",
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Goalpost — every result comes with a receipt",
  description: "A trustless World Cup settlement engine on Solana, verified on-chain against TxLINE's cryptographic proofs.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bigShoulders.variable} ${plexMono.variable}`}>
      <body>
        <SolanaProvider>
          <AppShell>{children}</AppShell>
        </SolanaProvider>
      </body>
    </html>
  );
}
