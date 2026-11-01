"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { addDays, format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCheck,
  ChevronDown,
  Clapperboard,
  FileText,
  Flame,
  Megaphone,
  Moon,
  PackageCheck,
  Presentation,
  Repeat,
  Settings,
  Undo2,
  Video,
  Wallet,
} from "lucide-react";
import {
  TareaHecha,
  ensureSettings,
  guardarChequeoAds,
  marcarDiaCumplido,
  marcarFijo,
  posponerUnidades,
  quitarChequeoAds,
  quitarPospuesta,
  useAdsChequeos,
  useDiasCumplidos,
  useFijosHechos,
  useTareasHechas,
} from "@/lib/supabase/data";
import { useAvisos, usePlan } from "@/lib/supabase/use-plan";
import { Asignacion, sugerirAdelanto } from "@/lib/domain/planner";
import { ItemHoy, armarHoy, estadoDelDia, racha, resumenDelDia } from "@/lib/domain/hoy";
import { completarUnidad, deshacerHecha, sePuedeTildar } from "@/lib/domain/completar";
import { fechaCorta, fromISODate, toISODate } from "@/lib/domain/dates";
import { reportesDelMes } from "@/lib/domain/ads";
import { colorCliente } from "@/lib/domain/calendario";
import { Client, diasDeTrabajo, topeDelDia } from "@/lib/domain/types";
import { NOMBRE, bajadaDelDia, fraseDelAvance, saludo } from "@/lib/domain/voz";
import { DisruptionSheet } from "@/components/disruption-sheet";
import { Cargando, EmptyState } from "@/components/empty-state";
import { SemaforoPunto } from "@/components/entrega";
import type { Entrega } from "@/lib/domain/entregas";
import { Inki } from "@/components/inki";
import { Sello } from "@/components/sello";
import { FilaDeslizable } from "@/components/fila-deslizable";
import { AvisoDeshacer, AvisoDeshacerToast } from "@/components/aviso-deshacer";
import { MensajesPendientes } from "@/components/mensajes-pendientes";
import { BotonPrimario, Sheet } from "@/components/sheet";
import { Tilde } from "@/components/tilde";
import { cn, indice } from "@/lib/utils";

const fechaLarga = (iso: string) => format(fromISODate(iso), "EEE d MMM", { locale: es });

/** One white card per row, on the grey of its column. */
const TARJETA = "rounded-[16px] border border-borde/70 bg-bg-elevada shadow-[var(--shadow-papel)]";
/** The red edge on what is late. */
const URGENTE = "border-l-[3px] border-l-[var(--color-error)]";
const AVISOS_VISIBLES = 3;
const ENTREGAS_VISIBLES = 6;

/** Today's list split the way Paula works it: content first, then Ads, then her fixed routines. */
const GRUPOS_HOY = [
  { clave: "contenido", titulo: "Contenido", Icono: Clapperboard },
  { clave: "ads", titulo: "Ads", Icono: Megaphone },
  { clave: "fijos", titulo: "Fijos", Icono: Repeat },
] as const;

function grupoDe(item: ItemHoy): (typeof GRUPOS_HOY)[number]["clave"] {
  switch (item.tipo) {
    case "fijo":
      return "fijos";
    case "ads":
      return "ads";
    case "unidad":
      return item.asignacion.unidad.categoria === "ads" ? "ads" : "contenido";
    case "registro":
      return item.registro.tipo.startsWith("ads") ? "ads" : "contenido";
  }
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
  /** `null` = not selecting: a tap ticks one row. Otherwise taps pick rows to tick together. */
  const [seleccion, setSeleccion] = useState<Set<string> | null>(null);
  const [aviso, setAviso] = useState<AvisoDeshacer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const avisoId = useRef(0);

  const ctx = usePlan();
  const fijosHechos = useFijosHechos(todayISO);
  const registros = useTareasHechas(todayISO);
  const chequeos = useAdsChequeos();
  const diasCumplidos = useDiasCumplidos();
  const avisos = useAvisos();
  const { alertas, mensajes } = avisos;

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
  const estado = estadoDelDia(hoy, carga);
  const frase = fraseDelAvance(estado, hoy);
  const bajada = estado.tipo === "en-curso" ? resumenDelDia(hoy, clients, ctx.entregas) : bajadaDelDia(estado, hoy);
  const cumplidoHoy = estado.tipo === "completo" || estado.tipo === "completo-con-atrasos";
  const diasRacha = diasCumplidos
    ? racha(cumplidoHoy ? new Set([...diasCumplidos, todayISO]) : diasCumplidos, diasDeTrabajo(estructura), today)
    : 0;
  // Logged ticks are always done, so pending rows are the plan's, the Ads checks and the fijos.
  const seleccionables = hoy.items.filter((i) => !i.hecha);
  const listas = mensajes.filter((m) => m.tipo === "entrega-lista");

  // A day's worth of upcoming work, in case today goes faster than planned.
  const adelantar = sugerirAdelanto(plan, todayISO, Math.max(capacidad, topeDelDia(estructura, today.getDay()))).filter(
    (a) => !(registros ?? []).some((r) => r.unidadId === a.unidad.id),
  );
  const hitosHoy = plan.hitos.filter((h) => h.fecha === todayISO);
  const proximas = plan.asignaciones.filter((a) => a.fecha > todayISO);
  const hayDatos = clients.some((c) => c.activo);
  const nombres = new Map(clients.map((c) => [c.id, c.nombre]));

  const vencidos = avisos.cobrosVencidos.length;
  const reportesAtrasados = reportesDelMes(clients, ctx.reportes, today).filter((r) => r.atrasado).length;
  const correrEntrega = mensajes.filter((m) => m.tipo === "correr-entrega");
  const hayPendiente = hoy.atrasadas.length > 0 || correrEntrega.length > 0 || vencidos > 0 || reportesAtrasados > 0;
  /** The bell's list, in Hoy's words: alerts first, then the messages to send. */
  const lineasAviso = [
    ...alertas.map((a) => ({ id: a.id, texto: a.mensaje, href: a.href })),
    ...mensajes.map((m) => ({ id: m.id, texto: `Mensaje para mandar: ${m.titulo} · ${m.cliente.nombre}`, href: `/clientes/${m.cliente.id}` })),
  ];

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
        const hecha = await completarUnidad(a.unidad, { clients });
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

  /** Tick every selected row at once, with one undo for all of them. */
  function tildarVarias(claves: Set<string>) {
    const elegidas = seleccionables.filter((i) => claves.has(i.clave));
    const unidades = elegidas.flatMap((i) => (i.tipo === "unidad" ? [i.asignacion.unidad.id] : []));
    setSeleccion(null);
    setLocales((prev) => new Set([...prev, ...unidades]));
    void seguro(async () => {
      const deshacer: (() => Promise<unknown>)[] = [];
      const guardadas = new Set<string>();
      try {
        for (const i of elegidas) {
          if (i.tipo === "unidad") {
            const h = await completarUnidad(i.asignacion.unidad, { clients });
            guardadas.add(i.asignacion.unidad.id);
            deshacer.push(() => deshacerHecha(h));
          } else if (i.tipo === "ads") {
            await guardarChequeoAds(i.cliente.id, todayISO, "ok");
            deshacer.push(() => quitarChequeoAds(i.cliente.id, todayISO));
          } else if (i.tipo === "fijo") {
            await marcarFijo(todayISO, i.fijo.id, true);
            deshacer.push(() => marcarFijo(todayISO, i.fijo.id, false));
          }
        }
      } finally {
        // What failed midway didn't get done: it goes back to pending.
        unidades.filter((id) => !guardadas.has(id)).forEach(quitarLocal);
        if (deshacer.length > 0) {
          mostrarAviso(`${deshacer.length} ${deshacer.length === 1 ? "hecha" : "hechas"}`, () => {
            unidades.forEach(quitarLocal);
            void seguro(() => Promise.all(deshacer.map((f) => f())));
          });
        }
      }
    });
  }

  /** While selecting, a row's tap picks it instead of ticking it. */
  const selector = (item: ItemHoy) =>
    seleccion && !item.hecha
      ? {
          elegida: seleccion.has(item.clave),
          onElegir: () =>
            setSeleccion((s) => {
              const next = new Set(s ?? []);
              if (next.has(item.clave)) next.delete(item.clave);
              else next.add(item.clave);
              return next;
            }),
        }
      : undefined;

  const filaDe = (item: ItemHoy): React.ReactNode => {
    const eleccion = selector(item);
    if (eleccion) {
      const titulo =
        item.tipo === "unidad" ? item.asignacion.unidad.etiqueta : item.tipo === "ads" ? "Chequeo de Ads" : item.tipo === "fijo" ? item.fijo.nombre : "";
      const clienteId = item.tipo === "unidad" ? item.asignacion.unidad.clienteId : item.tipo === "ads" ? item.cliente.id : undefined;
      return <FilaHoy hecha={false} titulo={titulo} cliente={clienteDe(clients, clienteId)} onTildar={() => undefined} eleccion={eleccion} />;
    }
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

  const grupos = GRUPOS_HOY.map((g) => ({ ...g, items: hoy.items.filter((i) => grupoDe(i) === g.clave) })).filter(
    (g) => g.items.length > 0,
  );
  const cuentaUrgente = hoy.atrasadas.length + correrEntrega.length + (vencidos > 0 ? 1 : 0) + (reportesAtrasados > 0 ? 1 : 0);
  const entregasPendientes = ctx.entregas.filter((e) => e.semaforo !== "lista");

  return (
    <div className="mx-auto max-w-[640px] px-4 pt-2 lg:max-w-[760px] lg:px-8 lg:pt-4 xl:max-w-[1360px]">
      <Inki />
      <header className="mb-5 flex flex-col gap-4 xl:mb-6 xl:flex-row xl:items-center xl:justify-between xl:gap-8">
        <div className="entra relative min-w-0 px-11 text-center xl:px-0 xl:text-left">
          <Link
            href="/ajustes"
            aria-label="Ajustes"
            className="tocable absolute right-0 top-0 rounded-full p-2 text-texto-secundario hover:bg-borde/50 lg:hidden"
          >
            <Settings size={20} strokeWidth={1.75} />
          </Link>
          <p className="mayuscula text-[0.8125rem] font-medium text-texto-secundario">
            {format(today, "EEEE d 'de' MMMM", { locale: es })}
          </p>
          <h1 className="titulo text-balance text-[1.875rem] leading-[1.12] lg:text-[2.5rem]">
            {saludo(today)}, <span className="text-acento-texto">{NOMBRE}</span>
          </h1>
          {bajada && (
            <p className="entra mt-1.5 max-w-[62ch] text-[0.9375rem] text-texto-secundario" style={indice(2)}>
              {bajada}
            </p>
          )}
        </div>

        <section className="destacado entra relative shrink-0 px-5 pb-4 pt-4 xl:w-[440px]" style={indice(1)}>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[0.8125rem] font-medium text-sobre-oscuro/70">Lo de hoy</p>
              {estado.tipo === "bloqueado" ? (
                <p className="titulo text-[1.5rem] leading-tight">{estado.titulo}</p>
              ) : estado.tipo === "libre" ? (
                <p className="titulo text-[1.5rem] leading-tight">Nada por hacer</p>
              ) : (
                <p key={hoy.hechas} className="numeros pop titulo text-[2rem] leading-tight">
                  {hoy.hechas}
                  <span className="text-[1.125rem] font-medium text-sobre-oscuro/70"> de {hoy.total} hechas</span>
                </p>
              )}
            </div>
            {estado.tipo === "en-curso" && <p className="numeros titulo text-[1.25rem] text-acento">{pct}%</p>}
          </div>
          {estado.tipo === "completo" && (
            <Sello
              texto="DÍA · CUMPLIDO · BIEN · HECHO ·"
              className="sello-cae pointer-events-none absolute -top-3 right-3 h-[92px] w-[92px] text-acento"
            />
          )}
          {estado.tipo !== "libre" && hoy.total > 0 && (
            <div
              className="barra mt-3"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={hoy.total}
              aria-valuenow={hoy.hechas}
              aria-label="Avance del día"
            >
              <div className="barra-relleno" style={{ width: `${pct}%` }} />
            </div>
          )}
          <p key={frase} className="aparece mt-2.5 text-[0.9375rem] font-medium leading-snug">
            {frase}
          </p>
          {estado.tipo === "bloqueado" && hoy.total > 0 && (
            <p className="numeros mt-0.5 text-[0.8125rem] text-sobre-oscuro/65">
              Quedan los fijos y chequeos de todos los días: {hoy.hechas} de {hoy.total} hechos.
            </p>
          )}
          {estado.tipo !== "bloqueado" && hoy.piezas > 0 && (
            <p className="mt-0.5 text-[0.8125rem] text-sobre-oscuro/65">
              Hoy te tocan {hoy.piezas} {hoy.piezas === 1 ? "pieza" : "piezas"}.
              {carga?.semaforo === "sobrecargado" && " Es un día cargado: arrancá por lo de arriba."}
            </p>
          )}
          {diasRacha >= 2 && (
            <p className="mt-2 flex items-center gap-1.5 text-[0.8125rem] font-medium text-sobre-oscuro/80">
              <Flame size={14} className="text-acento" /> {diasRacha} días seguidos al día
            </p>
          )}
        </section>
      </header>
      {cumplidoHoy && hoy.total > 0 && diasCumplidos && !diasCumplidos.has(todayISO) && (
        <RegistrarDiaCumplido fecha={todayISO} />
      )}

      {avisos.total > 0 && (
        <section
          className="entra mb-5 flex flex-wrap items-center gap-2 rounded-[18px] border border-borde/70 bg-bg-elevada px-3 py-2.5 shadow-[var(--shadow-papel)]"
          style={indice(2)}
        >
          <h2 className="flex shrink-0 items-center gap-1.5 px-1 text-[0.9375rem] font-semibold">
            <Bell size={16} className="text-acento-texto" />
            Avisos
            <span className="numeros rounded-full bg-acento/30 px-2 py-0.5 text-[0.75rem] text-acento-texto">{avisos.total}</span>
          </h2>
          {(avisosAbiertos ? lineasAviso : lineasAviso.slice(0, AVISOS_VISIBLES)).map((a) => {
            const contenido = (
              <>
                <span className="h-2 w-2 shrink-0 rounded-full bg-ambar" aria-hidden />
                <span className="truncate">{a.texto}</span>
              </>
            );
            const clase = "flex min-w-0 max-w-full items-center xl:max-w-[22rem] gap-2 rounded-[10px] bg-bg-hundida px-3 py-1.5 text-[0.8125rem]";
            return a.href ? (
              <Link key={a.id} href={a.href} className={cn("tocable hover:bg-borde/60", clase)}>
                {contenido}
              </Link>
            ) : (
              <p key={a.id} className={clase}>
                {contenido}
              </p>
            );
          })}
          {lineasAviso.length > AVISOS_VISIBLES && (
            <button
              onClick={() => setAvisosAbiertos((v) => !v)}
              aria-expanded={avisosAbiertos}
              className="tocable rounded-[10px] px-2.5 py-1.5 text-[0.8125rem] font-medium text-acento-texto hover:bg-borde/40"
            >
              {avisosAbiertos ? "Ver menos" : `y ${lineasAviso.length - AVISOS_VISIBLES} más`}
            </button>
          )}
        </section>
      )}

      {error && <p className="mb-3 text-center text-[0.8125rem] text-[var(--color-error)]">{error}</p>}

      <div className="grid items-start gap-4 xl:grid-cols-3 xl:gap-5">
        <Columna
          punto="bg-acento-texto"
          titulo="Hoy"
          cuenta={hoy.total}
          className="xl:order-2"
          style={indice(3)}
          accion={
            seleccionables.length >= 2 &&
            (seleccion ? (
              <div className="flex gap-1.5">
                <button
                  onClick={() => setSeleccion(new Set(seleccionables.map((i) => i.clave)))}
                  className="tocable rounded-[10px] px-2.5 py-1 text-[0.8125rem] font-medium text-acento-texto"
                >
                  Todas
                </button>
                <button
                  onClick={() => setSeleccion(null)}
                  className="tocable rounded-[10px] border border-borde bg-bg-elevada px-2.5 py-1 text-[0.8125rem] font-medium hover:bg-borde/40"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setSeleccion(new Set())}
                className="tocable flex items-center gap-1.5 rounded-[10px] border border-borde bg-bg-elevada px-2.5 py-1 text-[0.8125rem] font-medium text-texto-secundario hover:bg-borde/40"
              >
                <CheckCheck size={14} /> Tildar varias
              </button>
            ))
          }
        >
          {listas.length > 0 && (
            <div className={cn(TARJETA, "mb-3 p-3")}>
              <h3 className="titulo mb-0.5 flex items-center gap-2 text-[1rem]">
                <PackageCheck size={17} className="text-verde" />
                {listas.length === 1 ? "Terminaste una entrega" : `Terminaste ${listas.length} entregas`}
              </h3>
              <p className="mb-2.5 text-[0.8125rem] text-texto-secundario">
                Ya se abrió el ciclo siguiente. Avisale al cliente que está lista.
              </p>
              <MensajesPendientes mensajes={listas} />
            </div>
          )}

          {hitosHoy.length > 0 && (
            <ul className="mb-3 flex flex-wrap gap-2">
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
            estado.tipo === "bloqueado" ? null : (
              <EmptyState
                sol={hayDatos}
                title={hayDatos ? "Vas bien — nada para producir hoy" : "Todavía no hay clientes cargados"}
                detail={
                  hayDatos
                    ? "No hay nada pendiente para hoy. Si te sobra tiempo, tenés qué adelantar en Próximas entregas."
                    : "Agregá tu primer cliente para que la app arme el plan."
                }
              />
            )
          ) : (
            <>
              <div className="flex flex-col gap-4">
                {grupos.map((g) => (
                  <div key={g.clave}>
                    <h3 className="mb-2 flex items-center gap-1.5 px-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-texto-secundario">
                      <g.Icono size={13} /> {g.titulo}
                    </h3>
                    <ul className="flex flex-col gap-2">
                      {g.items.map((item, i) => (
                        <li key={item.clave} className={cn(TARJETA, "desliza overflow-hidden")} style={indice(i)}>
                          {filaDe(item)}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              {seleccion ? (
                <div className="aviso-sube sticky bottom-[calc(96px+env(safe-area-inset-bottom,0px))] z-30 mt-3 flex items-center gap-3 rounded-[16px] bg-bg-elevada p-2 pl-4 shadow-[var(--shadow-papel-alto)] lg:bottom-6">
                  <span className="numeros flex-1 text-[0.9375rem] font-medium">
                    {seleccion.size === 0 ? "Elegí las que hiciste" : `${seleccion.size} ${seleccion.size === 1 ? "elegida" : "elegidas"}`}
                  </span>
                  <button
                    disabled={seleccion.size === 0}
                    onClick={() => tildarVarias(seleccion)}
                    className="boton-primario tocable rounded-[12px] px-4 py-2 text-[0.9375rem] font-medium disabled:opacity-50"
                  >
                    Marcar hechas
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-center text-[0.75rem] text-texto-secundario">
                  Deslizá a la derecha para tildar, a la izquierda para pasarla a mañana.
                </p>
              )}
            </>
          )}
        </Columna>

        <Columna
          punto="bg-[var(--color-error)]"
          titulo="Urgente"
          cuenta={cuentaUrgente}
          className={cn("xl:order-1", !hayPendiente && "hidden xl:block")}
          style={indice(4)}
        >
          <p className="-mt-1.5 mb-3 px-1 text-[0.8125rem] text-texto-secundario">
            {hayPendiente ? "Lo que no entra hoy o se pasó de fecha." : "Nada atrasado: vas al día."}
          </p>

          {correrEntrega.length > 0 && (
            <div className={cn(TARJETA, URGENTE, "mb-2 p-3")}>
              <p className="mb-2 text-[0.8125rem] font-medium text-texto-secundario">
                Hay más urgente de lo que entra: conviene avisar y correr la entrega
              </p>
              <MensajesPendientes mensajes={correrEntrega} />
            </div>
          )}

          {(hoy.atrasadas.length > 0 || vencidos > 0 || reportesAtrasados > 0) && (
            <ul className="flex flex-col gap-2">
              {hoy.atrasadas.map((a, i) => (
                <li key={a.unidad.id} className={cn(TARJETA, URGENTE, "desliza overflow-hidden")} style={indice(i)}>
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
              {vencidos > 0 && (
                <li>
                  <Link
                    href="/plata"
                    className={cn(TARJETA, URGENTE, "tocable flex items-center gap-3 px-4 py-3 text-[0.9375rem] font-medium")}
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
                    className={cn(TARJETA, URGENTE, "tocable flex items-center gap-3 px-4 py-3 text-[0.9375rem] font-medium")}
                  >
                    <FileText size={18} className="text-acento-texto" />
                    {reportesAtrasados === 1 ? "1 reporte de Ads atrasado" : `${reportesAtrasados} reportes de Ads atrasados`}
                    <ArrowRight size={16} className="ml-auto text-texto-secundario" />
                  </Link>
                </li>
              )}
            </ul>
          )}
        </Columna>

        <Columna punto="bg-verde" titulo="Próximas entregas" className="xl:order-3" style={indice(5)}>
          {entregasPendientes.length === 0 ? (
            <p className="px-1 pb-1 text-[0.8125rem] text-texto-secundario">No hay entregas pendientes.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {entregasPendientes.slice(0, ENTREGAS_VISIBLES).map((e, i) => (
                <li key={`${e.clienteId}-${e.fecha}`} className="desliza" style={indice(i)}>
                  <FilaEntrega e={e} clients={clients} />
                </li>
              ))}
            </ul>
          )}
          {entregasPendientes.length > ENTREGAS_VISIBLES && (
            <Link
              href="/calendario"
              className="tocable mt-2 flex items-center justify-center gap-1.5 rounded-[12px] px-3 py-2 text-[0.8125rem] font-medium text-texto-secundario hover:bg-borde/40"
            >
              <CalendarDays size={14} /> Ver las {entregasPendientes.length} en el calendario
            </Link>
          )}

          {adelantar.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setAdelantarAbierto((v) => !v)}
                aria-expanded={adelantarAbierto}
                className="tocable flex w-full items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-texto-secundario/35 px-3 py-3 text-[0.875rem] text-texto-secundario hover:bg-borde/40"
              >
                Si te sobra tiempo:
                <span className="numeros font-semibold text-texto">
                  {adelantar.length} {adelantar.length === 1 ? "cosa" : "cosas"} para adelantar
                </span>
                <ChevronDown size={15} className={cn("transition-transform duration-300", adelantarAbierto && "rotate-180")} />
              </button>
              {adelantarAbierto && (
                <div className="mt-2">
                  <p className="mb-2 text-center text-[0.8125rem] text-texto-secundario">
                    Lo próximo del plan que ya podés adelantar.
                  </p>
                  <ul className="flex flex-col gap-2">
                    {adelantar.map((a, i) => (
                      <li key={a.unidad.id} className={cn(TARJETA, "desliza overflow-hidden")} style={indice(i)}>
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
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2.5">
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
        </Columna>
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
        piezas={piezas}
        today={todayISO}
        tareasHoy={plan.asignaciones.filter((a) => a.fecha === todayISO)}
        tareasProximas={proximas.filter((a) => sePuedeTildar(a.unidad))}
        grabacionesPendientes={grabaciones.filter((g) => !g.hecha)}
        entregas={ctx.entregas}
      />

      <AvisoDeshacerToast aviso={aviso} onCerrar={cerrarAviso} />
    </div>
  );
}

/** One of the three columns: a grey panel with a colored dot, a title and how many things it holds. */
function Columna({
  punto,
  titulo,
  cuenta,
  accion,
  className,
  style,
  children,
}: {
  punto: string;
  titulo: string;
  cuenta?: number;
  accion?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("entra rounded-[24px] bg-borde/45 p-3 lg:p-4", className)} style={style}>
      <div className="mb-3 flex min-h-8 items-center gap-2 px-1">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", punto)} aria-hidden />
        <h2 className="titulo text-[1.0625rem]">{titulo}</h2>
        {cuenta !== undefined && (
          <span className="numeros rounded-full bg-bg-elevada px-2 py-0.5 text-[0.75rem] font-semibold">{cuenta}</span>
        )}
        {accion && <div className="ml-auto">{accion}</div>}
      </div>
      {children}
    </section>
  );
}

/** A delivery coming up: its date, whose it is, what's left and its traffic light. */
function FilaEntrega({ e, clients }: { e: Entrega; clients: Client[] }) {
  const cliente = clienteDe(clients, e.clienteId);
  const fecha = fromISODate(e.fecha);
  const cuando = e.dias < 0 ? `atrasada ${-e.dias} ${e.dias === -1 ? "día" : "días"}` : e.dias === 0 ? "hoy" : e.dias === 1 ? "mañana" : `en ${e.dias} días`;
  const partes = [
    e.total > 0 && (e.faltan === 1 ? "falta 1 pieza" : `faltan ${e.faltan} piezas`),
    cuando,
    e.esperaGrabacion && "falta grabar",
    e.esperaAprobacion && "espera aprobación",
  ].filter(Boolean);
  return (
    <Link
      href={`/clientes/${e.clienteId}`}
      className={cn(TARJETA, "tocable flex items-center gap-3 p-2.5 hover:bg-bg-hundida/60")}
    >
      <span className="flex w-12 shrink-0 flex-col items-center rounded-[12px] border border-borde/80 py-1">
        <span className="numeros titulo text-[1.25rem] leading-tight">{format(fecha, "d")}</span>
        <span className="text-[0.625rem] font-medium uppercase tracking-wide text-texto-secundario">
          {format(fecha, "MMM", { locale: es })}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 font-semibold">
          {cliente && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: cliente.color }} aria-hidden />}
          <span className="truncate">{cliente?.nombre ?? "Cliente"}</span>
        </span>
        <span className="block truncate text-[0.8125rem] text-texto-secundario">{partes.join(" · ")}</span>
      </span>
      <SemaforoPunto semaforo={e.semaforo} className="mr-1.5 h-2.5 w-2.5" />
    </Link>
  );
}

function clienteDe(clients: Client[], id?: string) {
  const c = clients.find((x) => x.id === id);
  return c ? { id: c.id, nombre: c.nombre, color: colorCliente(clients, c.id) } : undefined;
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
      {unidad.tipo === "ads-reporte" && (
        <Link href="/ads" className="font-medium text-acento-texto hover:underline">
          Escribir el análisis
        </Link>
      )}
      {a.fecha !== hoyISO && <span>· planeada {fechaLarga(a.fecha)}</span>}
      {atrasada && (
        <span className="rounded-[8px] bg-acento/35 px-1.5 py-0.5 font-medium text-acento-texto">atrasada</span>
      )}
      {a.sobrecarga && (
        <span className="rounded-[8px] bg-acento/35 px-1.5 py-0.5 font-medium text-acento-texto">sobrecarga</span>
      )}
      {enMargen && <span className="rounded-[8px] bg-ambar/15 px-1.5 py-0.5 font-medium text-ambar">usa el margen</span>}
    </>
  );
}

/** Writes today into the streak once everything is done. Rendered only then. */
function RegistrarDiaCumplido({ fecha }: { fecha: string }) {
  useEffect(() => {
    marcarDiaCumplido(fecha).catch((e) => console.error("[dias_cumplidos]", e));
  }, [fecha]);
  return null;
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
  eleccion,
}: {
  hecha: boolean;
  titulo: string;
  cliente?: { id: string; nombre: string; color: string };
  detalle?: React.ReactNode;
  onTildar: () => void;
  onDeshacer?: () => void;
  onManana?: () => void;
  /** "Tildar varias": the row is picked instead of ticked. */
  eleccion?: { elegida: boolean; onElegir: () => void };
}) {
  if (eleccion) {
    return (
      <label className={cn("tocable flex cursor-pointer items-center gap-3 rounded-[12px] px-2.5 py-3", eleccion.elegida && "bg-acento/15")}>
        <input
          type="checkbox"
          checked={eleccion.elegida}
          onChange={eleccion.onElegir}
          aria-label={`Elegir ${titulo}`}
          className="h-[20px] w-[20px] shrink-0 accent-[var(--color-oscuro)]"
        />
        <span className="min-w-0 flex-1">
          {cliente && <span className="block truncate text-[0.8125rem] font-medium text-texto-secundario">{cliente.nombre}</span>}
          <span className="block font-medium leading-snug">{titulo}</span>
        </span>
      </label>
    );
  }
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
              <Link href={`/clientes/${cliente.id}`} className="truncate hover:text-texto hover:underline">
                {cliente.nombre}
              </Link>
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
            className="tocable flex shrink-0 items-center gap-1 self-center rounded-full border border-borde px-2.5 py-1.5 text-[0.75rem] font-medium text-texto-secundario hover:bg-borde/50 hover:text-texto"
          >
            Mañana <ArrowRight size={13} />
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
  const [cerrado, setCerrado] = useState<{ hechas: number; total: number; pasadas: number; ids: string[] } | null>(null);
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
      const ids = pendientes.map((a) => a.unidad.id);
      await posponerUnidades(ids, mananaISO);
      setCerrado({ hechas, total, pasadas: ids.length, ids });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cerrar el día. Probá de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  /** Take the day back: what moved to tomorrow returns to today's list. */
  async function reabrir() {
    if (!cerrado) return;
    setGuardando(true);
    setError(null);
    try {
      await Promise.all(cerrado.ids.map((id) => quitarPospuesta(id)));
      salir();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo deshacer. Probá de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Sheet open={open} title="Cerrar el día" onClose={salir}>
      {cerrado ? (
        <div className="flex flex-col items-center pt-2 text-center">
          <Sello
            texto="DÍA · CERRADO · HASTA · MAÑANA ·"
            className="sello-cae mb-3 h-[96px] w-[96px] text-acento-texto"
          />
          <p className="titulo text-[1.25rem]">Día cerrado, {NOMBRE}</p>
          <p className="entra mb-5 mt-1 max-w-[34ch] text-[0.9375rem] text-texto-secundario" style={indice(2)}>
            Avanzaste {cerrado.hechas} de {cerrado.total}.
            {cerrado.pasadas > 0
              ? ` ${cerrado.pasadas === 1 ? "La que quedó pasa" : `Las ${cerrado.pasadas} que quedaron pasan`} a mañana y el plan se reacomodó.`
              : " No quedó nada pendiente."}
          </p>
          <BotonPrimario onClick={salir}>Listo</BotonPrimario>
          {cerrado.ids.length > 0 && (
            <button
              onClick={reabrir}
              disabled={guardando}
              className="tocable mt-2 flex w-full items-center justify-center gap-1.5 rounded-[12px] border border-borde px-5 py-3 font-medium hover:bg-borde/40 disabled:opacity-60"
            >
              <Undo2 size={16} /> Deshacer: volver a hoy
            </button>
          )}
          {error && <p className="mt-3 text-[0.8125rem] text-[var(--color-error)]">{error}</p>}
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
