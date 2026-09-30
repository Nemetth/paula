import { isAfter } from "date-fns";
import { Client, Cobro, CobroEstado } from "./types";

/** A cobro's effective status: `pagado` sticks, otherwise it flips to
 * `vencido` once `today` is past its `fechaVencimiento` — this is what makes
 * "vencido" a fact derived fresh on every read instead of a value someone has
 * to remember to set. */
export function estadoCobro(cobro: Cobro, today: Date): CobroEstado {
  if (cobro.estado === "pagado") return "pagado";
  return isAfter(today, new Date(cobro.fechaVencimiento)) ? "vencido" : "pendiente";
}

/** Cobros currently vencido for active clients — the fact the proactive alert
 * (Hoy banner, Plata nav pill) surfaces outside the Plata screen itself. */
export function cobrosVencidos(cobros: Cobro[], clients: Client[], today: Date): Cobro[] {
  const activos = new Set(clients.filter((c) => c.activo).map((c) => c.id));
  return cobros.filter((c) => activos.has(c.clienteId) && estadoCobro(c, today) === "vencido");
}
