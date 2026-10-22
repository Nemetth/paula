"use client";

import { useFallaDeCarga } from "@/lib/supabase/data";

/** Shown when a table or setting didn't load. Without it an offline start reads as
 * "no clients yet" and invites Paula to enter them again. */
export function FallaDeCarga() {
  const falla = useFallaDeCarga();
  if (!falla) return null;
  return (
    <div
      role="alert"
      className="mx-4 mb-3 flex items-center gap-3 rounded-[14px] border border-[var(--color-error)] bg-bg-elevada px-4 py-2.5 text-[0.875rem] lg:mx-8"
    >
      <p className="min-w-0 flex-1 text-[var(--color-error)]">
        No se pudieron cargar tus datos. Lo que ves puede estar incompleto: revisá tu conexión.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="tocable shrink-0 rounded-[10px] border border-borde px-3 py-1.5 font-medium hover:bg-borde/40"
      >
        Reintentar
      </button>
    </div>
  );
}
