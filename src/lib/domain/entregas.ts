// Deliveries as Paula thinks about them: one per client and date, with how far
// along it is (per piece type) and a traffic light read off the plan.

import { differenceInCalendarDays } from "date-fns";
import { fromISODate } from "./dates";
import { Asignacion, Plan, fechaEntregaDe, objetivoDe } from "./planner";
import { Client, Grabacion, PieceType, Pieza, PiezaEstado } from "./types";

/** - verde: on track;
 * - ambar: due in a few days, or only fits by eating into the margin;
 * - rojo: overdue, or the plan can't make it by the delivery;
 * - lista: every piece is done. */
export type SemaforoEntrega = "verde" | "ambar" | "rojo" | "lista";

export interface AvanceTipo {
  hechas: number;
  total: number;
}

export interface Entrega {
  clienteId: string;
  fecha: string;
  /** Delivery minus the client's margin: when it should be finished. */
  objetivo: string;
  total: number;
  hechas: number;
  faltan: number;
  porTipo: Partial<Record<PieceType, AvanceTipo>>;
  semaforo: SemaforoEntrega;
  /** Some pieces still wait on a recording, so their place in the plan is provisional. */
  provisoria: boolean;
  /** Days until the delivery (negative = overdue). */
  dias: number;
}

/** Due within this many days counts as urgent. */
export const DIAS_URGENTE = 3;

const HECHAS: PiezaEstado[] = ["editada", "entregada", "programada"];
export const piezaHecha = (p: Pieza) => HECHAS.includes(p.estado);

export const ORDEN_TIPOS: PieceType[] = ["historia", "posteo", "reel"];

export function calcularEntregas(input: {
  clients: Client[];
  piezas: Pieza[];
  grabaciones: Grabacion[];
  plan: Plan;
  today: Date;
}): Entrega[] {
  const { clients, piezas, grabaciones, plan, today } = input;
  const clientById = new Map(clients.map((c) => [c.id, c]));

  const grupos = new Map<string, { client: Client; fecha: string; piezas: Pieza[] }>();
  for (const p of piezas) {
    if (p.estado === "idea") continue;
    const client = clientById.get(p.clienteId);
    if (!client || !client.activo || client.estado === "en-pausa") continue;
    const fecha = fechaEntregaDe(p, grabaciones);
    if (!fecha) continue;
    const key = `${p.clienteId}|${fecha}`;
    const g = grupos.get(key) ?? { client, fecha, piezas: [] };
    g.piezas.push(p);
    grupos.set(key, g);
  }

  const asignacionesDe = new Map<string, Asignacion[]>();
  for (const a of plan.asignaciones) {
    if (!a.unidad.piezaId) continue;
    asignacionesDe.set(a.unidad.piezaId, [...(asignacionesDe.get(a.unidad.piezaId) ?? []), a]);
  }
  const sinLugar = new Set(plan.sinLugar.map((u) => u.piezaId).filter(Boolean));

  const out: Entrega[] = [];
  for (const { client, fecha, piezas: suyas } of grupos.values()) {
    const porTipo: Entrega["porTipo"] = {};
    let hechas = 0;
    for (const p of suyas) {
      const t = (porTipo[p.tipo] ??= { hechas: 0, total: 0 });
      t.total += 1;
      if (piezaHecha(p)) {
        t.hechas += 1;
        hechas += 1;
      }
    }
    const pendientes = suyas.filter((p) => !piezaHecha(p));
    const asigs = pendientes.flatMap((p) => asignacionesDe.get(p.id) ?? []);
    const dias = differenceInCalendarDays(fromISODate(fecha), today);
    const sinPlan = pendientes.some((p) => sinLugar.has(p.id) || !asignacionesDe.has(p.id));

    let semaforo: SemaforoEntrega;
    if (pendientes.length === 0) semaforo = "lista";
    else if (dias < 0 || sinPlan || asigs.some((a) => a.atrasada)) semaforo = "rojo";
    else if (dias <= DIAS_URGENTE || asigs.some((a) => a.enMargen)) semaforo = "ambar";
    else semaforo = "verde";

    out.push({
      clienteId: client.id,
      fecha,
      objetivo: objetivoDe(fecha, client),
      total: suyas.length,
      hechas,
      faltan: pendientes.length,
      porTipo,
      semaforo,
      provisoria: pendientes.some((p) => {
        const g = p.grabacionId ? grabaciones.find((x) => x.id === p.grabacionId) : undefined;
        return !!g && !g.hecha;
      }),
      dias,
    });
  }

  const nombre = (id: string) => clientById.get(id)?.nombre ?? "";
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha) || nombre(a.clienteId).localeCompare(nombre(b.clienteId)));
}

/** The delivery a client is working towards: the earliest one not finished yet. */
export function entregaActual(entregas: Entrega[], clienteId: string): Entrega | undefined {
  return entregas.find((e) => e.clienteId === clienteId && e.semaforo !== "lista");
}
