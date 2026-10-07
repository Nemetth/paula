import { ClienteEstado, ClienteTipo, PiezaEstado } from "./types";

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
