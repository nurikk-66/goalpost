"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { OutcomeArg } from "@goalpost/sdk";
import type { DemoFixture } from "@/lib/fixtures-data";
import { useDemoRound } from "@/lib/useDemoRound";
import { useMarketAccount } from "@/lib/useMarketAccount";
import { usePositions } from "@/lib/usePositions";
import { useReplayChannel } from "@/lib/replayStream";
import { OddsRecordSchema, ScoreRecordSchema } from "@/lib/zodSchemas";
import { useTxState } from "@/lib/useTxState";
import { useMarketContext } from "@/lib/marketContext";
import { getBundledResult } from "@/lib/proof";
import { formatTokenAmount } from "@/lib/format";
import { ScoreboardHeader } from "@/components/ScoreboardHeader";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { MarketPanel } from "@/components/MarketPanel";
import { OddsSparkline } from "@/components/OddsSparkline";
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
  const { account, error: accountError, refetch: refetchAccount } = useMarketAccount(program, round?.market);
  const { positions, refetch: refetchPositions } = usePositions(program, round?.market);
  const startTx = useTxState();
  const [settleSignature, setSettleSignature] = useState<string | undefined>(undefined);

  // The public devnet RPC doesn't reliably push accountSubscribe updates
  // (see useMarketAccount.ts) - without an explicit refetch after each
  // action, the pool card would keep showing stale (often all-zero) totals
  // even after a confirmed join/lock/settle/claim, which reads as broken.
  const handleJoin = useCallback(
    async (outcome: OutcomeArg, stake: number) => {
      const signature = await joinRound(outcome, stake);
      await Promise.all([refetchAccount(), refetchPositions()]);
      return signature;
    },
    [joinRound, refetchAccount, refetchPositions]
  );
  const handleLock = useCallback(async () => {
    const signature = await lockRound();
    await refetchAccount();
    return signature;
  }, [lockRound, refetchAccount]);
  const handleSettle = useCallback(async () => {
    const signature = await settleRound();
    await refetchAccount();
    return signature;
  }, [settleRound, refetchAccount]);
  const handleClaim = useCallback(async () => {
    const signature = await claimRound();
    await Promise.all([refetchAccount(), refetchPositions()]);
    return signature;
  }, [claimRound, refetchAccount, refetchPositions]);

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

  const { setTicker } = useMarketContext();
  useEffect(() => {
    setTicker({
      fixtureLabel: `${fixture.participant1} vs ${fixture.participant2}`,
      score: liveScore ? `${liveScore.home}–${liveScore.away}` : "–:–",
      homeWinPct: homeImpliedProbability.length ? homeImpliedProbability[homeImpliedProbability.length - 1].toFixed(1) : null,
      poolTotal: account ? formatTokenAmount(account.totalHome.add(account.totalDraw).add(account.totalAway)) : "—",
      connectionLabel: scores.status === "live" ? "Replay Live" : scores.status === "reconnecting" ? "Reconnecting" : "Connecting",
    });
    return () => setTicker(null);
  }, [setTicker, fixture, liveScore, homeImpliedProbability, account, scores.status]);

  return (
    <div className="relative mx-auto min-h-screen max-w-3xl overflow-hidden pb-16">
      <ScoreboardHeader fixture={fixture} liveScore={liveScore} status={scores.status} />

      {/* Football-silhouette line-art, docs/DESIGN.md "Imagery" - decorative
          only, behind the interactive column, never over it. */}
      <ScrollAssembleArt className="pointer-events-none absolute -left-20 top-24 h-72 w-72 opacity-[0.11] sm:-left-28 sm:h-96 sm:w-96">
        <SprintingDribbler />
      </ScrollAssembleArt>
      <ScrollAssembleArt className="pointer-events-none absolute -right-16 bottom-8 h-64 w-64 opacity-[0.11] sm:-right-24 sm:h-80 sm:w-80">
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
            <MarketPanel fixture={fixture} account={account} positions={positions} walletPublicKey={publicKey ?? undefined} onJoin={handleJoin} />

            {("open" in account.status || "locked" in account.status) && (
              <LockSettleControls account={account} onLock={handleLock} onSettle={handleSettle} onSettled={setSettleSignature} />
            )}

            {("settled" in account.status || "claimed" in account.status) && !("claimed" in account.status) && (
              <ClaimPanel onClaim={handleClaim} />
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
