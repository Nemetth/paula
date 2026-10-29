"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronDown, Plus } from "lucide-react";
import { BotonEliminar } from "@/components/boton-eliminar";
import { AvancePorTipo, SEMAFORO_ENTREGA, SemaforoPunto } from "@/components/entrega";
import {
  actualizarGrabacion,
  actualizarPieza,
  actualizarPiezas,
  crearGrabacion,
  crearPiezas,
  eliminarGrabacion,
  eliminarPieza,
} from "@/lib/supabase/data";
import { grabacionDeLaPieza } from "@/lib/domain/ciclos";
import { Entrega } from "@/lib/domain/entregas";
import { fromISODate, toISODate } from "@/lib/domain/dates";
import { TIPO_PIEZA_LABEL } from "@/lib/domain/labels";
import { Client, Grabacion, ORDEN_TIPOS, PieceType, Pieza } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { Seccion, botonPrimario, botonSecundario, campo, listaFilas } from "./seccion";

const fecha = (iso: string) => format(fromISODate(iso), "d MMM", { locale: es });
const check = "h-[18px] w-[18px] shrink-0 accent-[var(--color-oscuro)]";

function useGuardar() {
  const [error, setError] = useState<string | null>(null);
  async function guardar(accion: () => Promise<unknown>) {
    setError(null);
    try {
      await accion();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar. Probá de nuevo.");
    }
  }
  return { error, guardar };
}

/** The pieces of each delivery still open, as a checklist. They are generated
 * from the client's volume when the cycle opens; ticking one is the only thing
 * to do, and the plan re-derives from it. */
export function SeccionPiezas({ piezas, entregas }: { piezas: Pieza[]; entregas: Entrega[] }) {
  const abiertas = entregas.filter((e) => e.semaforo !== "lista");
  const sinFecha = piezas.filter((p) => !p.fechaEntrega && !p.hecha);

  if (abiertas.length === 0 && sinFecha.length === 0) return null;
  return (
    <Seccion titulo="Piezas" detalle="Tildá lo que vas terminando. Con «Seleccionar» marcás varias de una.">
      <div className="flex flex-col gap-4">
        {abiertas.map((e, i) => (
          <BloqueEntrega
            key={e.fecha}
            titulo={`Entrega ${fecha(e.fecha)}`}
            entrega={e}
            piezas={piezas.filter((p) => p.fechaEntrega === e.fecha)}
            abierto={i === 0}
          />
        ))}
        {sinFecha.length > 0 && <BloqueEntrega titulo="Sin fecha de entrega" piezas={sinFecha} abierto={abiertas.length === 0} />}
      </div>
    </Seccion>
  );
}

function BloqueEntrega({
  titulo,
  entrega,
  piezas,
  abierto: abiertoAlInicio,
}: {
  titulo: string;
  entrega?: Entrega;
  piezas: Pieza[];
  abierto: boolean;
}) {
  const { error, guardar } = useGuardar();
  const [abierto, setAbierto] = useState(abiertoAlInicio);
  /** `null` = not selecting: a tap ticks the piece. Otherwise a tap selects it. */
  const [seleccion, setSeleccion] = useState<Set<string> | null>(null);

  const hechas = piezas.filter((p) => p.hecha).length;
  const porTipo = ORDEN_TIPOS.map((tipo) => ({
    tipo,
    suyas: piezas
      .filter((p) => p.tipo === tipo)
      .sort((a, b) => (a.titulo ?? "").localeCompare(b.titulo ?? "", "es", { numeric: true })),
  })).filter((g) => g.suyas.length > 0);

  function alternar(ids: string[], si: boolean) {
    setSeleccion((s) => {
      const next = new Set(s ?? []);
      ids.forEach((id) => (si ? next.add(id) : next.delete(id)));
      return next;
    });
  }

  function aplicar(hecha: boolean) {
    const ids = [...(seleccion ?? [])];
    void guardar(async () => {
      await actualizarPiezas(ids, { hecha });
      setSeleccion(null);
    });
  }

  function eliminar() {
    const ids = [...(seleccion ?? [])];
    void guardar(async () => {
      await Promise.all(ids.map((id) => eliminarPieza(id)));
      setSeleccion(null);
    });
  }

  return (
    <div className="papel overflow-hidden">
      <button
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        className="tocable flex w-full items-center gap-2.5 px-4 py-3 text-left"
      >
        {entrega && <SemaforoPunto semaforo={entrega.semaforo} />}
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{titulo}</span>
          <span className="numeros block text-[0.8125rem] text-texto-secundario">
            {hechas} de {piezas.length} hechas
            {entrega && ` · ${SEMAFORO_ENTREGA[entrega.semaforo].label.toLowerCase()}`}
            {entrega?.esperaAprobacion ? " · esperan la aprobación" : entrega?.esperaGrabacion && " · reels esperan la grabación"}
          </span>
        </span>
        <ChevronDown size={18} className={cn("shrink-0 text-texto-secundario transition-transform duration-300", abierto && "rotate-180")} />
      </button>

      {abierto && (
        <div className="aparece border-t border-borde/70 px-2 pb-3 pt-2">
          <div className="mb-1 flex items-center justify-end gap-2 px-2">
            {seleccion ? (
              <>
                <button onClick={() => alternar(piezas.map((p) => p.id), true)} className="text-[0.8125rem] font-medium text-acento-texto">
                  Todas
                </button>
                <button onClick={() => setSeleccion(null)} className={`${botonSecundario} py-1.5 text-[0.8125rem]`}>
                  Cancelar
                </button>
              </>
            ) : (
              <button onClick={() => setSeleccion(new Set())} className={`${botonSecundario} py-1.5 text-[0.8125rem]`}>
                Seleccionar
              </button>
            )}
          </div>

          {porTipo.map(({ tipo, suyas }) => {
            const hechasTipo = suyas.filter((p) => p.hecha).length;
            return (
              <div key={tipo} className="mt-2">
                <div className="flex items-center justify-between px-2 pb-1">
                  <p className="numeros text-[0.8125rem] font-medium capitalize text-texto-secundario">
                    {TIPO_PIEZA_LABEL[tipo].varios} {hechasTipo}/{suyas.length}
                  </p>
                  {seleccion && (
                    <button
                      onClick={() => alternar(suyas.map((p) => p.id), !suyas.every((p) => seleccion.has(p.id)))}
                      className="text-[0.75rem] font-medium text-acento-texto"
                    >
                      {suyas.every((p) => seleccion.has(p.id)) ? "Ninguna" : "Todas las " + TIPO_PIEZA_LABEL[tipo].varios}
                    </button>
                  )}
                </div>
                <ul className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
                  {suyas.map((p) => {
                    const marcada = seleccion ? seleccion.has(p.id) : p.hecha;
                    return (
                      <li key={p.id}>
                        <label
                          className={cn(
                            "tocable flex cursor-pointer items-center gap-3 rounded-[10px] px-2 py-2.5",
                            seleccion && marcada && "bg-acento/15",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={marcada}
                            onChange={(e) =>
                              seleccion
                                ? alternar([p.id], e.target.checked)
                                : void guardar(() => actualizarPieza(p.id, { hecha: e.target.checked }))
                            }
                            aria-label={seleccion ? `Seleccionar ${p.titulo ?? p.tipo}` : `${p.titulo ?? p.tipo} hecha`}
                            className={check}
                          />
                          <span className={cn("min-w-0 flex-1 truncate", !seleccion && p.hecha && "text-texto-secundario line-through")}>
                            {p.titulo ?? TIPO_PIEZA_LABEL[p.tipo].uno}
                          </span>
                          {seleccion && p.hecha && <span className="text-[0.75rem] text-texto-secundario">hecha</span>}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}

          {!seleccion && <PiezaExtra piezas={piezas} entrega={entrega} guardar={guardar} />}

          {seleccion && seleccion.size > 0 && (
            <div className="aparece sticky bottom-[calc(96px+env(safe-area-inset-bottom,0px))] mt-3 flex flex-wrap items-center gap-2 rounded-[14px] bg-bg-elevada p-2 shadow-[var(--shadow-papel-alto)] lg:bottom-4">
              <span className="numeros px-1 text-[0.875rem] font-medium">
                {seleccion.size} {seleccion.size === 1 ? "elegida" : "elegidas"}
              </span>
              <button onClick={() => aplicar(true)} className={`${botonPrimario} ml-auto py-1.5`}>
                Hechas
              </button>
              <button onClick={() => aplicar(false)} className={`${botonSecundario} py-1.5`}>
                Pendientes
              </button>
              <BotonEliminar etiqueta={`${seleccion.size} piezas`} onConfirmar={eliminar} />
            </div>
          )}
          {error && <p className="mt-2 px-2 text-[0.8125rem] text-[var(--color-error)]">{error}</p>}
        </div>
      )}
    </div>
  );
}

const TITULO_TIPO: Record<PieceType, string> = { historia: "Historia", posteo: "Posteo", reel: "Reel" };

/** One more piece for this delivery only ("this month she wants an extra
 * historia"), numbered after the last one of its type. The client's volume
 * stays as it is. */
function PiezaExtra({
  piezas,
  entrega,
  guardar,
}: {
  piezas: Pieza[];
  entrega?: Entrega;
  guardar: (accion: () => Promise<unknown>) => Promise<void>;
}) {
  const [tipo, setTipo] = useState<PieceType>("historia");
  const base = piezas[0];
  if (!base) return null;

  function agregar() {
    const numeros = piezas
      .filter((p) => p.tipo === tipo)
      .map((p) => Number(p.titulo?.match(/(\d+)\s*$/)?.[1] ?? 0));
    const n = Math.max(0, ...numeros) + 1;
    void guardar(() =>
      crearPiezas([
        {
          clienteId: base.clienteId,
          tipo,
          titulo: `${TITULO_TIPO[tipo]} ${n}`,
          fechaEntrega: entrega?.fecha ?? base.fechaEntrega,
          cicloId: base.cicloId,
        },
      ]),
    );
  }

  return (
    <div className="mt-3 flex items-center gap-2 border-t border-borde/70 px-2 pt-3">
      <span className="flex-1 text-[0.8125rem] text-texto-secundario">¿Una pieza extra para esta entrega?</span>
      <select
        value={tipo}
        onChange={(e) => setTipo(e.target.value as PieceType)}
        aria-label="Tipo de pieza extra"
        className={`${campo} py-1.5 text-[0.875rem]`}
      >
        {ORDEN_TIPOS.map((t) => (
          <option key={t} value={t}>
            {TITULO_TIPO[t]}
          </option>
        ))}
      </select>
      <button onClick={agregar} className={`${botonSecundario} py-1.5 text-[0.875rem]`}>
        <Plus size={14} className="-mt-0.5 inline" /> Sumar
      </button>
    </div>
  );
}

/** Finished deliveries, newest first: what was handed in and when. */
export function SeccionHistorial({ entregas }: { entregas: Entrega[] }) {
  const listas = entregas.filter((e) => e.semaforo === "lista").reverse();
  return (
    <Seccion titulo="Entregas terminadas">
      {listas.length === 0 ? (
        <p className="text-[0.9375rem] text-texto-secundario">Todavía no hay entregas terminadas.</p>
      ) : (
        <ul className={listaFilas}>
          {listas.map((e) => (
            <li key={e.fecha} className="flex flex-col gap-1.5 px-2 py-3">
              <p className="flex items-center justify-between text-[0.9375rem]">
                <span className="font-medium">Entrega {fecha(e.fecha)}</span>
                <span className="numeros text-[0.8125rem] text-texto-secundario">{e.total} piezas</span>
              </p>
              <AvancePorTipo porTipo={e.porTipo} compacta />
            </li>
          ))}
        </ul>
      )}
    </Seccion>
  );
}

export function SeccionGrabaciones({ cliente, grabaciones, piezas }: { cliente: Client; grabaciones: Grabacion[]; piezas: Pieza[] }) {
  const { error, guardar } = useGuardar();
  const [nueva, setNueva] = useState(toISODate(new Date()));
  const [antes, setAntes] = useState(0);
  const [despues, setDespues] = useState(0);

  const ordenadas = [...grabaciones].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const pendientesDe = (g: Grabacion) =>
    piezas.filter((p) => !p.hecha && p.tipo === "reel" && grabacionDeLaPieza(p, cliente, grabaciones)?.id === g.id).length;

  return (
    <Seccion
      titulo="Grabaciones"
      detalle="Cada grabación bloquea el día entero más el viaje. Los reels de la entrega entran al plan cuando la marcás como hecha; historias y posteos no la esperan."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          guardar(() => crearGrabacion({ clienteId: cliente.id, fecha: nueva, viajeDiasAntes: antes, viajeDiasDespues: despues }));
        }}
        className="mb-3 flex flex-wrap items-end gap-2"
      >
        <label className="flex flex-col gap-1 text-[0.8125rem] text-texto-secundario">
          Fecha
          <input type="date" value={nueva} onChange={(e) => setNueva(e.target.value)} className={campo} />
        </label>
        <label className="flex flex-col gap-1 text-[0.8125rem] text-texto-secundario">
          Viaje antes (días)
          <input type="number" min={0} max={7} value={antes} onChange={(e) => setAntes(Number(e.target.value))} className={`${campo} w-24`} />
        </label>
        <label className="flex flex-col gap-1 text-[0.8125rem] text-texto-secundario">
          Viaje después (días)
          <input type="number" min={0} max={7} value={despues} onChange={(e) => setDespues(Number(e.target.value))} className={`${campo} w-24`} />
        </label>
        <button type="submit" className={botonPrimario}>
          Agregar
        </button>
      </form>
      {error && <p className="mb-2 text-[0.8125rem] text-[var(--color-error)]">{error}</p>}

      {ordenadas.length === 0 ? (
        <p className="text-[0.9375rem] text-texto-secundario">No hay grabaciones.</p>
      ) : (
        <ul className={listaFilas}>
          {ordenadas.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center gap-3 px-2 py-2.5">
              <input
                type="date"
                value={g.fecha}
                onChange={(e) =>
                  // A half-typed year ("0002-10-20") must never reach the plan.
                  e.target.value >= "2000-01-01" && guardar(() => actualizarGrabacion(g.id, { fecha: e.target.value }))
                }
                aria-label="Fecha de grabación"
                className={`${campo} py-1.5`}
              />
              <p className="min-w-0 flex-1 basis-32 text-[0.8125rem] text-texto-secundario">
                {g.hecha ? "Hecha" : `${pendientesDe(g)} ${pendientesDe(g) === 1 ? "reel espera" : "reels esperan"}`}
                {g.viajeDiasAntes + g.viajeDiasDespues > 0 ? ` · viaje ${g.viajeDiasAntes}+${g.viajeDiasDespues} d` : ""}
              </p>
              <label className="flex items-center gap-2 text-[0.9375rem]">
                <input
                  type="checkbox"
                  checked={g.hecha}
                  onChange={(e) => guardar(() => actualizarGrabacion(g.id, { hecha: e.target.checked }))}
                  className="h-[16px] w-[16px] accent-[var(--color-oscuro)]"
                />
                Hecha
              </label>
              <BotonEliminar etiqueta="grabación" onConfirmar={() => guardar(() => eliminarGrabacion(g.id))} />
            </li>
          ))}
        </ul>
      )}
    </Seccion>
  );
}
