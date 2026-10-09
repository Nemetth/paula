import { toISODate } from "./dates";
import { UnidadTrabajo } from "./planner";
import { Client, Tarea } from "./types";

/** Loose tasks as planner units. Same class as production work: when a day
 * doesn't fit they yield only to fixed work, and give way to nothing but Ads
 * and ideas. */
export function unidadesDeTareas(tareas: Tarea[], clients: Client[], today: Date): UnidadTrabajo[] {
  const ids = new Map(clients.map((c) => [c.id, c]));
  return tareas
    .filter((t) => !t.hecha)
    .map((t) => ({
      id: `tarea:${t.id}`,
      tipo: "tarea" as const,
      categoria: "produccion" as const,
      tareaId: t.id,
      clienteId: t.clienteId && ids.has(t.clienteId) ? t.clienteId : undefined,
      etiqueta: t.titulo,
      // The plan counts pieces: a loose task takes the room of one.
      peso: 1,
      desde: toISODate(today),
      objetivo: t.fechaLimite,
      limite: t.fechaLimite,
      repartir: false,
      intocable: false,
    }));
}
