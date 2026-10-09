"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { addMonths, addWeeks, endOfMonth, format, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { actualizarPieza } from "@/lib/supabase/data";
import { usePlan } from "@/lib/supabase/use-plan";
import { armarDias, cierreDelMes, colorCliente, diasDeLaSemana, grillaDelMes } from "@/lib/domain/calendario";
import { fechasEspecialesDelMes } from "@/lib/domain/fechas-especiales";
import { fmtPiezas } from "@/lib/domain/planner";
import { fromISODate, toISODate } from "@/lib/domain/dates";
import { SEMAFORO_ENTREGA, SemaforoPunto, avanceTexto, fechaDM } from "@/components/entrega";
import { VistaMes } from "@/components/calendario/vista-mes";
import { VistaSemana } from "@/components/calendario/vista-semana";
import { DetalleDia } from "@/components/calendario/detalle-dia";
import { Cargando } from "@/components/empty-state";
import { cn } from "@/lib/utils";

type Vista = "semana" | "mes";

const HORIZONTE_DIAS = 120;

export default function CalendarioPage() {
  const today = useMemo(() => new Date(), []);
  const hoyISO = toISODate(today);
  const [vista, setVista] = useState<Vista>("semana");
  const [ancla, setAncla] = useState<Date>(today);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ctx = usePlan(HORIZONTE_DIAS);
  const plan = ctx?.plan ?? null;
  const clients = ctx?.clients;
  const piezas = ctx?.piezas;
  const grabaciones = ctx?.grabaciones;
  const cobros = ctx?.cobros;
  const entregas = ctx?.entregas;

  const dias = useMemo(() => {
    if (!plan) return null;
    const fechas = [...grillaDelMes(ancla), ...diasDeLaSemana(ancla)].map(toISODate);
    return armarDias(plan, cobros ?? [], today, fechas);
  }, [plan, cobros, ancla, today]);

  const cierre = useMemo(
    () => (plan && piezas && grabaciones ? cierreDelMes(ancla, piezas, grabaciones, plan) : null),
    [plan, piezas, grabaciones, ancla],
  );

  const especiales = useMemo(() => (clients ? fechasEspecialesDelMes(ancla, clients) : []), [ancla, clients]);

  if (!plan || !dias || !clients || !cierre || !entregas) {
    return <Cargando />;
  }

  const paso = (dir: 1 | -1) => setAncla((a) => (vista === "mes" ? addMonths(a, dir) : addWeeks(a, dir)));
  const semana = diasDeLaSemana(ancla);
  const titulo =
    vista === "mes"
      ? format(ancla, "MMMM yyyy", { locale: es })
      : `${format(semana[0], "d MMM", { locale: es })} – ${format(semana[6], "d MMM", { locale: es })}`;

  async function mover(piezaId: string, fecha: string) {
    setError(null);
    try {
      await actualizarPieza(piezaId, { noAntesDe: fecha });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo mover la tarea.");
    }
  }

  const detalle = seleccionado ? dias[seleccionado] : undefined;
  const finMes = toISODate(endOfMonth(ancla)) < hoyISO;
  const nombreMes = format(startOfMonth(ancla), "MMMM", { locale: es });
  const mesISO = toISODate(ancla).slice(0, 7);
  const entregasDelMes = entregas.filter((e) => e.fecha.startsWith(mesISO));
  const nombre = (id: string) => clients.find((c) => c.id === id)?.nombre ?? "";

  return (
    <div className="mx-auto max-w-[640px] px-4 pt-2 lg:max-w-[1180px] lg:px-8 lg:pt-4">
      <header className="entra mb-5 flex flex-wrap items-center justify-between gap-3 lg:mb-6">
        <h1 className="titulo-serif text-[1.875rem] font-medium leading-[1.15] lg:text-[2.25rem]">Calendario</h1>
        <div role="tablist" aria-label="Vista" className="relative flex rounded-[14px] bg-bg-hundida p-1">
          <span
            aria-hidden
            className="absolute bottom-1 left-1 top-1 w-[calc(50%-4px)] rounded-[10px] bg-bg-elevada shadow-papel transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ transform: vista === "mes" ? "translateX(100%)" : undefined }}
          />
          {(["semana", "mes"] as Vista[]).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={vista === v}
              onClick={() => setVista(v)}
              className={cn(
                "relative w-20 rounded-[10px] py-1.5 text-[0.9375rem] font-medium capitalize transition-colors",
                vista === v ? "text-texto" : "text-texto-secundario hover:text-texto",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </header>

      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => paso(-1)} aria-label="Anterior" className="tocable rounded-full p-1.5 text-texto-secundario hover:bg-borde/50">
          <ChevronLeft size={22} />
        </button>
        <div className="flex items-center gap-3">
          <p key={titulo} className="titulo-serif aparece text-[1.125rem] font-medium capitalize">{titulo}</p>
          <button onClick={() => setAncla(today)} className="tocable rounded-full bg-terracota/10 px-2.5 py-0.5 text-[0.8125rem] font-medium text-terracota hover:bg-terracota/15">
            Hoy
          </button>
        </div>
        <button onClick={() => paso(1)} aria-label="Siguiente" className="tocable rounded-full p-1.5 text-texto-secundario hover:bg-borde/50">
          <ChevronRight size={22} />
        </button>
      </div>

      {error && <p className="mb-3 text-[0.8125rem] text-[var(--color-error)]">{error}</p>}

      {vista === "mes" ? (
        <>
          <VistaMes
            ancla={ancla}
            dias={dias}
            clients={clients}
            especiales={especiales}
            seleccionado={seleccionado}
            onSeleccionar={setSeleccionado}
            hoyISO={hoyISO}
          />
          {detalle && (
            <DetalleDia info={detalle} clients={clients} especial={especiales.find((e) => e.fecha === detalle.fecha)} />
          )}

          <section className="entra mt-6">
            <h2 className="titulo-serif mb-2 text-[1.25rem] font-medium">Entregas de {nombreMes}</h2>
            {entregasDelMes.length === 0 ? (
              <p className="text-[0.9375rem] text-texto-secundario">No hay entregas con fecha este mes.</p>
            ) : (
              <ul className="papel flex flex-col divide-y divide-borde/80 px-1.5">
                {entregasDelMes.map((e) => (
                  <li key={`${e.clienteId}-${e.fecha}`}>
                    <Link
                      href={`/clientes/${e.clienteId}`}
                      className="tocable flex items-start gap-3 rounded-[12px] px-2.5 py-3 hover:bg-bg-hundida/60"
                    >
                      <SemaforoPunto semaforo={e.semaforo} className="mt-1.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[0.9375rem]">
                          <span
                            className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                            style={{ background: colorCliente(clients, e.clienteId) }}
                            aria-hidden
                          />
                          <span className="font-semibold">{nombre(e.clienteId)}</span>
                          <span className="numeros text-texto-secundario">
                            {" "}
                            · {e.hechas} de {e.total} · vence {fechaDM(e.fecha)}
                          </span>
                        </p>
                        <p className="text-[0.8125rem] text-texto-secundario">
                          {avanceTexto(e.porTipo)}
                          {e.provisoria && " · falta grabar"}
                        </p>
                      </div>
                      <span className={cn("shrink-0 text-[0.8125rem] font-medium", SEMAFORO_ENTREGA[e.semaforo].texto)}>
                        {SEMAFORO_ENTREGA[e.semaforo].label}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {especiales.length > 0 && (
            <section className="entra mt-6">
              <h2 className="titulo-serif mb-2 text-[1.25rem] font-medium">Fechas especiales</h2>
              <ul className="papel flex flex-col divide-y divide-borde/80 px-1.5">
                {especiales.map((f) => (
                  <li key={`${f.fecha}-${f.nombre}`} className="flex items-start gap-3 px-2.5 py-3 text-[0.9375rem]">
                    <Star size={14} className="mt-1 shrink-0 fill-ambar text-ambar" />
                    <span className="numeros w-12 shrink-0 font-medium">{format(fromISODate(f.fecha), "d MMM", { locale: es })}</span>
                    <span className="min-w-0 flex-1">
                      {f.nombre}
                      <span className="block text-[0.8125rem] text-texto-secundario">
                        {f.clienteIds.length > 0 ? f.clienteIds.map(nombre).join(", ") : "Todos los rubros"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="papel entra mt-6 px-4 py-3.5">
            <h2 className="titulo-serif mb-2 text-[1.25rem] font-medium">Cierre de {nombreMes}</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[0.9375rem]">
              <dt className="text-texto-secundario">Entregadas o programadas</dt>
              <dd className="text-right font-medium">{cierre.entregadas}</dd>
              <dt className="text-texto-secundario">Pendientes</dt>
              <dd className="text-right font-medium">{cierre.pendientes}</dd>
              <dt className="text-texto-secundario">Piezas planificadas</dt>
              <dd className="text-right font-medium">
                {fmtPiezas(cierre.cargaPlanificada)} de {fmtPiezas(cierre.capacidad)}
              </dd>
              <dt className="text-texto-secundario">Días libres de carga</dt>
              <dd className="text-right font-medium">{cierre.diasLibres}</dd>
            </dl>
            <p className="mt-3 text-[0.8125rem] text-texto-secundario">
              {finMes
                ? "El plan solo cubre desde hoy, así que un mes pasado no tiene carga planificada."
                : "Planificado y días libres cuentan desde hoy, contra tu tope de piezas por día."}
            </p>
          </section>
        </>
      ) : (
        <>
          <VistaSemana ancla={ancla} dias={dias} clients={clients} hoyISO={hoyISO} onMover={mover} />
        </>
      )}
    </div>
  );
}
