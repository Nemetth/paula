// The scheduling engine: the actual "heart" of the product.
//
// Design choice that matters: there is no stored, mutable "plan." Every screen
// asks this engine to DERIVE today's plan fresh from source facts (clients,
// their flow config, what Paula has actually logged as done, and which days
// are blocked). That is what makes "reconstruye y reorganiza todo el plan
// solo" true by construction: logging a day off or a slipped recording never
// requires a separate "reorganize" step, because tomorrow's derivation simply
// no longer counts today as available or as done, and every downstream quota
// recomputes from the new remaining-days count.

import {
  addDays,
  endOfMonth,
  endOfWeek,
  isAfter,
  isBefore,
  isWithinInterval,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  businessDaysInRange,
  fromISODate,
  isBusinessDay,
  sameDay,
  subtractBusinessDays,
  toISODate,
} from "./dates";
import {
  Client,
  DiaBloqueado,
  FlowStage,
  FlujoConfig,
  HORAS_POR_PIEZA,
  PieceType,
  RegistroTrabajo,
} from "./types";

/** How many business days before a delivery the pending pieces get batched
 * into, per PRODUCT.md: work is distributed in batches over 2-3 days before a
 * delivery, never all on the delivery day itself. */
const BATCH_DIAS = 3;

/** Fixed epoch "personalizado" periods tile from, so the same client always
 * lands on the same period boundaries across calls/days. */
const EPOCH_PERSONALIZADO = new Date(2024, 0, 1);

export interface StageWindow {
  etapa: FlowStage;
  inicio: Date;
  fin: Date;
}

export interface CicloInstancia {
  clienteId: string;
  periodo: string;
  cierreObjetivo: Date;
  ventanas: StageWindow[];
  /** Production window per piece type — usually identical, but a client can pin
   * reels to N days after recording instead of the general producción window. */
  produccionPorTipo: Record<PieceType, StageWindow>;
}

export interface TareaHoy {
  clienteId: string;
  clienteNombre: string;
  etapa: FlowStage;
  piezaTipo?: PieceType;
  cantidad?: number;
  horasEstimadas: number;
  urgente: boolean; // deadline is within 2 business days
  detalle: string;
}

export interface PlanDelDia {
  fecha: string;
  tareas: TareaHoy[];
  horasTotales: number;
  horasDisponibles: number;
  sobrecargado: boolean;
  clientesSinNovedad: string[]; // active clients with nothing due today — good news
}

function periodBoundsFor(
  cicloTipo: Client["flujo"]["cicloTipo"],
  anchor: Date,
  duracionPeriodoDias?: number,
) {
  if (cicloTipo === "semanal") {
    return {
      start: startOfWeek(anchor, { weekStartsOn: 1 }),
      end: endOfWeek(anchor, { weekStartsOn: 1 }),
    };
  }
  if (cicloTipo === "diario") {
    // Every day is its own period: today's delivery, produced today.
    return { start: anchor, end: anchor };
  }
  if (cicloTipo === "personalizado") {
    const dias = Math.max(duracionPeriodoDias ?? 30, 1);
    const daysSinceEpoch = Math.floor(
      (anchor.getTime() - EPOCH_PERSONALIZADO.getTime()) / (24 * 60 * 60 * 1000),
    );
    const periodIndex = Math.floor(daysSinceEpoch / dias);
    const start = addDays(EPOCH_PERSONALIZADO, periodIndex * dias);
    const end = addDays(start, dias - 1);
    return { start, end };
  }
  return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
}

/** How far ahead to anchor the search for the "next" cycle instance, per cycle
 * type — enough to land inside the following period no matter where in the
 * current one `today` falls. */
function nextPeriodAnchorOffsetDias(flujo: FlujoConfig): number {
  switch (flujo.cicloTipo) {
    case "semanal":
      return 7;
    case "diario":
      return 1;
    case "personalizado":
      return Math.max(flujo.duracionPeriodoDias ?? 30, 1);
    default:
      return 32; // any day past a month's max length guarantees landing in the next month
  }
}

/** Build the backward-chained stage windows for one client's cycle targeting the
 * period that ends at `periodEnd`. `blocked` should already be filtered to this
 * client's blocked dates. */
export function computeCicloInstancia(
  client: Client,
  periodEnd: Date,
  periodo: string,
  blocked: Set<string>,
): CicloInstancia {
  const { flujo } = client;
  const nextPeriodStart = addDays(periodEnd, 1);
  const cierreObjetivo = subtractBusinessDays(
    nextPeriodStart,
    flujo.diasMargenCierre,
    blocked,
  );

  const ventanas: StageWindow[] = [];

  // `cursor` is an EXCLUSIVE upper bound: the first business day that must stay
  // free for the stage already placed after it. Each stage's own fin is one
  // business day before the cursor, never the same day — otherwise a stage
  // (e.g. grabación) would silently overlap the one that follows it (e.g.
  // producción), defeating "los días de grabación no se puede editar."
  let cursor = addDays(cierreObjetivo, 1);

  function placeStage(etapa: FlowStage, duracionDias: number): StageWindow {
    const duracion = Math.max(duracionDias, 1);
    const fin = subtractBusinessDays(cursor, 1, blocked);
    const inicio = subtractBusinessDays(cursor, duracion, blocked);
    const window: StageWindow = { etapa, inicio, fin };
    ventanas.push(window);
    cursor = inicio;
    return window;
  }

  placeStage("programacion", 1);
  placeStage("ajustes", flujo.diasAjustes);
  placeStage("correccion", flujo.diasCorreccion);
  placeStage("presentacion", 1);
  const produccionGeneral = placeStage("produccion", flujo.diasProduccion);

  let grabacionWindow: StageWindow | undefined;
  if (flujo.tieneGrabacion) {
    grabacionWindow = placeStage("grabacion", 1 + (flujo.diasViajeGrabacion ?? 0));
  }

  if (flujo.mandaCalendario) {
    placeStage("aprobacion", flujo.diasAprobacion);
    placeStage("calendario", 2);
  }

  ventanas.sort((a, b) => a.inicio.getTime() - b.inicio.getTime());

  const produccionPorTipo: Record<PieceType, StageWindow> = {
    historia: produccionGeneral,
    posteo: produccionGeneral,
    reel: produccionGeneral,
  };

  if (flujo.diasEntregaPostGrabacion != null && grabacionWindow) {
    const reelDeadline = businessDaysInRange(
      grabacionWindow.fin,
      addDays(grabacionWindow.fin, flujo.diasEntregaPostGrabacion * 2),
      blocked,
    )[flujo.diasEntregaPostGrabacion - 1];
    if (reelDeadline) {
      produccionPorTipo.reel = { etapa: "produccion", inicio: grabacionWindow.fin, fin: reelDeadline };
    }
  }

  return { clienteId: client.id, periodo, cierreObjetivo, ventanas, produccionPorTipo };
}

/** Pick which cycle instance (this period's or next's) is the one currently "in
 * flight" for `today` — i.e. today falls inside its working window. Falls back
 * to whichever starts soonest if none currently contains today. */
export function activeCicloInstancia(
  client: Client,
  today: Date,
  blockedForClient: Set<string>,
): CicloInstancia | null {
  if (client.flujo.cicloTipo === "solo-ads") return null;

  const candidates: CicloInstancia[] = [];
  const nextOffset = nextPeriodAnchorOffsetDias(client.flujo);
  for (const offset of [0, 1]) {
    const anchor = addDays(today, offset === 1 ? nextOffset : 0);
    const { end } = periodBoundsFor(client.flujo.cicloTipo, anchor, client.flujo.duracionPeriodoDias);
    // The cycle that closes by `end` produces content FOR the period right
    // after `end` (the anticipation rule: next month's calendar starts while
    // this month's content is still running) — label it by that target period,
    // not by the period whose tail end it's racing against.
    const periodo = toISODate(addDays(end, 1)).slice(0, 7);
    candidates.push(computeCicloInstancia(client, end, periodo, blockedForClient));
  }

  const containing = candidates.find((c) => {
    const first = c.ventanas[0];
    const last = c.ventanas[c.ventanas.length - 1];
    return first && last && !isBefore(today, first.inicio) && !isAfter(today, last.fin);
  });
  if (containing) return containing;

  // Nothing currently contains today (e.g. mid-publication lull) — surface the
  // soonest upcoming one so overdue/near cycles still show up.
  return candidates.sort((a, b) => a.cierreObjetivo.getTime() - b.cierreObjetivo.getTime())[0] ?? null;
}

/** Pending = required minus what's already logged WITHIN this cycle's own
 * produccion window. Scoping by window (not all-time) is what makes the quota
 * reset from one period to the next — otherwise a client who finished this
 * month's pieces would show zero pending forever. */
function remainingQuantity(
  clienteId: string,
  etapa: FlowStage,
  piezaTipo: PieceType | undefined,
  requerido: number,
  workLog: RegistroTrabajo[],
  window: StageWindow,
): number {
  const inicioISO = toISODate(window.inicio);
  const finISO = toISODate(window.fin);
  const hecho = workLog
    .filter(
      (r) =>
        r.clienteId === clienteId &&
        r.etapa === etapa &&
        (piezaTipo ? r.piezaTipo === piezaTipo : true) &&
        r.fecha >= inicioISO &&
        r.fecha <= finISO,
    )
    .reduce((sum, r) => sum + r.cantidad, 0);
  return Math.max(requerido - hecho, 0);
}

/** Today's per-piece-type quota: pending pieces batched into the last
 * BATCH_DIAS business days of the producción window (never spread across the
 * whole window, never dumped all on the delivery day) — per PRODUCT.md's "el
 * trabajo se distribuye en tandas sobre los 2-3 días antes de la entrega."
 * Returns 0 outside the window, before the batch starts, or once nothing
 * remains. */
function quotaForToday(
  window: StageWindow,
  today: Date,
  requerido: number,
  clienteId: string,
  piezaTipo: PieceType,
  workLog: RegistroTrabajo[],
  blocked: Set<string>,
): number {
  if (isBefore(today, window.inicio) || isAfter(today, window.fin)) return 0;
  if (!isBusinessDay(today, blocked)) return 0;

  const pendiente = remainingQuantity(clienteId, "produccion", piezaTipo, requerido, workLog, window);
  if (pendiente <= 0) return 0;

  const diasHabilesVentana = businessDaysInRange(window.inicio, window.fin, blocked);
  const diasTanda = diasHabilesVentana.slice(-BATCH_DIAS);
  if (diasTanda.length === 0) return pendiente;

  const indiceHoy = diasTanda.findIndex((d) => sameDay(d, today));
  if (indiceHoy === -1) return 0; // today is inside the window but before the batch starts

  const diasRestantesTanda = diasTanda.length - indiceHoy;
  return Math.ceil(pendiente / diasRestantesTanda);
}

const STAGE_LABEL: Record<FlowStage, string> = {
  calendario: "Armar calendario de ideas",
  aprobacion: "Esperando aprobación del cliente",
  grabacion: "Día de grabación",
  produccion: "Producción",
  presentacion: "Presentar al cliente",
  correccion: "Corrección del cliente",
  ajustes: "Hacer ajustes",
  programacion: "Programar y publicar",
};

const PIECE_LABEL: Record<PieceType, string> = {
  historia: "historias",
  posteo: "posteos",
  reel: "reels",
};

const PIECE_LABEL_SINGULAR: Record<PieceType, string> = {
  historia: "historia",
  posteo: "posteo",
  reel: "reel",
};

function piezaLabel(tipo: PieceType, cantidad: number): string {
  return cantidad === 1 ? PIECE_LABEL_SINGULAR[tipo] : PIECE_LABEL[tipo];
}

export function computePlanDelDia(params: {
  clients: Client[];
  today: Date;
  blockedDates: DiaBloqueado[];
  workLog: RegistroTrabajo[];
  horasDisponiblesHoy: number;
}): PlanDelDia {
  const { clients, today, blockedDates, workLog, horasDisponiblesHoy } = params;
  const tareas: TareaHoy[] = [];
  const clientesSinNovedad: string[] = [];
  const todayISO = toISODate(today);

  for (const client of clients.filter((c) => c.activo)) {
    const blockedForClient = new Set(
      blockedDates.filter((b) => b.clienteId === client.id).map((b) => b.fecha),
    );
    const ciclo = activeCicloInstancia(client, today, blockedForClient);
    if (!ciclo) continue;

    let clienteTuvoTarea = false;

    // Production quota per piece type.
    (Object.keys(PIECE_LABEL) as PieceType[]).forEach((tipo) => {
      const requerido = client.volumenMensual[`${tipo}s` as keyof Client["volumenMensual"]] as number;
      if (!requerido) return;
      const window = ciclo.produccionPorTipo[tipo];
      const cantidad = quotaForToday(
        window,
        today,
        requerido,
        client.id,
        tipo,
        workLog,
        blockedForClient,
      );
      if (cantidad > 0) {
        clienteTuvoTarea = true;
        const diasRestantes = businessDaysInRange(today, window.fin, blockedForClient).length;
        tareas.push({
          clienteId: client.id,
          clienteNombre: client.nombre,
          etapa: "produccion",
          piezaTipo: tipo,
          cantidad,
          horasEstimadas: cantidad * HORAS_POR_PIEZA[tipo],
          urgente: diasRestantes <= 2,
          detalle: `${cantidad} ${piezaLabel(tipo, cantidad)} — entrega ${diasRestantes <= 1 ? "mañana" : `en ${diasRestantes} días hábiles`}`,
        });
      }
    });

    // Single-day stage milestones landing today (grabación, presentación, programación, calendario).
    for (const ventana of ciclo.ventanas) {
      if (ventana.etapa === "produccion") continue;
      const isSingleDayStage = ["grabacion", "presentacion", "programacion"].includes(ventana.etapa);
      const landsToday =
        (isSingleDayStage && toISODate(ventana.inicio) === todayISO) ||
        (ventana.etapa === "calendario" && toISODate(ventana.fin) === todayISO);
      if (!landsToday) continue;

      clienteTuvoTarea = true;
      const diasRestantesCierre = businessDaysInRange(today, ciclo.cierreObjetivo, blockedForClient).length;
      tareas.push({
        clienteId: client.id,
        clienteNombre: client.nombre,
        etapa: ventana.etapa,
        horasEstimadas: ventana.etapa === "grabacion" ? 3 : 0.5,
        urgente: diasRestantesCierre <= 2,
        detalle: STAGE_LABEL[ventana.etapa],
      });
    }

    if (!clienteTuvoTarea) clientesSinNovedad.push(client.nombre);
  }

  tareas.sort((a, b) => Number(b.urgente) - Number(a.urgente));

  const horasTotales = tareas.reduce((sum, t) => sum + t.horasEstimadas, 0);

  return {
    fecha: todayISO,
    tareas,
    horasTotales: Math.round(horasTotales * 100) / 100,
    horasDisponibles: horasDisponiblesHoy,
    sobrecargado: horasTotales > horasDisponiblesHoy,
    clientesSinNovedad,
  };
}

/** Simulator: given a hypothetical client's shape, estimate weekly hours it would
 * add so Paula can tell if it fits before accepting the client. */
export function simularCarga(input: {
  volumenMensual: Client["volumenMensual"];
  diasProduccion: number;
}): { horasTotales: number; horasPorSemana: number } {
  const { volumenMensual, diasProduccion } = input;
  const horasTotales =
    volumenMensual.historias * HORAS_POR_PIEZA.historia +
    volumenMensual.posteos * HORAS_POR_PIEZA.posteo +
    volumenMensual.reels * HORAS_POR_PIEZA.reel;
  const semanas = Math.max(diasProduccion / 5, 1);
  return {
    horasTotales: Math.round(horasTotales * 100) / 100,
    horasPorSemana: Math.round((horasTotales / semanas) * 100) / 100,
  };
}

export { isWithinInterval, fromISODate };
