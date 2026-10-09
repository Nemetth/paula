// Piece-based planner. One global pass over EVERYTHING Paula has to do:
//
// - the unit of work is a piece (or a loose task), not a client stage;
// - capacity is counted in pieces, not hours: a daily cap Paula sets, with a
//   weight per piece type (a reel can count as 2 historias);
// - each delivery is spread evenly over the days between when it can start and
//   its target date (delivery minus the client's margin), so a delivery is
//   never piled onto the first free day, and clients mix within a day;
// - pieces that wait on a recording are planned provisionally on the days after
//   it, so the plan shows them before they are shot;
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
  DiaBloqueado,
  ENTREGA_DIAS_POST_GRABACION,
  EstructuraSemanal,
  Grabacion,
  PieceType,
  Pieza,
  diasDeTrabajo,
  inicioDe,
  margenDe,
  pesosPieza,
  topePiezas,
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
  piezaTipo?: PieceType;
  /** Loose task this unit was built from. */
  tareaId?: string;
  etiqueta: string;
  /** How much of the daily cap it takes, in pieces. */
  peso: number;
  /** Earliest day it can be worked (ISO). Defaults to today. */
  desde?: string;
  /** Soft target: the day it should be done by (delivery minus margin). */
  objetivo?: string;
  /** Hard deadline: the delivery (ISO). Undefined = no deadline, filled last. */
  limite?: string;
  /** Spread evenly with the rest of its delivery instead of taking the first free day. */
  repartir: boolean;
  /** Waits on a recording that hasn't happened yet: planned, but provisional. */
  provisoria?: boolean;
  intocable: boolean;
}

export interface Asignacion {
  unidad: UnidadTrabajo;
  fecha: string;
  /** Placed after its deadline, or the deadline had already passed. */
  atrasada: boolean;
  /** Placed after its target date but still before the delivery. */
  enMargen: boolean;
}

export type SemaforoCarga = "libre" | "justo" | "sobrecargado" | "sin-capacidad";

export interface CargaDia {
  fecha: string;
  /** Planned load, in pieces. */
  carga: number;
  /** Daily cap, in pieces. */
  capacidad: number;
  semaforo: SemaforoCarga;
  /** Why capacity is 0, when it is (grabación, viaje, no trabajo). */
  bloqueo?: "grabacion" | "viaje" | "no-trabajo" | "libre-semana";
}

export interface Hito {
  fecha: string;
  tipo: "grabacion" | "entrega" | "presentacion";
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
  /** Explicit cap in pieces for a date (the "hoy puedo menos" override). */
  overrides?: Record<string, number>;
  /** Extra units from other modules (Ads reviews, loose tasks, ...). */
  extras?: UnidadTrabajo[];
  /** How many days ahead to plan. */
  horizonteDias?: number;
}

// ---------- tunables ----------

const HORIZONTE_DEFAULT = 60;
const EPS = 1e-9;
/** Weight of preparing one piece's script before a recording. */
const PESO_GUION = 0.5;
/** Weight of building the next month's idea calendar. */
const PESO_CALENDARIO = 2;
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

/** Target date: the delivery minus the client's margin. */
export function objetivoDe(entregaISO: string, client: Client): string {
  return toISODate(addDays(fromISODate(entregaISO), -margenDe(client)));
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

const maxISO = (...fechas: (string | undefined)[]): string =>
  fechas.filter((f): f is string => !!f).sort().at(-1) as string;

// ---------- unit generation ----------

function unidadesDePiezas(input: PlannerInput, alertas: Alerta[]): UnidadTrabajo[] {
  const { clients, piezas, grabaciones, today } = input;
  const pesos = pesosPieza(input.estructura);
  const todayISO = toISODate(today);
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const unidades: UnidadTrabajo[] = [];
  const sinGrabacion = new Map<string, number>();

  for (const p of piezas) {
    const client = clientById.get(p.clienteId);
    if (!client || !client.activo || client.estado === "en-pausa") continue;
    if (p.estado !== "aprobada" && p.estado !== "grabada") continue;

    const grab = p.grabacionId ? grabaciones.find((g) => g.id === p.grabacionId) : undefined;
    const etiquetaBase = p.titulo ?? p.tipo;
    const entrega = fechaEntregaDe(p, grabaciones);
    const modo = inicioDe(client);
    const desdeBase = maxISO(todayISO, p.noAntesDe, modo === "fecha" ? client.flujo.inicioFecha : undefined);

    const edicion = (desde: string, verbo: string, provisoria: boolean): UnidadTrabajo => ({
      id: `${p.id}:edicion`,
      tipo: "edicion",
      categoria: "produccion",
      clienteId: p.clienteId,
      piezaId: p.id,
      piezaTipo: p.tipo,
      etiqueta: `${verbo} · ${etiquetaBase}`,
      peso: pesos[p.tipo],
      desde,
      objetivo: entrega ? objetivoDe(entrega, client) : undefined,
      limite: entrega,
      repartir: !!entrega,
      provisoria,
      intocable: client.intocable,
    });

    if (p.estado === "grabada" || (grab && grab.hecha)) {
      unidades.push(edicion(desdeBase, "Editar", false));
      continue;
    }

    if (grab) {
      // Script prep unblocks the recording: must be done the day before it
      // (before any travel days block the calendar).
      if (!p.guionListo) {
        const ultimoDia = toISODate(addDays(fromISODate(grab.fecha), -1 - grab.viajeDiasAntes));
        unidades.push({
          id: `${p.id}:guion`,
          tipo: "guion",
          categoria: "produccion",
          clienteId: p.clienteId,
          piezaId: p.id,
          piezaTipo: p.tipo,
          etiqueta: `Guion · ${etiquetaBase}`,
          peso: PESO_GUION,
          desde: desdeBase,
          objetivo: ultimoDia,
          limite: ultimoDia,
          repartir: false,
          intocable: client.intocable,
        });
      }
      // Provisional editing: not shot yet, but it will be, so it already takes
      // its place in the days after the recording (and its travel back).
      const despues = toISODate(addDays(fromISODate(grab.fecha), 1 + grab.viajeDiasDespues));
      unidades.push(edicion(maxISO(desdeBase, despues), "Editar", true));
    } else if (modo === "grabacion") {
      sinGrabacion.set(client.id, (sinGrabacion.get(client.id) ?? 0) + 1);
    } else {
      unidades.push(edicion(desdeBase, "Producir", false));
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
      const limite = toISODate(maxDate(addDays(finalDelPeriodo, -DIAS_ANTICIPO_CALENDARIO), today));
      unidades.push({
        id: `${client.id}:calendario:${proximo}`,
        tipo: "ideas",
        categoria: "ideas",
        clienteId: client.id,
        etiqueta: `Calendario ${proximo}`,
        peso: PESO_CALENDARIO,
        desde: todayISO,
        objetivo: limite,
        limite,
        repartir: false,
        intocable: client.intocable,
      });
    }
  }
  return unidades;
}

const maxDate = (a: Date, b: Date) => (a > b ? a : b);

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
  const tope = topePiezas(estructura);
  const trabajo = new Set(diasDeTrabajo(estructura));
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
    } else if (trabajo.has(d.getDay())) {
      capacidad = tope;
    } else {
      capacidad = 0;
      bloqueo = "libre-semana";
    }
    slots.push({ fecha, capacidad, usadas: 0, bloqueo });
  }

  /** Index of the last slot on or before `fecha` (-1 if none). */
  function hasta(fecha: string): number {
    for (let i = slots.length - 1; i >= 0; i--) if (slots[i].fecha <= fecha) return i;
    return -1;
  }

  // ---- units ----
  const unidades = [
    ...unidadesDePiezas(input, alertas),
    ...unidadesDeCalendario(input, alertas),
    ...(input.extras ?? []),
  ];

  /** Units of the same delivery spread together. */
  const grupo = (u: UnidadTrabajo) => `${u.clienteId ?? u.id}|${u.limite ?? ""}`;
  const tier = (u: UnidadTrabajo): number => {
    if (u.limite && u.limite < todayISO) return 0; // vencido
    if (u.tipo === "guion") return 1; // destraba una grabación
    return 2; // entrega más cercana
  };
  // Urgency first. Intocable work is never pushed out (see victimasEnDia), but
  // it doesn't jump ahead of a closer delivery either.
  const orden = (a: UnidadTrabajo, b: UnidadTrabajo): number =>
    tier(a) - tier(b) ||
    (a.objetivo ?? a.limite ?? "9999").localeCompare(b.objetivo ?? b.limite ?? "9999") ||
    Number(b.intocable) - Number(a.intocable) ||
    grupo(a).localeCompare(grupo(b)) ||
    b.peso - a.peso ||
    a.id.localeCompare(b.id);

  const cola = [...unidades].sort(orden);
  const asignadas: Asignacion[] = [];
  const sinLugar: UnidadTrabajo[] = [];
  const reubicadas = new Set<string>();
  /** Load each delivery already has on each day, to spread it evenly. */
  const cargaGrupo = new Map<string, Map<number, number>>();

  const entra = (s: Slot, peso: number) => s.capacidad - s.usadas >= peso - EPS;

  function sumarGrupo(u: UnidadTrabajo, dia: number, signo: 1 | -1) {
    const g = grupo(u);
    const m = cargaGrupo.get(g) ?? new Map<number, number>();
    m.set(dia, (m.get(dia) ?? 0) + signo * u.peso);
    cargaGrupo.set(g, m);
  }

  function colocar(u: UnidadTrabajo, dia: number) {
    const s = slots[dia];
    s.usadas += u.peso;
    sumarGrupo(u, dia, 1);
    const venc = !!u.limite && u.limite < todayISO;
    const atrasada = venc || (!!u.limite && s.fecha > u.limite);
    asignadas.push({ unidad: u, fecha: s.fecha, atrasada, enMargen: !atrasada && !!u.objetivo && s.fecha > u.objetivo });
  }

  /** [first day, last day by target, last day by delivery] as slot indices. */
  function ventana(u: UnidadTrabajo, ignorarLimite: boolean): [number, number, number] {
    const desde = u.desde && u.desde > todayISO ? u.desde : todayISO;
    let ini = slots.findIndex((s) => s.fecha >= desde);
    if (ini === -1) ini = slots.length;
    const ultimo = slots.length - 1;
    if (ignorarLimite || !u.limite) return [ini, ultimo, ultimo];
    const finLim = hasta(maxISO(u.limite, todayISO));
    const finObj = u.objetivo ? Math.min(hasta(maxISO(u.objetivo, todayISO)), finLim) : finLim;
    return [ini, finObj, finLim];
  }

  /** Day in [a, b] with room: the one where its delivery has the least load so
   * far (even spread), else simply the earliest. */
  function elegirDia(u: UnidadTrabajo, a: number, b: number): number {
    const porDia = cargaGrupo.get(grupo(u));
    let mejor = -1;
    for (let i = a; i <= b && i < slots.length; i++) {
      if (!entra(slots[i], u.peso)) continue;
      if (!u.repartir) return i;
      if (mejor === -1 || (porDia?.get(i) ?? 0) < (porDia?.get(mejor) ?? 0) - EPS) mejor = i;
    }
    return mejor;
  }

  /** Work on `fecha` that `u` is allowed to push out. */
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
    const reubicada = reubicadas.has(u.id);
    const [ini, finObj, finLim] = ventana(u, reubicada);

    // 1) Spread over the days up to its target date.
    let dia = elegirDia(u, ini, finObj);
    // 2) Use the margin between the target and the delivery.
    if (dia === -1 && finLim > finObj) dia = elegirDia({ ...u, repartir: false }, Math.max(finObj + 1, ini), finLim);
    if (dia !== -1) {
      colocar(u, dia);
      continue;
    }

    // 3) Make room by postponing less important work (Ads → ideas → producción).
    if (!u.intocable && !reubicada) {
      let mejor: { dia: number; victimas: Asignacion[] } | undefined;
      for (let i = ini; i <= finLim; i++) {
        const s = slots[i];
        if (s.capacidad < u.peso - EPS) continue;
        let libre = s.capacidad - s.usadas;
        const elegidas: Asignacion[] = [];
        for (const v of victimasEnDia(u, s.fecha)) {
          if (libre >= u.peso - EPS) break;
          elegidas.push(v);
          libre += v.unidad.peso;
        }
        if (libre >= u.peso - EPS && elegidas.length > 0) {
          if (!mejor || elegidas.length < mejor.victimas.length) mejor = { dia: i, victimas: elegidas };
        }
      }
      if (mejor) {
        for (const v of mejor.victimas) {
          slots[mejor.dia].usadas -= v.unidad.peso;
          sumarGrupo(v.unidad, mejor.dia, -1);
          asignadas.splice(asignadas.indexOf(v), 1);
          reubicadas.add(v.unidad.id);
          cola.push(v.unidad);
        }
        colocar(u, mejor.dia);
        continue;
      }
    }

    // 4) Fixed work never moves: overload its least-loaded day instead of dropping it.
    if (u.intocable) {
      let mejorDia = -1;
      for (let i = ini; i <= Math.max(finObj, ini) && i < slots.length; i++) {
        if (slots[i].capacidad <= 0) continue;
        if (mejorDia === -1 || slots[i].capacidad - slots[i].usadas > slots[mejorDia].capacidad - slots[mejorDia].usadas) {
          mejorDia = i;
        }
      }
      if (mejorDia !== -1) {
        colocar(u, mejorDia);
        continue;
      }
    }

    // 5) Doesn't fit by its delivery: place it as soon as it fits after, flagged late.
    dia = elegirDia({ ...u, repartir: false }, Math.max(finLim + 1, ini), slots.length - 1);
    if (dia !== -1) colocar(u, dia);
    else sinLugar.push(u);
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
      carga: Math.round(s.usadas * 100) / 100,
      capacidad: s.capacidad,
      semaforo,
      bloqueo: s.bloqueo,
    };
    if (semaforo === "sobrecargado") {
      alertas.push({
        tipo: "dia-sobrecargado",
        fecha: s.fecha,
        mensaje: `${s.fecha}: ${fmtPiezas(s.usadas)} piezas cargadas para un tope de ${fmtPiezas(s.capacidad)}`,
      });
    }
  }

  const clientById = new Map(input.clients.map((c) => [c.id, c]));
  const nombre = (id: string) => clientById.get(id)?.nombre ?? "";
  const conCliente = (u: UnidadTrabajo) =>
    u.clienteId && clientById.has(u.clienteId) ? `${nombre(u.clienteId)} · ${u.etiqueta}` : u.etiqueta;
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

  // ---- milestones: recordings, presentations (target date) and deliveries ----
  const hitos: Hito[] = [];
  for (const g of grabaciones) {
    if (g.hecha) continue;
    hitos.push({
      fecha: g.fecha,
      tipo: "grabacion",
      clienteId: g.clienteId,
      detalle: `Grabación ${nombre(g.clienteId)}`.trim(),
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
      detalle: `Entrega ${nombre(e.clienteId)} · ${e.n} ${e.n === 1 ? "pieza" : "piezas"}`.trim(),
    });
    const client = clientById.get(e.clienteId);
    if (client && margenDe(client) > 0) {
      hitos.push({
        fecha: objetivoDe(e.fecha, client),
        tipo: "presentacion",
        clienteId: e.clienteId,
        detalle: `Presentación ${client.nombre}`,
      });
    }
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

export const fmtPiezas = (n: number) => `${Math.round(n * 10) / 10}`.replace(".", ",");

// ---------- helpers built on the plan ----------

export function tareasDelDia(plan: Plan, fechaISO: string): Asignacion[] {
  return plan.asignaciones.filter((a) => a.fecha === fechaISO);
}

/** "Si me sobra tiempo": the next pieces of work, from later days, that can be
 * done today, up to `pesoMax` pieces. Doing them early lightens future days
 * automatically because their estado changes and the plan is re-derived. */
export function sugerirAdelanto(plan: Plan, hoyISO: string, pesoMax: number): Asignacion[] {
  let libre = pesoMax;
  const sugeridas: Asignacion[] = [];
  for (const a of plan.asignaciones) {
    if (a.fecha <= hoyISO) continue;
    if (a.unidad.desde && a.unidad.desde > hoyISO) continue;
    if (a.unidad.peso > libre + EPS) continue;
    sugeridas.push(a);
    libre -= a.unidad.peso;
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

/** Rough monthly load of a client volume against Paula's monthly capacity, in pieces. */
export function simularCargaPiezas(
  volumen: { historias: number; posteos: number; reels: number },
  estructura: EstructuraSemanal,
): { piezasMes: number; capacidadMes: number } {
  const pesos = pesosPieza(estructura);
  const piezasMes = volumen.historias * pesos.historia + volumen.posteos * pesos.posteo + volumen.reels * pesos.reel;
  const capacidadMes = Math.round(topePiezas(estructura) * diasDeTrabajo(estructura).length * 4.3);
  return { piezasMes: Math.round(piezasMes * 10) / 10, capacidadMes };
}
