export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-4 border border-gp-danger/40 bg-gp-danger/10 px-4 py-3">
      <p className="text-sm text-gp-text">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="shrink-0 border border-gp-danger px-3 py-1 font-mono text-xs text-gp-danger hover:bg-gp-danger/10">
          Retry
        </button>
      )}
    </div>
  );
}
