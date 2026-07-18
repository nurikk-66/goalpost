// Hand-rolled SVG sparkline - no chart library (bundle discipline, MASTER_PLAN §3.2).
export function OddsSparkline({ values, width = 160, height = 32, color = "var(--color-gp-amber)" }: { values: number[]; width?: number; height?: number; color?: string }) {
  if (values.length < 2) {
    return <div style={{ width, height }} className="flex items-center justify-center font-mono text-[10px] text-gp-text-faint">--</div>;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);

  const points = values.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Odds movement sparkline">
      <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
