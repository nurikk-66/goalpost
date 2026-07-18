import Link from "next/link";
import { FIXTURES } from "@/lib/fixtures-data";
import { ScrollAssembleArt } from "@/components/art/ScrollAssembleArt";
import { BicycleKick, CelebrationPose } from "@/components/art/FootballFigures";

// Server component - no client JS needed for a static fixture list
// (performance gate, MASTER_PLAN §3.2). ScrollAssembleArt is a client
// component but Server Components can render Client Components as children
// directly - this doesn't force the page itself to become client-rendered.
export default function HomePage() {
  return (
    <main className="relative mx-auto min-h-screen max-w-3xl overflow-hidden px-4 py-10 sm:px-6">
      {/* Football-silhouette line-art, docs/DESIGN.md "Imagery" - decorative,
          bleeding off-canvas at section edges, never over interactive
          content. Low-contrast on purpose (atmosphere, not focus). */}
      <ScrollAssembleArt className="pointer-events-none absolute -right-16 top-0 h-72 w-72 opacity-[0.14] sm:-right-24 sm:h-96 sm:w-96">
        <BicycleKick />
      </ScrollAssembleArt>
      <ScrollAssembleArt className="pointer-events-none absolute -left-20 bottom-0 h-64 w-64 opacity-[0.11] sm:-left-28 sm:h-80 sm:w-80">
        <CelebrationPose />
      </ScrollAssembleArt>

      <header className="relative mb-10">
        <p className="font-mono text-xs tracking-[0.2em] text-gp-text-dim uppercase">Goalpost</p>
        <h1 className="font-mono text-4xl leading-none font-bold tracking-tight text-gp-text sm:text-5xl">
          Every result comes
          <br />
          with a receipt.
        </h1>
        <p className="mt-4 max-w-xl text-sm text-gp-text-dim">
          A trustless World Cup settlement engine on Solana. Outcomes are verified on-chain against TxLINE&apos;s
          cryptographic proofs - funds move by verification, not by trust.
        </p>
      </header>

      <section aria-labelledby="fixtures-heading" className="relative">
        <h2 id="fixtures-heading" className="mb-3 font-mono text-xs tracking-[0.2em] text-gp-text-dim uppercase">
          Fixtures
        </h2>
        <ul className="flex flex-col gap-3">
          {FIXTURES.map((fixture) => {
            const card = (
              <div
                className={`group relative overflow-hidden rounded-none border px-5 py-4 transition-colors ${
                  fixture.interactive
                    ? "border-gp-amber/40 bg-gp-surface hover:border-gp-amber"
                    : "border-gp-line-soft bg-gp-surface/50"
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-mono text-[11px] tracking-wide text-gp-text-faint">
                      {fixture.competition} · #{fixture.fixtureId}
                    </p>
                    <p className="font-mono text-xl font-bold text-gp-text">
                      {fixture.participant1} <span className="text-gp-text-faint">vs</span> {fixture.participant2}
                    </p>
                  </div>
                  {fixture.interactive ? (
                    <span className="shrink-0 border border-gp-amber px-2 py-1 font-mono text-[10px] tracking-wider text-gp-amber uppercase">
                      Live demo
                    </span>
                  ) : (
                    <span className="shrink-0 font-mono text-[10px] tracking-wider text-gp-text-faint uppercase">Preview</span>
                  )}
                </div>
                {fixture.finalScore && (
                  <p className="tabular mt-2 font-mono text-2xl font-bold text-gp-amber">
                    {fixture.finalScore.home} – {fixture.finalScore.away}
                  </p>
                )}
                {!fixture.interactive && (
                  <p className="mt-2 font-mono text-[11px] text-gp-text-faint">Not yet live for this demo - only fixture #{FIXTURES.find((f) => f.interactive)?.fixtureId} has a recorded replay feed and a captured settlement proof wired up.</p>
                )}
              </div>
            );

            return (
              <li key={fixture.fixtureId}>
                {fixture.interactive ? (
                  <Link href={`/fixtures/${fixture.fixtureId}`} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-gp-amber">
                    {card}
                  </Link>
                ) : (
                  <div aria-disabled="true" className="cursor-not-allowed opacity-60">
                    {card}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
