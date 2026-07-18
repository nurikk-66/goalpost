import Link from "next/link";

// Persistent hairline-framed nav so every page (including the fixture/market
// page, which previously had no way back) can get back to the fixtures
// list. Deliberately thin - the homepage keeps its own large hero; this is
// just the utility bar, per docs/DESIGN.md's restrained-hairline direction.
export function SiteHeader() {
  return (
    <header className="border-b border-gp-line bg-gp-bg">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-mono text-sm font-bold tracking-[0.15em] text-gp-text uppercase focus:outline-none focus-visible:ring-2 focus-visible:ring-gp-amber">
            Goalpost
          </Link>
          {/* Honesty as a trust signal, not a disclaimer to hide - see
              docs/POSITIONING.md's Q&A section on the trust model. */}
          <span className="border border-gp-verified/40 px-1.5 py-0.5 font-mono text-[9px] tracking-wider text-gp-verified uppercase">Devnet</span>
        </div>
        <p className="hidden font-mono text-[11px] tracking-wide text-gp-text-faint sm:block">every result comes with a receipt</p>
      </div>
    </header>
  );
}
