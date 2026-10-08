/** Hoy's sun, drawn: slow-turning rays around a breathing core. Used where
 * "nothing to do" is good news. */
export function Sol({ size = 72 }: { size?: number }) {
  const rayos = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" aria-hidden>
      <g className="rayos">
        {rayos.map((a, i) => (
          <line
            key={a}
            x1="36"
            y1={i % 2 ? 9 : 5}
            x2="36"
            y2="14"
            stroke="var(--color-ambar)"
            strokeWidth="2.5"
            strokeLinecap="round"
            transform={`rotate(${a} 36 36)`}
            opacity={i % 2 ? 0.55 : 0.9}
          />
        ))}
      </g>
      <g className="late">
        <circle cx="36" cy="36" r="15" fill="color-mix(in oklab, var(--color-ambar) 35%, var(--color-terracota))" />
        <circle cx="31" cy="31" r="5" fill="#fff" opacity="0.28" />
      </g>
    </svg>
  );
}

export function EmptyState({
  title,
  detail,
  sol = false,
}: {
  title: string;
  detail: string;
  /** Show the sun: for empties that are good news, not missing setup. */
  sol?: boolean;
}) {
  return (
    <div className="papel entra flex flex-col items-center px-6 py-9 text-center">
      {sol && (
        <div className="mb-3">
          <Sol />
        </div>
      )}
      <p className="titulo-serif text-[1.25rem] font-medium">{title}</p>
      <p className="mt-1 max-w-[38ch] text-[0.9375rem] text-texto-secundario">{detail}</p>
    </div>
  );
}

/** Paper-shaped placeholders while Supabase answers — the page keeps its
 * shape instead of flashing a "Cargando..." line. */
export function Cargando() {
  return (
    <div className="mx-auto max-w-[640px] px-4 pt-2 lg:max-w-[880px] lg:px-8 lg:pt-4" aria-busy aria-label="Cargando">
      <div className="mb-2 h-3 w-28 animate-pulse rounded-full bg-borde/70" />
      <div className="mb-7 h-8 w-44 animate-pulse rounded-full bg-borde/70" />
      <div className="papel mb-4 h-[96px] animate-pulse" />
      <div className="papel h-[240px] animate-pulse" />
    </div>
  );
}
