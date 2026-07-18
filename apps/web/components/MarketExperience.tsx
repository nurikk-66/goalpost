"use client";

import { useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { DemoFixture } from "@/lib/fixtures-data";
import { useDemoRound } from "@/lib/useDemoRound";
import { useMarketAccount } from "@/lib/useMarketAccount";
import { useReplayChannel } from "@/lib/replayStream";
import { OddsRecordSchema, ScoreRecordSchema } from "@/lib/zodSchemas";
import { useTxState } from "@/lib/useTxState";
import { getBundledResult } from "@/lib/proof";
import { ScoreboardHeader } from "@/components/ScoreboardHeader";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { MarketPoolCard } from "@/components/MarketPoolCard";
import { OddsSparkline } from "@/components/OddsSparkline";
import { JoinPanel } from "@/components/JoinPanel";
import { LockSettleControls } from "@/components/LockSettleControls";
import { ClaimPanel } from "@/components/ClaimPanel";
import { VerificationReceipt } from "@/components/VerificationReceipt";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ScrollAssembleArt } from "@/components/art/ScrollAssembleArt";
import { SprintingDribbler, GoalkeeperDive } from "@/components/art/FootballFigures";

// `settleSignature` only exists for the lifetime of this component instance
// (it's the return value of the live settle() call, not persisted) - a page
// reload after settling loses the receipt's tx link until the round is
// settled again. Acceptable for a single continuous demo session; a
// production build would look up the signature from tx history instead.
export function MarketExperience({ fixture }: { fixture: DemoFixture }) {
  const { publicKey } = useWallet();
  const { program, round, startRound, joinRound, lockRound, settleRound, claimRound } = useDemoRound(fixture.fixtureId);
  const { account, error: accountError } = useMarketAccount(program, round?.market);
  const startTx = useTxState();
  const [settleSignature, setSettleSignature] = useState<string | undefined>(undefined);

  const scores = useReplayChannel("scores", fixture.fixtureId, ScoreRecordSchema);
  const odds = useReplayChannel("odds", fixture.fixtureId, OddsRecordSchema);

  const liveScore = scores.latest
    ? { home: scores.latest.Score.Participant1.Total.Goals, away: scores.latest.Score.Participant2.Total.Goals }
    : fixture.finalScore;

  const homeImpliedProbability = useMemo(
    () =>
      odds.history
        .filter((o) => o.SuperOddsType === "1X2_PARTICIPANT_RESULT")
        .map((o) => parseFloat(o.Pct[0]))
        .filter((v) => !Number.isNaN(v)),
    [odds.history]
  );

  const bundledResult = getBundledResult();

  return (
    <div className="relative mx-auto min-h-screen max-w-3xl overflow-hidden pb-16">
      <ScoreboardHeader fixture={fixture} liveScore={liveScore} status={scores.status} />

      {/* Football-silhouette line-art, docs/DESIGN.md "Imagery" - decorative
          only, behind the interactive column, never over it. */}
      <ScrollAssembleArt className="pointer-events-none absolute -left-20 top-24 h-72 w-72 opacity-[0.06] sm:-left-28 sm:h-96 sm:w-96">
        <SprintingDribbler />
      </ScrollAssembleArt>
      <ScrollAssembleArt className="pointer-events-none absolute -right-16 bottom-8 h-64 w-64 opacity-[0.06] sm:-right-24 sm:h-80 sm:w-80">
        <GoalkeeperDive />
      </ScrollAssembleArt>

      <div className="relative flex flex-col gap-4 px-4 py-6 sm:px-8">
        <div className="flex items-center justify-between border border-gp-line bg-gp-surface px-5 py-4">
          <div>
            <p className="font-mono text-[11px] tracking-[0.2em] text-gp-text-dim uppercase">Home win probability</p>
            <p className="tabular font-mono text-2xl font-bold text-gp-text">
              {homeImpliedProbability.length ? `${homeImpliedProbability[homeImpliedProbability.length - 1].toFixed(1)}%` : "--"}
            </p>
          </div>
          <OddsSparkline values={homeImpliedProbability} />
        </div>

        {!publicKey && (
          <EmptyState
            title="Connect a devnet wallet"
            description="This demo runs entirely on Solana devnet - connect a wallet with devnet SOL to create a market, join it, and watch it settle trustlessly."
            action={<WalletConnectButton />}
          />
        )}

        {publicKey && !round && (
          <EmptyState
            title="Start a demo round"
            description="Creates a fresh market for this fixture, using your wallet as creator. Everything after this - joining, locking, settling, claiming - is also triggered by your own wallet, because the contract doesn't need an admin."
            action={
              <button
                onClick={() => startTx.run(() => startRound().then((r) => r.market.toBase58()))}
                disabled={startTx.state.status === "signing" || startTx.state.status === "confirming"}
                className="border border-gp-amber bg-gp-amber px-4 py-2 font-mono text-xs font-semibold tracking-wide text-gp-bg transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {startTx.state.status === "signing"
                  ? "Confirm in wallet…"
                  : startTx.state.status === "confirming"
                    ? "Creating market…"
                    : "Start demo round"}
              </button>
            }
          />
        )}
        {startTx.state.status === "failed" && (
          <ErrorBanner message={startTx.state.message} onRetry={() => startTx.run(() => startRound().then((r) => r.market.toBase58()))} />
        )}

        {round && accountError && <ErrorBanner message={`Couldn't load market state: ${accountError}`} />}

        {round && account && (
          <>
            <MarketPoolCard account={account} />

            {"open" in account.status && <JoinPanel onJoin={joinRound} />}

            {("open" in account.status || "locked" in account.status) && (
              <LockSettleControls account={account} onLock={lockRound} onSettle={settleRound} onSettled={setSettleSignature} />
            )}

            {("settled" in account.status || "claimed" in account.status) && !("claimed" in account.status) && (
              <ClaimPanel onClaim={claimRound} />
            )}

            {("settled" in account.status || "claimed" in account.status) && settleSignature && (
              <VerificationReceipt
                fixtureId={fixture.fixtureId}
                homeGoals={account.settlementHomeGoals}
                awayGoals={account.settlementAwayGoals}
                eventStatRoot={bundledResult.settleArgs.eventStatRoot}
                settleSignature={settleSignature}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
