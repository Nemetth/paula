import { ClienteEstado, ClienteTipo, PieceType, PiezaEstado } from "./types";

export const ESTADO_CLIENTE_LABEL: Record<ClienteEstado, string> = {
  "al-dia": "Al día",
  "en-produccion": "En producción",
  "esperando-aprobacion": "Esperando aprobación",
  "esperando-pago": "Esperando pago",
  "en-pausa": "En pausa",
};

export const TIPO_CLIENTE_LABEL: Record<ClienteTipo, string> = {
  mensual: "Mensual",
  pack: "Pack o proyecto puntual",
  "material-cliente": "Me manda el material",
  "pedidos-diarios": "Pedidos diarios sin plan",
  "ciclo-grabacion": "Ciclo atado a la grabación",
};

export const ESTADO_PIEZA_LABEL: Record<PiezaEstado, string> = {
  idea: "Idea",
  aprobada: "Aprobada",
  grabada: "Grabada",
  editada: "Editada",
  entregada: "Entregada",
  programada: "Programada",
};

export const TIPO_PIEZA_LABEL: Record<PieceType, { uno: string; varios: string }> = {
  historia: { uno: "historia", varios: "historias" },
  posteo: { uno: "posteo", varios: "posteos" },
  reel: { uno: "reel", varios: "reels" },
};

/** "1 reel", "2 posteos". */
export function cantidadPiezas(n: number, tipo: PieceType): string {
  return `${n} ${n === 1 ? TIPO_PIEZA_LABEL[tipo].uno : TIPO_PIEZA_LABEL[tipo].varios}`;
}
