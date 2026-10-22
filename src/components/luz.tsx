"use client";

import { useEffect, useRef } from "react";

/** The pink pool of light at the top, tinted by the hour: a little peach in
 * the morning, the plain accent through the day, a little lilac at night.
 * The markup is the plain accent; the tint is applied after mount. */
const TONOS = {
  manana: "color-mix(in oklab, var(--color-acento) 70%, #ffc9a3)",
  dia: "var(--color-acento)",
  noche: "color-mix(in oklab, var(--color-acento) 65%, #b9a6f0)",
};

function tonoDeLaHora(d: Date): string {
  const h = d.getHours();
  return h >= 6 && h < 12 ? TONOS.manana : h >= 12 && h < 19 ? TONOS.dia : TONOS.noche;
}

export function Luz() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const pintar = () => ref.current?.style.setProperty("--luz-color", tonoDeLaHora(new Date()));
    pintar();
    const t = setInterval(pintar, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  return <div ref={ref} className="luz" aria-hidden />;
}
