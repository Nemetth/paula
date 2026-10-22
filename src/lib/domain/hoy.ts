// How Hoy reads the plan: ONE list with everything Paula does today (the plan's
// pieces, the daily Ads check, her fixed routines, whatever she already ticked),
// ordered by how much it matters, with progress over it; and a second list below
// with what is late or pending.

import { addDays } from "date-fns";
import { fromISODate, toISODate } from "./dates";
import { DIAS_URGENTE, ORDEN_TIPOS } from "./entregas";
import { cantidadPiezas } from "./labels";
import { Asignacion, Plan, UnidadTrabajo, atrasadasProximas, tareasDelDia } from "./planner";
import { AdsChequeo, Client, FijoDiario } from "./types";
import { clientesAds } from "./ads";
import type { TareaHecha } from "@/lib/supabase/data";

/** Due in 3 days or less, already late, or unblocks a recording. */
export function esUrgente(a: Asignacion, hoyISO: string): boolean {
  const corte = toISODate(addDays(fromISODate(hoyISO), DIAS_URGENTE));
  return a.atrasada || a.unidad.tipo === "guion" || (!!a.unidad.limite && a.unidad.limite <= corte);
}

/** Most important first: what is late, what unblocks a recording, then the
 * nearest date, then the heavier piece. */
export function porImportancia(a: Asignacion, b: Asignacion): number {
  const rango = (x: Asignacion) => (x.atrasada ? 0 : x.unidad.tipo === "guion" ? 1 : x.unidad.limite ? 2 : 3);
  return (
    rango(a) - rango(b) ||
    (a.unidad.limite ?? "9999").localeCompare(b.unidad.limite ?? "9999") ||
    b.unidad.peso - a.unidad.peso ||
    a.unidad.id.localeCompare(b.unidad.id)
  );
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

export interface GrupoCliente {
  clienteId?: string;
  nombre: string;
  resumen: string;
  asignaciones: Asignacion[];
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

export type ItemHoy =
  | { clave: string; tipo: "unidad"; hecha: boolean; asignacion: Asignacion }
  | { clave: string; tipo: "ads"; hecha: boolean; cliente: Client }
  | { clave: string; tipo: "fijo"; hecha: boolean; fijo: FijoDiario }
  /** Ticked today and no longer in the plan: kept only so the day shows it done. */
  | { clave: string; tipo: "registro"; hecha: true; registro: TareaHecha };

export interface Hoy {
  /** Today's list: pending first (by importance), then done. */
  items: ItemHoy[];
  total: number;
  hechas: number;
  /** Late work the plan can only fit on a later day, most important first. */
  atrasadas: Asignacion[];
}

/** `locales` are ticks the screen has applied but the log hasn't echoed back yet. */
export function armarHoy(input: {
  plan: Plan;
  hoyISO: string;
  clients: Client[];
  fijos: FijoDiario[];
  fijosHechos: Set<string>;
  chequeos: AdsChequeo[];
  registros: TareaHecha[];
  locales: Set<string>;
}): Hoy {
  const { plan, hoyISO, clients, fijos, fijosHechos, chequeos, registros, locales } = input;
  const enRegistro = new Set(registros.map((r) => r.unidadId));

  const delPlan = [...tareasDelDia(plan, hoyISO)].sort(porImportancia);
  const unidades: ItemHoy[] = delPlan
    // A tick the log already knows is shown from the log, not from the plan.
    .filter((a) => !enRegistro.has(a.unidad.id))
    .map((asignacion) => ({
      clave: asignacion.unidad.id,
      tipo: "unidad" as const,
      hecha: locales.has(asignacion.unidad.id),
      asignacion,
    }));

  const chequeadas = new Set(chequeos.filter((c) => c.fecha === hoyISO).map((c) => c.clienteId));
  const ads: ItemHoy[] = clientesAds(clients).map((cliente) => ({
    clave: `ads:${cliente.id}`,
    tipo: "ads" as const,
    hecha: chequeadas.has(cliente.id),
    cliente,
  }));
  const fijosItems: ItemHoy[] = fijos.map((fijo) => ({
    clave: `fijo:${fijo.id}`,
    tipo: "fijo" as const,
    hecha: fijosHechos.has(fijo.id),
    fijo,
  }));
  const delRegistro: ItemHoy[] = registros.map((registro) => ({
    clave: `registro:${registro.unidadId}`,
    tipo: "registro" as const,
    hecha: true as const,
    registro,
  }));

  const todos = [...unidades, ...ads, ...fijosItems];
  const items = [...todos.filter((i) => !i.hecha), ...todos.filter((i) => i.hecha), ...delRegistro];

  return {
    items,
    total: items.length,
    hechas: items.filter((i) => i.hecha).length,
    atrasadas: atrasadasProximas(plan, hoyISO)
      .filter((a) => !enRegistro.has(a.unidad.id))
      .sort(porImportancia),
  };
}
