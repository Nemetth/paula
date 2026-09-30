// Domain model for Paula's work-management app.
// Kept storage-agnostic on purpose: src/lib/supabase/data.ts just persists
// these shapes as Postgres rows.

export type PieceType = "historia" | "posteo" | "reel";

export type Servicio = "contenido" | "ads" | "ambos";

export type CicloTipo =
  | "mensual"
  | "semanal"
  | "diario"
  | "solo-ads"
  | "personalizado";

/** Ordered stages of a client's production flow. Not every client uses every stage. */
export const FLOW_STAGES = [
  "calendario",
  "aprobacion",
  "grabacion",
  "produccion",
  "presentacion",
  "correccion",
  "ajustes",
  "programacion",
] as const;

export type FlowStage = (typeof FLOW_STAGES)[number];

export interface VolumenMensual {
  historias: number;
  posteos: number;
  reels: number;
}

export interface FlujoConfig {
  cicloTipo: CicloTipo;
  mandaCalendario: boolean;
  /** Business days the client takes to approve the calendar. */
  diasAprobacion: number;
  tieneGrabacion: boolean;
  /** Extra travel days to add around a recording day (off-site shoots). */
  diasViajeGrabacion: number;
  /** Business days needed to produce pieces once approved/recorded. */
  diasProduccion: number;
  /** For flows where reels/pieces are due N days after recording instead of a fixed produccion window. */
  diasEntregaPostGrabacion?: number;
  /** Business days the client historically takes to send corrections. */
  diasCorreccion: number;
  /** Business days reserved for adjustments after correction. */
  diasAjustes: number;
  /** Business days margin to close (scheduled/published) before the period starts. */
  diasMargenCierre: number;
  /** Length in days of one period, only used when cicloTipo === "personalizado". */
  duracionPeriodoDias?: number;
}

export interface Client {
  id: string;
  nombre: string;
  rubro?: string;
  servicio: Servicio;
  volumenMensual: VolumenMensual;
  flujo: FlujoConfig;
  contactoWhatsapp?: string;
  /** Day-of-month window in which this client is expected to pay, e.g. [1, 10]. */
  ventanaCobro?: [number, number];
  montoMensual?: number;
  activo: boolean;
  creadoEn: string; // ISO date
  notas?: string;
}

/** A day Paula explicitly cannot produce content on for this client (recording, travel, off day). */
export interface DiaBloqueado {
  id: string;
  clienteId: string;
  fecha: string; // ISO date (yyyy-MM-dd)
  motivo: "grabacion" | "viaje" | "no-trabaje" | "otro";
  detalle?: string;
}

/** Append-only log of pieces actually completed, per client/stage/day. This is the
 * source of truth the engine subtracts from required volume — there is no stored
 * "plan" to mutate, so logging here (or a DiaBloqueado) is what makes the plan
 * reorganize itself on the next read. */
export interface RegistroTrabajo {
  id: string;
  clienteId: string;
  etapa: FlowStage;
  piezaTipo?: PieceType;
  cantidad: number;
  fecha: string; // ISO date
  horas?: number;
}

export type CobroEstado = "pendiente" | "pagado" | "vencido";

export interface Cobro {
  id: string;
  clienteId: string;
  periodo: string; // "2026-09"
  monto?: number;
  estado: CobroEstado;
  fechaVencimiento: string; // ISO date
  fechaPago?: string; // ISO date
}

/** Paula's own weekly capacity template — how many hours she has free per weekday,
 * and which weekdays are structurally recording days. 0 = Sunday .. 6 = Saturday. */
export interface EstructuraSemanal {
  horasPorDia: Record<number, number>;
  diasGrabacionHabituales: number[];
}

export const DEFAULT_ESTRUCTURA_SEMANAL: EstructuraSemanal = {
  horasPorDia: { 0: 0, 1: 8, 2: 8, 3: 8, 4: 8, 5: 8, 6: 0 },
  diasGrabacionHabituales: [],
};

/** Rough default hours-per-piece, used to turn quotas into estimated hours.
 * Editable later; not a hard product fact. */
export const HORAS_POR_PIEZA: Record<PieceType, number> = {
  historia: 0.25,
  posteo: 0.75,
  reel: 1.5,
};
