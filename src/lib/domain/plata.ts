import { addMonths, differenceInCalendarDays } from "date-fns";
import { fromISODate, toISODate } from "./dates";
import { Client, Cobro, Gasto } from "./types";

/** Price increases are due every 3 months. */
export const MESES_ENTRE_AUMENTOS = 3;

export interface ProximoAumento {
  fecha: string;
  /** Negative when it is already overdue. */
  dias: number;
}

/** Next increase: 3 months after the last one (or after the client joined). */
export function proximoAumento(client: Client, today: Date): ProximoAumento {
  const base = client.ultimoAumento ? fromISODate(client.ultimoAumento) : new Date(client.creadoEn);
  const fecha = addMonths(base, MESES_ENTRE_AUMENTOS);
  return { fecha: toISODate(fecha), dias: differenceInCalendarDays(fecha, today) };
}

/** What's left for the month: collected minus expenses. */
export function balanceDelMes(cobros: Cobro[], gastos: Gasto[], periodo: string) {
  const cobrado = cobros
    .filter((c) => c.periodo === periodo && c.estado === "pagado")
    .reduce((s, c) => s + (c.monto ?? 0), 0);
  const gastado = gastos.filter((g) => g.fecha.startsWith(periodo)).reduce((s, g) => s + g.monto, 0);
  return { cobrado, gastado, queda: cobrado - gastado };
}
