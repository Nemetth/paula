"use client";

import { useRef, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** How far a row has to be dragged before letting go commits the action. */
const UMBRAL = 84;
/** Past this the row stops following the finger, so it can't be flung off screen. */
const MAXIMO = 132;

/** A row that can be slid sideways: right marks it done, left sends it to
 * tomorrow. The action it will trigger shows behind it while dragging. Works
 * with finger or mouse; vertical scroll is untouched (`touch-action: pan-y`). */
export function FilaDeslizable({
  children,
  onHecha,
  onManana,
  className,
}: {
  children: React.ReactNode;
  /** Slide right. Leave out when the row can't be ticked. */
  onHecha?: () => void;
  /** Slide left. Leave out when the row can't move. */
  onManana?: () => void;
  className?: string;
}) {
  const [dx, setDx] = useState(0);
  const [suelto, setSuelto] = useState(true);
  const inicio = useRef<{ x: number; y: number; id: number } | null>(null);
  const arrastrando = useRef(false);

  const limite = (v: number) => {
    const max = v > 0 ? (onHecha ? MAXIMO : 0) : onManana ? -MAXIMO : 0;
    return v > 0 ? Math.min(v, max) : Math.max(v, max);
  };

  function soltar() {
    const final = dx;
    inicio.current = null;
    arrastrando.current = false;
    setSuelto(true);
    setDx(0);
    if (final >= UMBRAL && onHecha) onHecha();
    else if (final <= -UMBRAL && onManana) onManana();
  }

  const activa = dx > 0 ? "hecha" : dx < 0 ? "manana" : null;
  const lista = Math.abs(dx) >= UMBRAL;

  return (
    <div className={cn("relative overflow-hidden rounded-[14px]", className)}>
      {activa && (
        <div
          aria-hidden
          className={cn(
            "absolute inset-0 flex items-center px-5 text-[0.8125rem] font-medium",
            activa === "hecha" ? "justify-start bg-acento/70 text-sobre-acento" : "justify-end bg-bg-hundida text-texto",
          )}
        >
          <span className={cn("flex items-center gap-1.5 transition-transform", lista && "scale-110")}>
            {activa === "hecha" ? (
              <>
                <Check size={18} strokeWidth={2.5} /> Hecha
              </>
            ) : (
              <>
                Mañana <ArrowRight size={18} strokeWidth={2.25} />
              </>
            )}
          </span>
        </div>
      )}
      <div
        className="deslizable relative bg-bg-elevada"
        data-suelto={suelto || undefined}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          inicio.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
        }}
        onPointerMove={(e) => {
          const i = inicio.current;
          if (!i || i.id !== e.pointerId) return;
          const mx = e.clientX - i.x;
          const my = e.clientY - i.y;
          if (!arrastrando.current) {
            // Decide the gesture once: sideways drags the row, vertical ones scroll the page.
            if (Math.abs(mx) < 8 || Math.abs(mx) < Math.abs(my) * 1.5) return;
            arrastrando.current = true;
            setSuelto(false);
            e.currentTarget.setPointerCapture(e.pointerId);
          }
          setDx(limite(mx));
        }}
        onPointerUp={() => arrastrando.current && soltar()}
        onPointerCancel={() => arrastrando.current && soltar()}
      >
        {children}
      </div>
    </div>
  );
}
