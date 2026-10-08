"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** How long the tick plays before the write goes out — long enough to see
 * the check land, short enough to never feel like waiting. */
const DEMORA_ESCRITURA = 450;

/** The tick, the app's one authored moment: the circle fills green, the check
 * draws itself, a few sparks fly — then the write goes out and the plan
 * re-derives without the task. */
export function Tilde({ onTildar, label = "Marcar como hecho" }: { onTildar: () => void; label?: string }) {
  const [hecho, setHecho] = useState(false);
  return (
    <button
      onClick={() => {
        if (hecho) return;
        setHecho(true);
        navigator.vibrate?.(12);
        setTimeout(onTildar, DEMORA_ESCRITURA);
      }}
      data-hecho={hecho || undefined}
      aria-label={label}
      aria-pressed={hecho}
      className="group relative -m-1.5 shrink-0 rounded-full p-1.5"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" className="tilde block" aria-hidden>
        <circle
          cx="12"
          cy="12"
          r="10"
          strokeWidth="1.75"
          className={cn(
            "tilde-circulo",
            hecho
              ? "fill-verde stroke-verde"
              : "fill-transparent stroke-texto-secundario/70 group-hover:fill-verde/15 group-hover:stroke-verde",
          )}
        />
        <path
          d="M7.5 12.5l3 3 6-6.5"
          fill="none"
          stroke="var(--color-bg)"
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
