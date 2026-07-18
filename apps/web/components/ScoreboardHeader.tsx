import type { DemoFixture } from "@/lib/fixtures-data";
import type { StreamStatus } from "@/lib/replayStream";
import { ConnectionStatusPill } from "@/components/ConnectionStatusPill";

export function ScoreboardHeader({
  fixture,
  liveScore,
  status,
}: {
  fixture: DemoFixture;
  liveScore?: { home: number; away: number };
  status: StreamStatus;
}) {
  return (
    <header className="relative overflow-hidden border-b border-gp-line bg-gp-surface px-5 py-6 sm:px-8">
      {/* the one angled accent shape, used only here (Chanel-rule discipline, see Phase 4 plan) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rotate-12 bg-gp-amber/5"
        style={{ clipPath: "polygon(20% 0%, 100% 0%, 80% 100%, 0% 100%)" }}
      />
      <div className="relative flex items-center justify-between gap-4">
        <p className="font-mono text-[11px] tracking-[0.2em] text-gp-text-dim uppercase">
          {fixture.competition} · Fixture #{fixture.fixtureId}
        </p>
        <ConnectionStatusPill status={status} />
      </div>
      <div className="relative mt-3 flex flex-col items-start gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <p className="font-mono text-lg font-bold leading-none text-gp-text sm:text-3xl">
          {fixture.participant1} <span className="text-gp-text-faint">vs</span> {fixture.participant2}
        </p>
        {/* The one deliberate exception to monospace-everywhere (docs/DESIGN.md): the live score numeral, the single place Big Shoulders still appears. */}
        <p className="tabular font-display text-4xl font-black leading-none text-gp-amber sm:text-5xl">
          {liveScore ? `${liveScore.home}–${liveScore.away}` : "–:–"}
        </p>
      </div>
    </header>
  );
}
