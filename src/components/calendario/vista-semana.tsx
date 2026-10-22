"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { DiaCalendario, colorCliente, diasDeLaSemana } from "@/lib/domain/calendario";
import { toISODate } from "@/lib/domain/dates";
import { fmtPiezas } from "@/lib/domain/planner";
import { Client } from "@/lib/domain/types";
import { IconoHito } from "@/components/entrega";
import { BotonPrimario, Sheet } from "@/components/sheet";
import { cn } from "@/lib/utils";

const SEMAFORO: Record<string, string> = {
  libre: "bg-verde",
  justo: "bg-ambar",
  sobrecargado: "bg-acento",
  "sin-capacidad": "bg-borde",
};

export function VistaSemana({
  ancla,
  dias,
  clients,
  hoyISO,
  onMover,
}: {
  ancla: Date;
  dias: Record<string, DiaCalendario>;
  clients: Client[];
  hoyISO: string;
  /** Called when a piece-based task is dropped on another day. */
  onMover: (piezaId: string, fecha: string) => void;
}) {
  const [sobre, setSobre] = useState<string | null>(null);
  // Dragging only exists with a mouse: tapping a task opens this to pick its day instead.
  const [moviendo, setMoviendo] = useState<{ piezaId: string; titulo: string; fecha: string } | null>(null);
  const semana = diasDeLaSemana(ancla);
  const desplazable = useRef<HTMLDivElement>(null);
  const inicioSemana = toISODate(semana[0]);

  // The week is wider than a phone: start on today's column instead of Monday's.
  useEffect(() => {
    const caja = desplazable.current;
    const hoy = caja?.querySelector<HTMLElement>(`[data-dia="${hoyISO}"]`);
    if (!caja) return;
    caja.scrollLeft = hoy
      ? Math.max(hoy.getBoundingClientRect().left - caja.getBoundingClientRect().left + caja.scrollLeft - 16, 0)
      : 0;
  }, [inicioSemana, hoyISO]);

  return (
    <div>
      <div ref={desplazable} className="-mx-4 overflow-x-auto px-4 pb-2 lg:mx-0 lg:overflow-visible lg:px-0">
        <div key={toISODate(semana[0])} className="aparece grid min-w-[1120px] grid-cols-7 gap-2 lg:min-w-0">
          {semana.map((d) => {
            const iso = toISODate(d);
            const info = dias[iso];
            const carga = info?.carga;
            return (
              <section
                key={iso}
                data-dia={iso}
                onDragOver={(e) => {
                  e.preventDefault();
                  setSobre(iso);
                }}
                onDragLeave={() => setSobre((s) => (s === iso ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  setSobre(null);
                  const piezaId = e.dataTransfer.getData("text/pieza");
                  if (piezaId) onMover(piezaId, iso);
                }}
                aria-label={format(d, "EEEE d", { locale: es })}
                className={cn(
                  "papel flex min-h-[200px] flex-col p-2 transition-[transform,box-shadow,border-color] duration-300",
                  sobre === iso && "-translate-y-1 border-acento/60 shadow-papel-alto",
                  iso === hoyISO && "ring-2 ring-acento/25",
                )}
              >
                <header className="mb-2 flex items-center justify-between">
                  <p className={cn("text-[0.8125rem] font-medium capitalize", iso === hoyISO && "text-acento-texto")}>
                    {format(d, "EEE d", { locale: es })}
                  </p>
                  <span
                    className={cn("h-2.5 w-2.5 rounded-full", SEMAFORO[carga?.semaforo ?? "sin-capacidad"])}
                    title={carga ? `${fmtPiezas(carga.carga)} de ${fmtPiezas(carga.capacidad)} piezas` : "Fuera del plan"}
                  />
                </header>
                <p className="mb-2 text-[0.8125rem] text-texto-secundario">
                  {carga ? `${fmtPiezas(carga.carga)} / ${fmtPiezas(carga.capacidad)} piezas` : "—"}
                </p>

                {info?.hitos.map((h, i) => (
                  <p
                    key={i}
                    className="mb-1.5 flex items-center gap-1.5 text-[0.8125rem] font-medium"
                    style={{ color: colorCliente(clients, h.clienteId) }}
                  >
                    <span className="shrink-0">
                      <IconoHito tipo={h.tipo} />
                    </span>
                    <span className="truncate text-texto">{h.detalle}</span>
                  </p>
                ))}

                <ul className="flex flex-col gap-1.5">
                  {info?.tareas.map((t) => {
                    const arrastrable = !!t.unidad.piezaId;
                    return (
                      <li
                        key={t.unidad.id}
                        draggable={arrastrable}
                        onDragStart={(e) => {
                          if (t.unidad.piezaId) e.dataTransfer.setData("text/pieza", t.unidad.piezaId);
                        }}
                        className={cn(
                          "rounded-[10px] bg-bg-hundida px-2 py-1.5 text-[0.8125rem] transition-[transform,box-shadow]",
                          arrastrable && "cursor-grab hover:-translate-y-px hover:shadow-papel active:cursor-grabbing",
                          t.atrasada && "bg-acento/10",
                        )}
                      >
                        {(() => {
                          const cliente = clients.find((c) => c.id === t.unidad.clienteId)?.nombre ?? "Tarea";
                          const contenido = (
                            <>
                              <span className="flex items-center gap-1.5">
                                <span
                                  className="h-2 w-2 shrink-0 rounded-full"
                                  style={{ background: colorCliente(clients, t.unidad.clienteId) }}
                                />
                                <span className="truncate font-medium">{cliente}</span>
                              </span>
                              <span className="block truncate text-texto-secundario">
                                {t.unidad.etiqueta}
                                {t.unidad.provisoria && " · provisoria"}
                              </span>
                            </>
                          );
                          return t.unidad.piezaId ? (
                            <button
                              onClick={() =>
                                setMoviendo({ piezaId: t.unidad.piezaId!, titulo: `${cliente} · ${t.unidad.etiqueta}`, fecha: iso })
                              }
                              aria-label={`Mover ${cliente}, ${t.unidad.etiqueta}, a otro día`}
                              className="tocable block w-full min-w-0 text-left"
                            >
                              {contenido}
                            </button>
                          ) : (
                            <div>{contenido}</div>
                          );
                        })()}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-[0.8125rem] text-texto-secundario">
        <span className="lg:hidden">Tocá una tarea para elegir otro día. </span>
        <span className="hidden lg:inline">
          Arrastrá una tarea a otro día (o tocala) para que no arranque antes de esa fecha.{" "}
        </span>
        Cada entrega se reparte parejo hasta su fecha objetivo.
      </p>

      <Sheet open={moviendo !== null} title="Mover tarea" onClose={() => setMoviendo(null)}>
        {moviendo && (
          <div className="flex flex-col gap-3">
            <p className="text-[0.9375rem] font-medium">{moviendo.titulo}</p>
            <label className="flex flex-col gap-1">
              <span className="text-[0.8125rem] font-medium text-texto-secundario">No arrancar antes del</span>
              <input
                type="date"
                value={moviendo.fecha}
                min={hoyISO}
                onChange={(e) => setMoviendo({ ...moviendo, fecha: e.target.value })}
                className="input"
              />
            </label>
            <p className="text-[0.8125rem] text-texto-secundario">El resto del plan se acomoda solo.</p>
            <BotonPrimario
              disabled={moviendo.fecha < hoyISO}
              onClick={() => {
                onMover(moviendo.piezaId, moviendo.fecha);
                setMoviendo(null);
              }}
            >
              Mover
            </BotonPrimario>
          </div>
        )}
      </Sheet>
    </div>
  );
}
