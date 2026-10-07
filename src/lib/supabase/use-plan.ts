"use client";

// One place that turns the live tables into the global plan, so Hoy, Calendario
// and the alerts bell all read exactly the same derived facts.

import { useMemo } from "react";
import { unidadesAdsFondo } from "@/lib/domain/ads";
import { Plan, ajustarTiempos, planificar } from "@/lib/domain/planner";
import { toISODate } from "@/lib/domain/dates";
import { unidadesDeTareas } from "@/lib/domain/tareas";
import {
  Client,
  Cobro,
  DEFAULT_ESTRUCTURA_SEMANAL,
  DEFAULT_TIEMPOS_PIEZA,
  EstructuraSemanal,
  AdsReporte,
  Grabacion,
  Pieza,
  Tarea,
} from "@/lib/domain/types";
import {
  useAdsReportes,
  useBlockedDates,
  useClients,
  useCobros,
  useDayOverride,
  useEstructuraSemanal,
  useGrabaciones,
  usePiezas,
  useTareas,
} from "./data";

export interface PlanContext {
  today: Date;
  todayISO: string;
  plan: Plan;
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
      // Editing times start from Ajustes and drift toward the real hours logged on pieces.
      tiempos: ajustarTiempos(piezas, estructura.tiemposPieza ?? DEFAULT_TIEMPOS_PIEZA),
      extras: [...unidadesAdsFondo(clients, today), ...unidadesDeTareas(lista, clients, today)],
      overrides: dayOverrideHoras != null ? { [todayISO]: dayOverrideHoras } : undefined,
      horizonteDias,
    });
    return {
      today,
      todayISO,
      plan,
      clients,
      piezas,
      grabaciones,
      cobros: cobros ?? [],
      reportes: reportes ?? [],
      tareas: lista,
      estructura,
    };
  }, [clients, piezas, grabaciones, blockedDates, cobros, reportes, tareas, estructura, dayOverrideHoras, today, todayISO, horizonteDias]);
}
