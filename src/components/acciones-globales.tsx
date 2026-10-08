"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bell, Plus } from "lucide-react";
import { crearTarea } from "@/lib/supabase/data";
import { usePlan } from "@/lib/supabase/use-plan";
import { AlertaGlobal, AlertaGrupo, alertasGlobales } from "@/lib/domain/alertas";
import { BotonPrimario, Sheet } from "@/components/sheet";
import { Sol } from "@/components/empty-state";

const GRUPO_LABEL: Record<AlertaGrupo, string> = {
  atraso: "Atrasos",
  aprobacion: "Aprobaciones demoradas",
  cobro: "Cobros vencidos",
  contenido: "Contenido",
  ads: "Ads",
  carga: "Días sobrecargados",
};
const GRUPO_ORDEN: AlertaGrupo[] = ["atraso", "carga", "aprobacion", "cobro", "contenido", "ads"];

const campo = "input";
const etiqueta = "text-[0.8125rem] font-medium text-texto-secundario";

/** Top bar with the alerts bell, plus the floating "+" for loose tasks. Rendered
 * once by the app frame, so both are on every screen. */
export function AccionesGlobales() {
  const ctx = usePlan();
  const [campanaAbierta, setCampanaAbierta] = useState(false);
  const [tareaAbierta, setTareaAbierta] = useState(false);

  const alertas = useMemo(
    () =>
      ctx
        ? alertasGlobales({
            plan: ctx.plan,
            clients: ctx.clients,
            piezas: ctx.piezas,
            cobros: ctx.cobros,
            reportes: ctx.reportes,
            today: ctx.today,
          })
        : [],
    [ctx],
  );

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between bg-bg/80 px-4 py-2 backdrop-blur-md lg:justify-end lg:bg-transparent lg:px-8 lg:backdrop-blur-none">
        <Link href="/hoy" className="lg:hidden" aria-label="Paula — ir a Hoy">
          <span className="titulo-serif text-[1.25rem] font-medium italic leading-none">Paula</span>
          <span className="ml-0.5 inline-block h-1 w-1 rounded-full bg-terracota" aria-hidden />
        </Link>
        <button
          onClick={() => setCampanaAbierta(true)}
          aria-label={alertas.length > 0 ? `Alertas: ${alertas.length}` : "Alertas"}
          className="tocable relative rounded-full p-2 text-texto-secundario hover:bg-borde/50 hover:text-texto"
        >
          <Bell size={20} strokeWidth={1.75} className={alertas.length > 0 ? "campanita" : undefined} />
          {alertas.length > 0 && (
            <span className="pop absolute right-0 top-0 flex h-[16px] min-w-[16px] items-center justify-center rounded-[8px] bg-terracota px-1 text-[0.6875rem] font-medium leading-none text-bg ring-2 ring-bg">
              {alertas.length}
            </span>
          )}
        </button>
      </div>

      <button
        onClick={() => setTareaAbierta(true)}
        aria-label="Agregar tarea suelta"
        className="boton-primario tocable fixed bottom-[calc(92px+env(safe-area-inset-bottom,0px))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-[18px] group lg:bottom-8 lg:right-8"
      >
        <Plus size={24} strokeWidth={2.25} className="transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:rotate-90 group-active:rotate-90" />
      </button>

      <Sheet open={campanaAbierta} title="Alertas" onClose={() => setCampanaAbierta(false)}>
        <ListaAlertas alertas={alertas} onNavegar={() => setCampanaAbierta(false)} />
      </Sheet>

      {tareaAbierta && ctx && (
        <FormTarea
          clientes={ctx.clients.filter((c) => c.activo).map((c) => ({ id: c.id, nombre: c.nombre }))}
          onClose={() => setTareaAbierta(false)}
        />
      )}
    </>
  );
}

function ListaAlertas({ alertas, onNavegar }: { alertas: AlertaGlobal[]; onNavegar: () => void }) {
  if (alertas.length === 0) {
    return <div className="flex flex-col items-center py-6 text-center">
        <Sol />
        <p className="titulo-serif mt-3 text-[1.125rem] font-medium">Todo viene en orden</p>
        <p className="mt-0.5 text-[0.9375rem] text-texto-secundario">Sin alertas por ahora.</p>
      </div>;
  }
  return (
    <div className="flex flex-col gap-4">
      {GRUPO_ORDEN.map((g) => {
        const items = alertas.filter((a) => a.grupo === g);
        if (items.length === 0) return null;
        return (
          <section key={g}>
            <h3 className="mb-1.5 text-[0.8125rem] font-medium text-texto-secundario">{GRUPO_LABEL[g]}</h3>
            <ul className="flex flex-col gap-1.5">
              {items.map((a) => (
                <li key={a.id}>
                  {a.href ? (
                    <Link
                      href={a.href}
                      onClick={onNavegar}
                      className="tocable block rounded-[12px] bg-ambar/10 px-4 py-3 text-[0.9375rem] hover:bg-ambar/15"
                    >
                      {a.mensaje}
                    </Link>
                  ) : (
                    <p className="rounded-[12px] bg-ambar/10 px-4 py-3 text-[0.9375rem]">{a.mensaje}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function FormTarea({
  clientes,
  onClose,
}: {
  clientes: { id: string; nombre: string }[];
  onClose: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [horas, setHoras] = useState(0.5);
  const [fechaLimite, setFechaLimite] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    if (!titulo.trim()) {
      setError("Poné qué hay que hacer.");
      return;
    }
    if (!(horas > 0)) {
      setError("Las horas tienen que ser mayores a 0.");
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      await crearTarea({
        titulo: titulo.trim(),
        horas,
        fechaLimite: fechaLimite || undefined,
        clienteId: clienteId || undefined,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar. Probá de nuevo.");
      setGuardando(false);
    }
  }

  return (
    <Sheet open title="Tarea suelta" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className={etiqueta}>¿Qué hay que hacer?</span>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={campo} autoFocus />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className={etiqueta}>Horas</span>
            <input
              type="number"
              min={0.25}
              step={0.25}
              value={horas}
              onChange={(e) => setHoras(Number(e.target.value))}
              className={campo}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={etiqueta}>Para el (opcional)</span>
            <input type="date" value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} className={campo} />
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <span className={etiqueta}>Cliente (opcional)</span>
          <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className={campo}>
            <option value="">Ninguno</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        <p className="text-[0.8125rem] text-texto-secundario">
          Entra al plan en el primer día con lugar, antes de su fecha si la tiene.
        </p>
        {error && <p className="text-[0.8125rem] text-[var(--color-error)]">{error}</p>}
        <BotonPrimario onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando..." : "Agregar"}
        </BotonPrimario>
      </div>
    </Sheet>
  );
}
