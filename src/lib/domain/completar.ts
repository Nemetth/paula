import {
  TareaHecha,
  actualizarCliente,
  actualizarPieza,
  completarTarea,
  quitarHecha,
  registrarHecha,
  restaurarRevisionAds,
} from "@/lib/supabase/data";
import { toISODate } from "./dates";
import { UnidadTrabajo } from "./planner";
import { Client, Pieza, PiezaEstado } from "./types";

/** What completing a unit needs to remember so it can be undone. */
export interface ContextoCompletar {
  piezas: Pieza[];
  clients: Client[];
}

/** Tick a unit of work. Nothing stores "the plan", so the writes are the source
 * fact the unit was derived from (a piece's state, the date of an account's last
 * deep Ads review...) plus a line in today's done log, which is what lets Hoy
 * keep showing it ticked and count it. The planner re-derives everything from
 * the source fact. Units with no source fact (calendar ideas) only get the log
 * line: they count as worked today and come back until the pieces are loaded.
 *
 * Returns the log line, which is all `deshacerHecha` needs. */
export async function completarUnidad(u: UnidadTrabajo, ctx?: ContextoCompletar): Promise<TareaHecha> {
  const fecha = toISODate(new Date());
  const pieza = u.piezaId ? ctx?.piezas.find((p) => p.id === u.piezaId) : undefined;
  const cliente = u.clienteId ? ctx?.clients.find((c) => c.id === u.clienteId) : undefined;
  const anterior =
    u.tipo === "edicion" ? pieza?.estado : u.tipo === "ads-fondo" ? cliente?.adsUltimaRevision : undefined;
  const hecha: TareaHecha = {
    id: `${fecha}__${u.id}`,
    fecha,
    unidadId: u.id,
    etiqueta: u.etiqueta,
    clienteId: u.clienteId,
    tipo: u.tipo,
    anterior,
  };

  // Log first: Hoy then already treats the unit as done while the source fact
  // is still being written, so the row never blinks out and back.
  try {
    await registrarHecha(fecha, hecha);
  } catch (e) {
    console.error("[tareas_hechas] no se pudo registrar", e);
  }

  if (u.tipo === "ads-fondo" && u.clienteId) await actualizarCliente(u.clienteId, { adsUltimaRevision: fecha });
  else if (u.tipo === "tarea" && u.tareaId) await completarTarea(u.tareaId);
  else if (u.piezaId && u.tipo === "guion") await actualizarPieza(u.piezaId, { guionListo: true });
  else if (u.piezaId && u.tipo === "edicion") await actualizarPieza(u.piezaId, { estado: "editada" });
  return hecha;
}

/** Undo a tick from its log line: put the source fact back, then drop the line. */
export async function deshacerHecha(h: TareaHecha): Promise<void> {
  // Unit ids: "{piezaId}:edicion", "{piezaId}:guion", "tarea:{id}", "ads-fondo:{clienteId}".
  const [a, b] = h.unidadId.split(":");
  if (h.tipo === "ads-fondo" && h.clienteId) await restaurarRevisionAds(h.clienteId, h.anterior ?? null);
  else if (h.tipo === "tarea") await completarTarea(b, false);
  else if (h.tipo === "guion") await actualizarPieza(a, { guionListo: false });
  else if (h.tipo === "edicion") await actualizarPieza(a, { estado: (h.anterior as PiezaEstado) ?? "aprobada" });
  await quitarHecha(h.id);
}

export function sePuedeTildar(u: UnidadTrabajo): boolean {
  if (u.tipo === "ads-fondo") return !!u.clienteId;
  if (u.tipo === "tarea") return !!u.tareaId;
  if (u.tipo === "ideas") return true;
  return !!u.piezaId && (u.tipo === "guion" || u.tipo === "edicion");
}
