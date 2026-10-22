"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** How long the tick plays before the write goes out — long enough to see
 * the check land, short enough to never feel like waiting. */
const DEMORA_ESCRITURA = 450;
/** How long the pop and the sparks keep playing after the tap. */
const DURACION_ANIMACION = 900;

/** The tick, the app's one authored moment: the circle fills pink, the check
 * draws itself, a few sparks fly — then the write goes out and the plan
 * re-derives. Once done it stays filled; tapping it again undoes it.
 *
 * `hecha` is the truth from the data; the tap animates on its own meanwhile. */
export function Tilde({
  hecha = false,
  onTildar,
  onDeshacer,
  label = "Marcar como hecho",
}: {
  hecha?: boolean;
  onTildar: () => void;
  onDeshacer?: () => void;
  label?: string;
}) {
  const [animando, setAnimando] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const pendientes = timers.current;
    return () => pendientes.forEach(clearTimeout);
  }, []);

  const lleno = hecha || animando;
  return (
    <button
      onClick={() => {
        if (animando) return;
        if (hecha) {
          onDeshacer?.();
          return;
        }
        setAnimando(true);
        navigator.vibrate?.(12);
        timers.current.push(setTimeout(onTildar, DEMORA_ESCRITURA));
        timers.current.push(setTimeout(() => setAnimando(false), DURACION_ANIMACION));
      }}
      data-hecho={animando || undefined}
      data-listo={(hecha && !animando) || undefined}
      aria-label={hecha ? "Deshacer" : label}
      aria-pressed={lleno}
      className="group relative -m-1.5 shrink-0 rounded-full p-1.5"
    >
      <svg width="26" height="26" viewBox="0 0 24 24" className="tilde block" aria-hidden>
        <circle
          cx="12"
          cy="12"
          r="10"
          strokeWidth="1.75"
          className={cn(
            "tilde-circulo",
            lleno
              ? "fill-acento stroke-acento"
              : "fill-transparent stroke-texto-secundario/60 group-hover:fill-acento/25 group-hover:stroke-acento",
          )}
        />
        <path
          d="M7.5 12.5l3 3 6-6.5"
          fill="none"
          stroke="var(--color-sobre-acento)"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="tilde-check"
        />
      </svg>
      <span className="chispa" aria-hidden>
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <i key={a} style={{ "--a": `${a}deg` } as React.CSSProperties} />
        ))}
      </span>
    </button>
  );
}
