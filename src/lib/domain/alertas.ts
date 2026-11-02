import { addDays, differenceInCalendarDays } from "date-fns";
import { FechaDeAds, clientesAds, cuentasConRutina, proximoRecambio, reportesDelMes } from "./ads";
import { grabacionDelCiclo, inicioVentana, proximaEntrega } from "./ciclos";
import { fechaCorta, fromISODate, toISODate } from "./dates";
import { Entrega } from "./entregas";
import { MensajePendiente, TipoMensaje } from "./mensajes";
import { AlertaTipo, Plan } from "./planner";
import { AdsReporte, Client, Grabacion, grabaDe } from "./types";

/** Warn this many days before a cycle's production starts if it has no recording yet. */
const DIAS_AVISO_GRABACION_POR_CARGAR = 5;

export type AlertaGrupo = "atraso" | "carga" | "grabacion" | "entrega" | "ads";

/** What an alert is about, so Hoy can say repeated ones in one line. */
export type AlertaClase = AlertaTipo | "grabacion-por-cargar" | "correccion" | "material" | "ads-pago" | "ads-recambio" | "ads-reportes" | "fecha-especial";

export interface AlertaGlobal {
  id: string;
  grupo: AlertaGrupo;
  clase: AlertaClase;
  clienteId?: string;
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
  /** Special dates coming up on the Ads screen. */
  fechasAds?: FechaDeAds[];
  today: Date;
}): AlertaGlobal[] {
  const { plan, clients, reportes, grabaciones, entregas, fechasAds, today } = input;
  const nombres = new Map(clients.map((c) => [c.id, c]));
  const out: AlertaGlobal[] = plan.alertas.map((a) => ({
    // Stable ids (no list positions), so the same fact keeps the same key.
    id: `plan-${a.tipo}-${a.clienteId ?? ""}-${a.fecha ?? ""}-${a.mensaje}`,
    grupo: GRUPO_DE[a.tipo],
    clase: a.tipo,
    clienteId: a.clienteId,
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
        clase: "grabacion-por-cargar",
        clienteId: c.id,
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
          clase: "correccion",
          clienteId: c.id,
          mensaje: `${c.nombre}: pasaron los ${plazo} días de corrección de la entrega del ${fechaCorta(e.fecha)} y no marcaste correcciones`,
          href: `/clientes/${c.id}`,
        });
      }
    }
    if (estado.materialFecha && !estado.materialLlego && estado.materialFecha < hoy && e.semaforo !== "lista") {
      out.push({
        id: `material-${e.cicloId}`,
        grupo: "entrega",
        clase: "material",
        clienteId: c.id,
        mensaje: `${c.nombre}: el material para la entrega del ${fechaCorta(e.fecha)} tenía que llegar el ${fechaCorta(estado.materialFecha)} y no llegó`,
        href: `/clientes/${c.id}`,
      });
    }
  }

  for (const c of clientesAds(clients)) {
    if (c.adsEstadoCuenta === "frenada-pago") {
      out.push({ id: `ads-pago-${c.id}`, grupo: "ads", clase: "ads-pago", clienteId: c.id, mensaje: `${c.nombre}: la cuenta de Ads está frenada por pago`, href: `/clientes/${c.id}` });
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
      clase: "ads-recambio",
      clienteId: c.id,
      mensaje: `Recambio de anuncios: le toca a ${c.nombre}${dias > 0 ? ` (desde hace ${dias} ${dias === 1 ? "día" : "días"})` : " hoy"}`,
      href: "/ads",
    });
  }

  const atrasados = reportesDelMes(clients, reportes, today).filter((r) => r.atrasado);
  if (atrasados.length > 0) {
    out.push({
      id: "ads-reportes",
      grupo: "ads",
      clase: "ads-reportes",
      mensaje: `${atrasados.length} ${atrasados.length === 1 ? "reporte de Ads atrasado" : "reportes de Ads atrasados"}`,
      href: "/ads",
    });
  }

  // A special date's campaigns once the day to have them ready has come.
  for (const f of fechasAds ?? []) {
    if (!f.vencida) continue;
    out.push({
      id: `fecha-especial-${f.id}`,
      grupo: "ads",
      clase: "fecha-especial",
      mensaje: `${f.nombre} es el ${fechaCorta(f.fecha)}: armá las campañas`,
      href: "/ads",
    });
  }

  // The same id is the same fact: say it once (it is also the list's React key).
  const vistas = new Set<string>();
  return out.filter((a) => !vistas.has(a.id) && vistas.add(a.id));
}

/** One line of Hoy's strip. No `href`: tapping it opens the full list. */
export interface LineaAviso {
  id: string;
  texto: string;
  href?: string;
}

/** Messages Hoy says some other way: the payments as a count, moving a delivery in Urgente. */
const MENSAJES_FUERA: TipoMensaje[] = ["recordar-pago", "correr-entrega"];

/** Alert classes for the strip, most pressing first: how to say one, how to say several.
 * The rest (late, overloaded, reports) Urgente already answers, and they stay in the bell. */
const LINEAS_DE_ALERTA: { clase: AlertaClase; una: (nombre: string, mensaje: string) => string; varias: (n: number) => string }[] = [
  { clase: "ads-pago", una: (c) => `${c}: la cuenta de Ads está frenada`, varias: (n) => `${n} cuentas de Ads frenadas por pago` },
  { clase: "material", una: (c) => `${c}: no llegó el material`, varias: (n) => `${n} entregas sin el material` },
  { clase: "correccion", una: (c) => `${c}: pasaron los días de corrección`, varias: (n) => `${n} entregas pasaron los días de corrección` },
  { clase: "grabacion-por-cargar", una: (c) => `${c}: falta cargar la grabación`, varias: (n) => `${n} clientes con la grabación sin cargar` },
  { clase: "espera-grabacion", una: (c) => `${c}: los reels esperan la grabación`, varias: (n) => `${n} clientes con reels esperando la grabación` },
  { clase: "espera-aprobacion", una: (c) => `${c}: espera que apruebe el calendario`, varias: (n) => `${n} clientes por aprobar el calendario` },
  { clase: "fecha-especial", una: (_, m) => m, varias: (n) => `${n} fechas especiales para armar` },
  { clase: "ads-recambio", una: (c) => `${c}: le toca el recambio de anuncios`, varias: (n) => `${n} cuentas con recambio de anuncios` },
];

/** What Hoy's strip says, one line per kind of thing: repeated alerts and
 * messages become one "4 clientes con...". The strip shows the first few of these. */
export function lineasDeAviso(alertas: AlertaGlobal[], mensajes: MensajePendiente[], cobrosVencidos: number, clients: Client[]): LineaAviso[] {
  const nombre = (id?: string) => clients.find((c) => c.id === id)?.nombre ?? "";
  const lineas: LineaAviso[] = [];
  if (cobrosVencidos > 0) {
    lineas.push({ id: "cobros", texto: cobrosVencidos === 1 ? "1 cobro vencido" : `${cobrosVencidos} cobros vencidos`, href: "/plata" });
  }
  for (const { clase, una, varias } of LINEAS_DE_ALERTA) {
    const suyas = alertas.filter((a) => a.clase === clase);
    if (suyas.length === 1) lineas.push({ id: clase, texto: una(nombre(suyas[0].clienteId), suyas[0].mensaje), href: suyas[0].href });
    else if (suyas.length > 1) lineas.push({ id: clase, texto: varias(suyas.length) });
  }
  const paraMandar = mensajes.filter((m) => !MENSAJES_FUERA.includes(m.tipo));
  for (const tipo of new Set(paraMandar.map((m) => m.tipo))) {
    const suyos = paraMandar.filter((m) => m.tipo === tipo);
    const texto =
      tipo === "entrega-lista"
        ? suyos.length === 1
          ? `Terminaste la entrega de ${suyos[0].cliente.nombre}`
          : `Terminaste ${suyos.length} entregas`
        : suyos.length === 1
          ? `${suyos[0].titulo} · ${suyos[0].cliente.nombre}`
          : `${suyos[0].titulo} · ${suyos.length} clientes`;
    lineas.push({ id: `mensaje-${tipo}`, texto });
  }
  return lineas;
}
