// Pure helpers for the calendar views: turn a Plan + cobros into one record per
// day, so Mes / Semana / detalle all read the same derived facts.

import { addDays, eachDayOfInterval, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";
import { toISODate } from "./dates";
import { estadoCobro } from "./cobros";
import { Asignacion, CargaDia, Hito, Plan } from "./planner";
import { Client, Cobro, Grabacion, Pieza } from "./types";
import { fechaEntregaDe } from "./planner";

export interface DiaCalendario {
  fecha: string;
  carga?: CargaDia;
  tareas: Asignacion[];
  hitos: Hito[];
  cobros: Cobro[];
}

export function armarDias(plan: Plan, cobros: Cobro[], today: Date, fechas: string[]): Record<string, DiaCalendario> {
  const out: Record<string, DiaCalendario> = {};
  for (const f of fechas) out[f] = { fecha: f, carga: plan.cargaPorDia[f], tareas: [], hitos: [], cobros: [] };
  for (const a of plan.asignaciones) out[a.fecha]?.tareas.push(a);
  for (const h of plan.hitos) out[h.fecha]?.hitos.push(h);
  for (const c of cobros) {
    if (estadoCobro(c, today) === "pagado") continue;
    out[c.fechaVencimiento]?.cobros.push(c);
  }
  return out;
}

/** Monday-first grid covering the whole month, padded with neighbouring days. */
export function grillaDelMes(ancla: Date): Date[] {
  return eachDayOfInterval({
    start: startOfWeek(startOfMonth(ancla), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(ancla), { weekStartsOn: 1 }),
  });
}

export function diasDeLaSemana(ancla: Date): Date[] {
  const inicio = startOfWeek(ancla, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(inicio, i));
}

/** Stable colour per client so it reads the same in every view. */
/** Earthy, warm-leaning hues that sit with terracota/hueso and stay legible
 * as dots, monograms and day-strip segments in both themes. */
const PALETA_CLIENTES = [
  "#C8623E", // arcilla
  "#5E8C6A", // salvia
  "#7A6BB0", // lavanda gris
  "#C99A3B", // ocre
  "#3F84A0", // petróleo
  "#B5577A", // ciruela
  "#7C8B3A", // oliva
  "#A0715A", // cuero
  "#4F6FA8", // azul pizarra
  "#D07E5B", // durazno tostado
];

export function colorCliente(clients: Client[], clienteId?: string): string {
  const i = clients.findIndex((c) => c.id === clienteId);
  if (i < 0) return "var(--color-texto-secundario)";
  return PALETA_CLIENTES[i % PALETA_CLIENTES.length];
}

export interface CierreMes {
  periodo: string; // yyyy-MM
  entregadas: number;
  pendientes: number;
  /** Planned load and capacity, in pieces. */
  cargaPlanificada: number;
  capacidad: number;
  diasLibres: number;
}

/** Month close: what was delivered, what's left, planned load vs capacity, and
 * free days. Planned load and free days only cover days from today on (the plan
 * has no memory of past days). */
export function cierreDelMes(
  ancla: Date,
  piezas: Pieza[],
  grabaciones: Grabacion[],
  plan: Plan,
): CierreMes {
  const periodo = toISODate(ancla).slice(0, 7);
  const delMes = piezas.filter((p) => {
    const f = p.periodoPublicacion ?? fechaEntregaDe(p, grabaciones)?.slice(0, 7);
    return f === periodo;
  });
  const entregadas = delMes.filter((p) => p.estado === "entregada" || p.estado === "programada").length;

  let carga = 0;
  let capacidad = 0;
  let libres = 0;
  for (const c of Object.values(plan.cargaPorDia)) {
    if (!c.fecha.startsWith(periodo)) continue;
    carga += c.carga;
    capacidad += c.capacidad;
    if (c.capacidad > 0 && c.carga === 0) libres += 1;
  }
  return {
    periodo,
    entregadas,
    pendientes: delMes.length - entregadas,
    cargaPlanificada: Math.round(carga * 10) / 10,
    capacidad: Math.round(capacidad * 10) / 10,
    diasLibres: libres,
  };
}
