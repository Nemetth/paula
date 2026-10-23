"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface Panel {
  id: string;
  titulo: string;
  contenido: React.ReactNode;
}

/** Side-by-side panels with tabs: swipe between them on the phone, click the
 * tabs (or use the arrow keys) on desktop. One scroll-snapping row, so the
 * swipe is the browser's own and the tabs just follow where it lands. */
export function Paneles({ paneles, inicial = 0 }: { paneles: Panel[]; inicial?: number }) {
  const fila = useRef<HTMLDivElement>(null);
  const [activo, setActivo] = useState(inicial);

  useEffect(() => {
    const el = fila.current;
    if (el && inicial > 0) el.scrollTo({ left: inicial * el.clientWidth });
    // Only on mount: afterwards the scroll position is the source of truth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function ir(i: number) {
    const el = fila.current;
    if (!el) return;
    const destino = Math.min(Math.max(i, 0), paneles.length - 1);
    el.scrollTo({ left: destino * el.clientWidth, behavior: "smooth" });
    setActivo(destino);
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Secciones del cliente"
        className="papel sticky top-[52px] z-20 mb-5 flex gap-1 p-1"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") ir(activo + 1);
          if (e.key === "ArrowLeft") ir(activo - 1);
        }}
      >
        {paneles.map((p, i) => (
          <button
            key={p.id}
            role="tab"
            id={`tab-${p.id}`}
            aria-selected={i === activo}
            aria-controls={`panel-${p.id}`}
            tabIndex={i === activo ? 0 : -1}
            onClick={() => ir(i)}
            className={cn(
              "tocable flex-1 rounded-[12px] px-2 py-2 text-[0.9375rem] font-medium transition-colors",
              i === activo ? "bg-acento/15 text-acento-texto" : "text-texto-secundario hover:bg-borde/40",
            )}
          >
            {p.titulo}
          </button>
        ))}
      </div>

      <div
        ref={fila}
        onScroll={(e) => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / Math.max(el.clientWidth, 1));
          if (i !== activo) setActivo(i);
        }}
        className="sin-barra flex snap-x snap-mandatory items-start overflow-x-auto overscroll-x-contain"
      >
        {paneles.map((p, i) => (
          <section
            key={p.id}
            id={`panel-${p.id}`}
            role="tabpanel"
            aria-labelledby={`tab-${p.id}`}
            // Off-screen panels stay out of the tab order and the screen reader's way.
            inert={i !== activo}
            className="w-full shrink-0 snap-start snap-always px-0.5"
          >
            {p.contenido}
          </section>
        ))}
      </div>
    </div>
  );
}
