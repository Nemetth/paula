// How Hoy reads the plan: ONE list with everything Paula does today (the plan's
// pieces, the daily Ads check, her fixed routines, whatever she already ticked),
// ordered by how much it matters, with progress over it; and a second list below
// with what is late or pending.

import { addDays } from "date-fns";
import { fromISODate, toISODate } from "./dates";
import { DIAS_URGENTE, Entrega, ORDEN_TIPOS } from "./entregas";
import { cantidadPiezas } from "./labels";
import { enumerar } from "./mensajes";
import { Asignacion, CargaDia, Plan, UnidadTrabajo, atrasadasProximas, tareasDelDia } from "./planner";
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

/** What kind of day it is. Hoy draws its summary from this one value only, so
 * it can never say "día completo" and "día bloqueado" at the same time. */
export type EstadoDia =
  /** Recording, travel or a day off: no production is planned. Daily checks may remain. */
  | { tipo: "bloqueado"; titulo: string; detalle: string }
  /** A working day with nothing on it. */
  | { tipo: "libre" }
  | { tipo: "en-curso" }
  | { tipo: "completo" }
  /** Today's list is done, but there is late work the plan put on later days. */
  | { tipo: "completo-con-atrasos"; atrasadas: number };

const BLOQUEO: Record<NonNullable<CargaDia["bloqueo"]>, { titulo: string; detalle: string }> = {
  grabacion: { titulo: "Día de grabación", detalle: "El día queda para grabar: no hay piezas planificadas." },
  viaje: { titulo: "Día de viaje", detalle: "No hay piezas planificadas: el viaje ocupa el día." },
  "no-trabajo": { titulo: "Hoy no trabajás", detalle: "Lo pendiente se repartió en los próximos días." },
  "libre-semana": { titulo: "Día libre", detalle: "Hoy no es día de trabajo en tu semana." },
};

export function estadoDelDia(hoy: Hoy, carga?: CargaDia): EstadoDia {
  if (carga?.bloqueo) return { tipo: "bloqueado", ...BLOQUEO[carga.bloqueo] };
  if (hoy.total === 0) return { tipo: "libre" };
  if (hoy.hechas < hoy.total) return { tipo: "en-curso" };
  return hoy.atrasadas.length > 0 ? { tipo: "completo-con-atrasos", atrasadas: hoy.atrasadas.length } : { tipo: "completo" };
}

/** How many client groups the morning line names before "y N cosas más". */
const GRUPOS_EN_RESUMEN = 3;

/** Today in one sentence, from what is still pending: "Hoy: 4 historias de
 * Bessone, 2 reels de Deluxe y el chequeo de Ads. Deluxe viene justa." The
 * same line Hoy shows under the greeting and the morning notification sends. */
export function resumenDelDia(hoy: Hoy, clients: Client[], entregas: Entrega[]): string | undefined {
  const pendientes = hoy.items.filter((i) => !i.hecha);
  if (pendientes.length === 0) return undefined;

  const grupos = agruparPorCliente(
    pendientes.flatMap((i) => (i.tipo === "unidad" ? [i.asignacion] : [])),
    clients,
  );
  const partes = grupos.map((g) => (g.clienteId ? `${g.resumen} de ${g.nombre}` : g.resumen));
  const visibles = partes.slice(0, GRUPOS_EN_RESUMEN);
  const resto = partes.length - visibles.length;
  if (resto > 0) visibles.push(resto === 1 ? "una cosa más" : `${resto} cosas más`);
  const ads = pendientes.filter((i) => i.tipo === "ads").length;
  if (ads > 0) visibles.push(ads === 1 ? "el chequeo de Ads" : `${ads} chequeos de Ads`);
  if (pendientes.some((i) => i.tipo === "fijo")) visibles.push("tus fijos");

  // The deliveries of today's clients that are tight or at risk.
  const deHoy = new Set(grupos.map((g) => g.clienteId).filter(Boolean));
  const riesgo = new Map<string, Entrega["semaforo"]>();
  for (const e of entregas) {
    if (!deHoy.has(e.clienteId) || riesgo.has(e.clienteId) || e.semaforo === "lista") continue;
    riesgo.set(e.clienteId, e.semaforo);
  }
  const nombre = (id: string) => clients.find((c) => c.id === id)?.nombre ?? "";
  const enRiesgo = [...riesgo].filter(([, s]) => s === "rojo").map(([id]) => nombre(id));
  const justas = [...riesgo].filter(([, s]) => s === "ambar").map(([id]) => nombre(id));

  let frase = `Hoy: ${enumerar(visibles)}.`;
  if (enRiesgo.length > 0) frase += ` ${enumerar(enRiesgo)} ${enRiesgo.length === 1 ? "está" : "están"} en riesgo.`;
  else if (justas.length > 0) frase += ` ${enumerar(justas)} ${justas.length === 1 ? "viene justa" : "vienen justas"}.`;
  return frase;
}

/** Consecutive working days Paula finished everything, counting today only if
 * it is already done. A day off in her week doesn't break it. */
export function racha(cumplidos: Set<string>, diasTrabajo: number[], today: Date): number {
  const trabajo = new Set(diasTrabajo);
  let n = 0;
  let d = today;
  if (!cumplidos.has(toISODate(d))) d = addDays(d, -1);
  for (let i = 0; i < 400; i++, d = addDays(d, -1)) {
    if (!trabajo.has(d.getDay())) continue;
    if (!cumplidos.has(toISODate(d))) break;
    n += 1;
  }
  return n;
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
