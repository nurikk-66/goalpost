export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 border border-dashed border-gp-line px-6 py-12 text-center">
      <p className="font-mono text-lg font-bold text-gp-text">{title}</p>
      <p className="max-w-sm text-sm text-gp-text-dim">{description}</p>
      {action}
    </div>
  );
}
