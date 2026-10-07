"use client";

import { useMemo, useState } from "react";
import { addMonths, addWeeks, endOfMonth, format, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { actualizarPieza } from "@/lib/supabase/data";
import { usePlan } from "@/lib/supabase/use-plan";
import { armarDias, cierreDelMes, diasDeLaSemana, grillaDelMes } from "@/lib/domain/calendario";
import { toISODate } from "@/lib/domain/dates";
import { VistaMes } from "@/components/calendario/vista-mes";
import { VistaSemana } from "@/components/calendario/vista-semana";
import { DetalleDia } from "@/components/calendario/detalle-dia";
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

  const dias = useMemo(() => {
    if (!plan) return null;
    const fechas = [...grillaDelMes(ancla), ...diasDeLaSemana(ancla)].map(toISODate);
    return armarDias(plan, cobros ?? [], today, fechas);
  }, [plan, cobros, ancla, today]);

  const cierre = useMemo(
    () => (plan && piezas && grabaciones ? cierreDelMes(ancla, piezas, grabaciones, plan) : null),
    [plan, piezas, grabaciones, ancla],
  );

  if (!plan || !dias || !clients || !cierre) {
    return <div className="px-4 py-8 text-texto-secundario">Cargando...</div>;
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

  return (
    <div className="mx-auto max-w-[640px] px-4 pt-6 lg:max-w-[1180px] lg:px-8 lg:pt-10">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 lg:mb-6">
        <h1 className="text-[1.25rem] font-semibold">Calendario</h1>
        <div role="tablist" aria-label="Vista" className="flex rounded-[12px] border border-borde p-0.5">
          {(["semana", "mes"] as Vista[]).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={vista === v}
              onClick={() => setVista(v)}
              className={cn(
                "rounded-[10px] px-4 py-1.5 text-[0.9375rem] font-medium capitalize",
                vista === v ? "bg-terracota text-bg" : "text-texto-secundario",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </header>

      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => paso(-1)} aria-label="Anterior" className="p-1 text-texto-secundario">
          <ChevronLeft size={22} />
        </button>
        <div className="flex items-center gap-3">
          <p className="font-semibold capitalize">{titulo}</p>
          <button onClick={() => setAncla(today)} className="text-[0.8125rem] font-medium text-terracota">
            Hoy
          </button>
        </div>
        <button onClick={() => paso(1)} aria-label="Siguiente" className="p-1 text-texto-secundario">
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
            seleccionado={seleccionado}
            onSeleccionar={setSeleccionado}
            hoyISO={hoyISO}
          />
          {detalle && <DetalleDia info={detalle} clients={clients} />}

          <section className="mt-6 rounded-[12px] border border-borde bg-bg-elevada px-4 py-3">
            <h2 className="mb-2 font-semibold">Cierre de {nombreMes}</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[0.9375rem]">
              <dt className="text-texto-secundario">Entregadas o programadas</dt>
              <dd className="text-right font-medium">{cierre.entregadas}</dd>
              <dt className="text-texto-secundario">Pendientes</dt>
              <dd className="text-right font-medium">{cierre.pendientes}</dd>
              <dt className="text-texto-secundario">Horas planificadas</dt>
              <dd className="text-right font-medium">
                {cierre.horasPlanificadas} de {cierre.capacidadHoras} h
              </dd>
              <dt className="text-texto-secundario">Horas reales cargadas</dt>
              <dd className="text-right font-medium">{cierre.horasReales} h</dd>
              <dt className="text-texto-secundario">Días libres de carga</dt>
              <dd className="text-right font-medium">{cierre.diasLibres}</dd>
            </dl>
            <p className="mt-3 text-[0.8125rem] text-texto-secundario">
              {finMes
                ? "El plan solo cubre desde hoy, así que un mes pasado no tiene horas."
                : "Planificado y días libres cuentan desde hoy. Las horas reales son las que cargaste en las piezas."}
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
