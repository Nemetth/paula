"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { endOfMonth, format } from "date-fns";
import { es } from "date-fns/locale";
import {
  actualizarCliente,
  crearGasto,
  crearOActualizarCobro,
  eliminarGasto,
  useClients,
  useCobros,
  useGastos,
} from "@/lib/supabase/data";
import { balanceDelMes, proximoAumento } from "@/lib/domain/plata";
import { CobroEstado } from "@/lib/domain/types";
import { estadoCobro } from "@/lib/domain/cobros";
import { toISODate } from "@/lib/domain/dates";
import { EmptyState } from "@/components/empty-state";
import { cn, indice } from "@/lib/utils";

const ESTADO_LABEL: Record<CobroEstado, string> = {
  pendiente: "Pendiente",
  pagado: "Pagado",
  vencido: "Vencido",
};

function periodoActual() {
  return toISODate(new Date()).slice(0, 7);
}

export default function PlataPage() {
  const clients = useClients();
  const periodo = periodoActual();
  const cobrosTodos = useCobros();
  const gastos = useGastos();
  const cobros = useMemo(() => cobrosTodos?.filter((c) => c.periodo === periodo), [cobrosTodos, periodo]);

  // Make sure every active client has a cobro row for the current period.
  useEffect(() => {
    if (!clients || !cobros) return;
    const existentes = new Set(cobros.map((c) => c.clienteId));
    const hoy = new Date();
    clients
      .filter((c) => c.activo && !existentes.has(c.id))
      .forEach((c) => {
        const diaVencimiento = c.ventanaCobro?.[1] ?? endOfMonth(hoy).getDate();
        const fecha = new Date(hoy.getFullYear(), hoy.getMonth(), Math.min(diaVencimiento, endOfMonth(hoy).getDate()));
        crearOActualizarCobro(c.id, periodo, {
          monto: c.montoMensual,
          fechaVencimiento: toISODate(fecha),
        });
      });
  }, [clients, cobros, periodo]);

  const filas = useMemo(() => {
    if (!clients || !cobros) return [];
    const hoy = new Date();
    return cobros
      .map((cobro) => {
        const cliente = clients.find((c) => c.id === cobro.clienteId);
        const estado: CobroEstado = estadoCobro(cobro, hoy);
        return { cobro, cliente, estado };
      })
      .filter((f) => f.cliente)
      .sort((a, b) => (a.estado === b.estado ? 0 : a.estado === "vencido" ? -1 : 1));
  }, [clients, cobros]);

  const totalPendiente = filas
    .filter((f) => f.estado !== "pagado")
    .reduce((sum, f) => sum + (f.cobro.monto ?? 0), 0);
  const totalVencido = filas
    .filter((f) => f.estado === "vencido")
    .reduce((sum, f) => sum + (f.cobro.monto ?? 0), 0);

  return (
    <div className="mx-auto max-w-[640px] px-4 pt-2 lg:max-w-[880px] lg:px-8 lg:pt-4">
      <header className="entra mb-6 lg:mb-8">
        <p className="text-[0.8125rem] font-medium text-texto-secundario mayuscula">
          {format(new Date(), "MMMM yyyy", { locale: es })}
        </p>
        <h1 className="titulo-serif text-[1.875rem] font-medium leading-[1.15] lg:text-[2.25rem]">Plata</h1>
      </header>

      <div className="mb-7 grid gap-3 lg:grid-cols-[1fr_1.6fr]">
        <div className="papel entra px-4 py-3.5" style={indice(1)}>
          <p className="text-[0.8125rem] text-texto-secundario">Por cobrar este mes</p>
          <Monto valor={totalPendiente} className="text-[1.75rem]" />
          {totalVencido > 0 ? (
            <p className="numeros text-[0.8125rem] font-medium text-terracota">
              ${totalVencido.toLocaleString("es-AR")} vencido
            </p>
          ) : (
            <p className="text-[0.8125rem] text-texto-secundario">Nada vencido</p>
          )}
        </div>
        <BalanceCard cobros={cobrosTodos ?? []} gastos={gastos ?? []} periodo={periodo} />
      </div>

      {filas.length === 0 ? (
        <EmptyState title="Nada para cobrar todavía" detail="Los cobros del mes aparecen acá una vez que tengas clientes activos." />
      ) : (
        <ul className="papel entra flex flex-col divide-y divide-borde/80 px-1.5">
          {filas.map(({ cobro, cliente, estado }) => (
            <li key={cobro.id} className="flex items-center gap-3 px-2 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{cliente!.nombre}</p>
                <p className="text-[0.8125rem] text-texto-secundario">
                  Vence {format(new Date(cobro.fechaVencimiento), "d MMM", { locale: es })}
                  {cobro.monto ? ` · $${cobro.monto.toLocaleString("es-AR")}` : ""}
                </p>
              </div>
              <button
                onClick={() =>
                  crearOActualizarCobro(cliente!.id, periodo, {
                    estado: estado === "pagado" ? "pendiente" : "pagado",
                    fechaPago: estado === "pagado" ? undefined : toISODate(new Date()),
                  })
                }
                className={cn(
                  "tocable shrink-0 rounded-[8px] px-2.5 py-1 text-[0.8125rem] font-medium",
                  estado === "pagado" && "pop bg-verde/15 text-verde",
                  estado === "vencido" && "bg-terracota/15 text-terracota",
                  estado === "pendiente" && "bg-ambar/15 text-ambar",
                )}
              >
                {ESTADO_LABEL[estado]}
              </button>
            </li>
          ))}
        </ul>
      )}

      <GastosSection gastos={(gastos ?? []).filter((g) => g.fecha.startsWith(periodo))} />
      <AumentosSection clients={clients ?? []} />
      <HistorialSection clients={clients ?? []} cobros={cobrosTodos ?? []} />
    </div>
  );
}

function BalanceCard({
  cobros,
  gastos,
  periodo,
}: {
  cobros: ReturnType<typeof useCobros> & object;
  gastos: ReturnType<typeof useGastos> & object;
  periodo: string;
}) {
  const { cobrado, gastado, queda } = balanceDelMes(cobros, gastos, periodo);
  return (
    <div className="papel entra grid grid-cols-1 divide-y divide-borde/80 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:py-3.5" style={indice(2)}>
      <StatCard label="Cobrado" valor={cobrado} tono="verde" />
      <StatCard label="Gastos" valor={gastado} />
      <StatCard label="Me queda" valor={queda} tono={queda < 0 ? "terracota" : "neutral"} />
    </div>
  );
}

function GastosSection({ gastos }: { gastos: NonNullable<ReturnType<typeof useGastos>> }) {
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    const valor = Number(monto);
    if (!concepto.trim() || !(valor > 0)) {
      setError("Poné un concepto y un monto mayor a 0.");
      return;
    }
    setError(null);
    try {
      await crearGasto({ fecha: toISODate(new Date()), concepto: concepto.trim(), monto: valor });
      setConcepto("");
      setMonto("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    }
  }

  return (
    <section className="mt-8">
      <h2 className="titulo-serif mb-2 text-[1.25rem] font-medium">Gastos del mes</h2>
      <form onSubmit={agregar} className="mb-3 flex gap-2">
        <input
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
          placeholder="Concepto"
          aria-label="Concepto del gasto"
          className="input min-w-0 flex-1"
        />
        <input
          type="number"
          min={0}
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder="$"
          aria-label="Monto del gasto"
          className="input w-28"
        />
        <button type="submit" className="boton-primario tocable rounded-[12px] px-4 py-2.5 font-medium">
          Agregar
        </button>
      </form>
      {error && <p className="mb-2 text-[0.8125rem] text-[var(--color-error)]">{error}</p>}
      {gastos.length > 0 && (
        <ul className="papel flex flex-col divide-y divide-borde/80 px-1.5">
          {gastos.map((g) => (
            <li key={g.id} className="flex items-center gap-3 px-2 py-3">
              <p className="min-w-0 flex-1 truncate">{g.concepto}</p>
              <p className="text-[0.9375rem] font-medium">${g.monto.toLocaleString("es-AR")}</p>
              <button onClick={() => eliminarGasto(g.id)} aria-label="Eliminar gasto" className="tocable rounded-full p-1.5 text-texto-secundario hover:bg-terracota/10 hover:text-terracota">
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AumentosSection({ clients }: { clients: NonNullable<ReturnType<typeof useClients>> }) {
  const hoy = new Date();
  const filas = clients
    .filter((c) => c.activo && c.montoMensual)
    .map((c) => ({ c, prox: proximoAumento(c, hoy) }))
    .sort((a, b) => a.prox.dias - b.prox.dias);
  if (filas.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="titulo-serif mb-1 text-[1.25rem] font-medium">Próximo aumento</h2>
      <p className="mb-2 text-[0.8125rem] text-texto-secundario">Toca cada 3 meses desde el último aumento.</p>
      <ul className="papel flex flex-col divide-y divide-borde/80 px-1.5">
        {filas.map(({ c, prox }) => (
          <li key={c.id} className="flex items-center gap-3 px-2 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{c.nombre}</p>
              <p className={cn("text-[0.8125rem]", prox.dias <= 0 ? "text-terracota" : prox.dias <= 30 ? "text-ambar" : "text-texto-secundario")}>
                {prox.dias < 0 ? `Atrasado ${-prox.dias} d` : prox.dias === 0 ? "Toca hoy" : `En ${prox.dias} d`} · {format(new Date(prox.fecha), "d MMM yyyy", { locale: es })}
              </p>
            </div>
            <button
              onClick={() => actualizarCliente(c.id, { ultimoAumento: toISODate(hoy) })}
              className="tocable shrink-0 rounded-[8px] border border-borde px-2.5 py-1 text-[0.8125rem] font-medium hover:bg-borde/40"
            >
              Aplicado hoy
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function HistorialSection({
  clients,
  cobros,
}: {
  clients: NonNullable<ReturnType<typeof useClients>>;
  cobros: NonNullable<ReturnType<typeof useCobros>>;
}) {
  const hoy = new Date();
  const conCobros = clients.filter((c) => cobros.some((x) => x.clienteId === c.id));
  if (conCobros.length === 0) return null;
  return (
    <section className="mt-8 pb-6">
      <h2 className="titulo-serif mb-2 text-[1.25rem] font-medium">Historial por cliente</h2>
      <ul className="papel flex flex-col divide-y divide-borde/80 px-1.5">
        {conCobros.map((c) => (
          <li key={c.id}>
            <details className="group px-2 py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between font-semibold [&::-webkit-details-marker]:hidden">
                {c.nombre}
                <ChevronDown size={16} className="text-texto-secundario transition-transform duration-300 group-open:rotate-180" />
              </summary>
              <ul className="mt-2 flex flex-col gap-1.5">
                {cobros
                  .filter((x) => x.clienteId === c.id)
                  .sort((a, b) => b.periodo.localeCompare(a.periodo))
                  .map((x) => (
                    <li key={x.id} className="flex justify-between text-[0.9375rem]">
                      <span className="text-texto-secundario">{x.periodo}</span>
                      <span>
                        {x.monto != null ? `$${x.monto.toLocaleString("es-AR")} · ` : ""}
                        {ESTADO_LABEL[estadoCobro(x, hoy)]}
                      </span>
                    </li>
                  ))}
              </ul>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StatCard({
  label,
  valor,
  tono = "neutral",
}: {
  label: string;
  valor: number;
  tono?: "neutral" | "terracota" | "verde";
}) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 px-4 py-2.5 sm:block sm:py-0">
      <p className="text-[0.8125rem] text-texto-secundario">{label}</p>
      <Monto
        valor={valor}
        className={cn(
          "text-[1.125rem] sm:text-[1.25rem]",
          tono === "terracota" && "text-terracota",
          tono === "verde" && "text-verde",
        )}
      />
    </div>
  );
}

/** A peso amount that rolls from its last value to the new one, so marking a
 * cobro "pagado" visibly moves the totals instead of silently swapping them. */
function Monto({ valor, className }: { valor: number; className?: string }) {
  const [mostrado, setMostrado] = useState(valor);
  const desde = useRef(valor);

  useEffect(() => {
    const inicio = desde.current;
    if (inicio === valor) return;
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t0 = performance.now();
    let raf = 0;
    const paso = (t: number) => {
      const k = quieto ? 1 : Math.min((t - t0) / 700, 1);
      const e = 1 - Math.pow(1 - k, 4);
      const v = Math.round(inicio + (valor - inicio) * e);
      desde.current = v;
      setMostrado(v);
      if (k < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [valor]);

  return (
    <p className={cn("titulo-serif numeros truncate font-medium leading-tight", className)}>
      ${mostrado.toLocaleString("es-AR")}
    </p>
  );
}
