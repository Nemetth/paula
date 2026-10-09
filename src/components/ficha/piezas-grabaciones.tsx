"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Trash2 } from "lucide-react";
import {
  actualizarGrabacion,
  asignarGrabacion,
  actualizarPieza,
  crearGrabacion,
  crearPiezas,
  eliminarGrabacion,
  eliminarPieza,
} from "@/lib/supabase/data";
import { fechaEntregaDe, publicadoHasta } from "@/lib/domain/planner";
import { fromISODate, toISODate } from "@/lib/domain/dates";
import { ESTADO_PIEZA_LABEL } from "@/lib/domain/labels";
import { Client, Grabacion, PIEZA_ESTADOS, PieceType, Pieza, PiezaEstado } from "@/lib/domain/types";
import { Seccion, botonPrimario, campo, listaFilas } from "./seccion";

const TIPO_LABEL: Record<PieceType, string> = { historia: "Historia", posteo: "Posteo", reel: "Reel" };
const fecha = (iso: string) => format(fromISODate(iso), "d MMM", { locale: es });

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

export function SeccionCiclo({
  piezas,
  grabaciones,
  cliente,
  todasLasPiezas,
}: {
  piezas: Pieza[];
  grabaciones: Grabacion[];
  cliente: Client;
  todasLasPiezas: Pieza[];
}) {
  const hoy = toISODate(new Date());
  const proximaGrabacion = grabaciones
    .filter((g) => !g.hecha && g.fecha >= hoy)
    .map((g) => g.fecha)
    .sort()[0];
  const hasta = publicadoHasta(cliente.id, todasLasPiezas);

  return (
    <Seccion titulo="Ciclo actual">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[0.9375rem]">
        <dt className="text-texto-secundario">Próxima grabación</dt>
        <dd className="text-right font-medium">{proximaGrabacion ? fecha(proximaGrabacion) : "—"}</dd>
        <dt className="text-texto-secundario">Publicado hasta</dt>
        <dd className="text-right font-medium">{hasta ? fecha(hasta) : "—"}</dd>
      </dl>
      <ul className="mt-3 flex flex-wrap gap-2">
        {PIEZA_ESTADOS.map((e) => {
          const n = piezas.filter((p) => p.estado === e).length;
          return n > 0 ? (
            <li key={e} className="rounded-[8px] bg-borde/60 px-2 py-1 text-[0.8125rem] font-medium text-texto-secundario">
              {n} {ESTADO_PIEZA_LABEL[e].toLowerCase()}
            </li>
          ) : null;
        })}
      </ul>
    </Seccion>
  );
}

export function SeccionPiezas({
  cliente,
  piezas,
  grabaciones,
}: {
  cliente: Client;
  piezas: Pieza[];
  grabaciones: Grabacion[];
}) {
  const { error, guardar } = useGuardar();
  const [tipo, setTipo] = useState<PieceType>("reel");
  const [titulo, setTitulo] = useState("");
  const [cantidad, setCantidad] = useState(1);

  const ordenadas = [...piezas].sort(
    (a, b) => PIEZA_ESTADOS.indexOf(a.estado) - PIEZA_ESTADOS.indexOf(b.estado) || a.creadaEn.localeCompare(b.creadaEn),
  );

  function agregar(e: React.FormEvent) {
    e.preventDefault();
    const n = Math.min(Math.max(Math.floor(cantidad), 1), 30);
    const base = titulo.trim();
    guardar(async () => {
      await crearPiezas(
        Array.from({ length: n }, (_, i) => ({
          clienteId: cliente.id,
          tipo,
          titulo: base ? (n > 1 ? `${base} ${i + 1}` : base) : undefined,
        })),
      );
      setTitulo("");
      setCantidad(1);
    });
  }

  return (
    <Seccion titulo="Piezas" detalle="Cada historia, posteo o reel con su estado. Al cambiarlo, el plan se recalcula.">
      <form onSubmit={agregar} className="mb-3 flex flex-wrap gap-2">
        <select value={tipo} onChange={(e) => setTipo(e.target.value as PieceType)} className={campo} aria-label="Tipo de pieza">
          {(Object.keys(TIPO_LABEL) as PieceType[]).map((t) => (
            <option key={t} value={t}>
              {TIPO_LABEL[t]}
            </option>
          ))}
        </select>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Título (opcional)"
          aria-label="Título de la pieza"
          className={`${campo} min-w-0 flex-1`}
        />
        <input
          type="number"
          min={1}
          max={30}
          value={cantidad}
          onChange={(e) => setCantidad(Number(e.target.value))}
          aria-label="Cantidad"
          className={`${campo} w-20`}
        />
        <button type="submit" className={botonPrimario}>
          Agregar
        </button>
      </form>
      {error && <p className="mb-2 text-[0.8125rem] text-[var(--color-error)]">{error}</p>}

      {ordenadas.length === 0 ? (
        <p className="text-[0.9375rem] text-texto-secundario">Todavía no hay piezas.</p>
      ) : (
        <ul className={listaFilas}>
          {ordenadas.map((p) => {
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-2 px-2 py-2.5">
                <div className="min-w-0 flex-1 basis-40">
                  <p className="truncate font-medium">{p.titulo ?? TIPO_LABEL[p.tipo]}</p>
                  <p className="text-[0.8125rem] text-texto-secundario">
                    {TIPO_LABEL[p.tipo]}
                    {fechaEntregaDe(p, grabaciones) ? ` · entrega ${fecha(fechaEntregaDe(p, grabaciones) as string)}` : ""}
                  </p>
                </div>
                <select
                  value={p.estado}
                  onChange={(e) => guardar(() => actualizarPieza(p.id, { estado: e.target.value as PiezaEstado }))}
                  aria-label="Estado de la pieza"
                  className={`${campo} py-1.5 text-[0.9375rem]`}
                >
                  {PIEZA_ESTADOS.map((e) => (
                    <option key={e} value={e}>
                      {ESTADO_PIEZA_LABEL[e]}
                    </option>
                  ))}
                </select>
                <select
                  value={p.grabacionId ?? ""}
                  onChange={(e) => guardar(() => asignarGrabacion(p.id, e.target.value || null))}
                  aria-label="Grabación de la pieza"
                  className={`${campo} py-1.5 text-[0.9375rem]`}
                >
                  <option value="">Sin grabación</option>
                  {grabaciones.map((g) => (
                    <option key={g.id} value={g.id}>
                      Grab. {fecha(g.fecha)}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => guardar(() => eliminarPieza(p.id))}
                  aria-label="Eliminar pieza"
                  className="text-texto-secundario"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Seccion>
  );
}

export function SeccionGrabaciones({
  cliente,
  grabaciones,
  piezas,
}: {
  cliente: Client;
  grabaciones: Grabacion[];
  piezas: Pieza[];
}) {
  const { error, guardar } = useGuardar();
  const [nueva, setNueva] = useState(toISODate(new Date()));
  const [antes, setAntes] = useState(0);
  const [despues, setDespues] = useState(0);

  /** Ticking a recording done moves its approved pieces to "grabada": one tick, everything updates. */
  function marcarHecha(g: Grabacion, hecha: boolean) {
    guardar(async () => {
      await actualizarGrabacion(g.id, { hecha });
      if (hecha) {
        await Promise.all(
          piezas
            .filter((p) => p.grabacionId === g.id && p.estado === "aprobada")
            .map((p) => actualizarPieza(p.id, { estado: "grabada" })),
        );
      }
    });
  }

  const ordenadas = [...grabaciones].sort((a, b) => a.fecha.localeCompare(b.fecha));

  return (
    <Seccion
      titulo="Grabaciones"
      detalle="Cada grabación bloquea el día entero más el viaje, y sus piezas se entregan 7 días después."
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
                onChange={(e) => e.target.value && guardar(() => actualizarGrabacion(g.id, { fecha: e.target.value }))}
                aria-label="Fecha de grabación"
                className={`${campo} py-1.5`}
              />
              <p className="min-w-0 flex-1 basis-32 text-[0.8125rem] text-texto-secundario">
                {piezas.filter((p) => p.grabacionId === g.id).length} piezas
                {g.viajeDiasAntes + g.viajeDiasDespues > 0 ? ` · viaje ${g.viajeDiasAntes}+${g.viajeDiasDespues} d` : ""}
              </p>
              <label className="flex items-center gap-2 text-[0.9375rem]">
                <input
                  type="checkbox"
                  checked={g.hecha}
                  onChange={(e) => marcarHecha(g, e.target.checked)}
                  className="h-[16px] w-[16px] accent-[var(--color-terracota)]"
                />
                Hecha
              </label>
              <button
                onClick={() => guardar(() => eliminarGrabacion(g.id))}
                aria-label="Eliminar grabación"
                className="text-texto-secundario"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Seccion>
  );
}
