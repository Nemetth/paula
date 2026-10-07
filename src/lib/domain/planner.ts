// Piece-based planner. Replaces the per-client, stage-window thinking of
// schedule-engine.ts with one global pass over EVERYTHING Paula has to do:
//
// - the unit of work is a piece (or a loose task), not a client stage;
// - capacity is a single per-day budget shared by all clients, so two clients
//   can no longer both "produce" on the same hours;
// - recordings block their whole day (plus travel days) and their pieces are
//   due 7 days later, so moving a recording moves the delivery by derivation;
// - nothing is stored as a plan. Ticking a piece's estado (or logging a day
//   off) and calling planificar() again IS the "se reacomoda solo".
//
// Pure functions only: no React, no Supabase.

import { addDays, endOfMonth, format, startOfDay, startOfMonth } from "date-fns";
import { fromISODate, toISODate } from "./dates";
import {
  Client,
  DEFAULT_TIEMPOS_PIEZA,
  DiaBloqueado,
  ENTREGA_DIAS_POST_GRABACION,
  EstructuraSemanal,
  Grabacion,
  PieceType,
  Pieza,
  TiemposPieza,
} from "./types";

// ---------- public types ----------

/** What kind of work a unit is. */
export type TipoUnidad = "edicion" | "guion" | "ideas" | "ads-fondo" | "tarea";

/** Postponement class. When something doesn't fit, lower ranks give way first:
 * Ads a fondo → ideas → producción. Intocable units (fixed dailies, Deluxe)
 * are never moved. */
export type Categoria = "ads-fondo" | "ideas" | "produccion";

const RANK: Record<Categoria, number> = { "ads-fondo": 0, ideas: 1, produccion: 2 };

export interface UnidadTrabajo {
  id: string;
  tipo: TipoUnidad;
  categoria: Categoria;
  clienteId?: string;
  piezaId?: string;
  /** Loose task this unit was built from. */
  tareaId?: string;
  etiqueta: string;
  horas: number;
  /** Earliest day it can be worked (ISO). Defaults to today. */
  desde?: string;
  /** Hard-ish deadline (ISO). Undefined = no deadline, filled last. */
  limite?: string;
  intocable: boolean;
}

export interface Asignacion {
  unidad: UnidadTrabajo;
  fecha: string;
  /** Placed after its deadline, or the deadline had already passed. */
  atrasada: boolean;
}

export type SemaforoCarga = "libre" | "justo" | "sobrecargado" | "sin-capacidad";

export interface CargaDia {
  fecha: string;
  horas: number;
  capacidad: number;
  semaforo: SemaforoCarga;
  /** Why capacity is 0, when it is (grabación, viaje, no trabajo). */
  bloqueo?: "grabacion" | "viaje" | "no-trabajo" | "libre-semana";
}

export interface Hito {
  fecha: string;
  tipo: "grabacion" | "entrega";
  clienteId: string;
  detalle: string;
}

export type AlertaTipo =
  | "no-entra"
  | "vencida"
  | "dia-sobrecargado"
  | "calendario-nuevo"
  | "contenido-por-acabarse"
  | "pieza-sin-grabacion";

export interface Alerta {
  tipo: AlertaTipo;
  mensaje: string;
  clienteId?: string;
  fecha?: string;
}

export interface Plan {
  asignaciones: Asignacion[];
  /** Units that could not be placed anywhere inside the horizon. */
  sinLugar: UnidadTrabajo[];
  cargaPorDia: Record<string, CargaDia>;
  hitos: Hito[];
  alertas: Alerta[];
}

export interface PlannerInput {
  today: Date;
  clients: Client[];
  piezas: Pieza[];
  grabaciones: Grabacion[];
  blockedDates: DiaBloqueado[];
  estructura: EstructuraSemanal;
  /** Explicit available hours for a date (the "hoy trabajo menos" override). */
  overrides?: Record<string, number>;
  tiempos?: TiemposPieza;
  /** Extra units from other modules (Ads reviews, loose tasks, ...). */
  extras?: UnidadTrabajo[];
  /** How many days ahead to plan. */
  horizonteDias?: number;
}

// ---------- tunables ----------

const HORIZONTE_DEFAULT = 60;
const EPS = 1e-9;
/** Hours reserved to build the next month's idea calendar. */
const HORAS_CALENDARIO = 2;
/** The new calendar should start in the 2nd week of the publication period. */
const DIA_INICIO_CALENDARIO = 7;
/** Days before the next period the calendar must be done by (approval + recording margin). */
const DIAS_ANTICIPO_CALENDARIO = 14;
/** Alert when this few days of published content remain. */
const DIAS_AVISO_POR_ACABARSE = 7;

// ---------- small helpers ----------

/** Delivery date of a piece: explicit, else its recording + 7 days. Undefined if neither exists. */
export function fechaEntregaDe(pieza: Pieza, grabaciones: Grabacion[]): string | undefined {
  if (pieza.fechaEntrega) return pieza.fechaEntrega;
  const grab = pieza.grabacionId ? grabaciones.find((g) => g.id === pieza.grabacionId) : undefined;
  if (!grab) return undefined;
  return toISODate(addDays(fromISODate(grab.fecha), ENTREGA_DIAS_POST_GRABACION));
}

/** Last day with a piece scheduled to publish. */
export function publicadoHasta(clienteId: string, piezas: Pieza[]): string | undefined {
  return piezas
    .filter((p) => p.clienteId === clienteId && p.estado === "programada" && p.fechaPublicacion)
    .map((p) => p.fechaPublicacion as string)
    .sort()
    .at(-1);
}

function nextPeriod(today: Date): string {
  return format(addDays(endOfMonth(today), 1), "yyyy-MM");
}

// ---------- unit generation ----------

const CLIENTES_SIN_GRABACION = new Set(["material-cliente", "pedidos-diarios", "pack"]);

function unidadesDePiezas(input: PlannerInput, alertas: Alerta[]): UnidadTrabajo[] {
  const { clients, piezas, grabaciones, today } = input;
  const tiempos = input.tiempos ?? DEFAULT_TIEMPOS_PIEZA;
  const todayISO = toISODate(today);
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const unidades: UnidadTrabajo[] = [];
  const sinGrabacion = new Map<string, number>();
  const desdeDe = (p: Pieza) => (p.noAntesDe && p.noAntesDe > todayISO ? p.noAntesDe : todayISO);

  for (const p of piezas) {
    const client = clientById.get(p.clienteId);
    if (!client || !client.activo || client.estado === "en-pausa") continue;

    const grab = p.grabacionId ? grabaciones.find((g) => g.id === p.grabacionId) : undefined;
    const etiquetaBase = p.titulo ?? p.tipo;

    if (p.estado === "grabada") {
      unidades.push({
        id: `${p.id}:edicion`,
        tipo: "edicion",
        categoria: "produccion",
        clienteId: p.clienteId,
        piezaId: p.id,
        etiqueta: `Editar · ${etiquetaBase}`,
        horas: tiempos[p.tipo].edicion,
        desde: desdeDe(p),
        limite: fechaEntregaDe(p, grabaciones),
        intocable: client.intocable,
      });
      continue;
    }

    if (p.estado !== "aprobada") continue;

    if (grab && !grab.hecha) {
      // Script prep unblocks the recording: must be done the day before it
      // (before any travel days block the calendar).
      if (!p.guionListo) {
        const ultimoDia = addDays(fromISODate(grab.fecha), -1 - grab.viajeDiasAntes);
        unidades.push({
          id: `${p.id}:guion`,
          tipo: "guion",
          categoria: "produccion",
          clienteId: p.clienteId,
          piezaId: p.id,
          etiqueta: `Guion · ${etiquetaBase}`,
          horas: tiempos[p.tipo].guion,
          desde: desdeDe(p),
          limite: toISODate(ultimoDia),
          intocable: client.intocable,
        });
      }
    } else if (CLIENTES_SIN_GRABACION.has(client.tipo)) {
      unidades.push({
        id: `${p.id}:edicion`,
        tipo: "edicion",
        categoria: "produccion",
        clienteId: p.clienteId,
        piezaId: p.id,
        etiqueta: `Producir · ${etiquetaBase}`,
        horas: tiempos[p.tipo].edicion,
        desde: desdeDe(p),
        limite: fechaEntregaDe(p, grabaciones),
        intocable: client.intocable,
      });
    } else if (!grab) {
      sinGrabacion.set(client.id, (sinGrabacion.get(client.id) ?? 0) + 1);
    }
  }

  for (const [clienteId, n] of sinGrabacion) {
    const nombre = clientById.get(clienteId)?.nombre ?? "Cliente";
    alertas.push({
      tipo: "pieza-sin-grabacion",
      clienteId,
      mensaje: `${nombre}: ${n} ${n === 1 ? "pieza aprobada" : "piezas aprobadas"} sin grabación asignada`,
    });
  }

  return unidades;
}

/** Calendar anticipation: the new idea calendar has to start in the 2nd week of
 * the current publication period, and we warn when published content is running out. */
function unidadesDeCalendario(input: PlannerInput, alertas: Alerta[]): UnidadTrabajo[] {
  const { clients, piezas, today } = input;
  const todayISO = toISODate(today);
  const proximo = nextPeriod(today);
  const inicioPeriodo = startOfMonth(today);
  const inicioCalendario = addDays(inicioPeriodo, DIA_INICIO_CALENDARIO);
  const finalDelPeriodo = addDays(endOfMonth(today), 1);
  const unidades: UnidadTrabajo[] = [];

  for (const client of clients) {
    if (!client.activo || client.estado === "en-pausa" || client.tipo !== "mensual") continue;
    const suyas = piezas.filter((p) => p.clienteId === client.id);
    if (suyas.length === 0) continue; // nothing to compare against yet
    if (suyas.some((p) => p.periodoPublicacion === proximo)) continue; // next period already started

    const hasta = publicadoHasta(client.id, piezas);
    if (hasta) {
      const diasRestantes = Math.round(
        (startOfDay(fromISODate(hasta)).getTime() - startOfDay(today).getTime()) / 86_400_000,
      );
      if (diasRestantes <= DIAS_AVISO_POR_ACABARSE) {
        alertas.push({
          tipo: "contenido-por-acabarse",
          clienteId: client.id,
          fecha: hasta,
          mensaje:
            diasRestantes < 0
              ? `${client.nombre}: ya no hay contenido programado`
              : `${client.nombre}: contenido programado hasta ${hasta} (${diasRestantes} d)`,
        });
      }
    }

    if (today >= inicioCalendario) {
      alertas.push({
        tipo: "calendario-nuevo",
        clienteId: client.id,
        mensaje: `${client.nombre}: arrancá el calendario de ${proximo}`,
      });
      const limite = addDays(finalDelPeriodo, -DIAS_ANTICIPO_CALENDARIO);
      unidades.push({
        id: `${client.id}:calendario:${proximo}`,
        tipo: "ideas",
        categoria: "ideas",
        clienteId: client.id,
        etiqueta: `Calendario ${proximo}`,
        horas: HORAS_CALENDARIO,
        desde: todayISO,
        limite: toISODate(limite < today ? today : limite),
        intocable: client.intocable,
      });
    }
  }
  return unidades;
}

// ---------- capacity ----------

function bloqueosDeGrabaciones(grabaciones: Grabacion[]): Map<string, "grabacion" | "viaje"> {
  const map = new Map<string, "grabacion" | "viaje">();
  for (const g of grabaciones) {
    const base = fromISODate(g.fecha);
    map.set(g.fecha, "grabacion");
    for (let i = 1; i <= g.viajeDiasAntes; i++) {
      const k = toISODate(addDays(base, -i));
      if (!map.has(k)) map.set(k, "viaje");
    }
    for (let i = 1; i <= g.viajeDiasDespues; i++) {
      const k = toISODate(addDays(base, i));
      if (!map.has(k)) map.set(k, "viaje");
    }
  }
  return map;
}

function capacidadBase(date: Date, estructura: EstructuraSemanal): number {
  const dow = date.getDay();
  const total = estructura.horasPorDia[dow] ?? 0;
  if (total <= 0) return 0;
  const fijos = (estructura.fijosDiarios ?? []).reduce((s, f) => s + f.horas, 0);
  const actividades = (estructura.actividadesFijas ?? [])
    .filter((a) => a.diaSemana === dow)
    .reduce((s, a) => s + a.horas, 0);
  return Math.max(total - fijos - actividades, 0);
}

// ---------- the planner ----------

interface Slot {
  fecha: string;
  capacidad: number;
  usadas: number;
  bloqueo?: CargaDia["bloqueo"];
}

export function planificar(input: PlannerInput): Plan {
  const { today, grabaciones, blockedDates, estructura } = input;
  const overrides = input.overrides ?? {};
  const horizonte = input.horizonteDias ?? HORIZONTE_DEFAULT;
  const todayISO = toISODate(today);
  const alertas: Alerta[] = [];

  // ---- day slots ----
  const bloqueoGrab = bloqueosDeGrabaciones(grabaciones);
  const noTrabajo = new Set(blockedDates.map((b) => b.fecha));
  const slots: Slot[] = [];
  for (let i = 0; i <= horizonte; i++) {
    const d = addDays(startOfDay(today), i);
    const fecha = toISODate(d);
    let capacidad: number;
    let bloqueo: Slot["bloqueo"];
    if (bloqueoGrab.has(fecha)) {
      capacidad = 0;
      bloqueo = bloqueoGrab.get(fecha);
    } else if (noTrabajo.has(fecha)) {
      capacidad = 0;
      bloqueo = "no-trabajo";
    } else if (fecha in overrides) {
      capacidad = Math.max(overrides[fecha], 0);
    } else {
      capacidad = capacidadBase(d, estructura);
      if (capacidad === 0) bloqueo = "libre-semana";
    }
    slots.push({ fecha, capacidad, usadas: 0, bloqueo });
  }
  const slotIndex = new Map(slots.map((s, i) => [s.fecha, i]));

  // ---- units ----
  const unidades = [
    ...unidadesDePiezas(input, alertas),
    ...unidadesDeCalendario(input, alertas),
    ...(input.extras ?? []),
  ];

  const tier = (u: UnidadTrabajo): number => {
    if (u.limite && u.limite < todayISO) return 0; // vencido
    if (u.tipo === "guion") return 1; // destraba una grabación
    return 2; // entrega más cercana
  };
  const orden = (a: UnidadTrabajo, b: UnidadTrabajo): number =>
    Number(b.intocable) - Number(a.intocable) ||
    tier(a) - tier(b) ||
    (a.limite ?? "9999").localeCompare(b.limite ?? "9999") ||
    a.id.localeCompare(b.id);

  const cola = [...unidades].sort(orden);
  const asignadas: Asignacion[] = [];
  const sinLugar: UnidadTrabajo[] = [];
  const reubicadas = new Set<string>();

  const entra = (s: Slot, horas: number) => s.capacidad - s.usadas >= horas - EPS;

  function colocar(u: UnidadTrabajo, fecha: string, atrasada: boolean) {
    const s = slots[slotIndex.get(fecha) as number];
    s.usadas += u.horas;
    asignadas.push({ unidad: u, fecha, atrasada });
  }

  function ventana(u: UnidadTrabajo, ignorarLimite: boolean): [number, number] {
    const desde = u.desde && u.desde > todayISO ? u.desde : todayISO;
    let ini = slots.findIndex((s) => s.fecha >= desde);
    if (ini === -1) ini = slots.length;
    let fin = slots.length - 1;
    if (!ignorarLimite && u.limite) {
      const lim = u.limite < todayISO ? todayISO : u.limite;
      let idx = -1;
      for (let i = slots.length - 1; i >= 0; i--) {
        if (slots[i].fecha <= lim) {
          idx = i;
          break;
        }
      }
      fin = idx;
    }
    return [ini, fin];
  }

  /** Free hours on `slot` taken by units that `u` is allowed to push out. */
  function victimasEnDia(u: UnidadTrabajo, fecha: string): Asignacion[] {
    return asignadas
      .filter(
        (a) =>
          a.fecha === fecha &&
          !a.unidad.intocable &&
          RANK[a.unidad.categoria] < RANK[u.categoria],
      )
      .sort(
        (a, b) =>
          RANK[a.unidad.categoria] - RANK[b.unidad.categoria] ||
          (b.unidad.limite ?? "9999").localeCompare(a.unidad.limite ?? "9999"),
      );
  }

  let guardia = unidades.length * 20 + 100;
  while (cola.length > 0 && guardia-- > 0) {
    const u = cola.shift() as UnidadTrabajo;
    const venc = !!u.limite && u.limite < todayISO;
    const reubicada = reubicadas.has(u.id);
    const [ini, fin] = ventana(u, reubicada);

    // 1) Earliest day with room inside the window.
    let hecho = false;
    for (let i = ini; i <= fin; i++) {
      if (entra(slots[i], u.horas)) {
        colocar(u, slots[i].fecha, venc || (reubicada && !!u.limite && slots[i].fecha > u.limite));
        hecho = true;
        break;
      }
    }
    if (hecho) continue;

    // 2) Make room by postponing less important work (Ads → ideas → producción).
    if (!u.intocable && !reubicada) {
      let mejor: { dia: number; victimas: Asignacion[] } | undefined;
      for (let i = ini; i <= fin; i++) {
        const s = slots[i];
        if (s.capacidad < u.horas - EPS) continue;
        let libre = s.capacidad - s.usadas;
        const elegidas: Asignacion[] = [];
        for (const v of victimasEnDia(u, s.fecha)) {
          if (libre >= u.horas - EPS) break;
          elegidas.push(v);
          libre += v.unidad.horas;
        }
        if (libre >= u.horas - EPS && elegidas.length > 0) {
          if (!mejor || elegidas.length < mejor.victimas.length) mejor = { dia: i, victimas: elegidas };
        }
      }
      if (mejor) {
        for (const v of mejor.victimas) {
          slots[mejor.dia].usadas -= v.unidad.horas;
          asignadas.splice(asignadas.indexOf(v), 1);
          reubicadas.add(v.unidad.id);
          cola.push(v.unidad);
        }
        colocar(u, slots[mejor.dia].fecha, venc);
        continue;
      }
    }

    // 3) Fixed work never moves: overload its best day instead of dropping it.
    if (u.intocable) {
      let mejorDia = -1;
      for (let i = ini; i <= Math.max(fin, ini); i++) {
        if (i >= slots.length) break;
        if (slots[i].capacidad <= 0) continue;
        if (mejorDia === -1 || slots[i].capacidad - slots[i].usadas > slots[mejorDia].capacidad - slots[mejorDia].usadas) {
          mejorDia = i;
        }
      }
      if (mejorDia !== -1) {
        colocar(u, slots[mejorDia].fecha, venc);
        continue;
      }
    }

    // 4) Doesn't fit by its deadline: place it as soon as it fits after, flagged late.
    for (let i = Math.max(fin + 1, ini); i < slots.length; i++) {
      if (entra(slots[i], u.horas)) {
        colocar(u, slots[i].fecha, true);
        hecho = true;
        break;
      }
    }
    if (!hecho) sinLugar.push(u);
  }

  // ---- load per day + alerts ----
  const cargaPorDia: Record<string, CargaDia> = {};
  for (const s of slots) {
    let semaforo: SemaforoCarga;
    if (s.capacidad <= 0) semaforo = s.usadas > 0 ? "sobrecargado" : "sin-capacidad";
    else if (s.usadas > s.capacidad + EPS) semaforo = "sobrecargado";
    else if (s.usadas >= s.capacidad * 0.85) semaforo = "justo";
    else semaforo = "libre";
    cargaPorDia[s.fecha] = {
      fecha: s.fecha,
      horas: Math.round(s.usadas * 100) / 100,
      capacidad: s.capacidad,
      semaforo,
      bloqueo: s.bloqueo,
    };
    if (semaforo === "sobrecargado") {
      alertas.push({
        tipo: "dia-sobrecargado",
        fecha: s.fecha,
        mensaje: `${s.fecha}: ${s.usadas.toFixed(1)} h cargadas para ${s.capacidad.toFixed(1)} h libres`,
      });
    }
  }

  const clientNombre = new Map(input.clients.map((c) => [c.id, c.nombre]));
  const conCliente = (u: UnidadTrabajo) =>
    u.clienteId && clientNombre.has(u.clienteId) ? `${clientNombre.get(u.clienteId)} · ${u.etiqueta}` : u.etiqueta;
  for (const a of asignadas) {
    if (!a.atrasada) continue;
    const venc = a.unidad.limite && a.unidad.limite < todayISO;
    alertas.push({
      tipo: venc ? "vencida" : "no-entra",
      clienteId: a.unidad.clienteId,
      fecha: a.unidad.limite,
      mensaje: venc
        ? `Vencida (${a.unidad.limite}): ${conCliente(a.unidad)}`
        : `No entra antes de ${a.unidad.limite}: ${conCliente(a.unidad)} → ${a.fecha}`,
    });
  }
  for (const u of sinLugar) {
    alertas.push({
      tipo: "no-entra",
      clienteId: u.clienteId,
      fecha: u.limite,
      mensaje: `Sin lugar en ${horizonte} días: ${conCliente(u)}`,
    });
  }

  // ---- milestones: recordings and deliveries ----
  const hitos: Hito[] = [];
  for (const g of grabaciones) {
    if (g.hecha) continue;
    hitos.push({
      fecha: g.fecha,
      tipo: "grabacion",
      clienteId: g.clienteId,
      detalle: `Grabación ${clientNombre.get(g.clienteId) ?? ""}`.trim(),
    });
  }
  const entregas = new Map<string, { clienteId: string; fecha: string; n: number }>();
  for (const p of input.piezas) {
    if (p.estado === "entregada" || p.estado === "programada" || p.estado === "idea") continue;
    const f = fechaEntregaDe(p, grabaciones);
    if (!f) continue;
    const key = `${p.clienteId}|${f}`;
    const cur = entregas.get(key) ?? { clienteId: p.clienteId, fecha: f, n: 0 };
    cur.n += 1;
    entregas.set(key, cur);
  }
  for (const e of entregas.values()) {
    hitos.push({
      fecha: e.fecha,
      tipo: "entrega",
      clienteId: e.clienteId,
      detalle: `Entrega ${clientNombre.get(e.clienteId) ?? ""} · ${e.n} ${e.n === 1 ? "pieza" : "piezas"}`.trim(),
    });
  }
  hitos.sort((a, b) => a.fecha.localeCompare(b.fecha));

  asignadas.sort(
    (a, b) =>
      a.fecha.localeCompare(b.fecha) ||
      Number(b.unidad.intocable) - Number(a.unidad.intocable) ||
      orden(a.unidad, b.unidad),
  );

  return { asignaciones: asignadas, sinLugar, cargaPorDia, hitos, alertas };
}

// ---------- helpers built on the plan ----------

export function tareasDelDia(plan: Plan, fechaISO: string): Asignacion[] {
  return plan.asignaciones.filter((a) => a.fecha === fechaISO);
}

/** "Me sobró tiempo": the next pieces of work, from later days, that fit into
 * today's free hours. Doing them early shortens future days automatically
 * because their estado changes and the plan is re-derived. */
export function sugerirAdelanto(plan: Plan, hoyISO: string, horasLibresHoy: number): Asignacion[] {
  const hoy = plan.cargaPorDia[hoyISO];
  let libre = Math.min(horasLibresHoy, hoy ? hoy.capacidad - hoy.horas : horasLibresHoy);
  const sugeridas: Asignacion[] = [];
  for (const a of plan.asignaciones) {
    if (a.fecha <= hoyISO) continue;
    if (a.unidad.desde && a.unidad.desde > hoyISO) continue;
    if (a.unidad.horas > libre + EPS) continue;
    sugeridas.push(a);
    libre -= a.unidad.horas;
    if (libre <= EPS) break;
  }
  return sugeridas;
}

/** Split one delivery in two batches. The first half keeps the current
 * delivery date, the second moves to `fechaTanda2`. Returns the field updates;
 * persisting them is the caller's job. */
export function partirEntrega(
  piezas: Pieza[],
  grabaciones: Grabacion[],
  fechaTanda2: string,
): { id: string; tanda: 1 | 2; fechaEntrega: string | undefined }[] {
  const ordenadas = [...piezas].sort((a, b) => a.id.localeCompare(b.id));
  const corte = Math.ceil(ordenadas.length / 2);
  return ordenadas.map((p, i) =>
    i < corte
      ? { id: p.id, tanda: 1 as const, fechaEntrega: fechaEntregaDe(p, grabaciones) }
      : { id: p.id, tanda: 2 as const, fechaEntrega: fechaTanda2 },
  );
}

/** Learn editing times from real hours logged on pieces. Blends the current
 * estimate toward the observed average, trusting observations more as they
 * accumulate (capped), and ignores a piece type until it has `minMuestras`. */
export function ajustarTiempos(
  piezas: Pieza[],
  base: TiemposPieza = DEFAULT_TIEMPOS_PIEZA,
  minMuestras = 3,
): TiemposPieza {
  const resultado: TiemposPieza = {
    historia: { ...base.historia },
    posteo: { ...base.posteo },
    reel: { ...base.reel },
  };
  (Object.keys(resultado) as PieceType[]).forEach((tipo) => {
    const muestras = piezas
      .filter((p) => p.tipo === tipo && p.horasReales != null && p.horasReales > 0)
      .map((p) => p.horasReales as number);
    if (muestras.length < minMuestras) return;
    const promedio = muestras.reduce((s, h) => s + h, 0) / muestras.length;
    const peso = Math.min(muestras.length / 10, 0.8);
    resultado[tipo].edicion = Math.round((base[tipo].edicion * (1 - peso) + promedio * peso) * 100) / 100;
  });
  return resultado;
}
