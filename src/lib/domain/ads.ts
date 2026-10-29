// Ads module rules. Ads is its own module, separate from content production,
// organised as routines per account:
//
// - every day: the quick check (Hoy's "Chequeo de Ads", not a planner unit);
// - once a week: the ads review, each account on its own weekday so the
//   accounts spread over the week;
// - every 15 days: the ads swap ("recambio"), counted from the last one;
// - at the start of the month: each account's report, spread over days 1 to 5.
//
// The three routines are planner units, so they show up by themselves in Hoy
// and the calendar to be ticked. What was done is kept as each account's
// history (ads_historial for reviews and swaps, ads_reportes for reports).

import { addDays, differenceInCalendarDays, format, getISOWeek, getISOWeekYear, startOfISOWeek, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { fromISODate, toISODate } from "./dates";
import { UnidadTrabajo } from "./planner";
import { AdsChequeo, AdsRegistro, AdsReporte, CADENCIA_RECAMBIO_DIAS, Client, EstructuraSemanal, diasDeTrabajo } from "./types";

/** How many pieces each routine counts as against the daily cap. */
export const PESO_REVISION = 1;
export const PESO_RECAMBIO = 1;
export const PESO_REPORTE = 1;
/** Monthly reports are due on days 1 to this day. */
export const ULTIMO_DIA_REPORTE = 5;

export function clientesAds(clients: Client[]): Client[] {
  return clients.filter((c) => c.activo && c.estado !== "en-pausa" && (c.servicio === "ads" || c.servicio === "ambos"));
}

/** Accounts that run routines: a paused account has nothing to review or swap. */
export function cuentasConRutina(clients: Client[]): Client[] {
  return clientesAds(clients)
    .filter((c) => c.adsEstadoCuenta !== "pausada")
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es") || a.id.localeCompare(b.id));
}

/** "2026-W44": the week a review belongs to. */
export function semanaDe(d: Date): string {
  return `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, "0")}`;
}

/** The k-th of n items over `dias`, spread out: 2 accounts over 5 days land on days 0 and 2. */
const repartir = <T,>(dias: T[], k: number, n: number): T => dias[Math.floor((k * dias.length) / Math.max(n, 1))];

/** Weekday (0 = Sunday) of each account's weekly review, spread over Paula's working days. */
export function diasDeRevision(clients: Client[], estructura: EstructuraSemanal): Map<string, number> {
  const trabajo = diasDeTrabajo(estructura).map((d) => (d === 0 ? 7 : d)).sort((a, b) => a - b).map((d) => d % 7);
  const dias = trabajo.length > 0 ? trabajo : [1];
  const cuentas = cuentasConRutina(clients);
  return new Map(cuentas.map((c, i) => [c.id, repartir(dias, i, cuentas.length)]));
}

/** The date of `diaSemana` in the ISO week (Monday first) that holds `d`. */
export function enLaSemana(d: Date, diaSemana: number): string {
  return toISODate(addDays(startOfISOWeek(d), (diaSemana + 6) % 7));
}

/** Day of the month each account's report is due, spread over days 1 to 5. */
export function diasDeReporte(clients: Client[], estructura: EstructuraSemanal, mes: Date): Map<string, string> {
  const trabajo = new Set(diasDeTrabajo(estructura));
  const primeros = Array.from({ length: ULTIMO_DIA_REPORTE }, (_, i) => new Date(mes.getFullYear(), mes.getMonth(), i + 1));
  const habiles = primeros.filter((d) => trabajo.has(d.getDay()));
  const dias = (habiles.length > 0 ? habiles : primeros).map(toISODate);
  const cuentas = cuentasConRutina(clients);
  return new Map(cuentas.map((c, i) => [c.id, repartir(dias, i, cuentas.length)]));
}

/** When the next ads swap is due: 15 days after the last one. Accounts with no
 * date yet are staggered over the next 15 days instead of all landing today. */
export function proximoRecambio(cliente: Client, clients: Client[], today: Date): string {
  if (cliente.adsRefreshCreativos) {
    return toISODate(addDays(fromISODate(cliente.adsRefreshCreativos), CADENCIA_RECAMBIO_DIAS));
  }
  const sinFecha = cuentasConRutina(clients).filter((c) => !c.adsRefreshCreativos);
  const i = Math.max(sinFecha.findIndex((c) => c.id === cliente.id), 0);
  return toISODate(addDays(today, Math.floor((i * (CADENCIA_RECAMBIO_DIAS - 1)) / Math.max(sinFecha.length, 1))));
}

/** Days since the last weekly review, or Infinity if there never was one. */
export function diasDesdeRevision(client: Client, today: Date): number {
  if (!client.adsUltimaRevision) return Infinity;
  return differenceInCalendarDays(today, fromISODate(client.adsUltimaRevision));
}

export const idRevision = (clienteId: string, semana: string) => `revision__${clienteId}__${semana}`;

/** This week's review is done for the account. */
export function revisadaEstaSemana(clienteId: string, historial: AdsRegistro[], today: Date): boolean {
  const semana = semanaDe(today);
  return historial.some((r) => r.tipo === "revision" && r.clienteId === clienteId && r.ref === semana);
}

/** Planner input: every account's routines from this week up to the horizon.
 * The weekly review is the first thing to give way on a full day and has no
 * hard deadline; the swap waits for its day; the report must be in by day 5. */
export function unidadesAds(input: {
  clients: Client[];
  historial: AdsRegistro[];
  reportes: AdsReporte[];
  estructura: EstructuraSemanal;
  today: Date;
  horizonteDias: number;
}): UnidadTrabajo[] {
  const { clients, historial, reportes, estructura, today, horizonteDias } = input;
  const hoy = toISODate(today);
  const fin = addDays(today, horizonteDias);
  const cuentas = cuentasConRutina(clients);
  const unidades: UnidadTrabajo[] = [];
  const base = { clienteId: undefined as string | undefined, repartir: false, intocable: false };

  // Weekly review: one per account and week.
  const diaRevision = diasDeRevision(clients, estructura);
  const hechas = new Set(historial.filter((r) => r.tipo === "revision").map((r) => `${r.clienteId}|${r.ref}`));
  for (let semana = startOfISOWeek(today); semana <= fin; semana = addDays(semana, 7)) {
    const clave = semanaDe(semana);
    for (const c of cuentas) {
      if (hechas.has(`${c.id}|${clave}`)) continue;
      const dia = enLaSemana(semana, diaRevision.get(c.id) ?? 1);
      const desde = dia < hoy ? hoy : dia;
      unidades.push({
        ...base,
        id: `ads-revision:${c.id}:${clave}`,
        tipo: "ads-revision",
        categoria: "ads",
        clienteId: c.id,
        etiqueta: "Revisión semanal de anuncios",
        peso: PESO_REVISION,
        desde,
        objetivo: dia,
      });
    }
  }

  // Ads swap every 15 days, projected forward as if each is done on its day.
  for (const c of cuentas) {
    for (let due = proximoRecambio(c, clients, today); fromISODate(due) <= fin; due = toISODate(addDays(fromISODate(due), CADENCIA_RECAMBIO_DIAS))) {
      unidades.push({
        ...base,
        id: `ads-recambio:${c.id}:${due}`,
        tipo: "ads-recambio",
        categoria: "produccion",
        clienteId: c.id,
        etiqueta: "Recambio de anuncios",
        peso: PESO_RECAMBIO,
        desde: due < hoy ? hoy : due,
        objetivo: due,
      });
      // Only the next one is real: the rest move with it once it's done.
      if (due < hoy) break;
    }
  }

  // Reports: the month that just ended, due between day 1 and day 5 of each month.
  for (let mes = new Date(today.getFullYear(), today.getMonth(), 1); mes <= fin; mes = new Date(mes.getFullYear(), mes.getMonth() + 1, 1)) {
    const periodo = format(subMonths(mes, 1), "yyyy-MM");
    const dias = diasDeReporte(clients, estructura, mes);
    const limite = toISODate(new Date(mes.getFullYear(), mes.getMonth(), ULTIMO_DIA_REPORTE));
    const nombreMes = format(subMonths(mes, 1), "MMMM", { locale: es });
    for (const c of cuentas) {
      if (reportes.some((r) => r.clienteId === c.id && r.periodo === periodo && r.estado === "enviado")) continue;
      // A client that started after that month has nothing to report.
      if (toISODate(new Date(c.creadoEn)).slice(0, 7) > periodo) continue;
      const dia = dias.get(c.id) ?? limite;
      unidades.push({
        ...base,
        id: `ads-reporte:${c.id}:${periodo}`,
        tipo: "ads-reporte",
        categoria: "produccion",
        clienteId: c.id,
        etiqueta: `Reporte de Ads de ${nombreMes}`,
        peso: PESO_REPORTE,
        desde: dia < hoy ? hoy : dia,
        objetivo: dia,
        limite,
      });
    }
  }
  return unidades;
}

export interface FilaReporte {
  cliente: Client;
  periodo: string; // month the report covers
  estado: "pendiente" | "enviado";
  /** The day of 1 to 5 it is planned for. */
  dia?: string;
  /** Past day 5 and still not sent. */
  atrasado: boolean;
  reporte?: AdsReporte;
}

/** Reports for the month that just ended. Each is due between day 1 and day 5. */
export function reportesDelMes(clients: Client[], reportes: AdsReporte[], today: Date, estructura?: EstructuraSemanal): FilaReporte[] {
  const periodo = format(subMonths(today, 1), "yyyy-MM");
  const dias = estructura ? diasDeReporte(clients, estructura, today) : undefined;
  return cuentasConRutina(clients)
    .filter((c) => toISODate(new Date(c.creadoEn)).slice(0, 7) <= periodo)
    .map((cliente) => {
      const reporte = reportes.find((r) => r.clienteId === cliente.id && r.periodo === periodo);
      const enviado = reporte?.estado === "enviado";
      return {
        cliente,
        periodo,
        estado: enviado ? "enviado" : "pendiente",
        dia: dias?.get(cliente.id),
        atrasado: !enviado && today.getDate() > ULTIMO_DIA_REPORTE,
        reporte,
      };
    });
}

export const hoyEnVentanaDeReportes = (today: Date) => today.getDate() <= ULTIMO_DIA_REPORTE;

export type TonoCuenta = "verde" | "ambar" | "rojo" | "gris";

/** One light per account, worst problem first: stopped over a payment or marked
 * to review → red; ads swap due or this week's review late → amber; paused → grey. */
export function saludCuenta(
  cliente: Client,
  chequeos: AdsChequeo[],
  today: Date,
  contexto?: { clients: Client[]; historial: AdsRegistro[]; estructura: EstructuraSemanal },
): { tono: TonoCuenta; motivo: string } {
  if (cliente.adsEstadoCuenta === "pausada") return { tono: "gris", motivo: "Pausada" };
  if (cliente.adsEstadoCuenta === "frenada-pago") return { tono: "rojo", motivo: "Frenada por pago" };
  const ultimo = chequeos
    .filter((c) => c.clienteId === cliente.id)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
  if (ultimo?.estado === "revisar" && differenceInCalendarDays(today, fromISODate(ultimo.fecha)) <= 2) {
    return { tono: "rojo", motivo: "Marcada para revisar" };
  }
  if (contexto) {
    const recambio = proximoRecambio(cliente, contexto.clients, today);
    if (cliente.adsRefreshCreativos && recambio <= toISODate(today)) return { tono: "ambar", motivo: "Toca recambio de anuncios" };
    const dia = diasDeRevision(contexto.clients, contexto.estructura).get(cliente.id);
    if (dia !== undefined && enLaSemana(today, dia) < toISODate(today) && !revisadaEstaSemana(cliente.id, contexto.historial, today)) {
      return { tono: "ambar", motivo: "Falta la revisión de esta semana" };
    }
  }
  if (!cliente.adsRefreshCreativos) return { tono: "ambar", motivo: "Sin fecha del último recambio" };
  return { tono: "verde", motivo: "Al día" };
}

/** "lunes", "jueves": an account's review day. */
export const nombreDia = (diaSemana: number) => format(addDays(new Date(2026, 0, 4), diaSemana), "EEEE", { locale: es });
