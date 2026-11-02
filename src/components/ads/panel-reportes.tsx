"use client";

import { addMonths, format } from "date-fns";
import { es } from "date-fns/locale";
import { Check } from "lucide-react";
import { FilaReporte } from "@/lib/domain/ads";
import { fechaCorta, fromISODate } from "@/lib/domain/dates";
import { Client } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

type Campo = "analisis" | "estrategia";

/** One step of a report: done shows ticked, tapping opens or sends it. */
function Paso({ hecho, activo, onClick, children }: { hecho: boolean; activo?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={hecho}
      className={cn(
        "tocable flex items-center gap-1 rounded-[8px] px-2 py-0.5 text-[0.75rem] font-medium",
        hecho ? "bg-verde/15 text-verde" : "bg-bg-hundida text-texto-secundario hover:bg-borde/60",
        activo && "ring-1 ring-texto-secundario/40",
      )}
    >
      {children}
      {hecho && <Check size={12} strokeWidth={2.5} />}
    </button>
  );
}

/** The month's reports (days 1 to 5): per client, analysis, new strategy and sent.
 * Past the date, in red. */
export function PanelReportes({
  filas,
  nuevas,
  vence,
  color,
  abierto,
  onAbrir,
  onEnviado,
  onTexto,
}: {
  filas: FilaReporte[];
  /** Accounts too new to have a report this month. */
  nuevas: Client[];
  vence: string;
  color: (clienteId: string) => string;
  /** The row open and which of its texts, if any. */
  abierto: { clienteId: string; campo: Campo } | null;
  onAbrir: (a: { clienteId: string; campo: Campo } | null) => void;
  onEnviado: (f: FilaReporte) => void;
  onTexto: (f: FilaReporte, cambios: { analisis?: string; estrategia?: string }) => void;
}) {
  const periodo = filas[0]?.periodo;
  const enviados = filas.filter((f) => f.estado === "enviado").length;
  const pct = filas.length === 0 ? 0 : Math.round((enviados / filas.length) * 100);

  return (
    <section className="papel px-4 py-3.5">
      <h2 className="titulo text-[1rem]">Reportes{periodo ? ` de ${format(fromISODate(`${periodo}-01`), "MMMM", { locale: es })}` : ""}</h2>
      <p className="text-[0.75rem] text-texto-secundario">Se hacen del 1 al 5 de cada mes</p>
      <p className="numeros titulo mt-2 text-[1.75rem] leading-none">
        {enviados}
        <span className="text-[0.8125rem] font-medium text-texto-secundario"> de {filas.length} enviados</span>
      </p>
      <div className="barra mt-2" role="progressbar" aria-valuemin={0} aria-valuemax={filas.length} aria-valuenow={enviados} aria-label="Reportes enviados">
        <div className="barra-relleno" style={{ width: `${pct}%` }} />
      </div>

      <ul className="mt-3 flex flex-col gap-1">
        {filas.map((f) => {
          const abierta = abierto?.clienteId === f.cliente.id ? abierto.campo : null;
          const alternar = (campo: Campo) => onAbrir(abierta === campo ? null : { clienteId: f.cliente.id, campo });
          return (
            <li
              key={f.cliente.id}
              id={`reporte-${f.cliente.id}`}
              className={cn("rounded-[12px] px-2.5 py-2", f.atrasado ? "bg-[var(--color-error)]/10" : "border-b border-borde/50 last:border-b-0")}
            >
              <div className="flex items-center gap-2 text-[0.8125rem] font-semibold">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color(f.cliente.id) }} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{f.cliente.nombre}</span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium",
                    f.estado === "enviado" ? "bg-verde/15 text-verde" : f.atrasado ? "font-semibold text-[var(--color-error)]" : "bg-ambar/15 text-ambar",
                  )}
                >
                  {f.estado === "enviado" ? "Enviado" : f.atrasado ? `Venció el ${fechaCorta(vence)}` : `Vence ${fechaCorta(vence)}`}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5 pl-4">
                <Paso hecho={!!f.reporte?.analisis} activo={abierta === "analisis"} onClick={() => alternar("analisis")}>
                  Análisis
                </Paso>
                <Paso hecho={!!f.reporte?.estrategia} activo={abierta === "estrategia"} onClick={() => alternar("estrategia")}>
                  Estrategia
                </Paso>
                <Paso hecho={f.estado === "enviado"} onClick={() => onEnviado(f)}>
                  Enviado
                </Paso>
              </div>
              {abierta && (
                <textarea
                  key={`${abierta}:${f.reporte?.[abierta] ?? ""}`}
                  autoFocus
                  defaultValue={f.reporte?.[abierta] ?? ""}
                  rows={3}
                  aria-label={abierta === "analisis" ? `Análisis de ${f.cliente.nombre}` : `Nueva estrategia de ${f.cliente.nombre}`}
                  placeholder={abierta === "analisis" ? "Qué funcionó, qué no, resultados…" : "Qué cambia el mes que viene…"}
                  onBlur={(e) => {
                    if (e.target.value.trim() !== (f.reporte?.[abierta] ?? "")) onTexto(f, { [abierta]: e.target.value });
                  }}
                  className="input aparece mt-2 w-full resize-y text-[0.875rem]"
                />
              )}
            </li>
          );
        })}
        {nuevas.map((c) => (
          <li key={c.id} className="flex items-center gap-2 px-2.5 py-2 text-[0.8125rem] font-semibold">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color(c.id) }} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{c.nombre}</span>
            <span className="shrink-0 rounded-full bg-bg-hundida px-2 py-0.5 text-[0.6875rem] font-medium text-texto-secundario">
              Primer reporte en {format(addMonths(new Date(c.creadoEn), 1), "MMM", { locale: es })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
