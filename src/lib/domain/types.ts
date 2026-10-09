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
  /** When this client's pieces can start being produced. Defaults from tieneGrabacion. */
  inicioDesde?: InicioDesde;
  /** Fixed start date, only used when inicioDesde === "fecha". */
  inicioFecha?: string;
  /** Days before each delivery Paula wants the pieces finished (the "fecha objetivo"). */
  margenDias?: number;
}

/** What unlocks production for a client:
 * - aprobacion: as soon as the calendar (each piece) is approved;
 * - grabacion: the day after the recording its pieces come from;
 * - fecha: not before a fixed date. */
export type InicioDesde = "aprobacion" | "grabacion" | "fecha";

export const DEFAULT_MARGEN_DIAS = 1;

export function inicioPorDefecto(flujo: FlujoConfig, tipo: ClienteTipo): InicioDesde {
  if (flujo.inicioDesde) return flujo.inicioDesde;
  const sinGrabacion = tipo === "material-cliente" || tipo === "pedidos-diarios" || tipo === "pack";
  return flujo.tieneGrabacion && !sinGrabacion ? "grabacion" : "aprobacion";
}

export function inicioDe(client: Client): InicioDesde {
  return inicioPorDefecto(client.flujo, client.tipo);
}

export function margenDe(client: Client): number {
  return Math.max(client.flujo.margenDias ?? DEFAULT_MARGEN_DIAS, 0);
}

/** What kind of engagement this is. Drives how its pieces are produced:
 * - mensual: recurring monthly plan, publication period = production period shifted.
 * - pack: one-off project/pack, no recurring period.
 * - material-cliente: client sends the material, Paula edits or writes copies (no recording).
 * - pedidos-diarios: ad-hoc daily requests with no plan.
 * - ciclo-grabacion: cycle tied to the recording date instead of the month. */
export type ClienteTipo =
  | "mensual"
  | "pack"
  | "material-cliente"
  | "pedidos-diarios"
  | "ciclo-grabacion";

export type ClienteEstado =
  | "al-dia"
  | "en-produccion"
  | "esperando-aprobacion"
  | "esperando-pago"
  | "en-pausa";

export interface Client {
  id: string;
  nombre: string;
  tipo: ClienteTipo;
  estado: ClienteEstado;
  /** Never postponed by the planner (e.g. Deluxe). */
  intocable: boolean;
  /** Last "a fondo" Ads review (ISO date); drives the review rotation. */
  adsUltimaRevision?: string;
  /** Last price increase (ISO date); the next one is due every 3 months. */
  ultimoAumento?: string;
  notasReunion?: string;
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
  /** Daily fixed routines (checked off every day); their hours come off every working day's capacity. */
  fijosDiarios?: FijoDiario[];
  /** Fixed activities on a specific weekday (e.g. a weekly meeting). */
  actividadesFijas?: ActividadFija[];
  /** Legacy hours per piece type; the plan now counts pieces (see pesoPieza). */
  tiemposPieza?: TiemposPieza;
  /** Weekdays Paula works. When absent, the weekdays with hours > 0 in horasPorDia. */
  diasTrabajo?: number[];
  /** How much work fits in one day, counted in pieces (weighted by pesoPieza). */
  topePiezasDia?: number;
  /** How many "pieces" each type counts as (e.g. a reel = 2 historias). */
  pesoPieza?: Record<PieceType, number>;
}

export const DEFAULT_TOPE_PIEZAS_DIA = 6;

export const DEFAULT_PESO_PIEZA: Record<PieceType, number> = { historia: 1, posteo: 1, reel: 2 };

export function diasDeTrabajo(e: EstructuraSemanal): number[] {
  if (e.diasTrabajo) return e.diasTrabajo;
  return Object.entries(e.horasPorDia)
    .filter(([, h]) => h > 0)
    .map(([d]) => Number(d));
}

export function topePiezas(e: EstructuraSemanal): number {
  return e.topePiezasDia ?? DEFAULT_TOPE_PIEZAS_DIA;
}

export function pesosPieza(e: EstructuraSemanal): Record<PieceType, number> {
  return { ...DEFAULT_PESO_PIEZA, ...e.pesoPieza };
}

export interface FijoDiario {
  id: string;
  nombre: string;
  horas: number;
}

export interface ActividadFija {
  id: string;
  nombre: string;
  diaSemana: number; // 0 = Sunday .. 6 = Saturday
  horas: number;
}

export const DEFAULT_ESTRUCTURA_SEMANAL: EstructuraSemanal = {
  horasPorDia: { 0: 0, 1: 8, 2: 8, 3: 8, 4: 8, 5: 8, 6: 0 },
  diasGrabacionHabituales: [],
  fijosDiarios: [],
  actividadesFijas: [],
};

/** Rough default hours-per-piece, used to turn quotas into estimated hours.
 * Editable later; not a hard product fact. */
export const HORAS_POR_PIEZA: Record<PieceType, number> = {
  historia: 0.25,
  posteo: 0.75,
  reel: 1.5,
};

// ---------------------------------------------------------------------------
// Piece-based model. The unit of work is the piece (one historia, posteo or
// reel), not the client's stage. Recordings are their own entity and can feed
// several pieces across more than one publication period.
// ---------------------------------------------------------------------------

export const PIEZA_ESTADOS = [
  "idea",
  "aprobada",
  "grabada",
  "editada",
  "entregada",
  "programada",
] as const;

export type PiezaEstado = (typeof PIEZA_ESTADOS)[number];

export interface Pieza {
  id: string;
  clienteId: string;
  tipo: PieceType;
  estado: PiezaEstado;
  titulo?: string;
  grabacionId?: string;
  /** The script/shot prep for this piece is done (only meaningful while it waits for a recording). */
  guionListo: boolean;
  /** Publication month this piece belongs to, "yyyy-MM". Separate from when it is produced. */
  periodoPublicacion?: string;
  /** Scheduled publication date. */
  fechaPublicacion?: string;
  /** Explicit delivery date. When absent, derived from the recording (+7 days). */
  fechaEntrega?: string;
  /** 1 or 2: lets one delivery be split into two batches with their own date. */
  tanda: 1 | 2;
  horasReales?: number;
  /** Postponed ("no llegué"): can't be worked before this date. */
  noAntesDe?: string;
  creadaEn: string;
}

export interface Grabacion {
  id: string;
  clienteId: string;
  fecha: string; // ISO date
  /** Full days blocked before / after for travel. */
  viajeDiasAntes: number;
  viajeDiasDespues: number;
  hecha: boolean;
  guiones?: string;
  tomas: string[];
  /** Publication periods ("yyyy-MM") or pack names this recording feeds. */
  alimenta: string[];
  notas?: string;
}

/** Days after a recording by which its pieces are delivered. */
export const ENTREGA_DIAS_POST_GRABACION = 7;

/** Hours per piece, split by the kind of work. */
export interface TiempoPieza {
  edicion: number;
  guion: number;
}

export type TiemposPieza = Record<PieceType, TiempoPieza>;

export const DEFAULT_TIEMPOS_PIEZA: TiemposPieza = {
  historia: { edicion: HORAS_POR_PIEZA.historia, guion: 0.1 },
  posteo: { edicion: HORAS_POR_PIEZA.posteo, guion: 0.25 },
  reel: { edicion: HORAS_POR_PIEZA.reel, guion: 0.4 },
};

export interface Idea {
  id: string;
  clienteId: string;
  texto: string;
  usada: boolean;
  creadaEn: string;
}

export type AdsEstado = "ok" | "revisar";

export interface AdsChequeo {
  id: string;
  clienteId: string;
  fecha: string;
  estado: AdsEstado;
  nota?: string;
}

export type AdsReporteEstado = "pendiente" | "enviado";

export interface AdsReporte {
  id: string;
  clienteId: string;
  periodo: string; // yyyy-MM covered
  estado: AdsReporteEstado;
}

export interface Gasto {
  id: string;
  fecha: string;
  concepto: string;
  monto: number;
}

/** A loose task added with the "+" button. */
export interface Tarea {
  id: string;
  titulo: string;
  horas: number;
  fechaLimite?: string;
  clienteId?: string;
  hecha: boolean;
  creadaEn: string;
}
