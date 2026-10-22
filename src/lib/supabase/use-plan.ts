"use client";

// One place that turns the live tables into the global plan, so Hoy, Calendario
// and the alerts bell all read exactly the same derived facts.

import { useMemo } from "react";
import { PESO_REVISION_FONDO, unidadesAdsFondo } from "@/lib/domain/ads";
import { Entrega, calcularEntregas } from "@/lib/domain/entregas";
import { PESO_CALENDARIO, PESO_GUION, Plan, planificar } from "@/lib/domain/planner";
import { toISODate } from "@/lib/domain/dates";
import { unidadesDeTareas } from "@/lib/domain/tareas";
import {
  Client,
  Cobro,
  DEFAULT_ESTRUCTURA_SEMANAL,
  EstructuraSemanal,
  AdsReporte,
  Grabacion,
  Pieza,
  Tarea,
  pesosPieza,
} from "@/lib/domain/types";
import {
  TareaHecha,
  useAdsReportes,
  useBlockedDates,
  useClients,
  useCobros,
  useDayOverride,
  useEstructuraSemanal,
  useGrabaciones,
  usePiezas,
  usePospuestas,
  useTareas,
  useTareasHechas,
} from "./data";

export interface PlanContext {
  today: Date;
  todayISO: string;
  plan: Plan;
  /** Deliveries with progress and traffic light, earliest first. */
  entregas: Entrega[];
  clients: Client[];
  piezas: Pieza[];
  grabaciones: Grabacion[];
  cobros: Cobro[];
  reportes: AdsReporte[];
  tareas: Tarea[];
  estructura: EstructuraSemanal;
}

/** `null` until the data it needs has loaded. */
export function usePlan(horizonteDias?: number): PlanContext | null {
  const today = useMemo(() => new Date(), []);
  const todayISO = toISODate(today);

  const clients = useClients();
  const piezas = usePiezas();
  const grabaciones = useGrabaciones();
  const blockedDates = useBlockedDates();
  const cobros = useCobros();
  const reportes = useAdsReportes();
  const tareas = useTareas();
  const pospuestas = usePospuestas();
  const hechasHoy = useTareasHechas(todayISO);
  const dayOverrideHoras = useDayOverride(todayISO);
  const estructuraGuardada = useEstructuraSemanal();

  const estructura = estructuraGuardada ?? DEFAULT_ESTRUCTURA_SEMANAL;

  return useMemo(() => {
    if (!clients || !piezas || !grabaciones || !blockedDates) return null;
    const lista = tareas ?? [];
    const plan = planificar({
      today,
      clients,
      piezas,
      grabaciones,
      blockedDates,
      estructura,
      extras: [...unidadesAdsFondo(clients, today), ...unidadesDeTareas(lista, clients, today)],
      pospuestas,
      unidadesHechasHoy: (hechasHoy ?? []).map((h) => h.unidadId),
      pesoHechoHoy: pesoHecho(hechasHoy ?? [], piezas, estructura),
      overrides: dayOverrideHoras != null ? { [todayISO]: dayOverrideHoras } : undefined,
      horizonteDias,
    });
    return {
      today,
      todayISO,
      plan,
      entregas: calcularEntregas({ clients, piezas, grabaciones, plan, today }),
      clients,
      piezas,
      grabaciones,
      cobros: cobros ?? [],
      reportes: reportes ?? [],
      tareas: lista,
      estructura,
    };
  }, [clients, piezas, grabaciones, blockedDates, cobros, reportes, tareas, estructura, pospuestas, hechasHoy, dayOverrideHoras, today, todayISO, horizonteDias]);
}

/** What ticking these off weighed, in pieces, so today's room can be reduced by it. */
function pesoHecho(hechas: TareaHecha[], piezas: Pieza[], estructura: EstructuraSemanal): number {
  const pesos = pesosPieza(estructura);
  return hechas.reduce((suma, h) => {
    if (h.tipo === "edicion") {
      const pieza = piezas.find((p) => p.id === h.unidadId.split(":")[0]);
      return suma + (pieza ? pesos[pieza.tipo] : 1);
    }
    if (h.tipo === "guion") return suma + PESO_GUION;
    if (h.tipo === "ideas") return suma + PESO_CALENDARIO;
    if (h.tipo === "ads-fondo") return suma + PESO_REVISION_FONDO;
    return suma + 1;
  }, 0);
}
