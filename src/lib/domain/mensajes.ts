// Pre-written WhatsApp messages. Only builds wa.me links: no WhatsApp Business API.

import { differenceInCalendarDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { fromISODate, toISODate } from "./dates";
import { estadoCobro } from "./cobros";
import { Client, Cobro, Grabacion, Pieza } from "./types";

export type TipoMensaje = "pedir-material" | "avisar-grabacion" | "recordar-aprobacion" | "recordar-pago";

export interface MensajeContexto {
  cliente: Client;
  /** ISO date of the recording, for "avisar-grabacion". */
  fechaGrabacion?: string;
}

export const MENSAJES: { tipo: TipoMensaje; titulo: string }[] = [
  { tipo: "pedir-material", titulo: "Pedir material" },
  { tipo: "avisar-grabacion", titulo: "Avisar la grabación" },
  { tipo: "recordar-aprobacion", titulo: "Recordar la aprobación" },
  { tipo: "recordar-pago", titulo: "Recordar el pago" },
];

export function textoMensaje(tipo: TipoMensaje, { cliente, fechaGrabacion }: MensajeContexto): string {
  const saludo = `Hola ${cliente.nombre.replace(/^\[Demo\]\s*/, "")}!`;
  switch (tipo) {
    case "pedir-material":
      return `${saludo} Para ir avanzando con tu contenido necesito que me mandes el material (fotos, videos y lo que tengas). Cuando lo tengas me avisás. Gracias!`;
    case "avisar-grabacion": {
      const cuando = fechaGrabacion
        ? format(fromISODate(fechaGrabacion), "EEEE d 'de' MMMM", { locale: es })
        : "la fecha que quedamos";
      return `${saludo} Te confirmo la grabación para el ${cuando}. Cualquier cambio avisame con tiempo para reacomodar todo.`;
    }
    case "recordar-aprobacion":
      return `${saludo} Te recuerdo que estoy esperando tu aprobación para poder seguir con la producción. Apenas la tengas me avisás!`;
    case "recordar-pago":
      return `${saludo} Te escribo para recordarte el pago de este mes. Si ya lo hiciste, ignorá este mensaje. Gracias!`;
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
}

/** Days of an idea sitting unapproved before we nudge the client. */
export const DIAS_APROBACION_DEMORADA = 3;
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
}): MensajePendiente[] {
  const { today, clients, piezas, grabaciones, cobros, hechos } = input;
  const out: MensajePendiente[] = [];
  const activos = clients.filter((c) => c.activo && c.estado !== "en-pausa");

  function agregar(tipo: TipoMensaje, cliente: Client, ref: string, contexto: Partial<MensajeContexto> = {}) {
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
    });
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
    const demoradas = piezas.some(
      (p) =>
        p.clienteId === c.id &&
        p.estado === "idea" &&
        differenceInCalendarDays(today, new Date(p.creadaEn)) >= DIAS_APROBACION_DEMORADA,
    );
    if (demoradas || c.estado === "esperando-aprobacion") agregar("recordar-aprobacion", c, semana);

    if (c.tipo === "material-cliente") {
      const conMaterial = piezas.some((p) => p.clienteId === c.id && (p.estado === "aprobada" || p.estado === "grabada"));
      if (!conMaterial && c.estado === "en-produccion") agregar("pedir-material", c, toISODate(today).slice(0, 7));
    }
  }

  for (const cobro of cobros) {
    const cliente = activos.find((c) => c.id === cobro.clienteId);
    if (cliente && estadoCobro(cobro, today) === "vencido") agregar("recordar-pago", cliente, cobro.periodo);
  }

  return out;
}
