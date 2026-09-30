"use client";

// Supabase-backed data layer: replaces the old Dexie repository. Every table
// is RLS-scoped to auth.uid(), so queries never filter by user explicitly —
// the database enforces that. `useTable` gives each screen a live-updating
// array (initial fetch + a realtime subscription), which is what makes
// "marco algo en un lado y aparece en el otro" (PRODUCT.md) actually true
// across devices, not just across components on one device.

import { useEffect, useState, useSyncExternalStore } from "react";
import { supabase } from "./client";
import {
  Client,
  Cobro,
  CobroEstado,
  DEFAULT_ESTRUCTURA_SEMANAL,
  DiaBloqueado,
  EstructuraSemanal,
  FlujoConfig,
  FlowStage,
  PieceType,
  RegistroTrabajo,
  Servicio,
  VolumenMensual,
} from "../domain/types";

// ---------- row <-> domain mapping ----------

type ClientRow = {
  id: string;
  nombre: string;
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

function rowToClient(r: ClientRow): Client {
  return {
    id: r.id,
    nombre: r.nombre,
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

type BlockedRow = { id: string; cliente_id: string; fecha: string; motivo: DiaBloqueado["motivo"]; detalle: string | null };
function rowToBlocked(r: BlockedRow): DiaBloqueado {
  return { id: r.id, clienteId: r.cliente_id, fecha: r.fecha, motivo: r.motivo, detalle: r.detalle ?? undefined };
}

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
        } else {
          rows = data ?? [];
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

export function useDayOverride(fechaISO: string): number | null | undefined {
  const [horas, setHoras] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    supabase()
      .from("day_overrides")
      .select("horas_disponibles")
      .eq("fecha", fechaISO)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setHoras(data?.horas_disponibles ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [fechaISO]);

  return horas;
}

export function useEstructuraSemanal(): EstructuraSemanal | undefined {
  const [estructura, setEstructura] = useState<EstructuraSemanal | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    supabase()
      .from("settings")
      .select("estructura_semanal")
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setEstructura(data?.estructura_semanal);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return estructura;
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

export async function eliminarCliente(id: string): Promise<void> {
  const { error } = await supabase().from("clients").delete().eq("id", id);
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

export async function bloquearDia(entry: Omit<DiaBloqueado, "id">): Promise<void> {
  const { error } = await supabase()
    .from("blocked_dates")
    .insert({ cliente_id: entry.clienteId, fecha: entry.fecha, motivo: entry.motivo, detalle: entry.detalle ?? null });
  if (error) throw error;
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase().auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error("No hay sesión activa.");
  return userId;
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
