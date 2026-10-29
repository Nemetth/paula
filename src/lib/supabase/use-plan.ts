"use client";

// One place that turns the live tables into the global plan and its alerts.
// The app frame computes it ONCE (PlanProvider) and every screen, the bell and
// the nav badges read that same value, so two places can never show different
// numbers for the same facts.

import { createElement, createContext, useContext, useEffect, useMemo } from "react";
import { AlertaGlobal, alertasGlobales } from "@/lib/domain/alertas";
import { armarPlan } from "@/lib/domain/armar-plan";
import { ciclosPorAbrir } from "@/lib/domain/ciclos";
import { cobrosVencidos } from "@/lib/domain/cobros";
import { Entrega, calcularEntregas } from "@/lib/domain/entregas";
import { MensajePendiente, mensajesPendientes } from "@/lib/domain/mensajes";
import { Plan, PlannerInput } from "@/lib/domain/planner";
import { toISODate } from "@/lib/domain/dates";
import {
  AdsRegistro,
  AdsReporte,
  Ciclo,
  Client,
  Cobro,
  DEFAULT_ESTRUCTURA_SEMANAL,
  EstadoEntrega,
  EstructuraSemanal,
  Grabacion,
  Pieza,
  Tarea,
} from "@/lib/domain/types";
import {
  abrirCiclo,
  useAdsHistorial,
  useAdsReportes,
  useBlockedDates,
  useCiclos,
  useClients,
  useCobros,
  useDayOverride,
  useEstadosEntrega,
  useEstructuraSemanal,
  useGrabaciones,
  useMensajesHechos,
  usePiezas,
  usePospuestas,
  useTareas,
  useTodasLasHechas,
} from "./data";

/** Days ahead the plan covers: enough for the calendar's month view. */
const HORIZONTE_DIAS = 120;

export interface PlanContext {
  today: Date;
  todayISO: string;
  plan: Plan;
  /** What the plan was built from: the simulator re-runs it with a prospect added. */
  entrada: PlannerInput;
  /** Deliveries with progress and traffic light, earliest first. */
  entregas: Entrega[];
  clients: Client[];
  piezas: Pieza[];
  ciclos: Ciclo[];
  grabaciones: Grabacion[];
  cobros: Cobro[];
  reportes: AdsReporte[];
  adsHistorial: AdsRegistro[];
  estadosEntrega: EstadoEntrega[];
  tareas: Tarea[];
  estructura: EstructuraSemanal;
}

/** Everything that wants Paula's attention: the alerts (late, overloaded,
 * waiting on a recording, Ads) and the WhatsApp messages due. */
export interface Avisos {
  alertas: AlertaGlobal[];
  mensajes: MensajePendiente[];
  /** What the bell and Hoy's line both show. */
  total: number;
  /** Behind the "recordar el pago" messages and the Plata badge. */
  cobrosVencidos: Cobro[];
}

const VACIO: Avisos = { alertas: [], mensajes: [], total: 0, cobrosVencidos: [] };

const Contexto = createContext<{ ctx: PlanContext | null; avisos: Avisos }>({ ctx: null, avisos: VACIO });

/** `null` until every table the plan reads has loaded: a plan computed from
 * half the data shows numbers that change by themselves a second later. */
function useCalcularPlan(): PlanContext | null {
  const today = useMemo(() => new Date(), []);
  const todayISO = toISODate(today);

  const clients = useClients();
  const piezas = usePiezas();
  const ciclos = useCiclos();
  const grabaciones = useGrabaciones();
  const blockedDates = useBlockedDates();
  const cobros = useCobros();
  const reportes = useAdsReportes();
  const adsHistorial = useAdsHistorial();
  const estadosEntrega = useEstadosEntrega();
  const tareas = useTareas();
  const pospuestas = usePospuestas();
  const hechas = useTodasLasHechas();
  const dayOverride = useDayOverride(todayISO);
  const estructuraGuardada = useEstructuraSemanal();

  // Tables come back as fresh arrays on every render; key the plan on their content.
  const firma = JSON.stringify([clients, piezas, ciclos, grabaciones, blockedDates, cobros, reportes, adsHistorial, estadosEntrega, tareas, pospuestas, hechas, dayOverride, estructuraGuardada]);

  return useMemo(() => {
    if (
      !clients ||
      !piezas ||
      !ciclos ||
      !grabaciones ||
      !blockedDates ||
      !cobros ||
      !reportes ||
      !adsHistorial ||
      !estadosEntrega ||
      !tareas ||
      !pospuestas ||
      !hechas ||
      dayOverride === undefined ||
      estructuraGuardada === undefined
    ) {
      return null;
    }
    const estructura = estructuraGuardada ?? DEFAULT_ESTRUCTURA_SEMANAL;
    const { entrada, plan } = armarPlan({
      today,
      clients,
      piezas,
      grabaciones,
      blockedDates,
      tareas,
      adsHistorial,
      reportes,
      estadosEntrega,
      pospuestas,
      hechas,
      dayOverride,
      estructura,
      horizonteDias: HORIZONTE_DIAS,
    });
    return {
      today,
      todayISO,
      plan,
      entrada,
      entregas: calcularEntregas({ clients, piezas, grabaciones, plan, today, estructura, estados: estadosEntrega }),
      clients,
      piezas,
      ciclos,
      grabaciones,
      cobros,
      reportes,
      adsHistorial,
      estadosEntrega,
      tareas,
      estructura,
    };
    // `firma` stands in for the tables: same content, same plan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma, today, todayISO]);
}

function useCalcularAvisos(ctx: PlanContext | null): Avisos {
  const hechos = useMensajesHechos();
  const firma = hechos ? [...hechos].sort().join("|") : undefined;
  return useMemo(() => {
    if (!ctx || !hechos) return VACIO;
    const alertas = alertasGlobales({
      plan: ctx.plan,
      clients: ctx.clients,
      reportes: ctx.reportes,
      grabaciones: ctx.grabaciones,
      entregas: ctx.entregas,
      today: ctx.today,
    });
    const mensajes = mensajesPendientes({
      today: ctx.today,
      clients: ctx.clients,
      piezas: ctx.piezas,
      grabaciones: ctx.grabaciones,
      cobros: ctx.cobros,
      hechos,
      plan: ctx.plan,
      entregas: ctx.entregas,
    });
    return {
      alertas,
      mensajes,
      total: alertas.length + mensajes.length,
      cobrosVencidos: cobrosVencidos(ctx.cobros, ctx.clients, ctx.today),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, firma]);
}

/** Cycles being written right now, across remounts: the realtime echo takes a
 * moment, and opening the same cycle twice would only bounce off the database. */
const abriendo = new Set<string>();

/** Opens the cycles that are due (new client, last cycle finished, window
 * started) with their pieces. The database ignores a cycle that already exists,
 * so two devices doing this at once still generate each piece once. */
function useAbrirCiclos(ctx: PlanContext | null) {
  const pendientes = useMemo(
    () => (ctx ? ciclosPorAbrir({ clients: ctx.clients, ciclos: ctx.ciclos, piezas: ctx.piezas, today: ctx.today }) : []),
    [ctx],
  );
  useEffect(() => {
    for (const { ciclo, piezas } of pendientes) {
      if (abriendo.has(ciclo.id)) continue;
      abriendo.add(ciclo.id);
      abrirCiclo(ciclo, piezas)
        .catch((e) => console.error("[ciclos] no se pudo abrir", ciclo.id, e))
        .finally(() => setTimeout(() => abriendo.delete(ciclo.id), 10_000));
    }
  }, [pendientes]);
}

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const ctx = useCalcularPlan();
  const avisos = useCalcularAvisos(ctx);
  useAbrirCiclos(ctx);
  const valor = useMemo(() => ({ ctx, avisos }), [ctx, avisos]);
  return createElement(Contexto.Provider, { value: valor }, children);
}

/** The plan and the data it was built from; `null` while loading. */
export function usePlan(): PlanContext | null {
  return useContext(Contexto).ctx;
}

export function useAvisos(): Avisos {
  return useContext(Contexto).avisos;
}

