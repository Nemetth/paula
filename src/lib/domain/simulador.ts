// "¿Me entra este cliente?" with real dates: run the whole plan again with the
// prospect's next deliveries added, and compare it with today's plan.

import { configCiclo, entregaSiguiente, idCiclo, piezasDelCiclo, proximaEntrega } from "./ciclos";
import { Entrega, SemaforoEntrega, calcularEntregas } from "./entregas";
import { Plan, PlannerInput, planificar } from "./planner";
import { Client, Pieza } from "./types";

export const ID_PROSPECTO = "prospecto";

export interface Empeora {
  clienteId: string;
  fecha: string;
  antes: SemaforoEntrega;
  despues: SemaforoEntrega;
}

export interface Simulacion {
  /** The prospect's own deliveries, with the light they would get. */
  propias: Entrega[];
  /** Deliveries of current clients that would get worse. */
  empeoran: Empeora[];
  /** Days that would go over the cap and don't today. */
  diasSobrecargados: string[];
}

const GRAVEDAD: Record<SemaforoEntrega, number> = { lista: -1, verde: 0, ambar: 1, rojo: 2 };

/** The prospect as a client: active, not recording (a simulation can't know
 * when the shoot would be), over its next `ciclos` deliveries. */
export function simularProspecto(
  entrada: PlannerInput,
  base: Plan,
  prospecto: Client,
  ciclos = 2,
): Simulacion | undefined {
  const cliente: Client = { ...prospecto, id: ID_PROSPECTO, activo: true, estado: "en-produccion", flujo: { ...prospecto.flujo, tieneGrabacion: false } };
  const cfg = configCiclo(cliente);
  let entrega = proximaEntrega(cliente, entrada.today);
  if (!cfg || !entrega) return undefined;

  const nuevas: Pieza[] = [];
  for (let i = 0; i < ciclos; i++) {
    piezasDelCiclo(cliente, { id: idCiclo(cliente.id, entrega), clienteId: cliente.id, entrega }).forEach((p, j) =>
      nuevas.push({ ...p, id: `sim-${i}-${j}`, hecha: false, guionListo: false, tanda: 1, creadaEn: entrada.today.toISOString() }),
    );
    entrega = entregaSiguiente(cfg, entrega);
  }

  const clients = [...entrada.clients, cliente];
  const piezas = [...entrada.piezas, ...nuevas];
  const plan = planificar({ ...entrada, clients, piezas });

  const antes = calcularEntregas({ clients: entrada.clients, piezas: entrada.piezas, grabaciones: entrada.grabaciones, plan: base, today: entrada.today });
  const despues = calcularEntregas({ clients, piezas, grabaciones: entrada.grabaciones, plan, today: entrada.today });
  const previo = new Map(antes.map((e) => [`${e.clienteId}|${e.fecha}`, e.semaforo]));

  return {
    propias: despues.filter((e) => e.clienteId === ID_PROSPECTO),
    empeoran: despues.flatMap((e) => {
      const era = previo.get(`${e.clienteId}|${e.fecha}`);
      return e.clienteId !== ID_PROSPECTO && era && GRAVEDAD[e.semaforo] > GRAVEDAD[era]
        ? [{ clienteId: e.clienteId, fecha: e.fecha, antes: era, despues: e.semaforo }]
        : [];
    }),
    diasSobrecargados: Object.values(plan.cargaPorDia)
      .filter((c) => c.semaforo === "sobrecargado" && base.cargaPorDia[c.fecha]?.semaforo !== "sobrecargado")
      .map((c) => c.fecha)
      .sort(),
  };
}
