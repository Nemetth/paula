"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ExternalLink } from "lucide-react";
import {
  actualizarCliente,
  actualizarGrabacion,
  actualizarPiezas,
  crearGrabacion,
  crearOActualizarCobro,
} from "@/lib/supabase/data";
import { Entrega } from "@/lib/domain/entregas";
import { fechaCorta, toISODate } from "@/lib/domain/dates";
import { fechaEntregaDe } from "@/lib/domain/planner";
import { Client, Cobro, Grabacion, Pieza, Servicio, VolumenMensual, inicioDe } from "@/lib/domain/types";
import { SEMAFORO_ENTREGA, SemaforoPunto } from "@/components/entrega";
import { cn } from "@/lib/utils";

const SERVICIO_LABEL: Record<Servicio, string> = {
  contenido: "Contenido",
  ads: "Ads",
  ambos: "Contenido + Ads",
};

const etiqueta = "text-[0.8125rem] font-medium text-texto-secundario";

/** Plural for the volume line: "1 historia", "8 posteos". */
function cantidad(n: number, uno: string, varios: string) {
  return `${n} ${n === 1 ? uno : varios}`;
}

/** One client at a glance — what Paula does for them, and the three dates that
 * drive the plan (delivery, recording, payment) — and the place to change them.
 * Every change is a source fact: the planner re-derives the rest. */
export function TarjetaCliente({
  cliente,
  color,
  entrega,
  piezas,
  grabaciones,
  cobro,
  periodo,
}: {
  cliente: Client;
  color: string;
  entrega?: Entrega;
  piezas: Pieza[];
  grabaciones: Grabacion[];
  cobro?: Cobro;
  /** Current month, "yyyy-MM": the cobro being edited. */
  periodo: string;
}) {
  const [abierta, setAbierta] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(0);
  const [nuevaGrabacion, setNuevaGrabacion] = useState(toISODate(new Date()));

  const hace = cliente.servicio !== "ads";
  const hacePauta = cliente.servicio !== "contenido";
  const graba = hace && inicioDe(cliente) === "grabacion";
  const v = cliente.volumenMensual;
  const pausado = !cliente.activo || cliente.estado === "en-pausa";

  const proximaGrabacion = grabaciones
    .filter((g) => g.clienteId === cliente.id && !g.hecha)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))[0];

  /** The pieces that make up the delivery being edited: the ones not handed over yet. */
  const piezasEntrega = entrega
    ? piezas.filter(
        (p) =>
          p.clienteId === cliente.id &&
          p.estado !== "idea" &&
          p.estado !== "entregada" &&
          p.estado !== "programada" &&
          fechaEntregaDe(p, grabaciones) === entrega.fecha,
      )
    : [];

  async function guardar(accion: () => Promise<unknown>) {
    setError(null);
    try {
      await accion();
      setGuardado((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar. Probá de nuevo.");
    }
  }

  function setVolumen(campo: keyof VolumenMensual, valor: number) {
    if (!Number.isFinite(valor) || valor < 0 || valor === v[campo]) return;
    void guardar(() => actualizarCliente(cliente.id, { volumenMensual: { ...v, [campo]: Math.floor(valor) } }));
  }

  function setGraba(si: boolean) {
    void guardar(() =>
      actualizarCliente(cliente.id, {
        flujo: { ...cliente.flujo, inicioDesde: si ? "grabacion" : "aprobacion", tieneGrabacion: si },
      }),
    );
  }

  return (
    <div className={cn("transition-opacity", pausado && "opacity-60")}>
      <button
        onClick={() => setAbierta((a) => !a)}
        aria-expanded={abierta}
        className="tocable group flex w-full items-start gap-3 px-3 py-3.5 text-left lg:px-4"
      >
        <Inicial nombre={cliente.nombre} color={color} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2">
            <span className="truncate font-semibold">{cliente.nombre}</span>
            {entrega && <SemaforoPunto semaforo={entrega.semaforo} />}
            {pausado && <span className="rounded-[8px] bg-borde/70 px-1.5 py-0.5 text-[0.75rem] font-medium">En pausa</span>}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[0.875rem] text-texto-secundario">
            <span className="font-medium text-texto">{SERVICIO_LABEL[cliente.servicio]}</span>
            {hace && (
              <span className="numeros">
                · {cantidad(v.historias, "historia", "historias")} · {cantidad(v.posteos, "posteo", "posteos")} ·{" "}
                {cantidad(v.reels, "reel", "reels")}
              </span>
            )}
            {hace && <span>· {graba ? "graba" : "sin grabación"}</span>}
          </p>
          <dl className="mt-2.5 grid grid-cols-3 gap-2 text-[0.8125rem]">
            <FechaResumen titulo="Entrega" valor={entrega?.fecha} extra={entrega ? SEMAFORO_ENTREGA[entrega.semaforo].label : undefined} />
            <FechaResumen titulo="Grabación" valor={proximaGrabacion?.fecha} apagado={!graba && !proximaGrabacion} />
            <FechaResumen titulo="Cobro" valor={cobro?.fechaVencimiento} extra={cobro?.estado === "pagado" ? "Pagado" : undefined} />
          </dl>
        </div>
        <ChevronDown
          size={18}
          className={cn("mt-1 shrink-0 text-texto-secundario transition-transform duration-300", abierta && "rotate-180")}
        />
      </button>

      {abierta && (
        <div className="aparece flex flex-col gap-5 border-t border-borde/70 px-3 pb-4 pt-4 lg:px-4">
          <section className="flex flex-col gap-3">
            <h3 className="titulo text-[1rem]">Qué le hago</h3>
            <label className="flex flex-col gap-1">
              <span className={etiqueta}>Servicio</span>
              <select
                value={cliente.servicio}
                onChange={(e) => void guardar(() => actualizarCliente(cliente.id, { servicio: e.target.value as Servicio }))}
                className="input"
              >
                {(Object.keys(SERVICIO_LABEL) as Servicio[]).map((s) => (
                  <option key={s} value={s}>
                    {SERVICIO_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            {hace && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  {(
                    [
                      ["historias", "Historias"],
                      ["posteos", "Posteos"],
                      ["reels", "Reels"],
                    ] as [keyof VolumenMensual, string][]
                  ).map(([campo, label]) => (
                    <label key={campo} className="flex flex-col gap-1">
                      <span className={etiqueta}>{label} por mes</span>
                      <input
                        key={`${campo}-${v[campo]}`}
                        type="number"
                        min={0}
                        defaultValue={v[campo]}
                        onBlur={(e) => setVolumen(campo, Number(e.target.value))}
                        className="input"
                      />
                    </label>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-[0.9375rem]">
                  <input
                    type="checkbox"
                    checked={graba}
                    onChange={(e) => setGraba(e.target.checked)}
                    className="h-[16px] w-[16px] accent-[var(--color-oscuro)]"
                  />
                  Graba para este cliente
                </label>
              </>
            )}
            {hacePauta && <p className="text-[0.8125rem] text-texto-secundario">Incluye el chequeo diario de Ads.</p>}
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="titulo text-[1rem]">Fechas</h3>

            {hace && (
              <label className="flex flex-col gap-1">
                <span className={etiqueta}>Entrega</span>
                <CampoFecha
                  valor={entrega?.fecha}
                  disabled={piezasEntrega.length === 0}
                  onGuardar={(fecha) =>
                    void guardar(() =>
                      actualizarPiezas(
                        piezasEntrega.map((p) => p.id),
                        { fechaEntrega: fecha },
                      ),
                    )
                  }
                />
                <span className="text-[0.75rem] text-texto-secundario">
                  {piezasEntrega.length === 0
                    ? "Sin piezas aprobadas para entregar: cargalas en la ficha."
                    : `Mueve las ${piezasEntrega.length} piezas de esta entrega y el plan se recalcula.`}
                </span>
              </label>
            )}

            {hace && (
              <div className="flex flex-col gap-1">
                <span className={etiqueta}>Próxima grabación</span>
                {proximaGrabacion ? (
                  <>
                    <CampoFecha
                      valor={proximaGrabacion.fecha}
                      onGuardar={(fecha) => void guardar(() => actualizarGrabacion(proximaGrabacion.id, { fecha }))}
                    />
                    <span className="text-[0.75rem] text-texto-secundario">
                      Bloquea ese día y las piezas se entregan 7 días después, salvo que les pongas otra fecha.
                    </span>
                  </>
                ) : graba ? (
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={nuevaGrabacion}
                      onChange={(e) => setNuevaGrabacion(e.target.value)}
                      className="input"
                    />
                    <button
                      onClick={() =>
                        nuevaGrabacion &&
                        void guardar(() =>
                          crearGrabacion({ clienteId: cliente.id, fecha: nuevaGrabacion, viajeDiasAntes: 0, viajeDiasDespues: 0 }),
                        )
                      }
                      className="boton-primario tocable shrink-0 rounded-[12px] px-4 py-2 text-[0.9375rem] font-medium"
                    >
                      Agregar
                    </button>
                  </div>
                ) : (
                  <span className="text-[0.9375rem] text-texto-secundario">No graba para este cliente.</span>
                )}
              </div>
            )}

            <label className="flex flex-col gap-1">
              <span className={etiqueta}>Cobro de este mes</span>
              <CampoFecha
                valor={cobro?.fechaVencimiento}
                onGuardar={(fecha) => void guardar(() => crearOActualizarCobro(cliente.id, periodo, { fechaVencimiento: fecha }))}
              />
              <span className="text-[0.75rem] text-texto-secundario">
                Si pasa esa fecha sin cobrar, aparece como vencido en Plata.
              </span>
            </label>
          </section>

          <div className="flex items-center justify-between gap-3">
            <p
              key={guardado}
              aria-live="polite"
              className={cn("text-[0.8125rem]", error ? "text-[var(--color-error)]" : "text-verde", guardado > 0 && !error && "pop")}
            >
              {error ?? (guardado > 0 ? "Guardado: el plan se recalculó" : "")}
            </p>
            <Link
              href={`/clientes/${cliente.id}`}
              className="tocable flex items-center gap-1.5 rounded-[12px] border border-borde px-3 py-2 text-[0.875rem] font-medium hover:bg-borde/40"
            >
              Ficha completa <ExternalLink size={14} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/** A date field that saves once the date is really chosen: picking it from the
 * calendar saves right away, typing it saves when the field loses focus (so a
 * half-typed year never reaches the plan). */
function CampoFecha({
  valor,
  disabled,
  onGuardar,
}: {
  valor?: string;
  disabled?: boolean;
  onGuardar: (fecha: string) => void;
}) {
  const confirmar = (fecha: string) => {
    if (!fecha || fecha === valor || fecha < "2000-01-01") return;
    onGuardar(fecha);
  };
  return (
    <input
      type="date"
      key={valor ?? "vacio"}
      defaultValue={valor ?? ""}
      disabled={disabled}
      onChange={(e) => {
        if (e.nativeEvent instanceof InputEvent) return;
        confirmar(e.target.value);
      }}
      onBlur={(e) => confirmar(e.target.value)}
      className="input disabled:opacity-50"
    />
  );
}

function FechaResumen({
  titulo,
  valor,
  extra,
  apagado,
}: {
  titulo: string;
  valor?: string;
  extra?: string;
  apagado?: boolean;
}) {
  return (
    <div className={cn("min-w-0 rounded-[12px] bg-bg-hundida px-2.5 py-1.5", apagado && "opacity-50")}>
      <dt className="text-[0.6875rem] font-medium text-texto-secundario">{titulo}</dt>
      <dd className="numeros truncate font-semibold">{valor ? fechaCorta(valor) : "—"}</dd>
      {extra && <dd className="truncate text-[0.6875rem] text-texto-secundario">{extra}</dd>}
    </div>
  );
}

/** Client monogram in the client's calendar color, so the same hue ties the
 * roster, Hoy and the calendar together. */
function Inicial({ nombre, color }: { nombre: string; color: string }) {
  return (
    <span
      aria-hidden
      className="titulo flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[1.125rem] transition-transform duration-300 group-hover:scale-105"
      style={{ background: `color-mix(in oklab, ${color} 16%, transparent)`, color }}
    >
      {(nombre.replace(/^\s*\[[^\]]*\]\s*/, "").match(/\p{L}|\d/u)?.[0] ?? "·").toUpperCase()}
    </span>
  );
}

