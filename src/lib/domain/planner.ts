// Piece-based planner. One global pass over EVERYTHING Paula has to do:
//
// - the unit of work is a piece (or a loose task), not a client stage;
// - capacity is counted in pieces, not hours: a daily cap Paula sets, with a
//   weight per piece type (a reel can count as 2 historias);
// - each piece belongs to a delivery and can only be worked inside its
//   production window: from the delivery minus the client's días de
//   anticipación up to its target date (delivery minus margin);
// - each delivery is spread evenly over the working days of that window, one
//   quota per piece type, so a delivery is never piled onto the first free day
//   and clients mix within a day;
// - pieces of a client that records only become available the day after the
//   cycle's recording is marked done;
// - hard rule: nothing is placed after its delivery. When it doesn't fit, the
//   day before is loaded over the cap and an overload alert says so;
// - nothing is stored as a plan. Ticking a piece (or logging a day off) and
//   calling planificar() again IS the "se reacomoda solo": what wasn't done
//   yesterday is simply spread over the days left.
//
// Pure functions only: no React, no Supabase.

import { addDays, startOfDay } from "date-fns";
import {
  configCiclo,
  entregaDesde,
  entregaSiguiente,
  grabacionDeLaPieza,
  inicioVentana,
  objetivoDe,
  tipoCicloDe,
} from "./ciclos";
import { fechaCorta, fromISODate, toISODate } from "./dates";
import {
  Client,
  DiaBloqueado,
  EstructuraSemanal,
  Grabacion,
  PieceType,
  Pieza,
  diasDeTrabajo,
  grabaDe,
  margenDe,
  pesosPieza,
  topeDelDia,
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
  intocable: boolean;
}

export interface Asignacion {
  unidad: UnidadTrabajo;
  fecha: string;
  /** Placed after its deadline, or the deadline had already passed. */
  atrasada: boolean;
  /** Placed after its target date but still before the delivery. */
  enMargen: boolean;
  /** Placed over the day's cap: it didn't fit before its delivery any other way. */
  sobrecarga: boolean;
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

export type AlertaTipo = "vencida" | "sobrecarga" | "no-entra" | "usa-margen" | "espera-grabacion";

export interface Alerta {
  tipo: AlertaTipo;
  mensaje: string;
  clienteId?: string;
  fecha?: string;
}

/** A delivery that only fits by going over the cap: when it could really be done. */
export interface Sobrecarga {
  clienteId?: string;
  limite: string;
  tareas: number;
  /** First day the overload would fit at the normal pace. Undefined if not within the horizon. */
  fechaPosible?: string;
}

export interface Plan {
  asignaciones: Asignacion[];
  /** Units that could not be placed anywhere inside the horizon. */
  sinLugar: UnidadTrabajo[];
  cargaPorDia: Record<string, CargaDia>;
  hitos: Hito[];
  alertas: Alerta[];
  sobrecargas: Sobrecarga[];
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
  /** Units moved to a later day ("pasar a mañana"): unit id → first day it can be worked. */
  pospuestas?: Record<string, string>;
  /** Weight, in pieces, of what was already ticked off today. It uses up today's room, so finishing something never pulls a new task into the day. */
  pesoHechoHoy?: number;
  /** Units already ticked off today: they are done, so they are not planned again. */
  unidadesHechasHoy?: string[];
  /** Units ever ticked off: an idea calendar ticked once doesn't come back. */
  unidadesHechas?: string[];
  /** How many days ahead to plan. */
  horizonteDias?: number;
}

// ---------- tunables ----------

const HORIZONTE_DEFAULT = 60;
const EPS = 1e-9;
/** Weight of preparing one piece's script before a recording. */
export const PESO_GUION = 0.5;
/** Weight of building the next cycle's idea calendar. */
export const PESO_CALENDARIO = 2;
/** The idea calendar shows up this many days before its cycle's production starts. */
const DIAS_CALENDARIO = 10;

// ---------- small helpers ----------

const maxISO = (...fechas: (string | undefined)[]): string =>
  fechas.filter((f): f is string => !!f).sort().at(-1) as string;

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

// ---------- unit generation ----------

function unidadesDePiezas(input: PlannerInput, alertas: Alerta[]): UnidadTrabajo[] {
  const { clients, piezas, grabaciones, today } = input;
  const pesos = pesosPieza(input.estructura);
  const todayISO = toISODate(today);
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const unidades: UnidadTrabajo[] = [];
  /** Pieces whose window is open but whose recording isn't done, per client. */
  const esperan = new Map<string, { n: number; grabacion?: Grabacion }>();

  for (const p of piezas) {
    const client = clientById.get(p.clienteId);
    if (!client || !client.activo || client.estado === "en-pausa" || p.hecha) continue;

    const entrega = p.fechaEntrega;
    const inicio = entrega ? inicioVentana(entrega, client) : undefined;
    const desdeBase = maxISO(todayISO, p.noAntesDe, inicio);
    const etiquetaBase = p.titulo ?? p.tipo;

    const edicion = (desde: string, verbo: string): UnidadTrabajo => ({
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
      intocable: client.intocable,
    });

    if (!grabaDe(client)) {
      unidades.push(edicion(desdeBase, "Producir"));
      continue;
    }

    const grab = grabacionDeLaPieza(p, client, grabaciones);
    if (grab?.hecha) {
      const despues = toISODate(addDays(fromISODate(grab.fecha), 1 + grab.viajeDiasDespues));
      unidades.push(edicion(maxISO(desdeBase, despues), "Editar"));
      continue;
    }

    // Not shot yet: nothing to edit. A piece tied to the recording by hand
    // still gets its script, due the day before (and before any travel).
    if (grab && p.grabacionId === grab.id && !p.guionListo) {
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
        desde: maxISO(todayISO, p.noAntesDe),
        objetivo: ultimoDia,
        limite: ultimoDia,
        repartir: false,
        intocable: client.intocable,
      });
    }
    if (!inicio || todayISO >= inicio) {
      const e = esperan.get(client.id) ?? { n: 0, grabacion: grab };
      e.n += 1;
      esperan.set(client.id, e);
    }
  }

  for (const [clienteId, { n, grabacion }] of esperan) {
    const nombre = clientById.get(clienteId)?.nombre ?? "Cliente";
    alertas.push({
      tipo: "espera-grabacion",
      clienteId,
      fecha: grabacion?.fecha,
      mensaje: grabacion
        ? `${nombre}: ${plural(n, "pieza espera", "piezas esperan")} la grabación del ${fechaCorta(grabacion.fecha)}. Marcala como hecha para que entren al plan`
        : `${nombre}: ${plural(n, "pieza espera", "piezas esperan")} una grabación, y no hay ninguna cargada`,
    });
  }

  return unidades;
}

/** The next cycle's idea calendar: it shows up a few days before that cycle's
 * production starts and must be done the day before. Ticking it once is enough. */
function unidadesDeCalendario(input: PlannerInput): UnidadTrabajo[] {
  const { clients, today } = input;
  const hoy = toISODate(today);
  const hechas = new Set(input.unidadesHechas ?? []);
  const unidades: UnidadTrabajo[] = [];

  for (const client of clients) {
    if (!client.activo || client.estado === "en-pausa" || client.servicio === "ads" || !client.flujo.mandaCalendario) continue;
    const cfg = configCiclo(client);
    if (!cfg) continue;

    // The first delivery whose production hasn't started yet.
    let entrega = entregaDesde(cfg, today);
    for (let i = 0; i < 12 && inicioVentana(entrega, client) <= hoy; i++) entrega = entregaSiguiente(cfg, entrega);
    const inicio = inicioVentana(entrega, client);
    if (hoy < toISODate(addDays(fromISODate(inicio), -DIAS_CALENDARIO))) continue;

    const id = `${client.id}:calendario:${entrega}`;
    if (hechas.has(id)) continue;
    const limite = maxISO(hoy, toISODate(addDays(fromISODate(inicio), -1)));
    unidades.push({
      id,
      tipo: "ideas",
      categoria: "ideas",
      clienteId: client.id,
      etiqueta: `Calendario de ideas · entrega ${fechaCorta(entrega)}`,
      peso: PESO_CALENDARIO,
      desde: hoy,
      objetivo: limite,
      limite,
      repartir: false,
      intocable: client.intocable,
    });
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
      capacidad = topeDelDia(estructura, d.getDay());
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
  const pospuestas = input.pospuestas ?? {};
  const hechasHoy = new Set(input.unidadesHechasHoy ?? []);
  const unidades = [...unidadesDePiezas(input, alertas), ...unidadesDeCalendario(input), ...(input.extras ?? [])]
    .filter((u) => !hechasHoy.has(u.id))
    .map((u) => {
      const hasta = pospuestas[u.id];
      return hasta && hasta > (u.desde ?? "") ? { ...u, desde: hasta } : u;
    });

  /** Units of the same delivery spread together. */
  const grupo = (u: UnidadTrabajo) => `${u.clienteId ?? u.id}|${u.limite ?? ""}`;
  /** Each piece type of a delivery gets its own even quota, so types mix across the days. */
  const cuota = (u: UnidadTrabajo) => `${grupo(u)}|${u.piezaTipo ?? u.tipo}`;
  const vencida = (u: UnidadTrabajo) => !!u.limite && u.limite < todayISO;
  const tier = (u: UnidadTrabajo): number => {
    if (vencida(u)) return 0;
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
    a.etiqueta.localeCompare(b.etiqueta, "es", { numeric: true }) ||
    a.id.localeCompare(b.id);

  const cola = [...unidades].sort(orden);
  const asignadas: Asignacion[] = [];
  const sinLugar: UnidadTrabajo[] = [];
  const reubicadas = new Set<string>();
  /** Load each delivery already has on each day, to spread it evenly. */
  const cargaGrupo = new Map<string, Map<number, number>>();
  /** Per quota: how many units it has, and the days still reserved for them. */
  const tamCuota = new Map<string, number>();
  for (const u of unidades) if (u.repartir) tamCuota.set(cuota(u), (tamCuota.get(cuota(u)) ?? 0) + 1);
  const diasCuota = new Map<string, number[]>();

  const entra = (s: Slot, peso: number) => s.capacidad - s.usadas >= peso - EPS;

  function sumarGrupo(u: UnidadTrabajo, dia: number, signo: 1 | -1) {
    const g = grupo(u);
    const m = cargaGrupo.get(g) ?? new Map<number, number>();
    m.set(dia, (m.get(dia) ?? 0) + signo * u.peso);
    cargaGrupo.set(g, m);
  }

  function colocar(u: UnidadTrabajo, dia: number, sobrecarga = false) {
    const s = slots[dia];
    s.usadas += u.peso;
    sumarGrupo(u, dia, 1);
    const atrasada = vencida(u) || (!!u.limite && s.fecha > u.limite);
    asignadas.push({
      unidad: u,
      fecha: s.fecha,
      atrasada,
      enMargen: !atrasada && !!u.objetivo && s.fecha > u.objetivo,
      sobrecarga,
    });
  }

  /** [first day, last day by target, last day by delivery] as slot indices. */
  function ventana(u: UnidadTrabajo): [number, number, number] {
    const desde = u.desde && u.desde > todayISO ? u.desde : todayISO;
    let ini = slots.findIndex((s) => s.fecha >= desde);
    if (ini === -1) ini = slots.length;
    const ultimo = slots.length - 1;
    if (!u.limite) return [ini, ultimo, ultimo];
    const finLim = hasta(maxISO(u.limite, todayISO));
    const finObj = u.objetivo ? Math.min(hasta(maxISO(u.objetivo, todayISO)), finLim) : finLim;
    return [ini, finObj, finLim];
  }

  /** The day the even spread reserves for this unit: the k-th of n units of a
   * quota goes to working day ⌊k·D/n⌋ of its window. -1 when there is none. */
  function diaDeCuota(u: UnidadTrabajo, ini: number, fin: number): number {
    const k = cuota(u);
    let dias = diasCuota.get(k);
    if (!dias) {
      const habiles: number[] = [];
      for (let i = ini; i <= fin && i < slots.length; i++) if (slots[i].capacidad > 0) habiles.push(i);
      const n = tamCuota.get(k) ?? 1;
      dias = habiles.length === 0 ? [] : Array.from({ length: n }, (_, j) => habiles[Math.floor((j * habiles.length) / n)]);
      diasCuota.set(k, dias);
    }
    return dias.shift() ?? -1;
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

  /** The working day in [a, b] with the most room left (or the least overload). */
  function diaMenosCargado(a: number, b: number): number {
    let mejor = -1;
    for (let i = a; i <= b && i < slots.length; i++) {
      if (slots[i].capacidad <= 0) continue;
      if (mejor === -1 || slots[i].capacidad - slots[i].usadas > slots[mejor].capacidad - slots[mejor].usadas + EPS) mejor = i;
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

  if (slots[0] && slots[0].capacidad > 0 && input.pesoHechoHoy) {
    slots[0].usadas = Math.min(input.pesoHechoHoy, slots[0].capacidad);
  }

  let guardia = unidades.length * 20 + 100;
  while (cola.length > 0 && guardia-- > 0) {
    const u = cola.shift() as UnidadTrabajo;
    const reubicada = reubicadas.has(u.id);
    const [ini, finObj, finLim] = ventana(u);

    // 1) Its day in the even spread, else the day its delivery has the least
    //    load, up to the target date.
    let dia = -1;
    if (u.repartir && !reubicada) {
      const reservado = diaDeCuota(u, ini, finObj);
      if (reservado >= ini && reservado <= finObj && entra(slots[reservado], u.peso)) dia = reservado;
    }
    if (dia === -1) dia = elegirDia(u, ini, finObj);
    // 2) Use the margin between the target and the delivery.
    if (dia === -1 && finLim > finObj) dia = elegirDia({ ...u, repartir: false }, Math.max(finObj + 1, ini), finLim);
    if (dia !== -1) {
      colocar(u, dia);
      continue;
    }

    // 3) Make room by postponing less important work (Ads → ideas → producción).
    if (!u.intocable && !reubicada) {
      let mejor: { dia: number; victimas: Asignacion[] } | undefined;
      for (let i = ini; i <= finLim && i < slots.length; i++) {
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

    // 4) Never after the delivery: load the least busy day before it over the
    //    cap. The overload alert is what tells Paula it doesn't fit.
    if (u.limite && !vencida(u)) {
      const d = diaMenosCargado(ini, finLim);
      if (d !== -1) {
        colocar(u, d, true);
        continue;
      }
    }

    // 5) Already late (its delivery passed, or she moved it past it): as soon as it fits.
    dia = elegirDia({ ...u, repartir: false }, u.limite ? Math.max(finLim + 1, ini) : ini, slots.length - 1);
    if (dia === -1 && u.limite) dia = elegirDia({ ...u, repartir: false }, ini, slots.length - 1);
    if (dia !== -1) colocar(u, dia);
    else sinLugar.push(u);
  }

  // ---- load per day ----
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
  }

  // ---- alerts: one per delivery, not one per piece ----
  const clientById = new Map(input.clients.map((c) => [c.id, c]));
  const nombre = (id: string) => clientById.get(id)?.nombre ?? "";
  const quien = (u: UnidadTrabajo) =>
    u.clienteId && clientById.has(u.clienteId) ? nombre(u.clienteId) : u.etiqueta;
  const fechas = (fs: Set<string>) => [...fs].sort().map(fechaCorta).join(", ");

  type Resumen = { u: UnidadTrabajo; n: number; peso: number; dias: Set<string> };
  function resumir(filtro: (a: Asignacion) => boolean): Resumen[] {
    const m = new Map<string, Resumen>();
    for (const a of asignadas) {
      if (!filtro(a)) continue;
      const r = m.get(grupo(a.unidad)) ?? { u: a.unidad, n: 0, peso: 0, dias: new Set<string>() };
      r.n += 1;
      r.peso += a.unidad.peso;
      r.dias.add(a.fecha);
      m.set(grupo(a.unidad), r);
    }
    return [...m.values()];
  }

  for (const r of resumir((a) => vencida(a.unidad))) {
    alertas.push({
      tipo: "vencida",
      clienteId: r.u.clienteId,
      fecha: r.u.limite,
      mensaje: `${quien(r.u)}: ${plural(r.n, "tarea vencida", "tareas vencidas")} (era para el ${fechaCorta(r.u.limite as string)}) — van el ${fechas(r.dias)}`,
    });
  }

  const sobrecargas: Sobrecarga[] = [];
  for (const r of resumir((a) => a.sobrecarga)) {
    const limite = r.u.limite as string;
    // Where the overload would fit at the normal pace: free room after the delivery.
    let libre = 0;
    let fechaPosible: string | undefined;
    for (let i = hasta(limite) + 1; i < slots.length; i++) {
      libre += Math.max(slots[i].capacidad - slots[i].usadas, 0);
      if (libre >= r.peso - EPS) {
        fechaPosible = slots[i].fecha;
        break;
      }
    }
    sobrecargas.push({ clienteId: r.u.clienteId, limite, tareas: r.n, fechaPosible });
    alertas.push({
      tipo: "sobrecarga",
      clienteId: r.u.clienteId,
      fecha: limite,
      mensaje: `Sobrecarga: ${quien(r.u)} no entra en tu tope antes del ${fechaCorta(limite)} — ${plural(r.n, "tarea quedó", "tareas quedaron")} de más el ${fechas(r.dias)}`,
    });
  }

  for (const r of resumir((a) => a.atrasada && !vencida(a.unidad))) {
    alertas.push({
      tipo: "no-entra",
      clienteId: r.u.clienteId,
      fecha: r.u.limite,
      mensaje: `${quien(r.u)}: ${plural(r.n, "tarea pasada", "tareas pasadas")} después de la entrega del ${fechaCorta(r.u.limite as string)} — van el ${fechas(r.dias)}`,
    });
  }

  // Work that misses the target (delivery minus margin) but still makes the
  // delivery, so the margin isn't eaten silently.
  for (const r of resumir((a) => a.enMargen && !a.sobrecarga)) {
    const ultimo = [...r.dias].sort().at(-1) as string;
    alertas.push({
      tipo: "usa-margen",
      clienteId: r.u.clienteId,
      fecha: r.u.objetivo,
      mensaje: `${quien(r.u)}: ${plural(r.n, "tarea no llega", "tareas no llegan")} al ${fechaCorta(r.u.objetivo as string)} — se terminan el ${fechaCorta(ultimo)}, usando el margen antes de la entrega del ${fechaCorta(r.u.limite as string)}`,
    });
  }

  for (const u of sinLugar) {
    alertas.push({
      tipo: "no-entra",
      clienteId: u.clienteId,
      fecha: u.limite,
      mensaje: `Sin lugar en ${horizonte} días: ${quien(u)}${u.clienteId ? ` · ${u.etiqueta}` : ""}`,
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
    if (p.hecha || !p.fechaEntrega) continue;
    const key = `${p.clienteId}|${p.fechaEntrega}`;
    const cur = entregas.get(key) ?? { clienteId: p.clienteId, fecha: p.fechaEntrega, n: 0 };
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

  return { asignaciones: asignadas, sinLugar, cargaPorDia, hitos, alertas, sobrecargas };
}

export const fmtPiezas = (n: number) => `${Math.round(n * 10) / 10}`.replace(".", ",");

// ---------- helpers built on the plan ----------

export function tareasDelDia(plan: Plan, fechaISO: string): Asignacion[] {
  return plan.asignaciones.filter((a) => a.fecha === fechaISO);
}

/** "Si me sobra tiempo": the next pieces of work, from later days, that can be
 * done today, up to `pesoMax` pieces. Doing them early lightens future days
 * automatically because they get ticked and the plan is re-derived. */
export function sugerirAdelanto(plan: Plan, hoyISO: string, pesoMax: number): Asignacion[] {
  let libre = pesoMax;
  const sugeridas: Asignacion[] = [];
  for (const a of plan.asignaciones) {
    if (a.fecha <= hoyISO) continue;
    if (a.atrasada) continue; // late work goes to Urgente, see atrasadasProximas
    if (a.unidad.desde && a.unidad.desde > hoyISO) continue;
    if (a.unidad.peso > libre + EPS) continue;
    sugeridas.push(a);
    libre -= a.unidad.peso;
    if (libre <= EPS) break;
  }
  return sugeridas;
}

/** Late work the plan only fits on a later day (today is full or blocked). It
 * is already late, so Hoy shows it as urgent instead of as something to get ahead on. */
export function atrasadasProximas(plan: Plan, hoyISO: string): Asignacion[] {
  return plan.asignaciones.filter(
    (a) => a.atrasada && a.fecha > hoyISO && !(a.unidad.desde && a.unidad.desde > hoyISO),
  );
}

/** Rough monthly load of a client volume against Paula's monthly capacity, in
 * pieces. A weekly client's volume is per week, so it counts ~4.3 times. */
export function simularCargaPiezas(
  volumen: { historias: number; posteos: number; reels: number },
  estructura: EstructuraSemanal,
  semanal = false,
): { piezasMes: number; capacidadMes: number } {
  const pesos = pesosPieza(estructura);
  const porCiclo = volumen.historias * pesos.historia + volumen.posteos * pesos.posteo + volumen.reels * pesos.reel;
  const piezasMes = semanal ? porCiclo * 4.3 : porCiclo;
  const capacidadSemana = diasDeTrabajo(estructura).reduce((suma, d) => suma + topeDelDia(estructura, d), 0);
  const capacidadMes = Math.round(capacidadSemana * 4.3);
  return { piezasMes: Math.round(piezasMes * 10) / 10, capacidadMes };
}

/** Whether a client's volume is per week. */
export const esSemanal = (client: Client) => tipoCicloDe(client) === "semanal";
