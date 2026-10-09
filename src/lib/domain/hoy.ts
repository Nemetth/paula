// How Hoy reads the plan: today's work split in urgent / the rest, and every
// list grouped by client with a one-line count ("2 posteos, 1 reel").

import { addDays } from "date-fns";
import { fromISODate, toISODate } from "./dates";
import { DIAS_URGENTE, ORDEN_TIPOS } from "./entregas";
import { cantidadPiezas } from "./labels";
import { Asignacion, UnidadTrabajo } from "./planner";
import { Client } from "./types";

/** Due in 3 days or less, already late, or unblocks a recording. */
export function esUrgente(a: Asignacion, hoyISO: string): boolean {
  const corte = toISODate(addDays(fromISODate(hoyISO), DIAS_URGENTE));
  return a.atrasada || a.unidad.tipo === "guion" || (!!a.unidad.limite && a.unidad.limite <= corte);
}

export interface GrupoCliente {
  clienteId?: string;
  nombre: string;
  resumen: string;
  asignaciones: Asignacion[];
}

/** "2 posteos, 1 reel, 1 guion". */
export function resumenUnidades(unidades: UnidadTrabajo[]): string {
  const partes: string[] = [];
  for (const tipo of ORDEN_TIPOS) {
    const n = unidades.filter((u) => u.tipo === "edicion" && u.piezaTipo === tipo).length;
    if (n > 0) partes.push(cantidadPiezas(n, tipo));
  }
  const guiones = unidades.filter((u) => u.tipo === "guion").length;
  if (guiones > 0) partes.push(`${guiones} ${guiones === 1 ? "guion" : "guiones"}`);
  if (unidades.some((u) => u.tipo === "ideas")) partes.push("calendario de ideas");
  if (unidades.some((u) => u.tipo === "ads-fondo")) partes.push("revisión de Ads");
  for (const u of unidades) if (u.tipo === "tarea") partes.push(u.etiqueta);
  return partes.join(", ");
}

/** Groups in the order their first unit appears; loose tasks with no client go together. */
export function agruparPorCliente(asignaciones: Asignacion[], clients: Client[]): GrupoCliente[] {
  const nombres = new Map(clients.map((c) => [c.id, c.nombre]));
  const grupos = new Map<string, GrupoCliente>();
  for (const a of asignaciones) {
    const id = a.unidad.clienteId;
    const key = id ?? "";
    const g = grupos.get(key) ?? { clienteId: id, nombre: (id && nombres.get(id)) || "Otras tareas", resumen: "", asignaciones: [] };
    g.asignaciones.push(a);
    grupos.set(key, g);
  }
  return [...grupos.values()].map((g) => ({ ...g, resumen: resumenUnidades(g.asignaciones.map((a) => a.unidad)) }));
}
