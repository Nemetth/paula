// Deliveries as Paula thinks about them: one per client and date, with how far
// along it is (per piece type) and a traffic light read off the plan.

import { differenceInCalendarDays } from "date-fns";
import { grabacionDeLaPieza, idCiclo, inicioVentana, objetivoDe } from "./ciclos";
import { fromISODate, toISODate } from "./dates";
import { Asignacion, Plan } from "./planner";
import {
  Client,
  DEFAULT_PESO_PIEZA,
  EstadoEntrega,
  EstructuraSemanal,
  Grabacion,
  ORDEN_TIPOS,
  PASOS_SIN_APROBAR,
  PieceType,
  Pieza,
  esperaGrabacionLaPieza,
  pesosPieza,
} from "./types";

export { ORDEN_TIPOS };

/** - verde: on track;
 * - ambar: due in a few days, takes more than half of the room left, or only
 *   fits by eating into the margin;
 * - rojo: overdue, what is left doesn't fit in the days left even with all of
 *   them for this client, or the plan can't make it without going over the cap;
 * - lista: every piece is done. */
export type SemaforoEntrega = "verde" | "ambar" | "rojo" | "lista";

export interface AvanceTipo {
  hechas: number;
  total: number;
}

export interface Entrega {
  clienteId: string;
  /** The cycle it was generated for: where its step (paso) is kept. */
  cicloId: string;
  fecha: string;
  /** When production starts: delivery minus the client's días de anticipación. */
  inicio: string;
  /** Delivery minus the client's margin: when it should be finished. */
  objetivo: string;
  total: number;
  hechas: number;
  faltan: number;
  porTipo: Partial<Record<PieceType, AvanceTipo>>;
  semaforo: SemaforoEntrega;
  /** The client records and this cycle's recording isn't done: its reels aren't in the plan yet. */
  esperaGrabacion: boolean;
  /** Its calendar is out for approval: none of its pieces are in the plan yet. */
  esperaAprobacion: boolean;
  /** Step, link, material: what Paula set for this delivery, if anything. */
  estado?: EstadoEntrega;
  /** Days until the delivery (negative = overdue). */
  dias: number;
}

/** Due within this many days counts as urgent. */
export const DIAS_URGENTE = 3;
/** Taking more than this share of the room left before the delivery reads as tight. */
const PARTE_JUSTA = 0.5;

export function calcularEntregas(input: {
  clients: Client[];
  piezas: Pieza[];
  grabaciones: Grabacion[];
  plan: Plan;
  today: Date;
  estructura?: EstructuraSemanal;
  estados?: EstadoEntrega[];
}): Entrega[] {
  const { clients, piezas, grabaciones, plan, today } = input;
  const pesos = input.estructura ? pesosPieza(input.estructura) : DEFAULT_PESO_PIEZA;
  const estados = new Map((input.estados ?? []).map((e) => [e.id, e]));
  const hoyISO = toISODate(today);
  /** Room from today up to a date, counting each day's whole cap. */
  const lugarHasta = (fecha: string) =>
    Object.values(plan.cargaPorDia).reduce((s, d) => (d.fecha >= hoyISO && d.fecha <= fecha ? s + d.capacidad : s), 0);
  const clientById = new Map(clients.map((c) => [c.id, c]));

  const grupos = new Map<string, { client: Client; fecha: string; piezas: Pieza[] }>();
  for (const p of piezas) {
    const client = clientById.get(p.clienteId);
    if (!client || !client.activo || client.estado === "en-pausa" || !p.fechaEntrega) continue;
    const key = `${p.clienteId}|${p.fechaEntrega}`;
    const g = grupos.get(key) ?? { client, fecha: p.fechaEntrega, piezas: [] };
    g.piezas.push(p);
    grupos.set(key, g);
  }

  const asignacionesDe = new Map<string, Asignacion[]>();
  for (const a of plan.asignaciones) {
    if (!a.unidad.piezaId) continue;
    asignacionesDe.set(a.unidad.piezaId, [...(asignacionesDe.get(a.unidad.piezaId) ?? []), a]);
  }
  const sinLugar = new Set(plan.sinLugar.map((u) => u.piezaId).filter(Boolean));

  const out: Entrega[] = [];
  for (const { client, fecha, piezas: suyas } of grupos.values()) {
    const porTipo: Entrega["porTipo"] = {};
    let hechas = 0;
    for (const p of suyas) {
      const t = (porTipo[p.tipo] ??= { hechas: 0, total: 0 });
      t.total += 1;
      if (p.hecha) {
        t.hechas += 1;
        hechas += 1;
      }
    }
    const pendientes = suyas.filter((p) => !p.hecha);
    const cicloId = suyas.find((p) => p.cicloId)?.cicloId ?? idCiclo(client.id, fecha);
    const estado = estados.get(cicloId);
    const esperaAprobacion = !!estado?.paso && PASOS_SIN_APROBAR.includes(estado.paso);
    const esperaGrabacion = pendientes.some(
      (p) => esperaGrabacionLaPieza(client, p.tipo) && !grabacionDeLaPieza(p, client, grabaciones)?.hecha,
    );
    const asigs = pendientes.flatMap((p) => asignacionesDe.get(p.id) ?? []);
    const dias = differenceInCalendarDays(fromISODate(fecha), today);
    const sinPlan = pendientes.some((p) => sinLugar.has(p.id));
    const inicio = inicioVentana(fecha, client);
    const arranco = hoyISO >= inicio;
    // Pieces waiting on a recording or an approval still have to be done by the
    // delivery: count them all, not only the ones the plan could place.
    const falta = pendientes.reduce((s, p) => s + pesos[p.tipo], 0);
    const lugar = arranco || dias <= DIAS_URGENTE ? lugarHasta(fecha) : Infinity;

    let semaforo: SemaforoEntrega;
    if (pendientes.length === 0) semaforo = "lista";
    else if (dias < 0 || sinPlan || falta > lugar || asigs.some((a) => a.atrasada || a.sobrecarga)) semaforo = "rojo";
    else if (
      dias <= DIAS_URGENTE ||
      falta > lugar * PARTE_JUSTA ||
      ((esperaGrabacion || esperaAprobacion) && arranco) ||
      asigs.some((a) => a.enMargen)
    )
      semaforo = "ambar";
    else semaforo = "verde";

    out.push({
      clienteId: client.id,
      cicloId,
      fecha,
      inicio,
      objetivo: objetivoDe(fecha, client),
      total: suyas.length,
      hechas,
      faltan: pendientes.length,
      porTipo,
      semaforo,
      esperaGrabacion,
      esperaAprobacion,
      estado,
      dias,
    });
  }

  const nombre = (id: string) => clientById.get(id)?.nombre ?? "";
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha) || nombre(a.clienteId).localeCompare(nombre(b.clienteId)));
}

export interface HistorialCliente {
  /** Months since the client joined. */
  meses: number;
  entregasTerminadas: number;
  /** Finished deliveries whose day each piece was done is known… */
  conFecha: number;
  /** …and how many of those were done by the delivery date. */
  aTiempo: number;
  piezasDelAnio: number;
  cobradoDelAnio: number;
  /** Paid cobros this year that came in after their due date. */
  pagosTarde: number;
}

/** What Paula has done with a client, to talk about a price increase with numbers. */
export function historialCliente(input: {
  cliente: Client;
  piezas: Pieza[];
  entregas: Entrega[];
  cobros: { clienteId: string; periodo: string; estado: string; monto?: number; fechaVencimiento: string; fechaPago?: string }[];
  today: Date;
}): HistorialCliente {
  const { cliente, piezas, entregas, cobros, today } = input;
  const anio = String(today.getFullYear());
  const suyas = piezas.filter((p) => p.clienteId === cliente.id);
  const listas = entregas.filter((e) => e.clienteId === cliente.id && e.semaforo === "lista");
  let conFecha = 0;
  let aTiempo = 0;
  for (const e of listas) {
    const deEsta = suyas.filter((p) => p.fechaEntrega === e.fecha);
    if (deEsta.length === 0 || deEsta.some((p) => !p.hechaEn)) continue;
    conFecha += 1;
    if (deEsta.every((p) => (p.hechaEn as string) <= e.fecha)) aTiempo += 1;
  }
  const pagados = cobros.filter((c) => c.clienteId === cliente.id && c.estado === "pagado" && c.periodo.startsWith(anio));
  return {
    meses: Math.max(differenceInCalendarDays(today, new Date(cliente.creadoEn)) / 30.4, 0) | 0,
    entregasTerminadas: listas.length,
    conFecha,
    aTiempo,
    piezasDelAnio: suyas.filter((p) => p.hecha && (p.hechaEn ?? p.fechaEntrega ?? "").startsWith(anio)).length,
    cobradoDelAnio: pagados.reduce((s, c) => s + (c.monto ?? 0), 0),
    pagosTarde: pagados.filter((c) => c.fechaPago && c.fechaPago > c.fechaVencimiento).length,
  };
}

/** The delivery a client is working towards: the earliest one not finished yet. */
export function entregaActual(entregas: Entrega[], clienteId: string): Entrega | undefined {
  return entregas.find((e) => e.clienteId === clienteId && e.semaforo !== "lista");
}
