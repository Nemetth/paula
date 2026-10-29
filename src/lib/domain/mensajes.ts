// Pre-written WhatsApp messages. Only builds wa.me links: no WhatsApp Business API.

import { differenceInCalendarDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { fromISODate } from "./dates";
import { cobrosVencidos } from "./cobros";
import { Entrega } from "./entregas";
import { cantidadPiezas } from "./labels";
import { Plan } from "./planner";
import { Client, Cobro, Grabacion, ORDEN_TIPOS, Pieza } from "./types";

export type TipoMensaje =
  | "pedir-material"
  | "avisar-grabacion"
  | "recordar-aprobacion"
  | "recordar-pago"
  | "correr-entrega"
  | "entrega-lista";

export interface MensajeContexto {
  cliente: Client;
  /** ISO date of the recording, for "avisar-grabacion". */
  fechaGrabacion?: string;
  /** For "correr-entrega" and "entrega-lista": the delivery as agreed. */
  fechaEntrega?: string;
  /** For "correr-entrega": the date it can really be done by. */
  fechaNueva?: string;
  /** For "entrega-lista": what it has, "16 historias, 4 posteos y 4 reels". */
  contenido?: string;
}

export const MENSAJES: { tipo: TipoMensaje; titulo: string }[] = [
  { tipo: "pedir-material", titulo: "Pedir material" },
  { tipo: "avisar-grabacion", titulo: "Avisar la grabación" },
  { tipo: "recordar-aprobacion", titulo: "Recordar la aprobación" },
  { tipo: "recordar-pago", titulo: "Recordar el pago" },
  { tipo: "correr-entrega", titulo: "Correr la entrega" },
  { tipo: "entrega-lista", titulo: "Avisar que la entrega está lista" },
];

/** "a, b y c". */
export function enumerar(partes: string[]): string {
  if (partes.length <= 1) return partes[0] ?? "";
  return `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}`;
}

/** "16 historias, 4 posteos y 4 reels". */
export function contenidoDeEntrega(e: Entrega): string {
  return enumerar(ORDEN_TIPOS.filter((t) => e.porTipo[t]).map((t) => cantidadPiezas(e.porTipo[t]!.total, t)));
}

export function textoMensaje(
  tipo: TipoMensaje,
  { cliente, fechaGrabacion, fechaEntrega, fechaNueva, contenido }: MensajeContexto,
): string {
  const saludo = `Hola ${cliente.nombre.replace(/^\[Demo\]\s*/, "")}!`;
  switch (tipo) {
    case "pedir-material":
      return `${saludo} Para ir avanzando con tu contenido necesito que me mandes el material (fotos, videos y lo que tengas). Cuando lo tengas me avisás. Gracias!`;
    case "avisar-grabacion": {
      const cuando = fechaGrabacion
        ? `para el ${format(fromISODate(fechaGrabacion), "EEEE d 'de' MMMM", { locale: es })}`
        : "en la fecha que quedamos";
      return `${saludo} Te confirmo la grabación ${cuando}. Cualquier cambio avisame con tiempo para reacomodar todo.`;
    }
    case "recordar-aprobacion":
      return `${saludo} Te recuerdo que estoy esperando tu aprobación para poder seguir con la producción. Apenas la tengas me avisás!`;
    case "recordar-pago":
      return `${saludo} Te escribo para recordarte el pago de este mes. Si ya lo hiciste, ignorá este mensaje. Gracias!`;
    case "correr-entrega": {
      const dia = (iso?: string) => (iso ? format(fromISODate(iso), "EEEE d 'de' MMMM", { locale: es }) : "");
      const original = fechaEntrega ? ` del ${dia(fechaEntrega)}` : "";
      const nueva = fechaNueva ? `para el ${dia(fechaNueva)}` : "unos días más tarde";
      return `${saludo} Se me juntó trabajo y la entrega${original} te la voy a poder dejar lista ${nueva}. ¿Te parece bien? Gracias por la paciencia!`;
    }
    case "entrega-lista": {
      const de = fechaEntrega ? ` del ${format(fromISODate(fechaEntrega), "d 'de' MMMM", { locale: es })}` : "";
      const que = contenido ? `: ${contenido}` : "";
      return `${saludo} Ya está lista la entrega${de}${que}. Te la paso por acá, cualquier ajuste me avisás!`;
    }
  }
}

/** A wa.me link with the text pre-filled. A group link can't be pre-filled, so it's returned as is. */
export function enlaceWhatsapp(contacto: string | undefined, texto: string): string | null {
  if (!contacto) return null;
  const c = contacto.trim();
  if (/^https?:\/\//i.test(c)) return c;
  const digitos = c.replace(/\D/g, "");
  if (digitos.length < 8) return null;
  return `https://wa.me/${digitos}?text=${encodeURIComponent(texto)}`;
}

export interface MensajePendiente {
  /** Unique per message and per occasion; stored once sent. */
  id: string;
  tipo: TipoMensaje;
  titulo: string;
  cliente: Client;
  texto: string;
  enlace: string | null;
  /** "correr-entrega": the move it proposes, so it can be applied with one tap. */
  corrimiento?: { fechaEntrega: string; fechaNueva: string };
}

/** A finished delivery counts as "just finished" this many days after its date. */
const DIAS_ENTREGA_LISTA = 3;

/** How many days ahead of a recording the client gets notified. */
const DIAS_AVISO_GRABACION = 2;

/** Messages that are due today, derived from the facts (nothing is scheduled).
 * Each carries a reference so it comes back when it's due again: a moved
 * recording, a new week, a new month. `hechos` are the ones already sent. */
export function mensajesPendientes(input: {
  today: Date;
  clients: Client[];
  piezas: Pieza[];
  grabaciones: Grabacion[];
  cobros: Cobro[];
  hechos: Set<string>;
  /** When given, adds the "correr la entrega" suggestions for work that can't make its date. */
  plan?: Plan;
  /** When given, adds "la entrega está lista" for deliveries just finished. */
  entregas?: Entrega[];
}): MensajePendiente[] {
  const { today, clients, grabaciones, cobros, hechos, plan, entregas } = input;
  const out: MensajePendiente[] = [];
  const activos = clients.filter((c) => c.activo && c.estado !== "en-pausa");

  function agregar(
    tipo: TipoMensaje,
    cliente: Client,
    ref: string,
    contexto: Partial<MensajeContexto> = {},
    extra: Partial<MensajePendiente> = {},
  ) {
    const id = `${tipo}__${cliente.id}__${ref}`;
    if (hechos.has(id)) return;
    const texto = textoMensaje(tipo, { cliente, ...contexto });
    out.push({
      id,
      tipo,
      titulo: MENSAJES.find((m) => m.tipo === tipo)?.titulo ?? tipo,
      cliente,
      texto,
      enlace: enlaceWhatsapp(cliente.contactoWhatsapp, texto),
      ...extra,
    });
  }

  for (const e of entregas ?? []) {
    const cliente = activos.find((c) => c.id === e.clienteId);
    if (!cliente || e.semaforo !== "lista" || e.dias < -DIAS_ENTREGA_LISTA) continue;
    agregar("entrega-lista", cliente, e.fecha, { fechaEntrega: e.fecha, contenido: contenidoDeEntrega(e) });
  }

  for (const g of grabaciones) {
    if (g.hecha) continue;
    const dias = differenceInCalendarDays(fromISODate(g.fecha), today);
    const cliente = activos.find((c) => c.id === g.clienteId);
    if (cliente && dias >= 0 && dias <= DIAS_AVISO_GRABACION) {
      agregar("avisar-grabacion", cliente, `${g.id}@${g.fecha}`, { fechaGrabacion: g.fecha });
    }
  }

  const semana = format(today, "RRRR-'W'II");
  for (const c of activos) {
    if (c.estado === "esperando-aprobacion") agregar("recordar-aprobacion", c, semana);
  }

  // Per delivery: a calendar sent and not approved within the client's days,
  // and material that is due in two days or late.
  for (const e of entregas ?? []) {
    const cliente = activos.find((c) => c.id === e.clienteId);
    const estado = e.estado;
    if (!cliente || !estado || e.semaforo === "lista") continue;
    if (estado.paso === "calendario-enviado" && estado.pasoDesde) {
      const esperando = differenceInCalendarDays(today, fromISODate(estado.pasoDesde));
      if (esperando >= Math.max(cliente.flujo.diasAprobacion ?? 2, 1)) agregar("recordar-aprobacion", cliente, e.cicloId);
    }
    if (cliente.tipo === "material-cliente" && estado.materialFecha && !estado.materialLlego) {
      if (differenceInCalendarDays(fromISODate(estado.materialFecha), today) <= 2) agregar("pedir-material", cliente, e.cicloId);
    }
  }

  for (const cobro of cobrosVencidos(cobros, clients, today)) {
    const cliente = activos.find((c) => c.id === cobro.clienteId);
    if (cliente) agregar("recordar-pago", cliente, cobro.periodo);
  }

  if (plan) {
    for (const c of corrimientosSugeridos(plan, activos)) {
      agregar(
        "correr-entrega",
        c.cliente,
        `${c.fechaEntrega}@${c.fechaNueva}`,
        { fechaEntrega: c.fechaEntrega, fechaNueva: c.fechaNueva },
        { corrimiento: { fechaEntrega: c.fechaEntrega, fechaNueva: c.fechaNueva } },
      );
    }
  }

  return out;
}

export interface CorrimientoSugerido {
  cliente: Client;
  /** The delivery date that no longer holds. */
  fechaEntrega: string;
  /** When the plan can actually finish it. */
  fechaNueva: string;
  /** How many tasks of that delivery miss its date. */
  tareas: number;
}

/** Deliveries the plan cannot make at a normal pace: ones that only fit by
 * going over the daily cap, and late work it could only fit after the date.
 * Most pressing delivery first. These are the cases where the right move is to
 * tell the client, not to work harder. */
export function corrimientosSugeridos(plan: Plan, clientes: Client[]): CorrimientoSugerido[] {
  const porId = new Map(clientes.map((c) => [c.id, c]));
  const grupos = new Map<string, CorrimientoSugerido>();
  for (const s of plan.sobrecargas) {
    const cliente = s.clienteId ? porId.get(s.clienteId) : undefined;
    if (!cliente || !s.fechaPosible) continue;
    grupos.set(`${cliente.id}|${s.limite}`, { cliente, fechaEntrega: s.limite, fechaNueva: s.fechaPosible, tareas: s.tareas });
  }
  for (const a of plan.asignaciones) {
    const { clienteId, limite, tipo } = a.unidad;
    const cliente = clienteId ? porId.get(clienteId) : undefined;
    if (!a.atrasada || !cliente || !limite || tipo !== "edicion") continue;
    if (a.fecha <= limite) continue;
    const key = `${cliente.id}|${limite}`;
    const cur = grupos.get(key) ?? { cliente, fechaEntrega: limite, fechaNueva: a.fecha, tareas: 0 };
    cur.tareas += 1;
    if (a.fecha > cur.fechaNueva) cur.fechaNueva = a.fecha;
    grupos.set(key, cur);
  }
  return [...grupos.values()].sort(
    (a, b) => a.fechaEntrega.localeCompare(b.fechaEntrega) || a.cliente.nombre.localeCompare(b.cliente.nombre),
  );
}
