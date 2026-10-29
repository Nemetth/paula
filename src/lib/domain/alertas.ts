import { addDays, differenceInCalendarDays } from "date-fns";
import { clientesAds, cuentasConRutina, proximoRecambio, reportesDelMes } from "./ads";
import { grabacionDelCiclo, inicioVentana, proximaEntrega } from "./ciclos";
import { fechaCorta, fromISODate, toISODate } from "./dates";
import { Entrega } from "./entregas";
import { AlertaTipo, Plan } from "./planner";
import { AdsReporte, Client, Grabacion, grabaDe } from "./types";

/** Warn this many days before a cycle's production starts if it has no recording yet. */
const DIAS_AVISO_GRABACION_POR_CARGAR = 5;

export type AlertaGrupo = "atraso" | "carga" | "grabacion" | "entrega" | "ads";

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
  "espera-aprobacion": "entrega",
};

/** Everything that deserves a look, in one list: late work, overloads, pieces
 * waiting on a recording or an approval, deliveries whose correction time or
 * material date passed, and Ads accounts that need attention. Payments and
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
  const nombres = new Map(clients.map((c) => [c.id, c]));
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
    // Only reels wait for a recording: a client with none has nothing to shoot.
    if (!c.activo || c.estado === "en-pausa" || c.servicio === "ads" || !grabaDe(c) || !(c.volumenMensual.reels > 0)) continue;
    const fechas = new Set(entregas.filter((e) => e.clienteId === c.id && e.semaforo !== "lista").map((e) => e.fecha));
    const proxima = proximaEntrega(c, today);
    if (proxima) fechas.add(proxima);
    for (const fecha of fechas) {
      const inicio = inicioVentana(fecha, c);
      if (inicio <= hoy || inicio > limite || grabacionDelCiclo(fecha, c, grabaciones)) continue;
      out.push({
        id: `grabacion-por-cargar-${c.id}-${fecha}`,
        grupo: "grabacion",
        mensaje: `${c.nombre}: la entrega del ${fechaCorta(fecha)} arranca el ${fechaCorta(inicio)} y sus reels no tienen grabación cargada`,
        href: `/clientes/${c.id}`,
      });
    }
  }

  // Each delivery Paula moved along its steps: the client's correction time
  // after handing it in, and the material of clients who send it.
  for (const e of entregas) {
    const c = nombres.get(e.clienteId);
    const estado = e.estado;
    if (!c || !estado) continue;
    if (estado.paso === "entregado" && estado.entregadoEn) {
      const plazo = Math.max(c.flujo.diasCorreccion ?? 2, 0);
      const pasados = differenceInCalendarDays(today, fromISODate(estado.entregadoEn));
      if (pasados > plazo) {
        out.push({
          id: `correccion-${e.cicloId}`,
          grupo: "entrega",
          mensaje: `${c.nombre}: pasaron los ${plazo} días de corrección de la entrega del ${fechaCorta(e.fecha)} y no marcaste correcciones`,
          href: `/clientes/${c.id}`,
        });
      }
    }
    if (estado.materialFecha && !estado.materialLlego && estado.materialFecha < hoy && e.semaforo !== "lista") {
      out.push({
        id: `material-${e.cicloId}`,
        grupo: "entrega",
        mensaje: `${c.nombre}: el material para la entrega del ${fechaCorta(e.fecha)} tenía que llegar el ${fechaCorta(estado.materialFecha)} y no llegó`,
        href: `/clientes/${c.id}`,
      });
    }
  }

  for (const c of clientesAds(clients)) {
    if (c.adsEstadoCuenta === "frenada-pago") {
      out.push({ id: `ads-pago-${c.id}`, grupo: "ads", mensaje: `${c.nombre}: la cuenta de Ads está frenada por pago`, href: `/clientes/${c.id}` });
    }
  }

  // Which account's ads swap is due ("a qué cuenta le toca").
  for (const c of cuentasConRutina(clients)) {
    const toca = proximoRecambio(c, clients, today);
    if (toca > hoy) continue;
    const dias = differenceInCalendarDays(today, fromISODate(toca));
    out.push({
      id: `ads-recambio-${c.id}-${toca}`,
      grupo: "ads",
      mensaje: `Recambio de anuncios: le toca a ${c.nombre}${dias > 0 ? ` (desde hace ${dias} ${dias === 1 ? "día" : "días"})` : " hoy"}`,
      href: "/ads",
    });
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
