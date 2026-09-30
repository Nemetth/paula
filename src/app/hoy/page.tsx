"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, CheckCircle2, Circle, Video, FileCheck2, CalendarDays, Send, Settings } from "lucide-react";
import {
  ensureSettings,
  registrarTrabajo,
  useBlockedDates,
  useClients,
  useCobros,
  useDayOverride,
  useEstructuraSemanal,
  useWorkLog,
} from "@/lib/supabase/data";
import { computePlanDelDia, TareaHoy } from "@/lib/domain/schedule-engine";
import { toISODate } from "@/lib/domain/dates";
import { cobrosVencidos } from "@/lib/domain/cobros";
import { DEFAULT_ESTRUCTURA_SEMANAL } from "@/lib/domain/types";
import { DisruptionSheet } from "@/components/disruption-sheet";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";

const STAGE_ICON: Partial<Record<TareaHoy["etapa"], typeof Video>> = {
  grabacion: Video,
  presentacion: Send,
  programacion: CalendarDays,
  correccion: FileCheck2,
};

export default function HoyPage() {
  const today = useMemo(() => new Date(), []);
  const todayISO = toISODate(today);
  const [sheetOpen, setSheetOpen] = useState(false);

  const clients = useClients();
  const blockedDates = useBlockedDates();
  const allWorkLog = useWorkLog();
  const cobros = useCobros();
  const dayOverrideHoras = useDayOverride(todayISO);
  const estructuraSemanal = useEstructuraSemanal();

  const vencidos = useMemo(
    () => (clients && cobros ? cobrosVencidos(cobros, clients, today).length : 0),
    [clients, cobros, today],
  );

  useEffect(() => {
    ensureSettings();
  }, []);

  const done = useMemo(
    () =>
      new Set(
        (allWorkLog ?? [])
          .filter((w) => w.fecha === todayISO)
          .map((w) => `${w.clienteId}:${w.etapa}:${w.piezaTipo ?? ""}`),
      ),
    [allWorkLog, todayISO],
  );

  const plan = useMemo(() => {
    if (!clients || !blockedDates || !allWorkLog) return null;
    const estructura = estructuraSemanal ?? DEFAULT_ESTRUCTURA_SEMANAL;
    const horasDisponiblesHoy = dayOverrideHoras ?? estructura.horasPorDia[today.getDay()] ?? 0;
    return computePlanDelDia({
      clients: clients.filter((c) => c.activo),
      today,
      blockedDates,
      workLog: allWorkLog,
      horasDisponiblesHoy,
    });
  }, [clients, blockedDates, allWorkLog, estructuraSemanal, dayOverrideHoras, today]);

  async function marcarHecho(tarea: TareaHoy) {
    await registrarTrabajo({
      clienteId: tarea.clienteId,
      etapa: tarea.etapa,
      piezaTipo: tarea.piezaTipo,
      cantidad: tarea.cantidad ?? 1,
      fecha: todayISO,
      horas: tarea.horasEstimadas,
    });
  }

  if (!plan) {
    return <div className="px-4 py-8 text-texto-secundario">Cargando...</div>;
  }

  const tareasVisibles = plan.tareas.filter(
    (t) => !done.has(`${t.clienteId}:${t.etapa}:${t.piezaTipo ?? ""}`),
  );

  return (
    <div className="mx-auto max-w-[640px] px-4 pt-6 lg:max-w-[880px] lg:px-8 lg:pt-10">
      <header className="mb-5 flex items-start justify-between lg:mb-8">
        <div>
          <p className="text-[0.8125rem] font-medium text-texto-secundario capitalize">
            {format(today, "EEEE d 'de' MMMM", { locale: es })}
          </p>
          <h1 className="text-[1.25rem] font-semibold">Hoy</h1>
        </div>
        <Link href="/ajustes" aria-label="Ajustes" className="mt-1 text-texto-secundario lg:hidden">
          <Settings size={20} strokeWidth={1.75} />
        </Link>
      </header>

      <div className="mb-5 flex flex-col gap-3 lg:mb-8 lg:flex-row">
        <div className="lg:flex-1">
          <HorasReadout plan={plan} />
        </div>
        {vencidos > 0 && (
          <Link
            href="/plata"
            className="flex items-center gap-2.5 rounded-[12px] bg-terracota/[0.08] border border-terracota/20 px-4 py-3 lg:flex-1"
          >
            <AlertTriangle size={18} className="shrink-0 text-terracota" />
            <p className="text-[0.9375rem] text-texto">
              {vencidos === 1
                ? "Tenés 1 cobro vencido"
                : `Tenés ${vencidos} cobros vencidos`}{" "}
              <span className="font-medium text-terracota">— ver en Plata</span>
            </p>
          </Link>
        )}
      </div>

      {tareasVisibles.length === 0 ? (
        <EmptyState
          title={plan.clientesSinNovedad.length > 0 ? "Vas bien — nada urgente hoy" : "Todavía no hay clientes cargados"}
          detail={
            plan.clientesSinNovedad.length > 0
              ? `${plan.clientesSinNovedad.join(", ")} no ${plan.clientesSinNovedad.length === 1 ? "necesita" : "necesitan"} nada hoy.`
              : "Agregá tu primer cliente para que la app arme el plan."
          }
        />
      ) : (
        <ul className="flex flex-col divide-y divide-borde border-y border-borde lg:rounded-[12px] lg:border lg:border-borde lg:bg-bg-elevada lg:px-3">
          {tareasVisibles.map((tarea, i) => {
            const Icon = STAGE_ICON[tarea.etapa];
            return (
              <li
                key={`${tarea.clienteId}-${tarea.etapa}-${tarea.piezaTipo ?? i}`}
                className={cn(
                  "flex items-start gap-3 px-2 py-3.5",
                  tarea.urgente && "bg-terracota/[0.06]",
                )}
              >
                <button
                  onClick={() => marcarHecho(tarea)}
                  className="mt-0.5 shrink-0 text-texto-secundario transition-colors hover:text-terracota"
                  aria-label="Marcar como hecho"
                >
                  <Circle size={22} strokeWidth={1.75} />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {Icon ? <Icon size={14} className="text-texto-secundario shrink-0" /> : null}
                    <p className="font-semibold truncate">{tarea.clienteNombre}</p>
                    {tarea.urgente && (
                      <span className="shrink-0 rounded-[8px] bg-terracota/15 px-1.5 py-0.5 text-[0.8125rem] font-medium text-terracota">
                        hoy
                      </span>
                    )}
                  </div>
                  <p className="text-[0.9375rem] text-texto-secundario">{tarea.detalle}</p>
                </div>
                <p className="shrink-0 text-[0.8125rem] font-medium text-texto-secundario">
                  {tarea.horasEstimadas}h
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <button
        onClick={() => setSheetOpen(true)}
        className="mt-6 w-full rounded-[12px] border border-borde px-5 py-3 text-center text-[0.9375rem] font-medium text-texto"
      >
        Algo cambió
      </button>

      <DisruptionSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        clients={clients?.filter((c) => c.activo) ?? []}
        today={todayISO}
      />
    </div>
  );
}

function HorasReadout({ plan }: { plan: ReturnType<typeof computePlanDelDia> }) {
  return (
    <div className="mb-5 flex items-center justify-between rounded-[12px] bg-bg-elevada border border-borde px-4 py-3">
      <div>
        <p className="text-[0.8125rem] text-texto-secundario">Horas de hoy</p>
        <p className="font-semibold">
          {plan.horasTotales}h <span className="font-normal text-texto-secundario">de {plan.horasDisponibles}h</span>
        </p>
      </div>
      {plan.sobrecargado ? (
        <span className="rounded-[8px] bg-ambar/15 px-2 py-1 text-[0.8125rem] font-medium text-ambar">
          Se pasa de horas
        </span>
      ) : (
        <CheckCircle2 size={20} className="text-verde" />
      )}
    </div>
  );
}
