/** Mini-Sparkline (SVG, serverseitig) für Portfolio-Karten. */
export function Sparkline({ values, width = 160, height = 40, light = false }: { values: number[]; width?: number; height?: number; light?: boolean }) {
  if (values.length < 2) {
    return <div style={{ width, height }} className={`rounded-xl ${light ? "bg-white/10" : "bg-mist"}`} aria-hidden />;
  }
  const max = Math.max(1, ...values);
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => [i * step, height - (v / max) * (height - 4) - 2] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const id = `sp${values.length}${Math.round(max)}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={light ? "#ffffff" : "#855ced"} stopOpacity="0.45" />
          <stop offset="100%" stopColor={light ? "#ffffff" : "#ff7049"} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={light ? "#ffffff" : "#855ced"} strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  );
}
