// How Hoy reads the plan: ONE list with everything Paula does today (the plan's
// pieces, the daily Ads check, her fixed routines, whatever she already ticked),
// ordered by how much it matters, with progress over it; and a second list below
// with what is late or pending.

import { addDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { fechaCorta, fromISODate, toISODate } from "./dates";
import { DIAS_URGENTE, Entrega, ORDEN_TIPOS } from "./entregas";
import { cantidadPiezas } from "./labels";
import { corrimientosSugeridos, enumerar } from "./mensajes";
import { Asignacion, CargaDia, Plan, UnidadTrabajo, atrasadasProximas, tareasDelDia } from "./planner";
import { AdsChequeo, AdsReporte, Client, FijoDiario, Pieza } from "./types";
import { clientesAds, reportesDelMes, venceReporte } from "./ads";
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

/** ["2 posteos", "1 reel", "1 guion"]. */
function partesDeUnidades(unidades: Pick<UnidadTrabajo, "tipo" | "piezaTipo" | "etiqueta">[]): string[] {
  const partes: string[] = [];
  for (const tipo of ORDEN_TIPOS) {
    const n = unidades.filter((u) => u.tipo === "edicion" && u.piezaTipo === tipo).length;
    if (n > 0) partes.push(cantidadPiezas(n, tipo));
  }
  const guiones = unidades.filter((u) => u.tipo === "guion").length;
  if (guiones > 0) partes.push(`${guiones} ${guiones === 1 ? "guion" : "guiones"}`);
  if (unidades.some((u) => u.tipo === "ideas")) partes.push("calendario de ideas");
  if (unidades.some((u) => u.tipo === "ads-revision")) partes.push("revisión de anuncios");
  if (unidades.some((u) => u.tipo === "ads-recambio")) partes.push("recambio de anuncios");
  if (unidades.some((u) => u.tipo === "ads-reporte")) partes.push("reporte de Ads");
  for (const u of unidades) if (u.tipo === "tarea") partes.push(u.etiqueta);
  return partes;
}

/** "2 posteos, 1 reel, 1 guion". */
export function resumenUnidades(unidades: UnidadTrabajo[]): string {
  return partesDeUnidades(unidades).join(", ");
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
  /** Pieces (historias, posteos, reels) on today's list, done or not: "Hoy te tocan 4 piezas". */
  piezas: number;
  /** Late work the plan can only fit on a later day, most important first. */
  atrasadas: Asignacion[];
  /** Planned for today but past the day's cap: not on the list. What is late or
   * can't make its delivery goes to Urgente; the rest simply waits. */
  sinEntrar: Asignacion[];
}

/** Doesn't fit today and can't wait either. */
const noPuedeEsperar = (a: Asignacion) => a.atrasada || a.sobrecarga;

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
  const atrasadas = hoy.atrasadas.length + hoy.sinEntrar.filter(noPuedeEsperar).length;
  return atrasadas > 0 ? { tipo: "completo-con-atrasos", atrasadas } : { tipo: "completo" };
}

/** "Hoy: 29 piezas de 6 clientes": the day's size, in one line. */
export function lineaDelDia(hoy: Hoy): string | undefined {
  const clientes = new Set(
    hoy.items.flatMap((i) =>
      i.tipo === "unidad" && i.asignacion.unidad.tipo === "edicion"
        ? [i.asignacion.unidad.clienteId]
        : i.tipo === "registro" && i.registro.tipo === "edicion"
          ? [i.registro.clienteId]
          : [],
    ),
  );
  if (hoy.piezas === 0) return undefined;
  return `Hoy: ${hoy.piezas} ${hoy.piezas === 1 ? "pieza" : "piezas"} de ${clientes.size} ${clientes.size === 1 ? "cliente" : "clientes"}`;
}

export type BloqueHoy = "contenido" | "ads";

/** One card of today's list: a client's work in that block, ticked whole or opened
 * to tick piece by piece. The daily checks and the fijos go together on a card too. */
export interface TarjetaHoy {
  clave: string;
  bloque: BloqueHoy;
  clienteId?: string;
  titulo: string;
  /** What's on it: ["3 historias", "1 posteo"]. Pending things; all of them once it's done. */
  partes: string[];
  /** The nearest date of what's pending, in words. */
  detalle?: string;
  /** Has a monthly report, whose text is written on the Ads screen. */
  conReporte: boolean;
  items: ItemHoy[];
  pendientes: ItemHoy[];
  /** Pending plan units: what can be moved to tomorrow. */
  movibles: Asignacion[];
}

function bloqueDe(item: ItemHoy): BloqueHoy {
  if (item.tipo === "ads") return "ads";
  if (item.tipo === "fijo") return "contenido";
  const tipo = item.tipo === "unidad" ? item.asignacion.unidad.tipo : item.registro.tipo;
  return tipo.startsWith("ads") ? "ads" : "contenido";
}

/** The items as cards, in the order they first appear (so what's pending comes first). */
export function tarjetasDeHoy(items: ItemHoy[], clients: Client[], piezas: Pieza[]): TarjetaHoy[] {
  const nombres = new Map(clients.map((c) => [c.id, c.nombre]));
  const grupos = new Map<string, { bloque: BloqueHoy; clienteId?: string; items: ItemHoy[] }>();
  for (const item of items) {
    const bloque = bloqueDe(item);
    const clienteId = item.tipo === "unidad" ? item.asignacion.unidad.clienteId : item.tipo === "registro" ? item.registro.clienteId : undefined;
    const clave = item.tipo === "ads" ? "chequeos" : item.tipo === "fijo" ? "fijos" : `${bloque}:${clienteId ?? ""}`;
    const g = grupos.get(clave) ?? { bloque, clienteId, items: [] };
    g.items.push(item);
    grupos.set(clave, g);
  }

  const unidadDe = (i: ItemHoy): Pick<UnidadTrabajo, "tipo" | "piezaTipo" | "etiqueta">[] => {
    if (i.tipo === "unidad") return [i.asignacion.unidad];
    if (i.tipo !== "registro") return [];
    const r = i.registro;
    return [{ tipo: r.tipo as UnidadTrabajo["tipo"], etiqueta: r.etiqueta, piezaTipo: piezas.find((p) => p.id === r.unidadId.split(":")[0])?.tipo }];
  };

  const tarjetas = [...grupos].map(([clave, g]): TarjetaHoy => {
    const pendientes = g.items.filter((i) => !i.hecha);
    const movibles = pendientes.flatMap((i) => (i.tipo === "unidad" ? [i.asignacion] : []));
    const base = { clave, bloque: g.bloque, clienteId: g.clienteId, items: g.items, pendientes, movibles };
    const hechas = g.items.length - pendientes.length;
    if (clave === "chequeos") {
      return { ...base, titulo: "Chequeo diario", partes: [`${hechas} de ${g.items.length} ${g.items.length === 1 ? "cuenta" : "cuentas"}`], conReporte: false };
    }
    if (clave === "fijos") {
      return { ...base, titulo: "Tus fijos", partes: [`${hechas} de ${g.items.length}`], conReporte: false };
    }
    const unidades = (pendientes.length > 0 ? pendientes : g.items).flatMap(unidadDe);
    const limite = movibles.map((a) => a.unidad).filter((u) => u.limite).sort((a, b) => (a.limite as string).localeCompare(b.limite as string))[0];
    return {
      ...base,
      titulo: (g.clienteId && nombres.get(g.clienteId)) || "Otras tareas",
      partes: partesDeUnidades(unidades).concat(hechas > 0 && pendientes.length > 0 ? [`${hechas} de ${g.items.length} listas`] : []),
      detalle: limite ? `${limite.tipo === "edicion" ? "entrega" : "para el"} ${fechaCorta(limite.limite as string)}` : undefined,
      conReporte: unidades.some((u) => u.tipo === "ads-reporte"),
    };
  });

  // The cards that gather several clients open their block; the fijos close theirs.
  const orden = (t: TarjetaHoy) => (t.clave === "chequeos" ? 0 : t.clave === "fijos" ? 2 : 1);
  return tarjetas.sort((a, b) => orden(a) - orden(b));
}

export type LineaUrgente =
  | { clave: string; tipo: "entrega"; clienteId: string; faltan: number; fecha: string; vencida: boolean; fechaNueva: string }
  | { clave: string; tipo: "reporte"; clienteId: string; etiqueta: string; fecha: string }
  | { clave: string; tipo: "unidad"; asignacion: Asignacion };

/** Urgente, one line per thing to decide: deliveries overdue or that can't make
 * their date (to move them), reports past day 5, and any other work that is late
 * or doesn't fit. Oldest first. */
export function lineasUrgentes(input: {
  hoy: Hoy;
  plan: Plan;
  entregas: Entrega[];
  clients: Client[];
  reportes: AdsReporte[];
  today: Date;
}): LineaUrgente[] {
  const { hoy, plan, entregas, clients, reportes, today } = input;
  const hoyISO = toISODate(today);
  const corrimientos = new Map(corrimientosSugeridos(plan, clients).map((c) => [`${c.cliente.id}|${c.fechaEntrega}`, c.fechaNueva]));
  const noEntran = hoy.sinEntrar.filter(noPuedeEsperar);

  const deEntrega: LineaUrgente[] = entregas
    .filter(
      (e) =>
        e.faltan > 0 &&
        (e.dias < 0 ||
          corrimientos.has(`${e.clienteId}|${e.fecha}`) ||
          noEntran.some((a) => a.unidad.clienteId === e.clienteId && a.unidad.limite === e.fecha)),
    )
    .map((e) => {
      const ultima = plan.asignaciones
        .filter((a) => a.unidad.clienteId === e.clienteId && a.unidad.limite === e.fecha)
        .map((a) => a.fecha)
        .sort()
        .at(-1);
      const manana = toISODate(addDays(today, 1));
      return {
        clave: `entrega:${e.clienteId}:${e.fecha}`,
        tipo: "entrega" as const,
        clienteId: e.clienteId,
        faltan: e.faltan,
        fecha: e.fecha,
        vencida: e.dias < 0,
        fechaNueva: corrimientos.get(`${e.clienteId}|${e.fecha}`) ?? (ultima && ultima > hoyISO ? ultima : manana),
      };
    });

  const deReporte: LineaUrgente[] = reportesDelMes(clients, reportes, today)
    .filter((r) => r.atrasado)
    .map((r) => ({
      clave: `reporte:${r.cliente.id}`,
      tipo: "reporte" as const,
      clienteId: r.cliente.id,
      etiqueta: `Reporte de ${format(fromISODate(`${r.periodo}-01`), "MMMM", { locale: es })}`,
      fecha: venceReporte(today),
    }));

  // Pieces with a delivery are already on that delivery's line, and reports on theirs.
  const sueltas = [...hoy.atrasadas, ...noEntran].filter((a) => a.unidad.tipo !== "ads-reporte" && !(a.unidad.tipo === "edicion" && a.unidad.limite));
  const deUnidad: LineaUrgente[] = [...new Map(sueltas.map((a) => [a.unidad.id, a])).values()].map((asignacion) => ({
    clave: asignacion.unidad.id,
    tipo: "unidad" as const,
    asignacion,
  }));

  return [...deEntrega, ...deReporte, ...deUnidad];
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

  // A tick the log already knows is shown from the log, not from the plan.
  const delPlan = tareasDelDia(plan, hoyISO)
    .filter((a) => !enRegistro.has(a.unidad.id))
    .sort((a, b) => Number(locales.has(b.unidad.id)) - Number(locales.has(a.unidad.id)) || porImportancia(a, b));

  // Only up to the day's cap. The plan's load is what was ticked plus today's
  // units, so what's left of the cap doesn't change as she ticks: nothing new
  // comes in and the "de N" holds.
  const carga = plan.cargaPorDia[hoyISO];
  const pesoDelPlan = tareasDelDia(plan, hoyISO).reduce((s, a) => s + a.unidad.peso, 0);
  let libre = carga ? carga.capacidad - (carga.carga - pesoDelPlan) : Infinity;
  const entran: Asignacion[] = [];
  const sinEntrar: Asignacion[] = [];
  for (const a of delPlan) {
    if (a.unidad.peso <= libre + 1e-9) {
      entran.push(a);
      libre -= a.unidad.peso;
    } else sinEntrar.push(a);
  }

  const unidades: ItemHoy[] = entran
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
    piezas: items.filter(
      (i) => (i.tipo === "unidad" && i.asignacion.unidad.tipo === "edicion") || (i.tipo === "registro" && i.registro.tipo === "edicion"),
    ).length,
    atrasadas: atrasadasProximas(plan, hoyISO)
      .filter((a) => !enRegistro.has(a.unidad.id))
      .sort(porImportancia),
    sinEntrar,
  };
}
