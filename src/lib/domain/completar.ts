import {
  TareaHecha,
  actualizarCliente,
  actualizarPieza,
  completarTarea,
  guardarEstadoEntrega,
  guardarReporteAds,
  quitarHecha,
  quitarRegistroAds,
  registrarAds,
  registrarHecha,
  restaurarRecambioAds,
  restaurarRevisionAds,
} from "@/lib/supabase/data";
import { idCiclo } from "./ciclos";
import { toISODate } from "./dates";
import { UnidadTrabajo } from "./planner";
import { Client } from "./types";

/** What completing a unit needs to remember so it can be undone. */
export interface ContextoCompletar {
  clients: Client[];
}

/** Tick a unit of work. Nothing stores "the plan", so the writes are the source
 * fact the unit was derived from (a piece being done, an Ads routine logged in
 * the account's history, a report sent, a calendar made...) plus a line in
 * today's done log, which is what lets Hoy keep showing it ticked and count it.
 * The planner re-derives everything from the source fact.
 *
 * Returns the log line, which is all `deshacerHecha` needs. */
export async function completarUnidad(u: UnidadTrabajo, ctx?: ContextoCompletar): Promise<TareaHecha> {
  const fecha = toISODate(new Date());
  const cliente = u.clienteId ? ctx?.clients.find((c) => c.id === u.clienteId) : undefined;
  const hecha: TareaHecha = {
    id: `${fecha}__${u.id}`,
    fecha,
    unidadId: u.id,
    etiqueta: u.etiqueta,
    clienteId: u.clienteId,
    tipo: u.tipo,
    anterior:
      u.tipo === "ads-revision" ? cliente?.adsUltimaRevision : u.tipo === "ads-recambio" ? cliente?.adsRefreshCreativos : undefined,
  };

  // Log first: Hoy then already treats the unit as done while the source fact
  // is still being written, so the row never blinks out and back.
  try {
    await registrarHecha(fecha, hecha);
  } catch (e) {
    console.error("[tareas_hechas] no se pudo registrar", e);
  }

  // Unit ids: "{piezaId}:edicion", "{piezaId}:guion", "tarea:{id}",
  // "ads-revision:{clienteId}:{semana}", "ads-recambio:{clienteId}:{día}",
  // "ads-reporte:{clienteId}:{periodo}", "{clienteId}:calendario:{entrega}".
  try {
    await escribirHecho(u, fecha);
  } catch (e) {
    // The fact didn't land: drop the log line too, or Hoy would show it done.
    await quitarHecha(hecha.id).catch(() => undefined);
    throw e;
  }
  return hecha;
}

/** The source fact behind a unit: what actually makes it done. */
async function escribirHecho(u: UnidadTrabajo, fecha: string): Promise<void> {
  const partes = u.id.split(":");
  if (u.tipo === "ads-revision" && u.clienteId) {
    await registrarAds({ clienteId: u.clienteId, tipo: "revision", ref: partes[2], fecha });
    await actualizarCliente(u.clienteId, { adsUltimaRevision: fecha });
  } else if (u.tipo === "ads-recambio" && u.clienteId) {
    await registrarAds({ clienteId: u.clienteId, tipo: "recambio", ref: fecha, fecha });
    await actualizarCliente(u.clienteId, { adsRefreshCreativos: fecha });
  } else if (u.tipo === "ads-reporte" && u.clienteId) await guardarReporteAds(u.clienteId, partes[2], "enviado");
  else if (u.tipo === "ideas" && u.clienteId) {
    await guardarEstadoEntrega(idCiclo(u.clienteId, partes[2]), u.clienteId, { paso: "calendario-armado" });
  } else if (u.tipo === "tarea" && u.tareaId) await completarTarea(u.tareaId);
  else if (u.piezaId && u.tipo === "guion") await actualizarPieza(u.piezaId, { guionListo: true });
  else if (u.piezaId && u.tipo === "edicion") await actualizarPieza(u.piezaId, { hecha: true });
}

/** Undo a tick from its log line: put the source fact back, then drop the line. */
export async function deshacerHecha(h: TareaHecha): Promise<void> {
  const [a, b, c] = h.unidadId.split(":");
  if (h.tipo === "ads-revision" && h.clienteId) {
    await quitarRegistroAds(`revision__${h.clienteId}__${c}`);
    await restaurarRevisionAds(h.clienteId, h.anterior ?? null);
  } else if (h.tipo === "ads-recambio" && h.clienteId) {
    await quitarRegistroAds(`recambio__${h.clienteId}__${h.fecha}`);
    await restaurarRecambioAds(h.clienteId, h.anterior ?? null);
  } else if (h.tipo === "ads-reporte" && h.clienteId) await guardarReporteAds(h.clienteId, c, "pendiente");
  else if (h.tipo === "ideas" && h.clienteId) await guardarEstadoEntrega(idCiclo(h.clienteId, c), h.clienteId, { paso: undefined });
  else if (h.tipo === "tarea") await completarTarea(b, false);
  else if (h.tipo === "guion") await actualizarPieza(a, { guionListo: false });
  else if (h.tipo === "edicion") await actualizarPieza(a, { hecha: false });
  await quitarHecha(h.id);
}

export function sePuedeTildar(u: UnidadTrabajo): boolean {
  if (u.tipo === "ads-revision" || u.tipo === "ads-recambio" || u.tipo === "ads-reporte") return !!u.clienteId;
  if (u.tipo === "tarea") return !!u.tareaId;
  if (u.tipo === "ideas") return true;
  return !!u.piezaId && (u.tipo === "guion" || u.tipo === "edicion");
}
