"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { addDays, format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  FileText,
  Moon,
  PackageCheck,
  Presentation,
  Settings,
  Video,
  Wallet,
} from "lucide-react";
import {
  TareaHecha,
  ensureSettings,
  guardarChequeoAds,
  marcarFijo,
  posponerUnidades,
  quitarChequeoAds,
  quitarPospuesta,
  useAdsChequeos,
  useFijosHechos,
  useTareasHechas,
} from "@/lib/supabase/data";
import { usePlan } from "@/lib/supabase/use-plan";
import { useAvisos } from "@/lib/supabase/use-avisos";
import { Asignacion, fmtPiezas, sugerirAdelanto } from "@/lib/domain/planner";
import { ItemHoy, armarHoy } from "@/lib/domain/hoy";
import { completarUnidad, deshacerHecha, sePuedeTildar } from "@/lib/domain/completar";
import { fechaCorta, fromISODate, toISODate } from "@/lib/domain/dates";
import { cobrosVencidos } from "@/lib/domain/cobros";
import { reportesDelMes } from "@/lib/domain/ads";
import { colorCliente } from "@/lib/domain/calendario";
import { Client, topeDelDia } from "@/lib/domain/types";
import { DisruptionSheet } from "@/components/disruption-sheet";
import { Cargando, EmptyState } from "@/components/empty-state";
import { Encabezado } from "@/components/encabezado";
import { Inki } from "@/components/inki";
import { FilaDeslizable } from "@/components/fila-deslizable";
import { AvisoDeshacer, AvisoDeshacerToast } from "@/components/aviso-deshacer";
import { MensajesPendientes } from "@/components/mensajes-pendientes";
import { BotonPrimario, Sheet } from "@/components/sheet";
import { Tilde } from "@/components/tilde";
import { cn, indice } from "@/lib/utils";

const fechaLarga = (iso: string) => format(fromISODate(iso), "EEE d MMM", { locale: es });

function saludo(d: Date) {
  const h = d.getHours();
  return h < 6 ? "Buenas noches" : h < 13 ? "Buen día" : h < 20 ? "Buenas tardes" : "Buenas noches";
}

export default function HoyPage() {
  const today = useMemo(() => new Date(), []);
  const todayISO = toISODate(today);
  const mananaISO = toISODate(addDays(today, 1));
  const [cambioAbierto, setCambioAbierto] = useState(false);
  const [cierreAbierto, setCierreAbierto] = useState(false);
  const [avisosAbiertos, setAvisosAbiertos] = useState(false);
  const [adelantarAbierto, setAdelantarAbierto] = useState(false);
  const [locales, setLocales] = useState<Set<string>>(new Set());
  const [aviso, setAviso] = useState<AvisoDeshacer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const avisoId = useRef(0);

  const ctx = usePlan();
  const fijosHechos = useFijosHechos(todayISO);
  const registros = useTareasHechas(todayISO);
  const chequeos = useAdsChequeos();
  const { alertas, mensajes } = useAvisos(ctx);

  useEffect(() => {
    ensureSettings();
  }, []);

  const cerrarAviso = useCallback(() => setAviso(null), []);
  const mostrarAviso = useCallback((texto: string, deshacer: () => void) => {
    avisoId.current += 1;
    setAviso({ id: avisoId.current, texto, deshacer });
  }, []);

  if (!ctx) {
    return <Cargando />;
  }
  const { plan, clients, piezas, grabaciones, estructura } = ctx;

  const carga = plan.cargaPorDia[todayISO];
  const hoy = armarHoy({
    plan,
    hoyISO: todayISO,
    clients,
    fijos: estructura.fijosDiarios ?? [],
    fijosHechos: fijosHechos ?? new Set(),
    chequeos: chequeos ?? [],
    registros: registros ?? [],
    locales,
  });
  const capacidad = carga?.capacidad ?? 0;
  const pct = hoy.total === 0 ? 0 : Math.round((hoy.hechas / hoy.total) * 100);
  const completo = hoy.total > 0 && hoy.hechas === hoy.total;

  // A day's worth of upcoming work, in case today goes faster than planned.
  const adelantar = sugerirAdelanto(plan, todayISO, Math.max(capacidad, topeDelDia(estructura, today.getDay()))).filter(
    (a) => !(registros ?? []).some((r) => r.unidadId === a.unidad.id),
  );
  const hitosHoy = plan.hitos.filter((h) => h.fecha === todayISO);
  const proximas = plan.asignaciones.filter((a) => a.fecha > todayISO);
  const hayDatos = clients.some((c) => c.activo);
  const nombres = new Map(clients.map((c) => [c.id, c.nombre]));

  const vencidos = cobrosVencidos(ctx.cobros, clients, today).length;
  const reportesAtrasados = reportesDelMes(clients, ctx.reportes, today).filter((r) => r.atrasado).length;
  const correrEntrega = mensajes.filter((m) => m.tipo === "correr-entrega");
  const hayPendiente = hoy.atrasadas.length > 0 || vencidos > 0 || reportesAtrasados > 0;

  const motivoBloqueo =
    carga?.bloqueo === "grabacion"
      ? "Hoy es día de grabación: el día entero queda bloqueado."
      : carga?.bloqueo === "viaje"
        ? "Hoy es día de viaje: no hay lugar para producir."
        : carga?.bloqueo === "no-trabajo"
          ? "Hoy marcaste que no trabajás."
          : carga?.bloqueo === "libre-semana"
            ? "Hoy es un día libre en tu semana."
            : null;

  async function seguro(accion: () => Promise<unknown>) {
    setError(null);
    try {
      await accion();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar. Probá de nuevo.");
    }
  }

  function quitarLocal(id: string) {
    setLocales((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function tildar(a: Asignacion) {
    const id = a.unidad.id;
    setLocales((prev) => new Set(prev).add(id));
    void seguro(async () => {
      try {
        const hecha = await completarUnidad(a.unidad, { piezas, clients });
        mostrarAviso(`Hecha: ${a.unidad.etiqueta}`, () => {
          quitarLocal(id);
          void seguro(() => deshacerHecha(hecha));
        });
      } catch (e) {
        quitarLocal(id);
        throw e;
      }
    });
  }

  function pasarAManana(a: Asignacion) {
    const id = a.unidad.id;
    void seguro(async () => {
      await posponerUnidades([id], mananaISO);
      mostrarAviso(`Pasada a mañana: ${a.unidad.etiqueta}`, () => void seguro(() => quitarPospuesta(id)));
    });
  }

  function destildar(r: TareaHecha) {
    quitarLocal(r.unidadId);
    void seguro(() => deshacerHecha(r));
  }

  const filaDe = (item: ItemHoy): React.ReactNode => {
    switch (item.tipo) {
      case "unidad": {
        const a = item.asignacion;
        return (
          <FilaHoy
            hecha={item.hecha}
            titulo={a.unidad.etiqueta}
            cliente={clienteDe(clients, a.unidad.clienteId)}
            detalle={<DetalleUnidad a={a} hoyISO={todayISO} />}
            onTildar={() => tildar(a)}
            onManana={() => pasarAManana(a)}
          />
        );
      }
      case "registro": {
        const r = item.registro;
        return (
          <FilaHoy
            hecha
            titulo={r.etiqueta}
            cliente={clienteDe(clients, r.clienteId)}
            onTildar={() => undefined}
            onDeshacer={() => destildar(r)}
          />
        );
      }
      case "ads": {
        const estado = (chequeos ?? []).find((c) => c.fecha === todayISO && c.clienteId === item.cliente.id)?.estado;
        return (
          <FilaHoy
            hecha={item.hecha}
            titulo="Chequeo de Ads"
            cliente={clienteDe(clients, item.cliente.id)}
            detalle={
              estado === "revisar" ? (
                <span className="rounded-[8px] bg-acento/35 px-1.5 py-0.5 font-medium text-acento-texto">
                  marcado para revisar
                </span>
              ) : undefined
            }
            onTildar={() => void seguro(() => guardarChequeoAds(item.cliente.id, todayISO, "ok"))}
            onDeshacer={() => void seguro(() => quitarChequeoAds(item.cliente.id, todayISO))}
          />
        );
      }
      case "fijo":
        return (
          <FilaHoy
            hecha={item.hecha}
            titulo={item.fijo.nombre}
            detalle={<span>Fijo de todos los días</span>}
            onTildar={() => void seguro(() => marcarFijo(todayISO, item.fijo.id, true))}
            onDeshacer={() => void seguro(() => marcarFijo(todayISO, item.fijo.id, false))}
          />
        );
    }
  };

  return (
    <div className="mx-auto max-w-[640px] px-4 pt-2 lg:max-w-[760px] lg:px-8 lg:pt-4">
      <Inki />
      <Encabezado
        grande
        arriba={format(today, "EEEE d 'de' MMMM", { locale: es })}
        titulo={saludo(today)}
        derecha={
          <Link
            href="/ajustes"
            aria-label="Ajustes"
            className="tocable rounded-full p-2 text-texto-secundario hover:bg-borde/50 lg:hidden"
          >
            <Settings size={20} strokeWidth={1.75} />
          </Link>
        }
      />

      {alertas.length > 0 && (
        <section className="entra mb-4" style={indice(1)}>
          <button
            onClick={() => setAvisosAbiertos((v) => !v)}
            aria-expanded={avisosAbiertos}
            className="tocable papel flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[0.9375rem]"
          >
            <AlertTriangle size={16} className="shrink-0 text-ambar" />
            <span className="shrink-0 font-semibold">
              {alertas.length === 1 ? "1 aviso" : `${alertas.length} avisos`}
            </span>
            {!avisosAbiertos && <span className="min-w-0 flex-1 truncate text-texto-secundario">{alertas[0].mensaje}</span>}
            <ChevronDown
              size={16}
              className={cn(
                "ml-auto shrink-0 text-texto-secundario transition-transform duration-300",
                avisosAbiertos && "rotate-180",
              )}
            />
          </button>
          {avisosAbiertos && (
            <ul className="mt-2 flex flex-col gap-1.5">
              {alertas.slice(0, 6).map((a, i) => (
                <li key={a.id} className="desliza" style={indice(i)}>
                  {a.href ? (
                    <Link href={a.href} className="tocable block rounded-[12px] bg-ambar/10 px-4 py-2.5 text-[0.9375rem]">
                      {a.mensaje}
                    </Link>
                  ) : (
                    <p className="rounded-[12px] bg-ambar/10 px-4 py-2.5 text-[0.9375rem]">{a.mensaje}</p>
                  )}
                </li>
              ))}
              {alertas.length > 6 && (
                <li className="px-1 text-[0.8125rem] text-texto-secundario">
                  y {alertas.length - 6} más en la campanita
                </li>
              )}
            </ul>
          )}
        </section>
      )}

      <section className="destacado entra mb-5 px-5 pb-5 pt-4" style={indice(2)}>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[0.8125rem] font-medium text-sobre-oscuro/70">Lo de hoy</p>
            {hoy.total === 0 ? (
              <p className="titulo text-[1.5rem] leading-tight">Nada por hacer</p>
            ) : (
              <p key={hoy.hechas} className="numeros pop titulo text-[2rem] leading-tight">
                {hoy.hechas}
                <span className="text-[1.125rem] font-medium text-sobre-oscuro/70"> de {hoy.total} hechas</span>
              </p>
            )}
          </div>
          {hoy.total > 0 && (
            <p className="numeros titulo text-[1.25rem] text-acento">{completo ? "¡Listo!" : `${pct}%`}</p>
          )}
        </div>
        <div
          className="barra mt-3.5"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={hoy.total}
          aria-valuenow={hoy.hechas}
          aria-label="Avance del día"
        >
          <div className="barra-relleno" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2.5 text-[0.8125rem] text-sobre-oscuro/70">
          {capacidad > 0
            ? `Tope de hoy: ${fmtPiezas(capacidad)} ${capacidad === 1 ? "pieza" : "piezas"}` +
              (carga?.semaforo === "sobrecargado" ? " · te pasás, empezá por lo de arriba" : "")
            : "Hoy no hay piezas en el plan"}
        </p>
      </section>

      {error && <p className="mb-3 text-center text-[0.8125rem] text-[var(--color-error)]">{error}</p>}

      {motivoBloqueo && (
        <p className="papel entra mb-5 px-4 py-3 text-center text-[0.9375rem] text-texto-secundario">{motivoBloqueo}</p>
      )}

      {hitosHoy.length > 0 && (
        <ul className="entra mb-5 flex flex-wrap justify-center gap-2" style={indice(3)}>
          {hitosHoy.map((h, i) => {
            const Icon = h.tipo === "grabacion" ? Video : h.tipo === "presentacion" ? Presentation : PackageCheck;
            return (
              <li
                key={`${h.tipo}-${h.clienteId}-${i}`}
                className="flex items-center gap-2 rounded-full bg-acento/25 py-1.5 pl-2.5 pr-3.5 text-[0.875rem] font-medium"
              >
                <Icon size={15} className="text-acento-texto" />
                {h.detalle}
              </li>
            );
          })}
        </ul>
      )}

      {hoy.items.length === 0 ? (
        <EmptyState
          sol={hayDatos}
          title={hayDatos ? "Vas bien — nada para producir hoy" : "Todavía no hay clientes cargados"}
          detail={
            hayDatos
              ? "No hay nada pendiente para hoy. Si te sobra tiempo, abajo tenés qué adelantar."
              : "Agregá tu primer cliente para que la app arme el plan."
          }
        />
      ) : (
        <section className="entra" style={indice(4)}>
          <ul className="papel flex flex-col divide-y divide-borde/70 p-1.5">
            {hoy.items.map((item, i) => (
              <li key={item.clave} className="desliza" style={indice(i)}>
                {filaDe(item)}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-center text-[0.75rem] text-texto-secundario">
            Deslizá a la derecha para tildar, a la izquierda para pasarla a mañana.
          </p>
        </section>
      )}

      {hayPendiente && (
        <section className="entra mt-8" style={indice(5)}>
          <h2 className="titulo mb-0.5 text-center text-[1.125rem]">Pendiente y atrasado</h2>
          <p className="mb-3 text-center text-[0.8125rem] text-texto-secundario">
            Lo que no entra hoy o se pasó de fecha.
          </p>

          {correrEntrega.length > 0 && (
            <div className="mb-3">
              <p className="mb-1.5 text-[0.8125rem] font-medium text-texto-secundario">
                Hay más urgente de lo que entra: conviene avisar y correr la entrega
              </p>
              <MensajesPendientes mensajes={correrEntrega} />
            </div>
          )}

          {hoy.atrasadas.length > 0 && (
            <ul className="papel flex flex-col divide-y divide-borde/70 p-1.5">
              {hoy.atrasadas.map((a, i) => (
                <li key={a.unidad.id} className="desliza" style={indice(i)}>
                  <FilaHoy
                    hecha={locales.has(a.unidad.id)}
                    titulo={a.unidad.etiqueta}
                    cliente={clienteDe(clients, a.unidad.clienteId)}
                    detalle={<DetalleUnidad a={a} hoyISO={todayISO} />}
                    onTildar={() => tildar(a)}
                    onManana={() => pasarAManana(a)}
                  />
                </li>
              ))}
            </ul>
          )}

          {(vencidos > 0 || reportesAtrasados > 0) && (
            <ul className="mt-3 flex flex-col gap-2">
              {vencidos > 0 && (
                <li>
                  <Link
                    href="/plata"
                    className="tocable papel flex items-center gap-3 px-4 py-3 text-[0.9375rem] font-medium"
                  >
                    <Wallet size={18} className="text-acento-texto" />
                    {vencidos === 1 ? "1 cobro vencido" : `${vencidos} cobros vencidos`}
                    <ArrowRight size={16} className="ml-auto text-texto-secundario" />
                  </Link>
                </li>
              )}
              {reportesAtrasados > 0 && (
                <li>
                  <Link
                    href="/ads"
                    className="tocable papel flex items-center gap-3 px-4 py-3 text-[0.9375rem] font-medium"
                  >
                    <FileText size={18} className="text-acento-texto" />
                    {reportesAtrasados === 1 ? "1 reporte de Ads atrasado" : `${reportesAtrasados} reportes de Ads atrasados`}
                    <ArrowRight size={16} className="ml-auto text-texto-secundario" />
                  </Link>
                </li>
              )}
            </ul>
          )}
        </section>
      )}

      {adelantar.length > 0 && (
        <section className="mt-8">
          <button
            onClick={() => setAdelantarAbierto((v) => !v)}
            aria-expanded={adelantarAbierto}
            className="tocable flex w-full items-center justify-center gap-2 rounded-[14px] px-3 py-2.5 text-[0.9375rem] font-medium text-texto-secundario hover:bg-borde/40"
          >
            Si me sobra tiempo
            <span className="numeros rounded-full bg-borde/70 px-2 py-0.5 text-[0.75rem]">{adelantar.length}</span>
            <ChevronDown
              size={16}
              className={cn("transition-transform duration-300", adelantarAbierto && "rotate-180")}
            />
          </button>
          {adelantarAbierto && (
            <div className="mt-2">
              <p className="mb-2 text-center text-[0.8125rem] text-texto-secundario">
                Lo próximo del plan que ya podés adelantar.
              </p>
              <ul className="papel flex flex-col divide-y divide-borde/70 p-1.5">
                {adelantar.map((a, i) => (
                  <li key={a.unidad.id} className="desliza" style={indice(i)}>
                    <FilaHoy
                      hecha={locales.has(a.unidad.id)}
                      titulo={a.unidad.etiqueta}
                      cliente={clienteDe(clients, a.unidad.clienteId)}
                      detalle={<DetalleUnidad a={a} hoyISO={todayISO} />}
                      onTildar={() => tildar(a)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <div className="mt-8 flex flex-col gap-2.5">
        <button
          onClick={() => setCierreAbierto(true)}
          className="boton-primario tocable flex w-full items-center justify-center gap-2 rounded-[16px] px-5 py-3.5 font-medium"
        >
          <Moon size={18} strokeWidth={2} /> Cerrar el día
        </button>
        <button
          onClick={() => setCambioAbierto(true)}
          className="tocable w-full rounded-[16px] border border-borde bg-bg-elevada/60 px-5 py-3 text-center text-[0.9375rem] font-medium text-texto hover:bg-bg-elevada"
        >
          Algo cambió
        </button>
      </div>

      <CerrarDia
        open={cierreAbierto}
        onClose={() => setCierreAbierto(false)}
        hechas={hoy.hechas}
        total={hoy.total}
        pendientes={hoy.items.flatMap((i) => (i.tipo === "unidad" && !i.hecha ? [i.asignacion] : []))}
        sinPasar={hoy.items.filter((i) => (i.tipo === "ads" || i.tipo === "fijo") && !i.hecha).length}
        nombres={nombres}
        mananaISO={mananaISO}
      />

      <DisruptionSheet
        open={cambioAbierto}
        onClose={() => setCambioAbierto(false)}
        clients={clients.filter((c) => c.activo)}
        today={todayISO}
        tareasHoy={plan.asignaciones.filter((a) => a.fecha === todayISO)}
        tareasProximas={proximas.filter((a) => sePuedeTildar(a.unidad))}
        grabacionesPendientes={grabaciones.filter((g) => !g.hecha)}
      />

      <AvisoDeshacerToast aviso={aviso} onCerrar={cerrarAviso} />
    </div>
  );
}

function clienteDe(clients: Client[], id?: string) {
  const c = clients.find((x) => x.id === id);
  return c ? { nombre: c.nombre, color: colorCliente(clients, c.id) } : undefined;
}

function DetalleUnidad({ a, hoyISO }: { a: Asignacion; hoyISO: string }) {
  const { unidad, atrasada, enMargen } = a;
  return (
    <>
      {unidad.limite && (
        <span>
          {unidad.tipo === "edicion" ? "entrega" : unidad.tipo === "guion" ? "antes de grabar, el" : "para el"}{" "}
          {fechaCorta(unidad.limite)}
        </span>
      )}
      {a.fecha !== hoyISO && <span>· planeada {fechaLarga(a.fecha)}</span>}
      {atrasada && (
        <span className="rounded-[8px] bg-acento/35 px-1.5 py-0.5 font-medium text-acento-texto">atrasada</span>
      )}
      {enMargen && <span className="rounded-[8px] bg-ambar/15 px-1.5 py-0.5 font-medium text-ambar">usa el margen</span>}
      {unidad.provisoria && (
        <span className="rounded-[8px] bg-borde/60 px-1.5 py-0.5 font-medium">provisoria: falta grabar</span>
      )}
    </>
  );
}

/** One line of the day: tick, what it is, whose it is, and the slide-to-act. */
function FilaHoy({
  hecha,
  titulo,
  cliente,
  detalle,
  onTildar,
  onDeshacer,
  onManana,
}: {
  hecha: boolean;
  titulo: string;
  cliente?: { nombre: string; color: string };
  detalle?: React.ReactNode;
  onTildar: () => void;
  onDeshacer?: () => void;
  onManana?: () => void;
}) {
  return (
    <FilaDeslizable onHecha={hecha ? undefined : onTildar} onManana={hecha ? undefined : onManana}>
      <div className={cn("flex items-start gap-3 px-2.5 py-3 transition-opacity", hecha && "opacity-55")}>
        <div className="pt-0.5">
          <Tilde hecha={hecha} onTildar={onTildar} onDeshacer={onDeshacer} />
        </div>
        <div className="min-w-0 flex-1">
          {cliente && (
            <p className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-texto-secundario">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: cliente.color }} aria-hidden />
              <span className="truncate">{cliente.nombre}</span>
            </p>
          )}
          <p className={cn("text-[1rem] font-medium leading-snug", hecha && "line-through decoration-texto-secundario/50")}>
            {titulo}
          </p>
          {detalle && (
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] text-texto-secundario">
              {detalle}
            </p>
          )}
        </div>
        {onManana && !hecha && (
          <button
            onClick={onManana}
            aria-label="Pasar a mañana"
            title="Pasar a mañana"
            className="tocable hidden shrink-0 rounded-full p-2 text-texto-secundario hover:bg-borde/50 lg:block"
          >
            <ArrowRight size={16} />
          </button>
        )}
      </div>
    </FilaDeslizable>
  );
}

/** "Cerrar el día": how far she got, and what didn't get done moves to tomorrow by itself. */
function CerrarDia({
  open,
  onClose,
  hechas,
  total,
  pendientes,
  sinPasar,
  nombres,
  mananaISO,
}: {
  open: boolean;
  onClose: () => void;
  hechas: number;
  total: number;
  pendientes: Asignacion[];
  /** Fixed routines and Ads checks left undone: they are daily, so they don't move. */
  sinPasar: number;
  nombres: Map<string, string>;
  mananaISO: string;
}) {
  const [cerrado, setCerrado] = useState<{ hechas: number; total: number; pasadas: number } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pct = total === 0 ? 0 : Math.round((hechas / total) * 100);

  function salir() {
    onClose();
    setCerrado(null);
    setError(null);
  }

  async function cerrar() {
    setGuardando(true);
    setError(null);
    try {
      await posponerUnidades(
        pendientes.map((a) => a.unidad.id),
        mananaISO,
      );
      setCerrado({ hechas, total, pasadas: pendientes.length });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cerrar el día. Probá de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Sheet open={open} title="Cerrar el día" onClose={salir}>
      {cerrado ? (
        <div className="flex flex-col items-center pt-2 text-center">
          <span className="pop mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-acento/40 text-acento-texto">
            <Moon size={24} strokeWidth={2} />
          </span>
          <p className="titulo text-[1.25rem]">Día cerrado</p>
          <p className="entra mb-5 mt-1 max-w-[34ch] text-[0.9375rem] text-texto-secundario" style={indice(2)}>
            Avanzaste {cerrado.hechas} de {cerrado.total}.
            {cerrado.pasadas > 0
              ? ` ${cerrado.pasadas === 1 ? "La que quedó pasa" : `Las ${cerrado.pasadas} que quedaron pasan`} a mañana y el plan se reacomodó.`
              : " No quedó nada pendiente."}
          </p>
          <BotonPrimario onClick={salir}>Listo</BotonPrimario>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="destacado px-5 pb-5 pt-4">
            <p className="numeros titulo text-[2rem] leading-tight">
              {hechas}
              <span className="text-[1.125rem] font-medium text-sobre-oscuro/70"> de {total} hechas</span>
            </p>
            <div className="barra mt-3">
              <div className="barra-relleno" style={{ width: `${pct}%` }} />
            </div>
          </div>
          {pendientes.length > 0 ? (
            <div>
              <p className="mb-1.5 text-[0.9375rem] font-medium">
                {pendientes.length === 1 ? "Esta pasa a mañana:" : `Estas ${pendientes.length} pasan a mañana:`}
              </p>
              <ul className="flex flex-col gap-1 rounded-[14px] bg-bg-hundida px-4 py-3 text-[0.9375rem]">
                {pendientes.map((a) => (
                  <li key={a.unidad.id}>
                    {a.unidad.clienteId && nombres.get(a.unidad.clienteId) ? (
                      <span className="text-texto-secundario">{nombres.get(a.unidad.clienteId)} · </span>
                    ) : null}
                    {a.unidad.etiqueta}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[0.8125rem] text-texto-secundario">
                Se acomodan en el próximo día que trabajes, sin tocar lo demás.
              </p>
            </div>
          ) : (
            <p className="text-[0.9375rem] text-texto-secundario">No queda nada pendiente de piezas. ¡Buen cierre!</p>
          )}
          {sinPasar > 0 && (
            <p className="text-[0.8125rem] text-texto-secundario">
              {sinPasar === 1 ? "Queda 1 fijo o chequeo" : `Quedan ${sinPasar} fijos o chequeos`} sin hacer: son de todos
              los días, mañana arrancan de nuevo.
            </p>
          )}
          {error && <p className="text-[0.8125rem] text-[var(--color-error)]">{error}</p>}
          <BotonPrimario onClick={cerrar} disabled={guardando}>
            {guardando ? "Cerrando..." : "Cerrar el día"}
          </BotonPrimario>
        </div>
      )}
    </Sheet>
  );
}
