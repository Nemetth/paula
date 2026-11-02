"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, MoreHorizontal } from "lucide-react";
import { ItemHoy, TarjetaHoy as Tarjeta } from "@/lib/domain/hoy";
import { FilaDeslizable } from "@/components/fila-deslizable";
import { OpcionSheet, Sheet } from "@/components/sheet";
import { Tilde } from "@/components/tilde";
import { cn } from "@/lib/utils";

/** What one piece of work reads as, inside an opened card. */
function tituloDe(item: ItemHoy): string {
  switch (item.tipo) {
    case "unidad":
      return item.asignacion.unidad.etiqueta;
    case "registro":
      return item.registro.etiqueta;
    case "ads":
      return item.cliente.nombre;
    case "fijo":
      return item.fijo.nombre;
  }
}

/** A client's work today: "Carla · 8 historias · 2 posteos". The tick takes the
 * whole card, or it opens to tick piece by piece. Slides like a row: right is
 * done, left is tomorrow, and the three dots say the same for who doesn't slide. */
export function TarjetaHoy({
  tarjeta: t,
  color,
  onTildar,
  onDeshacer,
  onManana,
}: {
  tarjeta: Tarjeta;
  color?: string;
  onTildar: (items: ItemHoy[]) => void;
  onDeshacer: (items: ItemHoy[]) => void;
  onManana: (t: Tarjeta) => void;
}) {
  const [abierta, setAbierta] = useState(false);
  const [menu, setMenu] = useState(false);
  const hecha = t.pendientes.length === 0;
  const seAbre = t.items.length > 1;
  const sePuedeMover = t.movibles.length > 0;

  return (
    <div className={cn("overflow-hidden rounded-[14px] border border-borde/70 bg-bg-elevada shadow-[var(--shadow-papel)]", hecha && "bg-bg-elevada/60")}>
      <FilaDeslizable onHecha={hecha ? undefined : () => onTildar(t.pendientes)} onManana={sePuedeMover ? () => onManana(t) : undefined}>
        <div className={cn("flex items-center gap-2.5 px-3 py-2", hecha && "opacity-55")}>
          <Tilde
            hecha={hecha}
            label={`Marcar ${t.titulo} como hecho`}
            onTildar={() => onTildar(t.pendientes)}
            onDeshacer={() => onDeshacer(t.items)}
          />
          <button
            onClick={() => seAbre && setAbierta((v) => !v)}
            aria-expanded={seAbre ? abierta : undefined}
            className={cn("min-w-0 flex-1 text-left", !seAbre && "cursor-default")}
          >
            <span className="flex items-center gap-1.5 text-[0.875rem] font-semibold leading-snug">
              {color && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden />}
              <span className="truncate">{t.titulo}</span>
            </span>
            <span className={cn("block text-[0.8125rem] leading-snug", hecha && "line-through decoration-texto-secundario/50")}>
              {t.partes.join(" · ")}
            </span>
            {t.detalle && <span className="block text-[0.75rem] leading-snug text-texto-secundario">{t.detalle}</span>}
          </button>
          {seAbre && (
            <ChevronDown size={15} aria-hidden className={cn("shrink-0 text-texto-secundario transition-transform duration-300", abierta && "rotate-180")} />
          )}
          {(sePuedeMover || t.clienteId) && (
            <button
              onClick={() => setMenu(true)}
              aria-label={`Más opciones de ${t.titulo}`}
              className="tocable -mr-1 shrink-0 rounded-full p-1 text-texto-secundario hover:bg-borde/50 hover:text-texto"
            >
              <MoreHorizontal size={16} />
            </button>
          )}
        </div>
      </FilaDeslizable>

      {abierta && seAbre && (
        <ul className="aparece flex flex-col border-t border-borde/70 px-3 py-1">
          {[...t.items].sort((a, b) => tituloDe(a).localeCompare(tituloDe(b), "es", { numeric: true })).map((item) => (
            <li key={item.clave} className={cn("flex items-center gap-2.5 py-1.5 text-[0.8125rem]", item.hecha && "opacity-55")}>
              <Tilde
                hecha={item.hecha}
                label={`Marcar ${tituloDe(item)} como hecho`}
                onTildar={() => onTildar([item])}
                onDeshacer={() => onDeshacer([item])}
              />
              <span className={cn("min-w-0 flex-1", item.hecha && "line-through decoration-texto-secundario/50")}>{tituloDe(item)}</span>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={menu} title={t.titulo} onClose={() => setMenu(false)}>
        <div className="flex flex-col gap-2">
          {sePuedeMover && (
            <OpcionSheet
              onClick={() => {
                setMenu(false);
                onManana(t);
              }}
            >
              Pasar a mañana
            </OpcionSheet>
          )}
          {t.conReporte && (
            <Link href="/ads" className="tocable rounded-[14px] border border-borde bg-bg px-4 py-3.5 text-[0.9375rem] font-medium hover:border-acento/40">
              Escribir el análisis del reporte
            </Link>
          )}
          {t.clienteId && (
            <Link
              href={`/clientes/${t.clienteId}`}
              className="tocable rounded-[14px] border border-borde bg-bg px-4 py-3.5 text-[0.9375rem] font-medium hover:border-acento/40"
            >
              Ver la ficha del cliente
            </Link>
          )}
        </div>
      </Sheet>
    </div>
  );
}
