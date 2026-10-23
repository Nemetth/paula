import { addDays, differenceInCalendarDays } from "date-fns";
import { clientesAds, reportesDelMes } from "./ads";
import { grabacionDelCiclo, inicioVentana, proximaEntrega } from "./ciclos";
import { fechaCorta, fromISODate, toISODate } from "./dates";
import { Entrega } from "./entregas";
import { AlertaTipo, Plan } from "./planner";
import { AdsReporte, Client, DIAS_REFRESH_CREATIVOS, Grabacion, grabaDe } from "./types";

/** Warn this many days before a cycle's production starts if it has no recording yet. */
const DIAS_AVISO_GRABACION_POR_CARGAR = 5;

export type AlertaGrupo = "atraso" | "carga" | "grabacion" | "ads";

export interface AlertaGlobal {
  id: string;
  grupo: AlertaGrupo;
  mensaje: string;
  href?: string;
}

const GRUPO_DE: Record<AlertaTipo, AlertaGrupo> = {
  vencida: "atraso",
  "no-entra": "atraso",
  "usa-margen": "atraso",
  sobrecarga: "carga",
  "espera-grabacion": "grabacion",
};

/** Everything that deserves a look, in one list: late work, overloads, pieces
 * waiting on a recording and Ads accounts that need attention. Payments and
 * approvals aren't here: they come as a WhatsApp message to send (see
 * mensajes.ts), so each fact is counted once. */
export function alertasGlobales(input: {
  plan: Plan;
  clients: Client[];
  reportes: AdsReporte[];
  grabaciones: Grabacion[];
  entregas: Entrega[];
  today: Date;
}): AlertaGlobal[] {
  const { plan, clients, reportes, grabaciones, entregas, today } = input;
  const out: AlertaGlobal[] = plan.alertas.map((a) => ({
    // Stable ids (no list positions), so the same fact keeps the same key.
    id: `plan-${a.tipo}-${a.clienteId ?? ""}-${a.fecha ?? ""}-${a.mensaje}`,
    grupo: GRUPO_DE[a.tipo],
    mensaje: a.mensaje,
    href: a.clienteId ? `/clientes/${a.clienteId}` : "/calendario",
  }));

  // A recording to schedule before production starts: once the window is open
  // with no recording done, the plan's own "esperan la grabación" takes over.
  const hoy = toISODate(today);
  const limite = toISODate(addDays(today, DIAS_AVISO_GRABACION_POR_CARGAR));
  for (const c of clients) {
    if (!c.activo || c.estado === "en-pausa" || c.servicio === "ads" || !grabaDe(c)) continue;
    const fechas = new Set(entregas.filter((e) => e.clienteId === c.id && e.semaforo !== "lista").map((e) => e.fecha));
    const proxima = proximaEntrega(c, today);
    if (proxima) fechas.add(proxima);
    for (const fecha of fechas) {
      const inicio = inicioVentana(fecha, c);
      if (inicio <= hoy || inicio > limite || grabacionDelCiclo(fecha, c, grabaciones)) continue;
      out.push({
        id: `grabacion-por-cargar-${c.id}-${fecha}`,
        grupo: "grabacion",
        mensaje: `${c.nombre}: la entrega del ${fechaCorta(fecha)} arranca el ${fechaCorta(inicio)} y no tiene grabación cargada`,
        href: `/clientes/${c.id}`,
      });
    }
  }

  for (const c of clientesAds(clients)) {
    if (c.adsEstadoCuenta === "frenada-pago") {
      out.push({ id: `ads-pago-${c.id}`, grupo: "ads", mensaje: `${c.nombre}: la cuenta de Ads está frenada por pago`, href: `/clientes/${c.id}` });
    }
    if (c.adsEstadoCuenta === "pausada") continue;
    const dias = c.adsRefreshCreativos ? differenceInCalendarDays(today, fromISODate(c.adsRefreshCreativos)) : Infinity;
    if (dias > DIAS_REFRESH_CREATIVOS) {
      out.push({
        id: `ads-creativos-${c.id}`,
        grupo: "ads",
        mensaje:
          dias === Infinity
            ? `${c.nombre}: no hay fecha del último refresh de creativos`
            : `${c.nombre}: los creativos no se renuevan hace ${dias} días`,
        href: `/clientes/${c.id}`,
      });
    }
  }

  const atrasados = reportesDelMes(clients, reportes, today).filter((r) => r.atrasado);
  if (atrasados.length > 0) {
    out.push({
      id: "ads-reportes",
      grupo: "ads",
      mensaje: `${atrasados.length} ${atrasados.length === 1 ? "reporte de Ads atrasado" : "reportes de Ads atrasados"}`,
      href: "/ads",
    });
  }

  return out;
}
