// The plan from the raw tables, the same way everywhere: the app (PlanProvider)
// and the server (the morning notification) both call this, so the push says
// exactly what Hoy will show.

import { PESO_RECAMBIO, PESO_REPORTE, PESO_REVISION, unidadesAds } from "./ads";
import { toISODate } from "./dates";
import { PESO_CALENDARIO, PESO_GUION, PlannerInput, planificar } from "./planner";
import { unidadesDeTareas } from "./tareas";
import {
  AdsRegistro,
  AdsReporte,
  Client,
  DiaBloqueado,
  EstadoEntrega,
  EstructuraSemanal,
  Grabacion,
  Pieza,
  Tarea,
  pesosPieza,
} from "./types";

/** One line of the done log, as far as the plan cares. */
export interface Hecho {
  fecha: string;
  unidadId: string;
  tipo: string;
}

export interface DatosPlan {
  today: Date;
  clients: Client[];
  piezas: Pieza[];
  grabaciones: Grabacion[];
  blockedDates: DiaBloqueado[];
  tareas: Tarea[];
  /** Ads routines done (weekly reviews, swaps) and the reports, so they aren't planned again. */
  adsHistorial: AdsRegistro[];
  reportes: AdsReporte[];
  /** Where each delivery is in its flow. */
  estadosEntrega: EstadoEntrega[];
  pospuestas: Record<string, string>;
  hechas: Hecho[];
  /** Today's "hoy puedo menos" cap, if Paula set one. */
  dayOverride: number | null;
  estructura: EstructuraSemanal;
  horizonteDias: number;
}

export function entradaDelPlan(d: DatosPlan): PlannerInput {
  const todayISO = toISODate(d.today);
  const hechasHoy = d.hechas.filter((h) => h.fecha === todayISO);
  return {
    today: d.today,
    clients: d.clients,
    piezas: d.piezas,
    grabaciones: d.grabaciones,
    blockedDates: d.blockedDates,
    estructura: d.estructura,
    estadosEntrega: d.estadosEntrega,
    extras: [
      ...unidadesAds({
        clients: d.clients,
        historial: d.adsHistorial,
        reportes: d.reportes,
        estructura: d.estructura,
        today: d.today,
        horizonteDias: d.horizonteDias,
      }),
      ...unidadesDeTareas(d.tareas, d.clients, d.today),
    ],
    pospuestas: d.pospuestas,
    unidadesHechasHoy: hechasHoy.map((h) => h.unidadId),
    unidadesHechas: d.hechas.map((h) => h.unidadId),
    pesoHechoHoy: pesoHecho(hechasHoy, d.piezas, d.estructura),
    overrides: d.dayOverride != null ? { [todayISO]: d.dayOverride } : undefined,
    horizonteDias: d.horizonteDias,
  };
}

export function armarPlan(d: DatosPlan) {
  const entrada = entradaDelPlan(d);
  return { entrada, plan: planificar(entrada) };
}

/** What ticking these off weighed, in pieces, so today's room can be reduced by it. */
function pesoHecho(hechas: Hecho[], piezas: Pieza[], estructura: EstructuraSemanal): number {
  const pesos = pesosPieza(estructura);
  return hechas.reduce((suma, h) => {
    if (h.tipo === "edicion") {
      const pieza = piezas.find((p) => p.id === h.unidadId.split(":")[0]);
      return suma + (pieza ? pesos[pieza.tipo] : 1);
    }
    if (h.tipo === "guion") return suma + PESO_GUION;
    if (h.tipo === "ideas") return suma + PESO_CALENDARIO;
    if (h.tipo === "ads-revision") return suma + PESO_REVISION;
    if (h.tipo === "ads-recambio") return suma + PESO_RECAMBIO;
    if (h.tipo === "ads-reporte") return suma + PESO_REPORTE;
    return suma + 1;
  }, 0);
}
