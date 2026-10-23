// "Contale a la app qué pasó": Paula writes a sentence, Claude turns it into the
// same changes the "Algo cambió" sheet already makes, and Paula confirms them.
// Nothing runs on the server: these types travel to /api/asistente and back.

import { fechaCorta } from "./dates";

/** What the model gets to read: only ids and names it can point at. */
export interface ContextoAsistente {
  hoy: string;
  /** Today's and upcoming work, so "no llegué a los reels de Deluxe" can name units. */
  tareas: { id: string; etiqueta: string; cliente?: string; fecha: string }[];
  clientes: { id: string; nombre: string }[];
  grabaciones: { id: string; cliente: string; fecha: string }[];
  entregas: { clienteId: string; cliente: string; fecha: string }[];
}

export type AccionAsistente =
  | { tipo: "pasar_tareas"; unidadIds: string[]; fecha: string }
  | { tipo: "marcar_hechas"; unidadIds: string[] }
  | { tipo: "no_trabajo"; fecha: string }
  | { tipo: "tope_de_hoy"; piezas: number }
  | { tipo: "mover_grabacion"; grabacionId: string; fecha: string }
  | { tipo: "mover_entrega"; clienteId: string; fechaActual: string; fechaNueva: string }
  | { tipo: "pausar_cliente"; clienteId: string };

export interface RespuestaAsistente {
  acciones: AccionAsistente[];
  /** What the model said besides the actions: a question when it didn't understand. */
  mensaje?: string;
}

const esFecha = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** A tool call as the model sent it → an action, only if every id it names is
 * in the context and every date is a date. Anything else is dropped. */
export function accionDeHerramienta(nombre: string, input: unknown, ctx: ContextoAsistente): AccionAsistente | undefined {
  const i = (input ?? {}) as Record<string, unknown>;
  const tareas = new Set(ctx.tareas.map((t) => t.id));
  const clientes = new Set(ctx.clientes.map((c) => c.id));
  const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && tareas.has(x)) : []);
  switch (nombre) {
    case "pasar_tareas": {
      const unidadIds = ids(i.unidad_ids);
      return unidadIds.length > 0 && esFecha(i.fecha) ? { tipo: "pasar_tareas", unidadIds, fecha: i.fecha } : undefined;
    }
    case "marcar_hechas": {
      const unidadIds = ids(i.unidad_ids);
      return unidadIds.length > 0 ? { tipo: "marcar_hechas", unidadIds } : undefined;
    }
    case "no_trabajo":
      return esFecha(i.fecha) ? { tipo: "no_trabajo", fecha: i.fecha } : undefined;
    case "tope_de_hoy":
      return typeof i.piezas === "number" && i.piezas >= 0 && i.piezas <= 30 ? { tipo: "tope_de_hoy", piezas: i.piezas } : undefined;
    case "mover_grabacion":
      return typeof i.grabacion_id === "string" && ctx.grabaciones.some((g) => g.id === i.grabacion_id) && esFecha(i.fecha)
        ? { tipo: "mover_grabacion", grabacionId: i.grabacion_id, fecha: i.fecha }
        : undefined;
    case "mover_entrega":
      return typeof i.cliente_id === "string" &&
        ctx.entregas.some((e) => e.clienteId === i.cliente_id && e.fecha === i.fecha_actual) &&
        esFecha(i.fecha_nueva)
        ? { tipo: "mover_entrega", clienteId: i.cliente_id, fechaActual: i.fecha_actual as string, fechaNueva: i.fecha_nueva }
        : undefined;
    case "pausar_cliente":
      return typeof i.cliente_id === "string" && clientes.has(i.cliente_id) ? { tipo: "pausar_cliente", clienteId: i.cliente_id } : undefined;
  }
  return undefined;
}

/** What Paula reads before confirming: "Pasar a mañana: Deluxe · Editar · Reel 2". */
export function describirAccion(a: AccionAsistente, ctx: ContextoAsistente): string {
  const tarea = (id: string) => {
    const t = ctx.tareas.find((x) => x.id === id);
    return t ? (t.cliente ? `${t.cliente} · ${t.etiqueta}` : t.etiqueta) : id;
  };
  const cliente = (id: string) => ctx.clientes.find((c) => c.id === id)?.nombre ?? "el cliente";
  const dia = (iso: string) => (iso === ctx.hoy ? "hoy" : fechaCorta(iso));
  switch (a.tipo) {
    case "pasar_tareas":
      return `Pasar al ${dia(a.fecha)}: ${a.unidadIds.map(tarea).join(", ")}`;
    case "marcar_hechas":
      return `Marcar hechas: ${a.unidadIds.map(tarea).join(", ")}`;
    case "no_trabajo":
      return `No trabajás ${a.fecha === ctx.hoy ? "hoy" : `el ${fechaCorta(a.fecha)}`}: lo de ese día se reparte`;
    case "tope_de_hoy":
      return `Hoy hacés como mucho ${a.piezas} ${a.piezas === 1 ? "pieza" : "piezas"}`;
    case "mover_grabacion": {
      const g = ctx.grabaciones.find((x) => x.id === a.grabacionId);
      return `Mover la grabación de ${g?.cliente ?? "el cliente"} del ${g ? fechaCorta(g.fecha) : "?"} al ${fechaCorta(a.fecha)}`;
    }
    case "mover_entrega":
      return `Mover la entrega de ${cliente(a.clienteId)} del ${fechaCorta(a.fechaActual)} al ${fechaCorta(a.fechaNueva)}`;
    case "pausar_cliente":
      return `Poner en pausa a ${cliente(a.clienteId)}: su trabajo sale del plan`;
  }
}
