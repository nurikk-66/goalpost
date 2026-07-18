"use client";

// Route-level error boundary (MASTER_PLAN §3.1: the app must never
// white-screen).
export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-mono text-3xl font-bold text-gp-text">Something went wrong.</p>
      <p className="text-sm text-gp-text-dim">{error.message || "An unexpected error occurred."}</p>
      <button
        onClick={reset}
        className="border border-gp-amber bg-gp-amber px-4 py-2 font-mono text-xs font-semibold tracking-wide text-gp-bg hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}
