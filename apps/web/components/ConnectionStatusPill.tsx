import type { StreamStatus } from "@/lib/replayStream";

const LABEL: Record<StreamStatus, string> = {
  connecting: "Connecting",
  live: "Replay Live",
  reconnecting: "Reconnecting",
};

const DOT_CLASS: Record<StreamStatus, string> = {
  connecting: "bg-gp-text-faint",
  live: "bg-gp-verified animate-pulse",
  reconnecting: "bg-gp-danger animate-pulse",
};

export function ConnectionStatusPill({ status }: { status: StreamStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 border border-gp-line px-2 py-1 font-mono text-[10px] tracking-wider text-gp-text-dim uppercase">
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS[status]}`} aria-hidden />
      {LABEL[status]}
    </span>
  );
}
