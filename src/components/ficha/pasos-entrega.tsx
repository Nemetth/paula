"use client";

import { useState } from "react";
import { addDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { Check, ExternalLink } from "lucide-react";
import { CampoFecha } from "@/components/clientes/tarjeta-cliente";
import { guardarEstadoEntrega } from "@/lib/supabase/data";
import { Entrega } from "@/lib/domain/entregas";
import { fromISODate, toISODate } from "@/lib/domain/dates";
import { PASO_ENTREGA_LABEL } from "@/lib/domain/labels";
import { Client, PASOS_ENTREGA, PasoEntrega } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { Seccion, campo } from "./seccion";

const fecha = (iso: string) => format(fromISODate(iso), "d MMM", { locale: es });
const conEsquema = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);
/** Finished deliveries stay here this many days, for the correction and scheduling steps. */
const DIAS_DESPUES = 21;

/** Where each delivery is: calendar → approval → production → handed in →
 * corrections → adjustments → scheduled. Plus the Canva link and, for clients
 * who send the material, when it has to arrive. Every change is a source fact:
 * approving the calendar lets the pieces into the plan, handing it in starts
 * the client's correction time. */
export function SeccionPasos({ cliente, entregas, hoyISO }: { cliente: Client; entregas: Entrega[]; hoyISO: string }) {
  const desde = toISODate(addDays(fromISODate(hoyISO), -DIAS_DESPUES));
  const visibles = entregas
    .filter((e) => (e.semaforo !== "lista" ? true : e.fecha >= desde && e.estado?.paso !== "programado"))
    .slice(0, 3);
  if (visibles.length === 0) return null;
  return (
    <Seccion titulo="En qué paso está" detalle="Tocá el paso en que está cada entrega.">
      <div className="flex flex-col gap-3">
        {visibles.map((e, i) => (
          <PasosDeUnaEntrega key={e.cicloId} cliente={cliente} entrega={e} hoyISO={hoyISO} abierta={i === 0} />
        ))}
      </div>
    </Seccion>
  );
}

function PasosDeUnaEntrega({
  cliente,
  entrega: e,
  hoyISO,
  abierta: abiertaAlInicio,
}: {
  cliente: Client;
  entrega: Entrega;
  hoyISO: string;
  abierta: boolean;
}) {
  const [abierta, setAbierta] = useState(abiertaAlInicio);
  const [error, setError] = useState<string | null>(null);
  const estado = e.estado;
  const pasos = PASOS_ENTREGA.filter((p) => cliente.flujo.mandaCalendario || !p.startsWith("calendario"));
  const actual = estado?.paso;
  const iActual = actual ? pasos.indexOf(actual) : -1;
  const plazo = Math.max(cliente.flujo.diasCorreccion ?? 2, 0);
  const finCorreccion = estado?.entregadoEn ? toISODate(addDays(fromISODate(estado.entregadoEn), plazo)) : undefined;
  const material = cliente.tipo === "material-cliente";

  async function guardar(cambios: Parameters<typeof guardarEstadoEntrega>[2]) {
    setError(null);
    try {
      await guardarEstadoEntrega(e.cicloId, cliente.id, cambios);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar. Probá de nuevo.");
    }
  }

  function marcar(p: PasoEntrega) {
    // Tapping the current step again takes it back to no step.
    if (p === actual) return guardar({ paso: undefined });
    return guardar(p === "entregado" ? { paso: p, entregadoEn: hoyISO } : { paso: p });
  }

  return (
    <div className="papel overflow-hidden">
      <button
        onClick={() => setAbierta((a) => !a)}
        aria-expanded={abierta}
        className="tocable flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="font-semibold">Entrega {fecha(e.fecha)}</span>
        <span className={cn("text-[0.8125rem] font-medium", actual ? "text-acento-texto" : "text-texto-secundario")}>
          {actual ? PASO_ENTREGA_LABEL[actual] : "Sin paso marcado"}
        </span>
      </button>

      {abierta && (
        <div className="aparece flex flex-col gap-4 border-t border-borde/70 px-4 pb-4 pt-3">
          <ol className="flex flex-wrap gap-1.5" aria-label="Pasos de la entrega">
            {pasos.map((p, i) => {
              const hecho = i < iActual;
              const esActual = i === iActual;
              return (
                <li key={p}>
                  <button
                    onClick={() => marcar(p)}
                    aria-pressed={esActual}
                    className={cn(
                      "tocable flex items-center gap-1 rounded-full border px-3 py-1.5 text-[0.8125rem] font-medium",
                      esActual && "pop border-acento/40 bg-acento/20 text-acento-texto",
                      hecho && "border-verde/30 bg-verde/10 text-verde",
                      !esActual && !hecho && "border-borde text-texto-secundario hover:bg-borde/40",
                    )}
                  >
                    {hecho && <Check size={13} />}
                    {PASO_ENTREGA_LABEL[p]}
                  </button>
                </li>
              );
            })}
          </ol>

          <p className="text-[0.8125rem] text-texto-secundario">
            {e.esperaAprobacion
              ? "Las piezas esperan: cuando marques «Calendario aprobado» entran solas al plan."
              : actual === "entregado" && finCorreccion
                ? finCorreccion < hoyISO
                  ? `Se pasaron los ${plazo} días de corrección (era hasta el ${fecha(finCorreccion)}).`
                  : `El cliente tiene hasta el ${fecha(finCorreccion)} para mandar correcciones.`
                : !actual
                  ? cliente.flujo.mandaCalendario
                    ? "Si marcás el calendario como armado o enviado, las piezas esperan a la aprobación."
                    : "Las piezas se producen como siempre."
                  : `Desde el ${estado?.pasoDesde ? fecha(estado.pasoDesde) : "—"}.`}
          </p>

          <label className="flex flex-col gap-1">
            <span className="text-[0.8125rem] font-medium text-texto-secundario">Link de Canva o de la presentación</span>
            <span className="flex gap-2">
              <input
                key={estado?.link ?? ""}
                type="url"
                inputMode="url"
                defaultValue={estado?.link ?? ""}
                placeholder="https://www.canva.com/..."
                onBlur={(ev) => {
                  const link = ev.target.value.trim();
                  if (link !== (estado?.link ?? "")) void guardar({ link });
                }}
                className={cn(campo, "min-w-0 flex-1")}
              />
              {estado?.link && (
                <a
                  href={conEsquema(estado.link)}
                  target="_blank"
                  rel="noreferrer"
                  className="tocable flex shrink-0 items-center gap-1 rounded-[12px] border border-borde px-3 py-2 text-[0.875rem] font-medium hover:bg-borde/40"
                >
                  Abrir <ExternalLink size={13} />
                </a>
              )}
            </span>
          </label>

          {material && (
            <div className="flex flex-col gap-1">
              <span className="text-[0.8125rem] font-medium text-texto-secundario">El material tiene que llegar el</span>
              <div className="flex items-center gap-3">
                <CampoFecha valor={estado?.materialFecha} onGuardar={(f) => void guardar({ materialFecha: f })} />
                <label className="flex shrink-0 items-center gap-2 text-[0.9375rem]">
                  <input
                    type="checkbox"
                    checked={estado?.materialLlego ?? false}
                    onChange={(ev) => void guardar({ materialLlego: ev.target.checked })}
                    className="h-[16px] w-[16px] accent-[var(--color-oscuro)]"
                  />
                  Llegó
                </label>
              </div>
              {estado?.materialFecha && !estado.materialLlego && estado.materialFecha < hoyISO && (
                <span className="text-[0.8125rem] font-medium text-acento-texto">No llegó y ya pasó la fecha.</span>
              )}
            </div>
          )}
          {error && <p className="text-[0.8125rem] text-[var(--color-error)]">{error}</p>}
        </div>
      )}
    </div>
  );
}
