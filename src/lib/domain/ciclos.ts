// Delivery cycles. A client delivers weekly or monthly on a fixed day, and each
// delivery is a cycle with its own pieces, generated from the client's volume.
// The delivery date comes from the cycle settings, never from a recording:
//
//   production window = [delivery − días de anticipación, delivery − margen]
//
// Pure functions only: opening a cycle (writing it and its pieces) is the data
// layer's job, see useAbrirCiclos.

import { addDays, addMonths, getDaysInMonth, startOfDay, startOfMonth, subMonths } from "date-fns";
import { fromISODate, toISODate } from "./dates";
import { Ciclo, Client, Grabacion, ORDEN_TIPOS, PieceType, Pieza, margenDe } from "./types";

export type TipoCiclo = "mensual" | "quincenal" | "semanal";

export const DEFAULT_ANTICIPACION: Record<TipoCiclo, number> = { mensual: 15, quincenal: 10, semanal: 7 };

/** How many deliveries fall in a month, to turn a volume per delivery into a monthly one. */
export const ENTREGAS_POR_MES: Record<TipoCiclo, number> = { mensual: 1, quincenal: 2, semanal: 4.3 };

/** "por mes", "por quincena", "por semana". */
export const POR_CICLO: Record<TipoCiclo, string> = { mensual: "por mes", quincenal: "por quincena", semanal: "por semana" };

export interface ConfigCiclo {
  tipo: TipoCiclo;
  /** Day of the month (mensual, quincenal) or weekday, 0 = Sunday (semanal). */
  dia: number;
  /** The second day of the month of a twice-a-month client. */
  dia2?: number;
}

export function tipoCicloDe(client: Client): TipoCiclo {
  const t = client.flujo.cicloTipo;
  return t === "semanal" || t === "quincenal" ? t : "mensual";
}

export function anticipacionDe(client: Client): number {
  return Math.max(client.flujo.diasAnticipacion ?? DEFAULT_ANTICIPACION[tipoCicloDe(client)], 0);
}

const valido = (n?: number): n is number => n != null && Number.isFinite(n);

/** Undefined while the client has no delivery day: it can't be planned yet. */
export function configCiclo(client: Client): ConfigCiclo | undefined {
  const { diaEntrega: dia, diaEntrega2: dia2 } = client.flujo;
  const tipo = tipoCicloDe(client);
  if (!valido(dia)) return undefined;
  if (tipo === "quincenal") return valido(dia2) ? { tipo, dia: Math.min(dia, dia2), dia2: Math.max(dia, dia2) } : undefined;
  return { tipo, dia };
}

/** The delivery of `d`'s month; a day past the month's end falls on its last day. */
function entregaDelMes(d: Date, dia: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), Math.min(Math.max(dia, 1), getDaysInMonth(d)));
}

/** First delivery on or after `desde`. */
export function entregaDesde(cfg: ConfigCiclo, desde: Date): string {
  const d = startOfDay(desde);
  if (cfg.tipo === "semanal") return toISODate(addDays(d, (((cfg.dia - d.getDay()) % 7) + 7) % 7));
  const dias = cfg.tipo === "quincenal" && cfg.dia2 != null ? [cfg.dia, cfg.dia2] : [cfg.dia];
  const proximoMes = addMonths(startOfMonth(d), 1);
  const candidatas = [...dias.map((dia) => entregaDelMes(d, dia)), ...dias.map((dia) => entregaDelMes(proximoMes, dia))];
  return toISODate(candidatas.filter((c) => c >= d).sort((a, b) => a.getTime() - b.getTime())[0]);
}

/** The delivery after `entregaISO`: next month's, the other half of the month's, or next week's. */
export function entregaSiguiente(cfg: ConfigCiclo, entregaISO: string): string {
  const d = fromISODate(entregaISO);
  if (cfg.tipo === "semanal") return entregaDesde(cfg, addDays(d, 4));
  if (cfg.tipo === "quincenal") return entregaDesde(cfg, addDays(d, 1));
  return toISODate(entregaDelMes(addMonths(startOfMonth(d), 1), cfg.dia));
}

/** When production for a delivery starts. */
export function inicioVentana(entregaISO: string, client: Client): string {
  return toISODate(addDays(fromISODate(entregaISO), -anticipacionDe(client)));
}

/** When it should be finished: the delivery minus the client's margin. */
export function objetivoDe(entregaISO: string, client: Client): string {
  return toISODate(addDays(fromISODate(entregaISO), -margenDe(client)));
}

/** The next delivery that can still be worked on (its target date isn't past). */
export function proximaEntrega(client: Client, today: Date): string | undefined {
  const cfg = configCiclo(client);
  if (!cfg) return undefined;
  const e = entregaDesde(cfg, today);
  return objetivoDe(e, client) < toISODate(today) ? entregaSiguiente(cfg, e) : e;
}

export const idCiclo = (clienteId: string, entrega: string) => `${clienteId}__${entrega}`;

/** The recording a delivery's pieces come from: one set by hand, else the
 * client's recording in the cycle (after the previous delivery, up to this
 * one), preferring one already done. */
export function grabacionDeLaPieza(pieza: Pieza, client: Client, grabaciones: Grabacion[]): Grabacion | undefined {
  if (pieza.grabacionId) {
    const g = grabaciones.find((x) => x.id === pieza.grabacionId);
    if (g) return g;
  }
  return pieza.fechaEntrega ? grabacionDelCiclo(pieza.fechaEntrega, client, grabaciones) : undefined;
}

export function grabacionDelCiclo(entregaISO: string, client: Client, grabaciones: Grabacion[]): Grabacion | undefined {
  const entrega = fromISODate(entregaISO);
  const tipo = tipoCicloDe(client);
  const desde = toISODate(tipo === "semanal" ? addDays(entrega, -7) : tipo === "quincenal" ? addDays(entrega, -15) : subMonths(entrega, 1));
  const delCiclo = grabaciones
    .filter((g) => g.clienteId === client.id && g.fecha > desde && g.fecha <= entregaISO)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  return delCiclo.filter((g) => g.hecha).at(-1) ?? delCiclo[0];
}

const TITULO: Record<PieceType, string> = { historia: "Historia", posteo: "Posteo", reel: "Reel" };
const VOLUMEN: Record<PieceType, keyof Client["volumenMensual"]> = { historia: "historias", posteo: "posteos", reel: "reels" };

export interface PiezaNueva {
  clienteId: string;
  tipo: PieceType;
  titulo: string;
  fechaEntrega: string;
  cicloId: string;
}

/** "Historia 1" … "Historia 12", then the posteos, then the reels. */
export function piezasDelCiclo(client: Client, ciclo: Ciclo): PiezaNueva[] {
  return ORDEN_TIPOS.flatMap((tipo) =>
    Array.from({ length: Math.max(Math.floor(client.volumenMensual[VOLUMEN[tipo]] ?? 0), 0) }, (_, i) => ({
      clienteId: client.id,
      tipo,
      titulo: `${TITULO[tipo]} ${i + 1}`,
      fechaEntrega: ciclo.entrega,
      cicloId: ciclo.id,
    })),
  );
}

/** Cycles to open now, with their pieces. A client's next cycle opens when:
 * - it has none yet (a new client);
 * - all the pieces of its latest cycle are done (close it, open the next); or
 * - the next cycle's production window has started.
 * Deliveries missed while a client was paused are skipped, not back-filled. */
export function ciclosPorAbrir(input: {
  clients: Client[];
  ciclos: Ciclo[];
  piezas: Pieza[];
  today: Date;
}): { ciclo: Ciclo; piezas: PiezaNueva[] }[] {
  const { clients, ciclos, piezas, today } = input;
  const hoy = toISODate(today);
  const out: { ciclo: Ciclo; piezas: PiezaNueva[] }[] = [];

  for (const client of clients) {
    if (!client.activo || client.estado === "en-pausa" || client.servicio === "ads") continue;
    const cfg = configCiclo(client);
    const proxima = proximaEntrega(client, today);
    if (!cfg || !proxima) continue;

    const ultimo = ciclos.filter((c) => c.clienteId === client.id).sort((a, b) => a.entrega.localeCompare(b.entrega)).at(-1);
    let entrega = ultimo ? entregaSiguiente(cfg, ultimo.entrega) : proxima;
    if (entrega < proxima) entrega = proxima;

    const ultimoListo = !ultimo || piezas.filter((p) => p.cicloId === ultimo.id).every((p) => p.hecha);
    if (!ultimoListo && hoy < inicioVentana(entrega, client)) continue;

    const ciclo: Ciclo = { id: idCiclo(client.id, entrega), clienteId: client.id, entrega };
    const nuevas = piezasDelCiclo(client, ciclo);
    if (nuevas.length === 0) continue;
    out.push({ ciclo, piezas: nuevas });
  }
  return out;
}
