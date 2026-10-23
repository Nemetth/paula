// Row <-> domain mapping for the tables both the app and the server read. No
// "use client" here: the morning-notification route imports it too.

import {
  AdsEstadoCuenta,
  Client,
  ClienteEstado,
  ClienteTipo,
  DiaBloqueado,
  FlujoConfig,
  Grabacion,
  PieceType,
  Pieza,
  Servicio,
  VolumenMensual,
} from "../domain/types";

export type ClientRow = {
  id: string;
  nombre: string;
  tipo: ClienteTipo | null;
  estado: ClienteEstado | null;
  intocable: boolean | null;
  ads_ultima_revision: string | null;
  ads_cuenta_url: string | null;
  ads_estado_cuenta: AdsEstadoCuenta | null;
  ads_refresh_creativos: string | null;
  ultimo_aumento: string | null;
  notas_reunion: string | null;
  rubro: string | null;
  servicio: Servicio;
  volumen_mensual: VolumenMensual;
  flujo: FlujoConfig;
  contacto_whatsapp: string | null;
  ventana_cobro: [number, number] | null;
  monto_mensual: number | null;
  activo: boolean;
  notas: string | null;
  creado_en: string;
};

export function rowToClient(r: ClientRow): Client {
  return {
    id: r.id,
    nombre: r.nombre,
    tipo: r.tipo ?? "mensual",
    estado: r.estado ?? "al-dia",
    intocable: r.intocable ?? false,
    adsUltimaRevision: r.ads_ultima_revision ?? undefined,
    adsCuentaUrl: r.ads_cuenta_url ?? undefined,
    adsEstadoCuenta: r.ads_estado_cuenta ?? "activa",
    adsRefreshCreativos: r.ads_refresh_creativos ?? undefined,
    ultimoAumento: r.ultimo_aumento ?? undefined,
    notasReunion: r.notas_reunion ?? undefined,
    rubro: r.rubro ?? undefined,
    servicio: r.servicio,
    volumenMensual: r.volumen_mensual,
    flujo: r.flujo,
    contactoWhatsapp: r.contacto_whatsapp ?? undefined,
    ventanaCobro: r.ventana_cobro ?? undefined,
    montoMensual: r.monto_mensual ?? undefined,
    activo: r.activo,
    notas: r.notas ?? undefined,
    creadoEn: r.creado_en,
  };
}

export type BlockedRow = { id: string; cliente_id: string; fecha: string; motivo: DiaBloqueado["motivo"]; detalle: string | null };
export function rowToBlocked(r: BlockedRow): DiaBloqueado {
  return { id: r.id, clienteId: r.cliente_id, fecha: r.fecha, motivo: r.motivo, detalle: r.detalle ?? undefined };
}

export type PiezaRow = {
  id: string;
  cliente_id: string;
  tipo: PieceType;
  hecha: boolean;
  hecha_en: string | null;
  titulo: string | null;
  ciclo_id: string | null;
  grabacion_id: string | null;
  guion_listo: boolean;
  periodo_publicacion: string | null;
  fecha_publicacion: string | null;
  fecha_entrega: string | null;
  tanda: 1 | 2;
  horas_reales: number | null;
  no_antes_de: string | null;
  creada_en: string;
};
export function rowToPieza(r: PiezaRow): Pieza {
  return {
    id: r.id,
    clienteId: r.cliente_id,
    tipo: r.tipo,
    hecha: r.hecha ?? false,
    hechaEn: r.hecha_en ?? undefined,
    titulo: r.titulo ?? undefined,
    cicloId: r.ciclo_id ?? undefined,
    grabacionId: r.grabacion_id ?? undefined,
    guionListo: r.guion_listo,
    periodoPublicacion: r.periodo_publicacion ?? undefined,
    fechaPublicacion: r.fecha_publicacion ?? undefined,
    fechaEntrega: r.fecha_entrega ?? undefined,
    tanda: r.tanda,
    horasReales: r.horas_reales != null ? Number(r.horas_reales) : undefined,
    noAntesDe: r.no_antes_de ?? undefined,
    creadaEn: r.creada_en,
  };
}

export type GrabacionRow = {
  id: string;
  cliente_id: string;
  fecha: string;
  viaje_dias_antes: number;
  viaje_dias_despues: number;
  hecha: boolean;
  guiones: string | null;
  tomas: string[];
  alimenta: string[];
  notas: string | null;
};
export function rowToGrabacion(r: GrabacionRow): Grabacion {
  return {
    id: r.id,
    clienteId: r.cliente_id,
    fecha: r.fecha,
    viajeDiasAntes: r.viaje_dias_antes,
    viajeDiasDespues: r.viaje_dias_despues,
    hecha: r.hecha,
    guiones: r.guiones ?? undefined,
    tomas: r.tomas ?? [],
    alimenta: r.alimenta ?? [],
    notas: r.notas ?? undefined,
  };
}
