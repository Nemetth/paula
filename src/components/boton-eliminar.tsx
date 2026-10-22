"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const ESPERA = 4000;

/** A trash button that asks before it deletes: the first tap arms it ("¿Seguro?"),
 * the second one deletes. It disarms by itself, so a stray tap does nothing. */
export function BotonEliminar({
  etiqueta,
  onConfirmar,
  className,
}: {
  /** What is being deleted, for the accessible name ("pieza", "gasto"). */
  etiqueta: string;
  onConfirmar: () => void;
  className?: string;
}) {
  const [armado, setArmado] = useState(false);

  useEffect(() => {
    if (!armado) return;
    const t = setTimeout(() => setArmado(false), ESPERA);
    return () => clearTimeout(t);
  }, [armado]);

  return (
    <button
      type="button"
      onClick={() => {
        if (!armado) return setArmado(true);
        setArmado(false);
        onConfirmar();
      }}
      onBlur={() => setArmado(false)}
      aria-label={armado ? `Confirmar: eliminar ${etiqueta}` : `Eliminar ${etiqueta}`}
      className={cn(
        "tocable flex shrink-0 items-center justify-center rounded-full text-texto-secundario transition-colors",
        armado
          ? "bg-acento/20 px-3 py-2 text-[0.8125rem] font-semibold text-acento-texto"
          : "-m-1 p-2.5 hover:bg-acento/10 hover:text-acento-texto",
        className,
      )}
    >
      {armado ? "¿Seguro?" : <Trash2 size={16} />}
    </button>
  );
}
