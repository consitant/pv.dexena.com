export function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg viewBox="0 0 32 32" className={small ? "h-7 w-7" : "h-9 w-9"} aria-hidden>
        <circle cx="16" cy="16" r="7" fill="#f59e0b" />
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4;
          return (
            <line
              key={i}
              x1={16 + Math.cos(a) * 10}
              y1={16 + Math.sin(a) * 10}
              x2={16 + Math.cos(a) * 14}
              y2={16 + Math.sin(a) * 14}
              stroke="#f59e0b"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          );
        })}
      </svg>
      <span className={`font-semibold tracking-tight ${small ? "text-base" : "text-xl"}`}>
        PV-Portal <span className="font-normal text-stone-400">dexena</span>
      </span>
    </span>
  );
}
