"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { format } from "date-fns";
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
import { Cobro, CobroEstado } from "@/lib/domain/types";
import { cobrosDelPeriodo, estadoCobro } from "@/lib/domain/cobros";
import { fechaCorta, fromISODate, nombreMes, toISODate } from "@/lib/domain/dates";
import { AvisoDeshacer, AvisoDeshacerToast, avisarConDeshacer } from "@/components/aviso-deshacer";
import { BotonEliminar } from "@/components/boton-eliminar";
import { EmptyState } from "@/components/empty-state";
import { Encabezado } from "@/components/encabezado";
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
  // Every active client's cobro for the month, saved or not: rows are only
  // written when Paula changes one, so opening this screen changes no number.
  const cobros = useMemo(
    () => (clients && cobrosTodos ? cobrosDelPeriodo(clients, cobrosTodos, periodo) : undefined),
    [clients, cobrosTodos, periodo],
  );
  const [errorCobro, setErrorCobro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<AvisoDeshacer | null>(null);
  const avisoId = useRef(0);
  const cerrarAviso = useCallback(() => setAviso(null), []);

  /** One tap flips a cobro between cobrado and not, so every flip can be taken back. */
  function alternarCobro(cobro: Cobro, nombre: string, estadoGuardado: CobroEstado, estabaPagado: boolean) {
    setErrorCobro(null);
    const clienteId = cobro.clienteId;
    const falla = (err: unknown) => setErrorCobro(err instanceof Error ? err.message : "No se pudo guardar el cobro.");
    crearOActualizarCobro(clienteId, periodo, {
      // A cobro that was never saved is written with the due date and amount it shows.
      fechaVencimiento: cobro.fechaVencimiento,
      monto: cobro.monto,
      estado: estabaPagado ? "pendiente" : "pagado",
      fechaPago: estabaPagado ? undefined : toISODate(new Date()),
    })
      .then(() => {
        avisoId.current += 1;
        setAviso({
          id: avisoId.current,
          texto: estabaPagado ? `${nombre}: marcado como no cobrado` : `${nombre}: cobrado`,
          deshacer: () => void crearOActualizarCobro(clienteId, periodo, { estado: estadoGuardado }).catch(falla),
        });
      })
      .catch(falla);
  }

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
  const sinMonto = filas.some((f) => f.estado !== "pagado" && !f.cobro.monto);
  const vencidas = filas.filter((f) => f.estado === "vencido");
  const totalVencido = vencidas.reduce((sum, f) => sum + (f.cobro.monto ?? 0), 0);

  return (
    <div className="mx-auto max-w-[640px] px-4 pt-2 lg:max-w-[880px] lg:px-8 lg:pt-4">
      <Encabezado titulo="Plata" arriba={format(new Date(), "MMMM yyyy", { locale: es })} />

      <div className="mb-7 grid gap-3 lg:grid-cols-[1fr_1.6fr]">
        <div className="papel entra px-4 py-3.5" style={indice(1)}>
          <p className="text-[0.8125rem] text-texto-secundario">Por cobrar este mes</p>
          <Monto valor={totalPendiente} className="text-[1.75rem]" />
          {vencidas.length > 0 ? (
            <p className="numeros text-[0.8125rem] font-medium text-acento-texto">
              {vencidas.length === 1 ? "1 cobro vencido" : `${vencidas.length} cobros vencidos`}
              {totalVencido > 0 && ` · $${totalVencido.toLocaleString("es-AR")}`}
            </p>
          ) : (
            <p className="text-[0.8125rem] text-texto-secundario">Nada vencido</p>
          )}
          {sinMonto && (
            <p className="mt-1 text-[0.8125rem] text-texto-secundario">
              Hay cobros sin monto: cargalo en la ficha de cada cliente y el total se suma acá.
            </p>
          )}
        </div>
        <BalanceCard cobros={cobrosTodos ?? []} gastos={gastos ?? []} periodo={periodo} porCobrar={totalPendiente} />
      </div>

      {errorCobro && (
        <p role="alert" className="mb-3 text-center text-[0.8125rem] text-[var(--color-error)]">
          {errorCobro}
        </p>
      )}

      {filas.length === 0 ? (
        <EmptyState title="Nada para cobrar todavía" detail="Los cobros del mes aparecen acá una vez que tengas clientes activos." />
      ) : (
        <ul className="papel entra flex flex-col divide-y divide-borde/80 px-1.5">
          {filas.map(({ cobro, cliente, estado }) => (
            <li key={cobro.id} className="flex items-center gap-3 px-2 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{cliente!.nombre}</p>
                <p className="text-[0.8125rem] text-texto-secundario">
                  Vence {fechaCorta(cobro.fechaVencimiento)}
                  {cobro.monto ? ` · $${cobro.monto.toLocaleString("es-AR")}` : ""}
                </p>
              </div>
              <button
                onClick={() => alternarCobro(cobro, cliente!.nombre, cobro.estado, estado === "pagado")}
                aria-label={`${cliente!.nombre}: ${ESTADO_LABEL[estado]}. ${estado === "pagado" ? "Marcar como no cobrado" : "Marcar como cobrado"}`}
                className={cn(
                  "tocable shrink-0 rounded-[8px] px-3 py-2 text-[0.8125rem] font-medium ring-1 ring-inset ring-current/25",
                  estado === "pagado" && "pop bg-verde/15 text-verde",
                  estado === "vencido" && "bg-acento/15 text-acento-texto",
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
      <AvisoDeshacerToast aviso={aviso} onCerrar={cerrarAviso} />
    </div>
  );
}

function BalanceCard({
  cobros,
  gastos,
  periodo,
  porCobrar,
}: {
  cobros: ReturnType<typeof useCobros> & object;
  gastos: ReturnType<typeof useGastos> & object;
  periodo: string;
  /** What is still pending this month, so the bar shows the whole month. */
  porCobrar: number;
}) {
  const { cobrado, gastado, queda } = balanceDelMes(cobros, gastos, periodo);
  return (
    <div className="papel entra" style={indice(2)}>
      <div className="grid grid-cols-1 divide-y divide-borde/80 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:py-3.5">
        <StatCard label="Cobrado" valor={cobrado} tono="verde" />
        <StatCard label="Gastos" valor={gastado} />
        <StatCard label="Me queda" valor={queda} tono={queda < 0 ? "acento" : "neutral"} />
      </div>
      <BarraDelMes cobrado={cobrado} porCobrar={porCobrar} gastado={gastado} />
    </div>
  );
}

/** The month at a glance: collected and still to collect on one bar, expenses
 * on another at the same scale, so "how am I doing" reads without numbers. */
function BarraDelMes({ cobrado, porCobrar, gastado }: { cobrado: number; porCobrar: number; gastado: number }) {
  const escala = Math.max(cobrado + porCobrar, gastado, 1);
  const pct = (n: number) => `${(n / escala) * 100}%`;
  if (cobrado + porCobrar + gastado === 0) return null;
  return (
    <div className="border-t border-borde/80 px-4 pb-3.5 pt-3">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-bg-hundida" aria-hidden>
        <span className="h-full bg-verde" style={{ width: pct(cobrado) }} />
        <span className="h-full bg-ambar/70" style={{ width: pct(porCobrar) }} />
      </div>
      <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-full bg-bg-hundida" aria-hidden>
        <span className="h-full bg-acento/70" style={{ width: pct(gastado) }} />
      </div>
      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.75rem] text-texto-secundario">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-verde" /> Cobrado</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-ambar/70" /> Por cobrar ${porCobrar.toLocaleString("es-AR")}</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-acento/70" /> Gastos</span>
      </p>
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
      <h2 className="titulo mb-2 text-[1.25rem] font-medium">Gastos del mes</h2>
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
              <BotonEliminar
                etiqueta="gasto"
                onConfirmar={() => void eliminarGasto(g.id).catch((err) => setError(err instanceof Error ? err.message : "No se pudo eliminar."))}
              />
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
      <h2 className="titulo mb-1 text-[1.25rem] font-medium">Próximo aumento</h2>
      <p className="mb-2 text-[0.8125rem] text-texto-secundario">Toca cada 3 meses desde el último aumento.</p>
      <ul className="papel flex flex-col divide-y divide-borde/80 px-1.5">
        {filas.map(({ c, prox }) => (
          <li key={c.id} className="flex items-center gap-3 px-2 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{c.nombre}</p>
              <p className={cn("text-[0.8125rem]", prox.dias <= 0 ? "text-acento-texto" : prox.dias <= 30 ? "text-ambar" : "text-texto-secundario")}>
                {prox.dias < 0 ? `Atrasado ${-prox.dias} d` : prox.dias === 0 ? "Toca hoy" : `En ${prox.dias} d`} · {format(fromISODate(prox.fecha), "d MMM yyyy", { locale: es })}
              </p>
            </div>
            <button
              onClick={() => {
                const antes = c.ultimoAumento;
                actualizarCliente(c.id, { ultimoAumento: toISODate(hoy) })
                  .then(() =>
                    avisarConDeshacer(`${c.nombre}: aumento aplicado hoy`, () => {
                      // An empty date clears it: the client had no increase on record.
                      void actualizarCliente(c.id, { ultimoAumento: antes ?? "" }).catch(console.error);
                    }),
                  )
                  .catch(console.error);
              }}
              className="tocable shrink-0 rounded-[8px] border border-borde px-3 py-2 text-[0.8125rem] font-medium hover:bg-borde/40"
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
      <h2 className="titulo mb-2 text-[1.25rem] font-medium">Historial por cliente</h2>
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
                      <span className="text-texto-secundario">{nombreMes(x.periodo, hoy)}</span>
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
  tono?: "neutral" | "acento" | "verde";
}) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 px-4 py-2.5 sm:block sm:py-0">
      <p className="text-[0.8125rem] text-texto-secundario">{label}</p>
      <Monto
        valor={valor}
        className={cn(
          "text-[1.125rem] sm:text-[1.25rem]",
          tono === "acento" && "text-acento-texto",
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
    <p className={cn("titulo numeros truncate font-medium leading-tight", className)}>
      ${mostrado.toLocaleString("es-AR")}
    </p>
  );
}
