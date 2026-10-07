import { actualizarCliente, actualizarPieza, completarTarea } from "@/lib/supabase/data";
import { toISODate } from "./dates";
import { UnidadTrabajo } from "./planner";

/** Tick a unit of work. Nothing stores "the plan", so the only write is the
 * source fact the unit was derived from: a piece's state, or the date of an
 * account's last deep Ads review. The planner re-derives everything from it.
 * Units with no source fact (calendar ideas, loose tasks) have no tick here. */
export async function completarUnidad(u: UnidadTrabajo): Promise<void> {
  if (u.tipo === "ads-fondo" && u.clienteId) {
    return actualizarCliente(u.clienteId, { adsUltimaRevision: toISODate(new Date()) });
  }
  if (u.tipo === "tarea" && u.tareaId) return completarTarea(u.tareaId);
  if (!u.piezaId) return;
  if (u.tipo === "guion") return actualizarPieza(u.piezaId, { guionListo: true });
  if (u.tipo === "edicion") return actualizarPieza(u.piezaId, { estado: "editada" });
}

export function sePuedeTildar(u: UnidadTrabajo): boolean {
  if (u.tipo === "ads-fondo") return !!u.clienteId;
  if (u.tipo === "tarea") return !!u.tareaId;
  return !!u.piezaId && (u.tipo === "guion" || u.tipo === "edicion");
}
