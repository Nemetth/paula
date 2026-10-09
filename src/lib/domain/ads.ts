// Ads module rules. Ads is its own module, separate from content production:
// daily account checks, a rotation of deep reviews, and monthly reports.

import { differenceInCalendarDays, format, subMonths } from "date-fns";
import { fromISODate, toISODate } from "./dates";
import { UnidadTrabajo } from "./planner";
import { AdsReporte, Client } from "./types";

/** Days between deep reviews of the same account. */
export const CADENCIA_REVISION_FONDO_DIAS = 14;
/** How many pieces a deep review counts as. */
export const PESO_REVISION_FONDO = 1;
/** Monthly reports are due on days 1 to this day. */
export const ULTIMO_DIA_REPORTE = 5;

export function clientesAds(clients: Client[]): Client[] {
  return clients.filter((c) => c.activo && c.estado !== "en-pausa" && (c.servicio === "ads" || c.servicio === "ambos"));
}

/** Days since the last deep review, or Infinity if there never was one. */
export function diasDesdeRevision(client: Client, today: Date): number {
  if (!client.adsUltimaRevision) return Infinity;
  return differenceInCalendarDays(today, fromISODate(client.adsUltimaRevision));
}

/** Rotation: accounts whose deep review is due, most overdue first. */
export function revisionesDeFondoPendientes(clients: Client[], today: Date): Client[] {
  return clientesAds(clients)
    .filter((c) => diasDesdeRevision(c, today) >= CADENCIA_REVISION_FONDO_DIAS)
    .sort((a, b) => diasDesdeRevision(b, today) - diasDesdeRevision(a, today) || a.nombre.localeCompare(b.nombre));
}

/** Planner input: ONE deep review at a time (the most overdue account), so the
 * rotation spreads out instead of landing as a block. It is the first thing
 * postponed when a day doesn't fit. */
export function unidadesAdsFondo(clients: Client[], today: Date): UnidadTrabajo[] {
  const siguiente = revisionesDeFondoPendientes(clients, today)[0];
  if (!siguiente) return [];
  return [
    {
      id: `ads-fondo:${siguiente.id}`,
      tipo: "ads-fondo",
      categoria: "ads-fondo",
      clienteId: siguiente.id,
      etiqueta: "Revisión a fondo de Ads",
      peso: PESO_REVISION_FONDO,
      desde: toISODate(today),
      repartir: false,
      intocable: false,
    },
  ];
}

export interface FilaReporte {
  cliente: Client;
  periodo: string; // month the report covers
  estado: "pendiente" | "enviado";
  /** Past day 5 and still not sent. */
  atrasado: boolean;
}

/** Reports for the month that just ended. Each is due between day 1 and day 5. */
export function reportesDelMes(clients: Client[], reportes: AdsReporte[], today: Date): FilaReporte[] {
  const periodo = format(subMonths(today, 1), "yyyy-MM");
  return clientesAds(clients).map((cliente) => {
    const enviado = reportes.some((r) => r.clienteId === cliente.id && r.periodo === periodo && r.estado === "enviado");
    return {
      cliente,
      periodo,
      estado: enviado ? "enviado" : "pendiente",
      atrasado: !enviado && today.getDate() > ULTIMO_DIA_REPORTE,
    };
  });
}

export const hoyEnVentanaDeReportes = (today: Date) => today.getDate() <= ULTIMO_DIA_REPORTE;

