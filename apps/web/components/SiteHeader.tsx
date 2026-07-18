import Link from "next/link";

// Persistent hairline-framed nav so every page (including the fixture/market
// page, which previously had no way back) can get back to the fixtures
// list. Given more vertical presence per the Jupiter-reference note ("make
// sure it's visually present and grounding on every page, not just a thin
// strip") - the tagline is now always shown (stacked below the wordmark on
// mobile, inline on larger screens) rather than hidden below sm:, so the
// page never feels like a single lonely screen with no context above it.
export function SiteHeader() {
  return (
    <header className="border-b border-gp-line bg-gp-bg">
      <div className="mx-auto flex max-w-3xl flex-col gap-1 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-5">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-mono text-base font-bold tracking-[0.15em] text-gp-text uppercase focus:outline-none focus-visible:ring-2 focus-visible:ring-gp-amber">
            Goalpost
          </Link>
          {/* Honesty as a trust signal, not a disclaimer to hide - see
              docs/POSITIONING.md's Q&A section on the trust model. */}
          <span className="border border-gp-verified/40 px-1.5 py-0.5 font-mono text-[9px] tracking-wider text-gp-verified uppercase">Devnet</span>
        </div>
        <p className="font-mono text-[11px] tracking-wide text-gp-text-faint">every result comes with a receipt</p>
      </div>
    </header>
  );
}
