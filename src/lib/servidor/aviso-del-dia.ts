// The morning notification's text, computed on the server from the same tables
// and the same pure functions the app uses, so the push says what Hoy will show.

import { createClient } from "@supabase/supabase-js";
import { armarPlan } from "@/lib/domain/armar-plan";
import { calcularEntregas } from "@/lib/domain/entregas";
import { armarHoy, estadoDelDia, resumenDelDia } from "@/lib/domain/hoy";
import { toISODate } from "@/lib/domain/dates";
import { AdsChequeo, DEFAULT_ESTRUCTURA_SEMANAL, EstructuraSemanal, Tarea } from "@/lib/domain/types";
import { NOMBRE, saludo } from "@/lib/domain/voz";
import {
  AdsRegistroRow,
  BlockedRow,
  ClientRow,
  EstadoEntregaRow,
  GrabacionRow,
  PiezaRow,
  ReporteRow,
  rowToAdsRegistro,
  rowToBlocked,
  rowToClient,
  rowToEstadoEntrega,
  rowToGrabacion,
  rowToPieza,
  rowToReporte,
} from "@/lib/supabase/filas";

/** Paula's day, not the server's: Vercel runs on UTC. */
const ZONA = "America/Argentina/Buenos_Aires";

export function hoyEnArgentina(ahora = new Date()): Date {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(ahora)
    .split("-")
    .map(Number);
  // Midnight of that date in the server's own zone, which is what the domain's date helpers expect.
  return new Date(y, m - 1, d, 8);
}

export function supabaseServidor() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !clave) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  return createClient(url, clave, { auth: { persistSession: false } });
}

async function tabla<T>(nombre: string, filtro?: { columna: string; valor: string }): Promise<T[]> {
  let q = supabaseServidor().from(nombre).select("*");
  if (filtro) q = q.eq(filtro.columna, filtro.valor);
  const { data, error } = await q;
  if (error) throw new Error(`[${nombre}] ${error.message}`);
  return (data ?? []) as T[];
}

/** A table added in a later migration: until it's run, read it as empty instead of failing the push. */
async function tablaNueva<T>(nombre: string): Promise<T[]> {
  return tabla<T>(nombre).catch((e) => {
    console.error("[aviso-manana]", e);
    return [];
  });
}

export interface AvisoDelDia {
  titulo: string;
  cuerpo: string;
}

export async function avisoDelDia(ahora = new Date()): Promise<AvisoDelDia> {
  const today = hoyEnArgentina(ahora);
  const hoyISO = toISODate(today);

  const [clientes, piezas, grabaciones, bloqueos, tareas, pospuestas, hechas, overrides, settings, chequeos, fijos, reportes, adsHistorial, estados] = await Promise.all([
    tabla<ClientRow>("clients"),
    tabla<PiezaRow>("piezas"),
    tabla<GrabacionRow>("grabaciones"),
    tabla<BlockedRow>("blocked_dates"),
    tabla<{ id: string; titulo: string; horas: number; fecha_limite: string | null; cliente_id: string | null; hecha: boolean; creada_en: string }>("tareas"),
    tabla<{ id: string; hasta: string }>("pospuestas"),
    tabla<{ id: string; fecha: string; unidad_id: string; etiqueta: string; cliente_id: string | null; tipo: string; anterior: string | null }>("tareas_hechas"),
    tabla<{ horas_disponibles: number }>("day_overrides", { columna: "fecha", valor: hoyISO }),
    // Only the app's fixed user: an old row from the days with login can still be there.
    tabla<{ estructura_semanal: EstructuraSemanal }>("settings", { columna: "user_id", valor: "a871f9ba-7331-4af8-9914-26323e0edd1f" }),
    tabla<{ id: string; cliente_id: string; fecha: string; estado: AdsChequeo["estado"]; nota: string | null }>("ads_chequeos", { columna: "fecha", valor: hoyISO }),
    tabla<{ fijo_id: string; fecha: string }>("fijos_hechos", { columna: "fecha", valor: hoyISO }),
    tabla<ReporteRow>("ads_reportes"),
    tablaNueva<AdsRegistroRow>("ads_historial"),
    tablaNueva<EstadoEntregaRow>("entregas_estado"),
  ]);
  const estadosEntrega = estados.map(rowToEstadoEntrega);

  const clients = clientes.map(rowToClient);
  const lasPiezas = piezas.map(rowToPieza);
  const lasGrabaciones = grabaciones.map(rowToGrabacion);
  const estructura = settings[0]?.estructura_semanal ?? DEFAULT_ESTRUCTURA_SEMANAL;
  const registros = hechas.map((h) => ({
    id: h.id,
    fecha: h.fecha,
    unidadId: h.unidad_id,
    etiqueta: h.etiqueta,
    clienteId: h.cliente_id ?? undefined,
    tipo: h.tipo,
    anterior: h.anterior ?? undefined,
  }));
  const lasTareas: Tarea[] = tareas.map((t) => ({
    id: t.id,
    titulo: t.titulo,
    horas: Number(t.horas),
    fechaLimite: t.fecha_limite ?? undefined,
    clienteId: t.cliente_id ?? undefined,
    hecha: t.hecha,
    creadaEn: t.creada_en,
  }));

  const { plan } = armarPlan({
    today,
    clients,
    piezas: lasPiezas,
    grabaciones: lasGrabaciones,
    blockedDates: bloqueos.map(rowToBlocked),
    tareas: lasTareas,
    adsHistorial: adsHistorial.map(rowToAdsRegistro),
    reportes: reportes.map(rowToReporte),
    estadosEntrega,
    pospuestas: Object.fromEntries(pospuestas.map((p) => [p.id, p.hasta])),
    hechas: registros,
    dayOverride: overrides[0]?.horas_disponibles ?? null,
    estructura,
    horizonteDias: 60,
  });
  const hoy = armarHoy({
    plan,
    hoyISO,
    clients,
    fijos: estructura.fijosDiarios ?? [],
    fijosHechos: new Set(fijos.map((f) => f.fijo_id)),
    chequeos: chequeos.map((c) => ({ id: c.id, clienteId: c.cliente_id, fecha: c.fecha, estado: c.estado, nota: c.nota ?? undefined })),
    registros: registros.filter((r) => r.fecha === hoyISO),
    locales: new Set(),
  });
  const estado = estadoDelDia(hoy, plan.cargaPorDia[hoyISO]);
  const entregas = calcularEntregas({ clients, piezas: lasPiezas, grabaciones: lasGrabaciones, plan, today, estructura, estados: estadosEntrega });

  const cuerpo =
    estado.tipo === "bloqueado"
      ? `${estado.titulo}. ${estado.detalle}`
      : (resumenDelDia(hoy, clients, entregas) ?? "Hoy no hay nada en el plan. Día liviano.");
  return { titulo: `${saludo(today)}, ${NOMBRE}`, cuerpo };
}
