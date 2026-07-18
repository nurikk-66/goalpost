// Anonymous, faceless football-motion silhouettes (docs/DESIGN.md "Imagery")
// - pictogram-style, in the spirit of Olympic sport pictograms: a head
// circle, a torso capsule, and four limb capsules per figure, each rotated
// from a joint pivot. No real player's likeness, no photography - abstract
// geometric line-art is the point, not a limitation.
//
// Every shape carries `.gp-fragment` so ScrollAssembleArt's
// IntersectionObserver-driven `.gp-assembled` class (see
// globals.css/ScrollAssembleArt.tsx) can animate it in from a scattered
// starting position. `--gp-fragment-delay` staggers the assembly.

interface LimbProps {
  cx: number;
  cy: number;
  length: number;
  angle: number;
  width?: number;
  delay?: number;
}

/** A single capsule shape pivoting around (cx, cy), extending `length` at `angle` degrees (SVG rotate convention). */
function Limb({ cx, cy, length, angle, width = 13, delay = 0 }: LimbProps) {
  return (
    <rect
      className="gp-fragment"
      style={
        {
          "--gp-fragment-delay": `${delay}ms`,
          "--gp-fragment-dx": `${(cx - 100) * 0.3}px`,
          "--gp-fragment-dy": `${-30 - (delay % 4) * 6}px`,
          "--gp-fragment-rot": `${angle > 0 ? 12 : -12}deg`,
        } as React.CSSProperties
      }
      x={cx - width / 2}
      y={cy}
      width={width}
      height={length}
      rx={width / 2}
      transform={`rotate(${angle} ${cx} ${cy})`}
      fill="currentColor"
    />
  );
}

function Head({ cx, cy, r = 15, delay = 0 }: { cx: number; cy: number; r?: number; delay?: number }) {
  return (
    <circle
      className="gp-fragment"
      style={{ "--gp-fragment-delay": `${delay}ms`, "--gp-fragment-dy": "-24px" } as React.CSSProperties}
      cx={cx}
      cy={cy}
      r={r}
      fill="currentColor"
    />
  );
}

function Ball({ cx, cy, r = 10, delay = 0 }: { cx: number; cy: number; r?: number; delay?: number }) {
  return (
    <circle
      className="gp-fragment"
      style={{ "--gp-fragment-delay": `${delay}ms`, "--gp-fragment-dx": "18px", "--gp-fragment-dy": "-10px" } as React.CSSProperties}
      cx={cx}
      cy={cy}
      r={r}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
    />
  );
}

function endPoint(cx: number, cy: number, length: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx - length * Math.sin(rad), y: cy + length * Math.cos(rad) };
}

const wrapperProps = {
  viewBox: "0 0 220 220",
  className: "text-gp-line-strong h-full w-full",
  "aria-hidden": true,
} as const;

/** Mid-air overhead (bicycle) kick - torso horizontal, kicking leg overhead, trailing leg extended back. */
export function BicycleKick() {
  const neck = { x: 95, y: 75 };
  const hip = endPoint(neck.x, neck.y, 52, -55);
  return (
    <svg {...wrapperProps}>
      <Head cx={neck.x - 6} cy={neck.y - 18} delay={0} />
      <Limb cx={neck.x} cy={neck.y} length={52} angle={-55} delay={80} />
      <Limb cx={hip.x} cy={hip.y} length={62} angle={-155} width={14} delay={160} />
      <Limb cx={hip.x} cy={hip.y} length={50} angle={-15} width={14} delay={240} />
      <Limb cx={neck.x} cy={neck.y - 4} length={38} angle={140} width={11} delay={200} />
      <Limb cx={neck.x} cy={neck.y - 4} length={36} angle={-40} width={11} delay={200} />
      <Ball cx={hip.x + 40} cy={hip.y - 70} delay={320} />
    </svg>
  );
}

/** Full sprint, low body lean, high knee drive, ball at feet. */
export function SprintingDribbler() {
  const neck = { x: 100, y: 60 };
  const hip = endPoint(neck.x, neck.y, 55, -18);
  return (
    <svg {...wrapperProps}>
      <Head cx={neck.x - 8} cy={neck.y - 16} delay={0} />
      <Limb cx={neck.x} cy={neck.y} length={55} angle={-18} delay={80} />
      <Limb cx={hip.x} cy={hip.y} length={48} angle={-70} width={14} delay={160} />
      <Limb cx={hip.x} cy={hip.y} length={46} angle={35} width={14} delay={200} />
      <Limb cx={neck.x} cy={neck.y - 2} length={34} angle={-110} width={10} delay={200} />
      <Limb cx={neck.x} cy={neck.y - 2} length={34} angle={60} width={10} delay={240} />
      <Ball cx={hip.x - 6} cy={hip.y + 62} delay={300} />
    </svg>
  );
}

/** Goalkeeper full-stretch dive - body fully extended horizontal, arms reaching. */
export function GoalkeeperDive() {
  const neck = { x: 70, y: 110 };
  const hip = endPoint(neck.x, neck.y, 50, -92);
  return (
    <svg {...wrapperProps}>
      <Head cx={neck.x + 18} cy={neck.y - 6} delay={0} />
      <Limb cx={neck.x} cy={neck.y} length={50} angle={-92} delay={80} />
      <Limb cx={hip.x} cy={hip.y} length={48} angle={-95} width={14} delay={160} />
      <Limb cx={hip.x} cy={hip.y} length={46} angle={-70} width={14} delay={200} />
      <Limb cx={neck.x} cy={neck.y - 2} length={46} angle={-100} width={11} delay={120} />
      <Limb cx={neck.x} cy={neck.y - 2} length={30} angle={-40} width={11} delay={200} />
      <Ball cx={neck.x - 46} cy={neck.y - 14} delay={280} />
    </svg>
  );
}

/** Celebration - upright, arms raised, one knee lifted. */
export function CelebrationPose() {
  const neck = { x: 100, y: 70 };
  const hip = endPoint(neck.x, neck.y, 55, 4);
  return (
    <svg {...wrapperProps}>
      <Head cx={neck.x} cy={neck.y - 18} delay={0} />
      <Limb cx={neck.x} cy={neck.y} length={55} angle={4} delay={80} />
      <Limb cx={hip.x} cy={hip.y} length={50} angle={8} width={14} delay={160} />
      <Limb cx={hip.x} cy={hip.y} length={44} angle={-95} width={14} delay={200} />
      <Limb cx={neck.x} cy={neck.y - 4} length={44} angle={-165} width={11} delay={220} />
      <Limb cx={neck.x} cy={neck.y - 4} length={44} angle={165} width={11} delay={220} />
    </svg>
  );
}
