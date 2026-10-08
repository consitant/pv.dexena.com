/** Drahtgitter-Kugel (Linien-Ellipsen) als Deko-Element im dexena-Stil. */
export function WireSphere({
  size = 240,
  color = "#cdb9ff",
  lines = 14,
  tilt = -18,
  className = "",
  strokeWidth = 1,
}: {
  size?: number;
  color?: string;
  lines?: number;
  tilt?: number;
  className?: string;
  strokeWidth?: number;
}) {
  const r = 50;
  return (
    <svg
      viewBox="-52 -52 104 104"
      width={size}
      height={size}
      className={`pointer-events-none select-none ${className}`}
      aria-hidden
      focusable="false"
    >
      <g transform={`rotate(${tilt})`} fill="none" stroke={color} strokeWidth={strokeWidth * (104 / size) * 1.4}>
        <circle r={r} />
        {Array.from({ length: lines }, (_, i) => {
          const rx = r * Math.abs(Math.cos(((i + 0.5) / lines) * Math.PI));
          return <ellipse key={i} rx={rx} ry={r} />;
        })}
      </g>
    </svg>
  );
}
