// Pure helpers for the calendar views: turn a Plan + cobros into one record per
// day, so Mes / Semana / detalle all read the same derived facts.

import { addDays, eachDayOfInterval, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";
import { toISODate } from "./dates";
import { estadoCobro } from "./cobros";
import { Asignacion, CargaDia, Hito, Plan } from "./planner";
import { Client, Cobro, Pieza } from "./types";

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
/** Earthy, warm-leaning hues that sit with acento/hueso and stay legible
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
  /** Pieces the plan puts in the month, from today on. */
  piezasPlanificadas: number;
  /** Days loaded over the cap. */
  diasCargados: number;
  diasLibres: number;
}

/** Pieces (not routines or tasks) the plan puts on a day. */
export const piezasDelDia = (tareas: Asignacion[]) => tareas.filter((a) => a.unidad.tipo === "edicion").length;

/** "4 piezas", "4 piezas · día cargado", "Sin piezas": a day's load in Paula's words, no caps or decimals. */
export function textoCarga(info: { tareas: Asignacion[]; carga?: CargaDia }): string {
  const n = piezasDelDia(info.tareas);
  const piezas = n === 0 ? "Sin piezas" : `${n} ${n === 1 ? "pieza" : "piezas"}`;
  return info.carga?.semaforo === "sobrecargado" ? `${piezas} · día cargado` : piezas;
}

/** Month close: what was delivered, what's left, pieces planned, loaded and
 * free days. Planned pieces and days only cover days from today on (the plan
 * has no memory of past days). */
export function cierreDelMes(
  ancla: Date,
  piezas: Pieza[],
  plan: Plan,
): CierreMes {
  const periodo = toISODate(ancla).slice(0, 7);
  const delMes = piezas.filter((p) => (p.periodoPublicacion ?? p.fechaEntrega?.slice(0, 7)) === periodo);
  const entregadas = delMes.filter((p) => p.hecha).length;

  let cargados = 0;
  let libres = 0;
  for (const c of Object.values(plan.cargaPorDia)) {
    if (!c.fecha.startsWith(periodo)) continue;
    if (c.semaforo === "sobrecargado") cargados += 1;
    if (c.capacidad > 0 && c.carga === 0) libres += 1;
  }
  return {
    periodo,
    entregadas,
    pendientes: delMes.length - entregadas,
    piezasPlanificadas: piezasDelDia(plan.asignaciones.filter((a) => a.fecha.startsWith(periodo))),
    diasCargados: cargados,
    diasLibres: libres,
  };
}
