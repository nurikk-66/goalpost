import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-mono text-3xl font-bold text-gp-text">Fixture not found.</p>
      <p className="text-sm text-gp-text-dim">This fixture doesn&apos;t have an interactive demo market.</p>
      <Link href="/" className="border border-gp-amber px-4 py-2 font-mono text-xs tracking-wide text-gp-amber hover:bg-gp-amber/10">
        Back to fixtures
      </Link>
    </div>
  );
}
