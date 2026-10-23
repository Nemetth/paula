"use client";

// Supabase-backed data layer: replaces the old Dexie repository. No auth: RLS
// is disabled and every row belongs to the same fixed user (see
// FIXED_USER_ID below and supabase/migrations/0002_remove_auth.sql).
// `useTable` gives each screen a live-updating array (initial fetch + a
// realtime subscription), which is what makes "marco algo en un lado y
// aparece en el otro" (PRODUCT.md) actually true across devices, not just
// across components on one device.

import { useSyncExternalStore } from "react";
import { supabase } from "./client";
import {
  AdsChequeo,
  AdsEstado,
  AdsReporte,
  AdsEstadoCuenta,
  AdsReporteEstado,
  Ciclo,
  Client,
  ClienteEstado,
  ClienteTipo,
  Cobro,
  CobroEstado,
  DEFAULT_ESTRUCTURA_SEMANAL,
  DiaBloqueado,
  EstructuraSemanal,
  FlujoConfig,
  FlowStage,
  Gasto,
  Grabacion,
  Idea,
  PieceType,
  Tarea,
  Pieza,
  RegistroTrabajo,
  Servicio,
  VolumenMensual,
} from "../domain/types";

// ---------- row <-> domain mapping ----------

import { ClientRow, GrabacionRow, PiezaRow, BlockedRow, rowToBlocked, rowToClient, rowToGrabacion, rowToPieza } from "./filas";


type WorkLogRow = {
  id: string;
  cliente_id: string;
  etapa: FlowStage;
  pieza_tipo: PieceType | null;
  cantidad: number;
  fecha: string;
  horas: number | null;
};
function rowToWorkLog(r: WorkLogRow): RegistroTrabajo {
  return {
    id: r.id,
    clienteId: r.cliente_id,
    etapa: r.etapa,
    piezaTipo: r.pieza_tipo ?? undefined,
    cantidad: Number(r.cantidad),
    fecha: r.fecha,
    horas: r.horas != null ? Number(r.horas) : undefined,
  };
}

type CobroRow = {
  id: string;
  cliente_id: string;
  periodo: string;
  monto: number | null;
  estado: CobroEstado;
  fecha_vencimiento: string;
  fecha_pago: string | null;
};
function rowToCobro(r: CobroRow): Cobro {
  return {
    id: r.id,
    clienteId: r.cliente_id,
    periodo: r.periodo,
    monto: r.monto != null ? Number(r.monto) : undefined,
    estado: r.estado,
    fechaVencimiento: r.fecha_vencimiento,
    fechaPago: r.fecha_pago ?? undefined,
  };
}


type CicloRow = { id: string; cliente_id: string; entrega: string };
type IdeaRow = { id: string; cliente_id: string; texto: string; usada: boolean; creada_en: string };
type ChequeoRow = { id: string; cliente_id: string; fecha: string; estado: AdsEstado; nota: string | null };
type ReporteRow = { id: string; cliente_id: string; periodo: string; estado: AdsReporteEstado };
type TareaRow = {
  id: string;
  titulo: string;
  horas: number;
  fecha_limite: string | null;
  cliente_id: string | null;
  hecha: boolean;
  creada_en: string;
};
type GastoRow = { id: string; fecha: string; concepto: string; monto: number };

// ---------- generic live table hook ----------
//
// One realtime channel + one fetch per TABLE, shared across every component
// reading it, not one per hook call. Supabase's client de-dupes `.channel()`
// by topic name and returns the SAME channel object for a repeated name —
// so if two mounted components (e.g. the bottom nav and the page it's on)
// both called the old per-call version of this hook for "clients", the
// second one would call `.on()` on a channel the first had already
// `.subscribe()`d, which throws ("cannot add postgres_changes callbacks ...
// after subscribe()"). A ref-counted singleton store per table sidesteps
// that: the first subscriber opens the channel, later ones just attach a
// listener to the same in-memory rows, and the channel closes once the last
// one unmounts.

interface TableStore<Row> {
  subscribe: (onStoreChange: () => void) => () => void;
  getSnapshot: () => Row[] | undefined;
}

const tableStores = new Map<string, TableStore<unknown>>();

function getTableStore<Row extends { id: string }>(table: string): TableStore<Row> {
  const existing = tableStores.get(table);
  if (existing) return existing as TableStore<Row>;

  let rows: Row[] | undefined;
  const listeners = new Set<() => void>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let channel: any;
  let refCount = 0;

  function notify() {
    listeners.forEach((l) => l());
  }

  function start() {
    const client = supabase();

    client
      .from(table)
      .select("*")
      .then(({ data, error }: { data: Row[] | null; error: unknown }) => {
        if (error) {
          console.error(`[${table}] fetch error`, error);
          rows = [];
          marcarFalla(table, true);
        } else {
          rows = data ?? [];
          marcarFalla(table, false);
        }
        notify();
      });

    channel = client
      .channel(`${table}-changes`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("postgres_changes", { event: "*", schema: "public", table }, (payload: any) => {
        const list = rows ?? [];
        if (payload.eventType === "DELETE") {
          const oldId = (payload.old as Row).id;
          rows = list.filter((r) => r.id !== oldId);
        } else {
          const next = payload.new as Row;
          const exists = list.some((r) => r.id === next.id);
          rows = exists ? list.map((r) => (r.id === next.id ? next : r)) : [...list, next];
        }
        notify();
      })
      .subscribe();
  }

  function stop() {
    supabase().removeChannel(channel);
    channel = undefined;
    rows = undefined;
  }

  const store: TableStore<Row> = {
    getSnapshot: () => rows,
    subscribe(onStoreChange) {
      listeners.add(onStoreChange);
      refCount += 1;
      if (refCount === 1) start();
      return () => {
        listeners.delete(onStoreChange);
        refCount -= 1;
        if (refCount === 0) stop();
      };
    },
  };

  tableStores.set(table, store as TableStore<unknown>);
  return store;
}

function useTable<Row extends { id: string }, T>(table: string, mapRow: (row: Row) => T): T[] | undefined {
  const store = getTableStore<Row>(table);
  const rows = useSyncExternalStore(store.subscribe, store.getSnapshot, () => undefined);
  return rows?.map(mapRow);
}

export function useClients(): Client[] | undefined {
  return useTable<ClientRow, Client>("clients", rowToClient);
}

export function useBlockedDates(): DiaBloqueado[] | undefined {
  return useTable<BlockedRow, DiaBloqueado>("blocked_dates", rowToBlocked);
}

export function useWorkLog(): RegistroTrabajo[] | undefined {
  return useTable<WorkLogRow, RegistroTrabajo>("work_log", rowToWorkLog);
}

export function useCobros(): Cobro[] | undefined {
  return useTable<CobroRow, Cobro>("cobros", rowToCobro);
}

export function usePiezas(): Pieza[] | undefined {
  return useTable<PiezaRow, Pieza>("piezas", rowToPieza);
}

export function useGrabaciones(): Grabacion[] | undefined {
  return useTable<GrabacionRow, Grabacion>("grabaciones", rowToGrabacion);
}

export function useCiclos(): Ciclo[] | undefined {
  return useTable<CicloRow, Ciclo>("ciclos", (r) => ({ id: r.id, clienteId: r.cliente_id, entrega: r.entrega }));
}

export function useIdeas(): Idea[] | undefined {
  return useTable<IdeaRow, Idea>("ideas", (r) => ({
    id: r.id,
    clienteId: r.cliente_id,
    texto: r.texto,
    usada: r.usada,
    creadaEn: r.creada_en,
  }));
}

export function useAdsChequeos(): AdsChequeo[] | undefined {
  return useTable<ChequeoRow, AdsChequeo>("ads_chequeos", (r) => ({
    id: r.id,
    clienteId: r.cliente_id,
    fecha: r.fecha,
    estado: r.estado,
    nota: r.nota ?? undefined,
  }));
}

export function useAdsReportes(): AdsReporte[] | undefined {
  return useTable<ReporteRow, AdsReporte>("ads_reportes", (r) => ({
    id: r.id,
    clienteId: r.cliente_id,
    periodo: r.periodo,
    estado: r.estado,
  }));
}

export function useTareas(): Tarea[] | undefined {
  return useTable<TareaRow, Tarea>("tareas", (r) => ({
    id: r.id,
    titulo: r.titulo,
    horas: Number(r.horas),
    fechaLimite: r.fecha_limite ?? undefined,
    clienteId: r.cliente_id ?? undefined,
    hecha: r.hecha,
    creadaEn: r.creada_en,
  }));
}

/** A unit of work ticked off on a day. Kept so Hoy can show it done and count it. */
export interface TareaHecha {
  id: string;
  fecha: string;
  unidadId: string;
  etiqueta: string;
  clienteId?: string;
  tipo: string;
  /** Value the source fact had before the tick, to undo it. */
  anterior?: string;
}

type TareaHechaRow = {
  id: string;
  fecha: string;
  unidad_id: string;
  etiqueta: string;
  cliente_id: string | null;
  tipo: string;
  anterior: string | null;
};

/** Everything ever ticked off. */
export function useTodasLasHechas(): TareaHecha[] | undefined {
  return useTable<TareaHechaRow, TareaHecha>("tareas_hechas", (r) => ({
    id: r.id,
    fecha: r.fecha,
    unidadId: r.unidad_id,
    etiqueta: r.etiqueta,
    clienteId: r.cliente_id ?? undefined,
    tipo: r.tipo,
    anterior: r.anterior ?? undefined,
  }));
}

/** Everything ticked off on `fechaISO`. */
export function useTareasHechas(fechaISO: string): TareaHecha[] | undefined {
  return useTodasLasHechas()?.filter((r) => r.fecha === fechaISO);
}

/** Units moved to a later day: unit id → first day it can be worked. */
export function usePospuestas(): Record<string, string> | undefined {
  const rows = useTable<{ id: string; hasta: string }, { id: string; hasta: string }>("pospuestas", (r) => r);
  return rows ? Object.fromEntries(rows.map((r) => [r.id, r.hasta])) : undefined;
}

/** Days Paula finished everything Hoy had for her (ISO dates), for the streak. */
export function useDiasCumplidos(): Set<string> | undefined {
  const rows = useTable<{ id: string }, string>("dias_cumplidos", (r) => r.id);
  return rows ? new Set(rows) : undefined;
}

export async function marcarDiaCumplido(fechaISO: string): Promise<void> {
  const { error } = await supabase().from("dias_cumplidos").upsert({ id: fechaISO });
  if (error) throw error;
}

/** Save this device's push subscription for the morning notification. */
export async function guardarSuscripcionPush(suscripcion: PushSubscriptionJSON): Promise<void> {
  if (!suscripcion.endpoint) throw new Error("La suscripción no tiene endpoint.");
  const { error } = await supabase()
    .from("push_suscripciones")
    .upsert({ id: suscripcion.endpoint, suscripcion });
  if (error) throw error;
}

export async function borrarSuscripcionPush(endpoint: string): Promise<void> {
  const { error } = await supabase().from("push_suscripciones").delete().eq("id", endpoint);
  if (error) throw error;
}

/** Ids of the WhatsApp messages already sent. */
export function useMensajesHechos(): Set<string> | undefined {
  const rows = useTable<{ id: string; fecha: string }, string>("mensajes_hechos", (r) => r.id);
  return rows ? new Set(rows) : undefined;
}

export function useGastos(): Gasto[] | undefined {
  return useTable<GastoRow, Gasto>("gastos", (r) => ({
    id: r.id,
    fecha: r.fecha,
    concepto: r.concepto,
    monto: Number(r.monto),
  }));
}

/** Fixed daily routines ticked off on `fechaISO`, as a set of fijo ids. */
export function useFijosHechos(fechaISO: string): Set<string> | undefined {
  const rows = useTable<{ id: string; fecha: string; fijo_id: string }, { fecha: string; fijoId: string }>(
    "fijos_hechos",
    (r) => ({ fecha: r.fecha, fijoId: r.fijo_id }),
  );
  if (!rows) return undefined;
  return new Set(rows.filter((r) => r.fecha === fechaISO).map((r) => r.fijoId));
}

// Single-row reads (settings, a day's override) have no realtime channel. Each
// lives in a small store that fetches when the first screen reads it and that a
// write can update, so the screen that saved (and the bell, which reads the same
// plan from the top bar) sees the change without a reload.
function valorRefrescable<T>(cargar: () => PromiseLike<T>) {
  let valor: T | undefined;
  let lectores = 0;
  const oyentes = new Set<() => void>();

  function notificar() {
    oyentes.forEach((l) => l());
  }

  return {
    subscribe(onStoreChange: () => void) {
      oyentes.add(onStoreChange);
      lectores += 1;
      if (lectores === 1) {
        cargar().then(
          (v) => {
            valor = v;
            marcarFalla("single-row", false);
            notificar();
          },
          (e) => {
            console.error("[single-row] fetch error", e);
            marcarFalla("single-row", true);
          },
        );
      }
      return () => {
        oyentes.delete(onStoreChange);
        lectores -= 1;
      };
    },
    getSnapshot: () => valor,
    set(v: T) {
      valor = v;
      notificar();
    },
  };
}

const overrides = new Map<string, ReturnType<typeof valorRefrescable<number | null>>>();

function overrideDe(fechaISO: string) {
  let s = overrides.get(fechaISO);
  if (!s) {
    s = valorRefrescable<number | null>(async () => {
      const { data } = await supabase()
        .from("day_overrides")
        .select("horas_disponibles")
        .eq("fecha", fechaISO)
        .maybeSingle();
      return data?.horas_disponibles ?? null;
    });
    overrides.set(fechaISO, s);
  }
  return s;
}

export function useDayOverride(fechaISO: string): number | null | undefined {
  const s = overrideDe(fechaISO);
  return useSyncExternalStore(s.subscribe, s.getSnapshot, () => undefined);
}

const estructuraStore = valorRefrescable<EstructuraSemanal | null>(async () => {
  // Filtered by user: an old row from the days with login can still be in the table.
  const { data, error } = await supabase()
    .from("settings")
    .select("estructura_semanal")
    .eq("user_id", FIXED_USER_ID)
    .maybeSingle();
  // On a failed read the plan still loads with the default week; the load-failure banner says why.
  marcarFalla("settings", !!error);
  if (error) console.error("[settings] fetch error", error);
  return data?.estructura_semanal ?? null;
});

/** `undefined` while loading, `null` when Paula never saved her week (use the default). */
export function useEstructuraSemanal(): EstructuraSemanal | null | undefined {
  return useSyncExternalStore(estructuraStore.subscribe, estructuraStore.getSnapshot, () => undefined);
}

// ---------- load failures ----------
//
// A failed fetch leaves the table empty, which the screens read as "nothing yet".
// This flag is what lets the app tell Paula the data didn't load instead.

const fallas = new Set<string>();
const oyentesFalla = new Set<() => void>();

function marcarFalla(fuente: string, falla: boolean) {
  if (falla === fallas.has(fuente)) return;
  if (falla) fallas.add(fuente);
  else fallas.delete(fuente);
  oyentesFalla.forEach((l) => l());
}

/** True while any table or setting failed to load. */
export function useFallaDeCarga(): boolean {
  return useSyncExternalStore(
    (l) => {
      oyentesFalla.add(l);
      return () => oyentesFalla.delete(l);
    },
    () => fallas.size > 0,
    () => false,
  );
}

// ---------- writes ----------

export interface NuevoClienteInput {
  nombre: string;
  rubro?: string;
  servicio: Servicio;
  volumenMensual: VolumenMensual;
  flujo: FlujoConfig;
  contactoWhatsapp?: string;
  ventanaCobro?: [number, number];
  montoMensual?: number;
  notas?: string;
  tipo?: ClienteTipo;
  estado?: ClienteEstado;
  intocable?: boolean;
  adsUltimaRevision?: string;
  adsCuentaUrl?: string;
  adsEstadoCuenta?: AdsEstadoCuenta;
  adsRefreshCreativos?: string;
  ultimoAumento?: string;
  notasReunion?: string;
}

function clienteInputToRow(input: NuevoClienteInput) {
  return {
    nombre: input.nombre,
    rubro: input.rubro ?? null,
    servicio: input.servicio,
    volumen_mensual: input.volumenMensual,
    flujo: input.flujo,
    contacto_whatsapp: input.contactoWhatsapp ?? null,
    ventana_cobro: input.ventanaCobro ?? null,
    monto_mensual: input.montoMensual ?? null,
    notas: input.notas ?? null,
    tipo: input.tipo,
    estado: input.estado,
    intocable: input.intocable,
    ads_ultima_revision: input.adsUltimaRevision,
    // An empty link or date clears it.
    ads_cuenta_url: input.adsCuentaUrl === "" ? null : input.adsCuentaUrl,
    ads_estado_cuenta: input.adsEstadoCuenta,
    ads_refresh_creativos: input.adsRefreshCreativos === "" ? null : input.adsRefreshCreativos,
    ultimo_aumento: input.ultimoAumento,
    notas_reunion: input.notasReunion,
  };
}

export async function crearCliente(input: NuevoClienteInput): Promise<Client> {
  const { data, error } = await supabase().from("clients").insert(clienteInputToRow(input)).select().single();
  if (error) throw error;
  return rowToClient(data as ClientRow);
}

export async function actualizarCliente(id: string, input: Partial<NuevoClienteInput> & { activo?: boolean }): Promise<void> {
  const { activo, ...rest } = input;
  const row: Record<string, unknown> = { ...clienteInputToRow(rest as NuevoClienteInput) };
  if (activo !== undefined) row.activo = activo;
  // Only send fields that were actually provided.
  Object.keys(row).forEach((k) => row[k] === undefined && delete row[k]);
  const { error } = await supabase().from("clients").update(row).eq("id", id);
  if (error) throw error;
}

/** Put an account's last deep review back to `fecha` (null = never reviewed): the undo of a tick. */
export async function restaurarRevisionAds(id: string, fecha: string | null): Promise<void> {
  const { error } = await supabase().from("clients").update({ ads_ultima_revision: fecha }).eq("id", id);
  if (error) throw error;
}

export async function eliminarCliente(id: string): Promise<void> {
  const { error } = await supabase().from("clients").delete().eq("id", id);
  if (error) throw error;
}

// ---------- piezas & grabaciones ----------

export type NuevaPiezaInput = Pick<Pieza, "clienteId" | "tipo"> &
  Partial<Omit<Pieza, "id" | "clienteId" | "tipo" | "creadaEn">>;

function piezaToRow(p: Partial<Omit<Pieza, "id" | "creadaEn">>) {
  const row = {
    cliente_id: p.clienteId,
    tipo: p.tipo,
    hecha: p.hecha,
    titulo: p.titulo,
    ciclo_id: p.cicloId,
    grabacion_id: p.grabacionId,
    guion_listo: p.guionListo,
    periodo_publicacion: p.periodoPublicacion,
    fecha_publicacion: p.fechaPublicacion,
    fecha_entrega: p.fechaEntrega,
    tanda: p.tanda,
    horas_reales: p.horasReales,
    no_antes_de: p.noAntesDe,
    // Ticking a piece records the day, so the client history can tell on-time deliveries.
    hecha_en: p.hecha === undefined ? undefined : p.hecha ? (p.hechaEn ?? hoyLocal()) : null,
  };
  Object.entries(row).forEach(([k, v]) => v === undefined && delete (row as Record<string, unknown>)[k]);
  return row;
}

/** Today as "yyyy-MM-dd" in local time. */
function hoyLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function crearPiezas(inputs: NuevaPiezaInput[]): Promise<void> {
  if (inputs.length === 0) return;
  // A bulk insert sends the union of all keys and fills missing ones with null,
  // which would override column defaults, so spell the defaults out per row.
  const rows = inputs.map((i) => ({ ...piezaToRow(i), hecha: i.hecha ?? false, guion_listo: i.guionListo ?? false, tanda: i.tanda ?? 1 }));
  const { error } = await supabase().from("piezas").insert(rows);
  if (error) throw error;
}

/** Open a delivery cycle: its row, then its pieces. The row's id is the client
 * and the delivery, so when two devices open the same cycle at once only the
 * first insert lands, and only that one writes the pieces. */
export async function abrirCiclo(ciclo: Ciclo, piezas: NuevaPiezaInput[]): Promise<boolean> {
  const { data, error } = await supabase()
    .from("ciclos")
    .upsert({ id: ciclo.id, cliente_id: ciclo.clienteId, entrega: ciclo.entrega }, { onConflict: "id", ignoreDuplicates: true })
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) return false;
  try {
    await crearPiezas(piezas);
  } catch (e) {
    // A cycle with no pieces reads as finished: take it back so it opens again.
    await supabase().from("ciclos").delete().eq("id", ciclo.id);
    throw e;
  }
  return true;
}

/** Tick a piece done (or back): this is the single write that makes the whole
 * plan re-derive, since nothing else stores "the plan". */
export async function actualizarPieza(
  id: string,
  changes: Partial<Omit<Pieza, "id" | "creadaEn">>,
): Promise<void> {
  const { error } = await supabase().from("piezas").update(piezaToRow(changes)).eq("id", id);
  if (error) throw error;
}

/** Link a piece to a recording, or unlink it with `null` (the generic update drops undefined fields). */
export async function asignarGrabacion(piezaId: string, grabacionId: string | null): Promise<void> {
  const { error } = await supabase().from("piezas").update({ grabacion_id: grabacionId }).eq("id", piezaId);
  if (error) throw error;
}

/** Same change on several pieces at once (a delivery moving as a block). */
export async function actualizarPiezas(
  ids: string[],
  changes: Partial<Omit<Pieza, "id" | "creadaEn">>,
): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase().from("piezas").update(piezaToRow(changes)).in("id", ids);
  if (error) throw error;
}

/** Move a client's delivery to another date: every piece due that day goes with
 * it. Returns the ids it moved, which is what undoing it needs. */
export async function moverEntrega(clienteId: string, desde: string, hasta: string): Promise<string[]> {
  const { data, error } = await supabase()
    .from("piezas")
    .update({ fecha_entrega: hasta })
    .eq("cliente_id", clienteId)
    .eq("fecha_entrega", desde)
    .select("id");
  if (error) throw error;
  return (data ?? []).map((r: { id: string }) => r.id);
}

export async function eliminarPieza(id: string): Promise<void> {
  const { error } = await supabase().from("piezas").delete().eq("id", id);
  if (error) throw error;
}

export type NuevaGrabacionInput = Pick<Grabacion, "clienteId" | "fecha"> &
  Partial<Omit<Grabacion, "id" | "clienteId" | "fecha">>;

function grabacionToRow(g: Partial<Omit<Grabacion, "id">>) {
  const row = {
    cliente_id: g.clienteId,
    fecha: g.fecha,
    viaje_dias_antes: g.viajeDiasAntes,
    viaje_dias_despues: g.viajeDiasDespues,
    hecha: g.hecha,
    guiones: g.guiones,
    tomas: g.tomas,
    alimenta: g.alimenta,
    notas: g.notas,
  };
  Object.entries(row).forEach(([k, v]) => v === undefined && delete (row as Record<string, unknown>)[k]);
  return row;
}

export async function crearGrabacion(input: NuevaGrabacionInput): Promise<Grabacion> {
  const { data, error } = await supabase().from("grabaciones").insert(grabacionToRow(input)).select().single();
  if (error) throw error;
  return rowToGrabacion(data as GrabacionRow);
}

/** Moving `fecha` here is all it takes to move the delivery: pieces derive their
 * due date from the recording unless they carry an explicit one. */
export async function actualizarGrabacion(
  id: string,
  changes: Partial<Omit<Grabacion, "id">>,
): Promise<void> {
  const { error } = await supabase().from("grabaciones").update(grabacionToRow(changes)).eq("id", id);
  if (error) throw error;
}

export async function eliminarGrabacion(id: string): Promise<void> {
  const { error } = await supabase().from("grabaciones").delete().eq("id", id);
  if (error) throw error;
}

export async function crearIdea(clienteId: string, texto: string): Promise<void> {
  const { error } = await supabase().from("ideas").insert({ cliente_id: clienteId, texto });
  if (error) throw error;
}

export async function marcarIdeaUsada(id: string, usada: boolean): Promise<void> {
  const { error } = await supabase().from("ideas").update({ usada }).eq("id", id);
  if (error) throw error;
}

export async function eliminarIdea(id: string): Promise<void> {
  const { error } = await supabase().from("ideas").delete().eq("id", id);
  if (error) throw error;
}

export async function guardarChequeoAds(
  clienteId: string,
  fecha: string,
  estado: AdsEstado,
  /** Left out, the note already written that day is kept. An empty one clears it. */
  nota?: string,
): Promise<void> {
  const row: Record<string, unknown> = { id: `${fecha}__${clienteId}`, cliente_id: clienteId, fecha, estado };
  if (nota !== undefined) row.nota = nota.trim() || null;
  const { error } = await supabase().from("ads_chequeos").upsert(row);
  if (error) throw error;
}

export async function quitarChequeoAds(clienteId: string, fecha: string): Promise<void> {
  const { error } = await supabase().from("ads_chequeos").delete().eq("id", `${fecha}__${clienteId}`);
  if (error) throw error;
}

export async function guardarReporteAds(
  clienteId: string,
  periodo: string,
  estado: AdsReporteEstado,
): Promise<void> {
  const { error } = await supabase()
    .from("ads_reportes")
    .upsert({ id: `${periodo}__${clienteId}`, cliente_id: clienteId, periodo, estado });
  if (error) throw error;
}

export async function crearGasto(input: Omit<Gasto, "id">): Promise<void> {
  const { error } = await supabase().from("gastos").insert(input);
  if (error) throw error;
}

export async function eliminarGasto(id: string): Promise<void> {
  const { error } = await supabase().from("gastos").delete().eq("id", id);
  if (error) throw error;
}

export async function crearTarea(input: {
  titulo: string;
  horas: number;
  fechaLimite?: string;
  clienteId?: string;
}): Promise<void> {
  const { error } = await supabase()
    .from("tareas")
    .insert({
      titulo: input.titulo,
      horas: input.horas,
      fecha_limite: input.fechaLimite ?? null,
      cliente_id: input.clienteId ?? null,
    });
  if (error) throw error;
}

export async function completarTarea(id: string, hecha = true): Promise<void> {
  const { error } = await supabase().from("tareas").update({ hecha }).eq("id", id);
  if (error) throw error;
}

export async function registrarHecha(fechaISO: string, h: Omit<TareaHecha, "id" | "fecha">): Promise<void> {
  const { error } = await supabase()
    .from("tareas_hechas")
    .upsert({
      id: `${fechaISO}__${h.unidadId}`,
      fecha: fechaISO,
      unidad_id: h.unidadId,
      etiqueta: h.etiqueta,
      cliente_id: h.clienteId ?? null,
      tipo: h.tipo,
      anterior: h.anterior ?? null,
    });
  if (error) throw error;
}

export async function quitarHecha(id: string): Promise<void> {
  const { error } = await supabase().from("tareas_hechas").delete().eq("id", id);
  if (error) throw error;
}

/** Move units to `hasta` or later: "pasar a mañana" and "cerrar el día". */
export async function posponerUnidades(unidadIds: string[], hasta: string): Promise<void> {
  if (unidadIds.length === 0) return;
  const { error } = await supabase()
    .from("pospuestas")
    .upsert(unidadIds.map((id) => ({ id, hasta })));
  if (error) throw error;
}

export async function quitarPospuesta(unidadId: string): Promise<void> {
  const { error } = await supabase().from("pospuestas").delete().eq("id", unidadId);
  if (error) throw error;
}

export async function marcarMensajeHecho(id: string, fechaISO: string): Promise<void> {
  const { error } = await supabase().from("mensajes_hechos").upsert({ id, fecha: fechaISO });
  if (error) throw error;
}

export async function marcarFijo(fechaISO: string, fijoId: string, hecho: boolean): Promise<void> {
  const id = `${fechaISO}__${fijoId}`;
  const q = hecho
    ? supabase().from("fijos_hechos").upsert({ id, fecha: fechaISO, fijo_id: fijoId })
    : supabase().from("fijos_hechos").delete().eq("id", id);
  const { error } = await q;
  if (error) throw error;
}

export async function registrarTrabajo(entry: Omit<RegistroTrabajo, "id">): Promise<void> {
  const { error } = await supabase()
    .from("work_log")
    .insert({
      cliente_id: entry.clienteId,
      etapa: entry.etapa,
      pieza_tipo: entry.piezaTipo ?? null,
      cantidad: entry.cantidad,
      fecha: entry.fecha,
      horas: entry.horas ?? null,
    });
  if (error) throw error;
}

/** Returns the id of the block, so the caller can offer to undo it. */
export async function bloquearDia(entry: Omit<DiaBloqueado, "id">): Promise<string> {
  const { data, error } = await supabase()
    .from("blocked_dates")
    .insert({ cliente_id: entry.clienteId, fecha: entry.fecha, motivo: entry.motivo, detalle: entry.detalle ?? null })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function desbloquearDia(id: string): Promise<void> {
  const { error } = await supabase().from("blocked_dates").delete().eq("id", id);
  if (error) throw error;
}

// App sin autenticación: todas las filas se guardan bajo este mismo usuario
// fijo (ver supabase/migrations/0002_remove_auth.sql).
const FIXED_USER_ID = "a871f9ba-7331-4af8-9914-26323e0edd1f";

async function currentUserId(): Promise<string> {
  return FIXED_USER_ID;
}

export async function guardarHorasDia(fechaISO: string, horasDisponibles: number): Promise<void> {
  const userId = await currentUserId();
  const { error } = await supabase()
    .from("day_overrides")
    .upsert(
      { user_id: userId, fecha: fechaISO, horas_disponibles: horasDisponibles },
      { onConflict: "user_id,fecha" },
    );
  if (error) throw error;
  overrideDe(fechaISO).set(horasDisponibles);
}

export async function crearOActualizarCobro(
  clienteId: string,
  periodo: string,
  changes: Partial<Pick<Cobro, "monto" | "estado" | "fechaVencimiento" | "fechaPago">>,
): Promise<void> {
  const userId = await currentUserId();

  const id = `${clienteId}__${periodo}`;
  const { data: existing } = await supabase().from("cobros").select("*").eq("id", id).maybeSingle();

  const row = {
    id,
    user_id: userId,
    cliente_id: clienteId,
    periodo,
    estado: "pendiente" as CobroEstado,
    fecha_vencimiento: new Date().toISOString().slice(0, 10),
    ...(existing
      ? {
          monto: existing.monto,
          estado: existing.estado,
          fecha_vencimiento: existing.fecha_vencimiento,
          fecha_pago: existing.fecha_pago,
        }
      : {}),
    ...(changes.monto !== undefined && { monto: changes.monto }),
    ...(changes.estado !== undefined && { estado: changes.estado }),
    ...(changes.fechaVencimiento !== undefined && { fecha_vencimiento: changes.fechaVencimiento }),
    ...(changes.fechaPago !== undefined && { fecha_pago: changes.fechaPago }),
  };

  const { error } = await supabase().from("cobros").upsert(row);
  if (error) throw error;
}

export async function ensureSettings(): Promise<void> {
  const userId = await currentUserId();
  const { data: existing } = await supabase().from("settings").select("user_id").eq("user_id", userId).maybeSingle();
  if (existing) return;
  const { error } = await supabase()
    .from("settings")
    .insert({ user_id: userId, estructura_semanal: DEFAULT_ESTRUCTURA_SEMANAL });
  if (error) throw error;
}

export async function guardarEstructuraSemanal(estructura: EstructuraSemanal): Promise<void> {
  const userId = await currentUserId();
  const { error } = await supabase()
    .from("settings")
    .upsert({ user_id: userId, estructura_semanal: estructura }, { onConflict: "user_id" });
  if (error) throw error;
  estructuraStore.set(estructura);
}

export const DEFAULT_FLUJO: FlujoConfig = {
  cicloTipo: "mensual",
  mandaCalendario: true,
  diasAprobacion: 2,
  tieneGrabacion: false,
  diasViajeGrabacion: 0,
  diasProduccion: 8,
  diasCorreccion: 2,
  diasAjustes: 1,
  diasMargenCierre: 3,
};
