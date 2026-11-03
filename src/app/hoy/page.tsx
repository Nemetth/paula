"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { addDays, format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  Clapperboard,
  Flame,
  Megaphone,
  Moon,
  PackageCheck,
  Presentation,
  Settings,
  Undo2,
  Video,
} from "lucide-react";
import {
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
import { lineasDeAviso } from "@/lib/domain/alertas";
import { Asignacion, sugerirAdelanto } from "@/lib/domain/planner";
import {
  DatosDeTarjetas,
  ItemHoy,
  LineaEntrega,
  TarjetaHoy as DatosTarjeta,
  agruparPorCliente,
  armarHoy,
  detalleDeEntrega,
  estadoDelDia,
  lineaDelDia,
  lineasUrgentes,
  racha,
  tarjetaDeEntrega,
  tarjetasDeHoy,
  tarjetasUrgentes,
} from "@/lib/domain/hoy";
import { completarUnidad, deshacerHecha, sePuedeTildar } from "@/lib/domain/completar";
import { fromISODate, toISODate } from "@/lib/domain/dates";
import { colorCliente } from "@/lib/domain/calendario";
import { Client, diasDeTrabajo, topeDelDia } from "@/lib/domain/types";
import { NOMBRE, bajadaDelDia, fraseDelAvance, saludo } from "@/lib/domain/voz";
import { ListaAlertas } from "@/components/acciones-globales";
import { DisruptionSheet } from "@/components/disruption-sheet";
import { Cargando, EmptyState } from "@/components/empty-state";
import { SemaforoPunto } from "@/components/entrega";
import { CorrerEntrega } from "@/components/hoy/urgente";
import { TarjetaHoy } from "@/components/hoy/tarjeta-hoy";
import { Inki } from "@/components/inki";
import { Sello } from "@/components/sello";
import { AvisoDeshacer, AvisoDeshacerToast } from "@/components/aviso-deshacer";
import { BotonPrimario, Sheet } from "@/components/sheet";
import { cn, indice } from "@/lib/utils";

const AVISOS_VISIBLES = 3;
const URGENTES_VISIBLES = 5;
const ENTREGAS_VISIBLES = 6;

/** Today's list in the two blocks Paula works it in. */
const BLOQUES = [
  { clave: "contenido", titulo: "Contenido", Icono: Clapperboard },
  { clave: "ads", titulo: "Ads", Icono: Megaphone },
] as const;

export default function HoyPage() {
  const today = useMemo(() => new Date(), []);
  const todayISO = toISODate(today);
  const mananaISO = toISODate(addDays(today, 1));
  const [cambioAbierto, setCambioAbierto] = useState(false);
  const [cierreAbierto, setCierreAbierto] = useState(false);
  const [avisosAbiertos, setAvisosAbiertos] = useState(false);
  const [adelantarAbierto, setAdelantarAbierto] = useState(false);
  const [urgentesAbiertos, setUrgentesAbiertos] = useState(false);
  const [aCorrer, setACorrer] = useState<LineaEntrega | null>(null);
  const [locales, setLocales] = useState<Set<string>>(new Set());
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
  const bajada = lineaDelDia(hoy) ?? bajadaDelDia(estado, hoy);
  const cumplidoHoy = estado.tipo === "completo" || estado.tipo === "completo-con-atrasos";
  const diasRacha = diasCumplidos
    ? racha(cumplidoHoy ? new Set([...diasCumplidos, todayISO]) : diasCumplidos, diasDeTrabajo(estructura), today)
    : 0;

  // A day's worth of upcoming work, in case today goes faster than planned.
  const adelantar = sugerirAdelanto(plan, todayISO, Math.max(capacidad, topeDelDia(estructura, today.getDay()))).filter(
    (a) => !(registros ?? []).some((r) => r.unidadId === a.unidad.id),
  );
  const hitosHoy = plan.hitos.filter((h) => h.fecha === todayISO);
  const proximas = plan.asignaciones.filter((a) => a.fecha > todayISO);
  const hayDatos = clients.some((c) => c.activo);

  const lineasAviso = lineasDeAviso(alertas, mensajes, avisos.cobrosVencidos.length, clients);
  const datosTarjetas: DatosDeTarjetas = { clients, piezas, registros: registros ?? [], locales, hoyISO: todayISO };
  const urgentes = tarjetasUrgentes(lineasUrgentes({ hoy, plan, entregas: ctx.entregas, clients, reportes: ctx.reportes, today }), datosTarjetas);
  const urgentesVisibles = urgentesAbiertos ? urgentes : urgentes.slice(0, URGENTES_VISIBLES);
  const tarjetas = tarjetasDeHoy(hoy.items, clients, piezas);
  const bloques = BLOQUES.map((b) => ({ ...b, tarjetas: tarjetas.filter((t) => t.bloque === b.clave) })).filter((b) => b.tarjetas.length > 0);
  /** Past the day's cap and able to wait: Urgente doesn't have them. */
  const enEspera = hoy.sinEntrar.filter((a) => !a.atrasada && !a.sobrecarga).length;
  const entregasPendientes = ctx.entregas.filter((e) => e.semaforo !== "lista");
  const faltan = hoy.total - hoy.hechas;

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

  /** Tick a whole card or a single piece, with one undo for all of it. */
  function tildar(elegidas: ItemHoy[]) {
    const unidades = elegidas.flatMap((i) => (i.tipo === "unidad" ? [i.asignacion.unidad.id] : []));
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
          const solo = elegidas.length === 1 && elegidas[0].tipo === "unidad" ? elegidas[0].asignacion.unidad.etiqueta : undefined;
          mostrarAviso(solo ? `Hecha: ${solo}` : `${deshacer.length} ${deshacer.length === 1 ? "hecha" : "hechas"}`, () => {
            unidades.forEach(quitarLocal);
            void seguro(() => Promise.all(deshacer.map((f) => f())));
          });
        }
      }
    });
  }

  /** Take back what's done on a card, or one piece of it. */
  function destildar(elegidas: ItemHoy[]) {
    void seguro(async () => {
      for (const i of elegidas) {
        if (!i.hecha) continue;
        if (i.tipo === "registro") {
          quitarLocal(i.registro.unidadId);
          await deshacerHecha(i.registro);
        } else if (i.tipo === "ads") await quitarChequeoAds(i.cliente.id, todayISO);
        else if (i.tipo === "fijo") await marcarFijo(todayISO, i.fijo.id, false);
      }
    });
  }

  function pasarAManana(t: DatosTarjeta) {
    const ids = t.movibles.map((a) => a.unidad.id);
    void seguro(async () => {
      await posponerUnidades(ids, mananaISO);
      mostrarAviso(`Pasó a mañana: ${t.titulo}`, () => void seguro(() => Promise.all(ids.map(quitarPospuesta))));
    });
  }

  const tarjetaDe = (t: DatosTarjeta, extras?: Pick<React.ComponentProps<typeof TarjetaHoy>, "inicio" | "fin" | "accion" | "className">) => (
    <TarjetaHoy
      tarjeta={t}
      color={t.clienteId ? colorCliente(clients, t.clienteId) : undefined}
      onTildar={tildar}
      onDeshacer={destildar}
      onManana={pasarAManana}
      {...extras}
    />
  );

  const itemDeUnidad = (asignacion: Asignacion): ItemHoy => ({
    clave: asignacion.unidad.id,
    tipo: "unidad",
    hecha: locales.has(asignacion.unidad.id),
    asignacion,
  });

  return (
    <div className="mx-auto flex max-w-[640px] flex-col px-4 pt-2 lg:max-w-[760px] lg:px-8 xl:h-[calc(100dvh-5.75rem)] xl:max-w-[1360px] xl:pt-0">
      <Inki />
      <header className="mb-3 flex shrink-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between xl:gap-8">
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
          <h1 className="titulo text-balance text-[1.75rem] leading-[1.12] xl:text-[2rem]">
            {saludo(today)}, <span className="text-acento-texto">{NOMBRE}</span>
          </h1>
          {bajada && (
            <p className="entra mt-0.5 text-[0.9375rem] text-texto-secundario" style={indice(2)}>
              {bajada}
            </p>
          )}
        </div>

        <section className="destacado entra relative flex shrink-0 items-center gap-4 px-5 py-3 xl:w-[460px]" style={indice(1)}>
          {estado.tipo === "bloqueado" || estado.tipo === "libre" ? (
            <p className="titulo shrink-0 text-[1.375rem] leading-tight">{estado.tipo === "bloqueado" ? estado.titulo : "Nada por hacer"}</p>
          ) : (
            <p key={hoy.hechas} className="numeros pop titulo shrink-0 whitespace-nowrap text-[2.5rem] leading-none">
              {hoy.hechas}
              <span className="text-[0.9375rem] font-medium text-sobre-oscuro/70"> de {hoy.total} hechas</span>
            </p>
          )}
          <div className="min-w-0 flex-1">
            {estado.tipo !== "libre" && hoy.total > 0 && (
              <div
                className="barra"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={hoy.total}
                aria-valuenow={hoy.hechas}
                aria-label="Avance del día"
              >
                <div className="barra-relleno" style={{ width: `${pct}%` }} />
              </div>
            )}
            <p className="mt-1.5 text-[0.8125rem] leading-snug text-sobre-oscuro/75">
              {estado.tipo === "en-curso" ? (
                <span className="numeros">
                  {pct}% del día · te {faltan === 1 ? "falta 1" : `faltan ${faltan}`}
                </span>
              ) : (
                frase
              )}
              {diasRacha >= 2 && (
                <span className="ml-2 inline-flex items-center gap-1 whitespace-nowrap">
                  <Flame size={13} className="text-acento" /> {diasRacha} días seguidos
                </span>
              )}
            </p>
          </div>
          {estado.tipo === "completo" && (
            <Sello
              texto="DÍA · CUMPLIDO · BIEN · HECHO ·"
              className="sello-cae pointer-events-none absolute -top-3 right-3 h-[92px] w-[92px] text-acento"
            />
          )}
        </section>
      </header>
      {cumplidoHoy && hoy.total > 0 && diasCumplidos && !diasCumplidos.has(todayISO) && (
        <RegistrarDiaCumplido fecha={todayISO} />
      )}

      {lineasAviso.length > 0 && (
        <section
          className="entra mb-3 flex shrink-0 flex-wrap items-center gap-2 rounded-[16px] border border-borde/70 bg-bg-elevada px-3 py-2 shadow-[var(--shadow-papel)]"
          style={indice(2)}
        >
          <h2 className="flex shrink-0 items-center gap-1.5 px-1 text-[0.875rem] font-semibold">
            <Bell size={15} className="text-acento-texto" />
            Avisos
            <span className="numeros rounded-full bg-acento/30 px-2 py-0.5 text-[0.75rem] text-acento-texto">{lineasAviso.length}</span>
          </h2>
          {lineasAviso.slice(0, AVISOS_VISIBLES).map((a) => {
            const contenido = (
              <>
                <span className="h-2 w-2 shrink-0 rounded-full bg-ambar" aria-hidden />
                <span className="truncate">{a.texto}</span>
              </>
            );
            const clase = "tocable flex min-w-0 max-w-full items-center gap-2 rounded-[10px] bg-bg-hundida px-3 py-1 text-[0.8125rem] hover:bg-borde/60 xl:max-w-[22rem]";
            return a.href ? (
              <Link key={a.id} href={a.href} className={clase}>
                {contenido}
              </Link>
            ) : (
              <button key={a.id} onClick={() => setAvisosAbiertos(true)} className={clase}>
                {contenido}
              </button>
            );
          })}
          {lineasAviso.length > AVISOS_VISIBLES && (
            <button
              onClick={() => setAvisosAbiertos(true)}
              className="tocable rounded-[10px] px-2.5 py-1 text-[0.8125rem] font-medium text-acento-texto hover:bg-borde/40"
            >
              y {lineasAviso.length - AVISOS_VISIBLES} más
            </button>
          )}
        </section>
      )}

      {error && <p className="mb-2 shrink-0 text-center text-[0.8125rem] text-[var(--color-error)]">{error}</p>}

      <div className="grid gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-3">
        <Columna punto="bg-acento-texto" titulo="Hoy" cuenta={hoy.total} className="xl:order-2" style={indice(3)}>
          {hitosHoy.length > 0 && (
            <ul className="mb-3 flex flex-wrap gap-2">
              {hitosHoy.map((h, i) => {
                const Icon = h.tipo === "grabacion" ? Video : h.tipo === "presentacion" ? Presentation : PackageCheck;
                return (
                  <li
                    key={`${h.tipo}-${h.clienteId}-${i}`}
                    className="flex items-center gap-1.5 rounded-full bg-acento/25 py-1 pl-2.5 pr-3 text-[0.8125rem] font-medium"
                  >
                    <Icon size={14} className="text-acento-texto" />
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
            <div className="flex flex-col gap-3">
              {bloques.map((b) => (
                <div key={b.clave}>
                  <h3 className="mb-1.5 flex items-center gap-1.5 px-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-texto-secundario">
                    <b.Icono size={13} /> {b.titulo}
                  </h3>
                  <ul className="flex flex-col gap-1.5">
                    {b.tarjetas.map((t, i) => (
                      <li key={t.clave} className="desliza" style={indice(i)}>
                        {tarjetaDe(t)}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {enEspera > 0 && (
                <p className="px-1 text-center text-[0.75rem] text-texto-secundario">
                  {enEspera === 1 ? "1 cosa no entra" : `${enEspera} cosas no entran`} en tu tope de hoy: {enEspera === 1 ? "queda pendiente" : "quedan pendientes"}.
                </p>
              )}
            </div>
          )}
        </Columna>

        <Columna
          punto="bg-[var(--color-error)]"
          titulo="Urgente"
          cuenta={urgentes.length}
          className={cn("xl:order-1", urgentes.length === 0 && "hidden xl:flex")}
          style={indice(4)}
        >
          {urgentes.length === 0 ? (
            <p className="px-1 text-[0.8125rem] text-texto-secundario">Nada atrasado: vas al día.</p>
          ) : (
            <>
              <ul className="flex flex-col gap-1.5">
                {urgentesVisibles.map(({ tarjeta, entrega }, i) => (
                  <li key={tarjeta.clave} className="desliza" style={indice(i)}>
                    {tarjetaDe(tarjeta, {
                      className: "border-l-[3px] border-l-[var(--color-error)]",
                      accion: entrega && (
                        <button
                          onClick={() => setACorrer(entrega)}
                          className="tocable shrink-0 rounded-[10px] border border-borde px-2.5 py-1 text-[0.75rem] font-medium hover:bg-borde/40"
                        >
                          Correr entrega
                        </button>
                      ),
                    })}
                  </li>
                ))}
              </ul>
              {urgentes.length > URGENTES_VISIBLES && (
                <button
                  onClick={() => setUrgentesAbiertos((v) => !v)}
                  aria-expanded={urgentesAbiertos}
                  className="tocable mt-2 w-full rounded-[12px] px-3 py-1.5 text-[0.8125rem] font-medium text-texto-secundario hover:bg-borde/40"
                >
                  {urgentesAbiertos ? "Ver menos" : `Ver todos (${urgentes.length})`}
                </button>
              )}
            </>
          )}
        </Columna>

        <Columna
          punto="bg-verde"
          titulo="Próximas entregas"
          className="xl:order-3"
          style={indice(5)}
          pie={
            <div className="mt-2.5 flex gap-2 xl:pr-16">
              <button
                onClick={() => setCierreAbierto(true)}
                className="boton-primario tocable flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[12px] px-3 py-2 text-[0.875rem] font-medium"
              >
                <Moon size={15} strokeWidth={2} /> Cerrar el día
              </button>
              <button
                onClick={() => setCambioAbierto(true)}
                className="tocable flex-1 whitespace-nowrap rounded-[12px] border border-borde bg-bg-elevada/60 px-3 py-2 text-center text-[0.875rem] font-medium text-texto hover:bg-bg-elevada"
              >
                Algo cambió
              </button>
            </div>
          }
        >
          {entregasPendientes.length === 0 ? (
            <p className="px-1 pb-1 text-[0.8125rem] text-texto-secundario">No hay entregas pendientes.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {entregasPendientes.slice(0, ENTREGAS_VISIBLES).map((e, i) => (
                <li key={`${e.clienteId}-${e.fecha}`} className="desliza" style={indice(i)}>
                  {tarjetaDe(tarjetaDeEntrega(e, detalleDeEntrega(e), datosTarjetas), {
                    inicio: <FechaEntrega fecha={e.fecha} />,
                    fin: <SemaforoPunto semaforo={e.semaforo} className="h-2.5 w-2.5" />,
                  })}
                </li>
              ))}
            </ul>
          )}
          {entregasPendientes.length > ENTREGAS_VISIBLES && (
            <Link
              href="/calendario"
              className="tocable mt-1.5 flex items-center justify-center gap-1.5 rounded-[12px] px-3 py-1.5 text-[0.8125rem] font-medium text-texto-secundario hover:bg-borde/40"
            >
              <CalendarDays size={14} /> Ver las {entregasPendientes.length} en el calendario
            </Link>
          )}

          {adelantar.length > 0 && (
            <div className="mt-2">
              <button
                onClick={() => setAdelantarAbierto((v) => !v)}
                aria-expanded={adelantarAbierto}
                className="tocable flex w-full items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-texto-secundario/35 px-3 py-2 text-[0.8125rem] text-texto-secundario hover:bg-borde/40"
              >
                Si te sobra tiempo:
                <span className="numeros font-semibold text-texto">
                  {adelantar.length} {adelantar.length === 1 ? "cosa" : "cosas"} para adelantar
                </span>
                <ChevronDown size={15} className={cn("transition-transform duration-300", adelantarAbierto && "rotate-180")} />
              </button>
              {adelantarAbierto && (
                <ul className="mt-2 flex flex-col gap-1.5">
                  {tarjetasDeHoy(adelantar.map(itemDeUnidad), clients, piezas).map((t, i) => (
                    <li key={t.clave} className="desliza" style={indice(i)}>
                      {tarjetaDe({ ...t, movibles: [] })}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Columna>
      </div>

      <Sheet open={avisosAbiertos} title="Avisos" onClose={() => setAvisosAbiertos(false)}>
        <ListaAlertas alertas={alertas} mensajes={mensajes} onNavegar={() => setAvisosAbiertos(false)} />
      </Sheet>

      <CorrerEntrega linea={aCorrer} clients={clients} onClose={() => setACorrer(null)} />

      <CerrarDia
        open={cierreAbierto}
        onClose={() => setCierreAbierto(false)}
        hechas={hoy.hechas}
        total={hoy.total}
        pendientes={[...hoy.items.flatMap((i) => (i.tipo === "unidad" && !i.hecha ? [i.asignacion] : [])), ...hoy.sinEntrar]}
        sinPasar={hoy.items.filter((i) => (i.tipo === "ads" || i.tipo === "fijo") && !i.hecha).length}
        clients={clients}
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
  pie,
  className,
  style,
  children,
}: {
  punto: string;
  titulo: string;
  cuenta?: number;
  /** Stays at the bottom of the column while its list scrolls. */
  pie?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("entra flex flex-col rounded-[20px] bg-borde/45 p-3 xl:min-h-0", className)} style={style}>
      <div className="mb-2 flex shrink-0 items-center gap-2 px-1">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", punto)} aria-hidden />
        <h2 className="titulo text-[1rem]">{titulo}</h2>
        {cuenta !== undefined && (
          <span className="numeros rounded-full bg-bg-elevada px-2 py-0.5 text-[0.75rem] font-semibold">{cuenta}</span>
        )}
      </div>
      <div className="xl:-mx-1 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:px-1 xl:pb-1">{children}</div>
      {pie && <div className="shrink-0">{pie}</div>}
    </section>
  );
}

/** A delivery's date, as a small calendar leaf. */
function FechaEntrega({ fecha }: { fecha: string }) {
  const dia = fromISODate(fecha);
  return (
    <span className="flex w-10 shrink-0 flex-col items-center rounded-[10px] border border-borde/80 py-0.5">
      <span className="numeros titulo text-[1.0625rem] leading-tight">{format(dia, "d")}</span>
      <span className="text-[0.625rem] font-medium uppercase tracking-wide text-texto-secundario">{format(dia, "MMM", { locale: es })}</span>
    </span>
  );
}

/** Writes today into the streak once everything is done. Rendered only then. */
function RegistrarDiaCumplido({ fecha }: { fecha: string }) {
  useEffect(() => {
    marcarDiaCumplido(fecha).catch((e) => console.error("[dias_cumplidos]", e));
  }, [fecha]);
  return null;
}

/** "Cerrar el día": how far she got, and what didn't get done moves to tomorrow by itself. */
function CerrarDia({
  open,
  onClose,
  hechas,
  total,
  pendientes,
  sinPasar,
  clients,
  mananaISO,
}: {
  open: boolean;
  onClose: () => void;
  hechas: number;
  total: number;
  pendientes: Asignacion[];
  /** Fixed routines and Ads checks left undone: they are daily, so they don't move. */
  sinPasar: number;
  clients: Client[];
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
                {agruparPorCliente(pendientes, clients).map((g) => (
                  <li key={g.clienteId ?? "otras"}>
                    <span className="text-texto-secundario">{g.nombre} · </span>
                    {g.resumen}
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
