import { endOfMonth } from "date-fns";
import { fromISODate, toISODate } from "./dates";
import { Client, Cobro, CobroEstado } from "./types";

/** A cobro's effective status: `pagado` sticks, otherwise it flips to
 * `vencido` the day after its `fechaVencimiento` — this is what makes
 * "vencido" a fact derived fresh on every read instead of a value someone has
 * to remember to set. */
export function estadoCobro(cobro: Cobro, today: Date): CobroEstado {
  if (cobro.estado === "pagado") return "pagado";
  return toISODate(today) > cobro.fechaVencimiento ? "vencido" : "pendiente";
}

/** When a client's cobro for `periodo` ("yyyy-MM") is due: the last day of its
 * payment window, or the end of the month. */
export function vencimientoDe(client: Client, periodo: string): string {
  const fin = endOfMonth(fromISODate(`${periodo}-01`));
  const dia = Math.min(client.ventanaCobro?.[1] ?? fin.getDate(), fin.getDate());
  return toISODate(new Date(fin.getFullYear(), fin.getMonth(), dia));
}

/** Every active client's cobro for `periodo`: the saved one, or the one it
 * would have (pending, due at the end of its payment window). Saved rows are
 * only written when Paula changes something, so nothing here depends on which
 * screen she opened first. A client that joined after the due date owes
 * nothing that month. */
export function cobrosDelPeriodo(clients: Client[], cobros: Cobro[], periodo: string): Cobro[] {
  const guardados = new Map(cobros.filter((c) => c.periodo === periodo).map((c) => [c.clienteId, c]));
  return clients
    .filter((c) => c.activo)
    .flatMap((c) => {
      const guardado = guardados.get(c.id);
      if (guardado) return [guardado];
      const fechaVencimiento = vencimientoDe(c, periodo);
      if (c.creadoEn.slice(0, 10) > fechaVencimiento) return [];
      return [{ id: `${c.id}__${periodo}`, clienteId: c.id, periodo, monto: c.montoMensual, estado: "pendiente" as const, fechaVencimiento }];
    });
}

/** Cobros currently vencido for active clients: saved ones from any month plus
 * this month's. The one list behind the cobro alert, the WhatsApp reminder and
 * the Plata badge. */
export function cobrosVencidos(cobros: Cobro[], clients: Client[], today: Date): Cobro[] {
  const periodo = toISODate(today).slice(0, 7);
  const activos = new Set(clients.filter((c) => c.activo).map((c) => c.id));
  const anteriores = cobros.filter((c) => c.periodo !== periodo && activos.has(c.clienteId));
  return [...anteriores, ...cobrosDelPeriodo(clients, cobros, periodo)].filter((c) => estadoCobro(c, today) === "vencido");
}
