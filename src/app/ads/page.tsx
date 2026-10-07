"use client";

import { useMemo, useState } from "react";
import { format, parse } from "date-fns";
import { es } from "date-fns/locale";
import { Check, CircleAlert } from "lucide-react";
import {
  actualizarCliente,
  guardarChequeoAds,
  guardarReporteAds,
  useAdsChequeos,
  useAdsReportes,
  useClients,
} from "@/lib/supabase/data";
import {
  CADENCIA_REVISION_FONDO_DIAS,
  clientesAds,
  diasDesdeRevision,
  hoyEnVentanaDeReportes,
  reportesDelMes,
} from "@/lib/domain/ads";
import { toISODate } from "@/lib/domain/dates";
import { AdsEstado } from "@/lib/domain/types";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";

export default function AdsPage() {
  const today = useMemo(() => new Date(), []);
  const hoyISO = toISODate(today);
  const clients = useClients();
  const chequeos = useAdsChequeos();
  const reportes = useAdsReportes();
  const [error, setError] = useState<string | null>(null);

  if (!clients) return <div className="px-4 py-8 text-texto-secundario">Cargando...</div>;

  const cuentas = clientesAds(clients);
  const estadoHoy = new Map((chequeos ?? []).filter((c) => c.fecha === hoyISO).map((c) => [c.clienteId, c.estado]));
  const rotacion = [...cuentas].sort((a, b) => diasDesdeRevision(b, today) - diasDesdeRevision(a, today));
  const filasReporte = reportesDelMes(clients, reportes ?? [], today);
  const periodoReporte = filasReporte[0]?.periodo;

  async function guardar(accion: () => Promise<void>) {
    setError(null);
    try {
      await accion();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar. Probá de nuevo.");
    }
  }

  return (
    <div className="mx-auto max-w-[640px] px-4 pt-6 lg:max-w-[880px] lg:px-8 lg:pt-10">
      <header className="mb-5 lg:mb-8">
        <p className="text-[0.8125rem] font-medium capitalize text-texto-secundario">
          {format(today, "EEEE d 'de' MMMM", { locale: es })}
        </p>
        <h1 className="text-[1.25rem] font-semibold">Ads</h1>
      </header>

      {error && <p className="mb-4 text-[0.8125rem] text-[var(--color-error)]">{error}</p>}

      {cuentas.length === 0 ? (
        <EmptyState
          title="No hay cuentas de Ads"
          detail="Los clientes con servicio Ads o Contenido + Ads aparecen acá."
        />
      ) : (
        <div className="flex flex-col gap-8">
          <section>
            <h2 className="mb-2 text-[0.9375rem] font-semibold">Chequeo de hoy</h2>
            <ul className="flex flex-col divide-y divide-borde border-y border-borde">
              {cuentas.map((c) => {
                const estado = estadoHoy.get(c.id);
                return (
                  <li key={c.id} className="flex items-center gap-3 px-2 py-3">
                    <p className="min-w-0 flex-1 truncate font-semibold">{c.nombre}</p>
                    <Boton
                      activo={estado === "ok"}
                      tono="verde"
                      onClick={() => guardar(() => guardarChequeoAds(c.id, hoyISO, "ok" as AdsEstado))}
                    >
                      <Check size={14} /> OK
                    </Boton>
                    <Boton
                      activo={estado === "revisar"}
                      tono="terracota"
                      onClick={() => guardar(() => guardarChequeoAds(c.id, hoyISO, "revisar" as AdsEstado))}
                    >
                      <CircleAlert size={14} /> Revisar
                    </Boton>
                  </li>
                );
              })}
            </ul>
          </section>

          <section>
            <h2 className="mb-1 text-[0.9375rem] font-semibold">Revisión a fondo</h2>
            <p className="mb-2 text-[0.8125rem] text-texto-secundario">
              Cada cuenta se revisa a fondo cada {CADENCIA_REVISION_FONDO_DIAS} días. Va rotando: la más atrasada
              aparece en Hoy y es lo primero que se posterga si no entra.
            </p>
            <ul className="flex flex-col divide-y divide-borde border-y border-borde">
              {rotacion.map((c) => {
                const dias = diasDesdeRevision(c, today);
                const vencida = dias >= CADENCIA_REVISION_FONDO_DIAS;
                return (
                  <li key={c.id} className="flex items-center gap-3 px-2 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{c.nombre}</p>
                      <p className={cn("text-[0.8125rem]", vencida ? "text-terracota" : "text-texto-secundario")}>
                        {dias === Infinity ? "Nunca revisada" : dias === 0 ? "Revisada hoy" : `Hace ${dias} d`}
                      </p>
                    </div>
                    <button
                      onClick={() => guardar(() => actualizarCliente(c.id, { adsUltimaRevision: hoyISO }))}
                      className="shrink-0 rounded-[8px] border border-borde px-2.5 py-1 text-[0.8125rem] font-medium"
                    >
                      Revisada hoy
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section>
            <h2 className="mb-1 text-[0.9375rem] font-semibold">
              Reportes de {periodoReporte ? format(parse(periodoReporte, "yyyy-MM", new Date()), "MMMM", { locale: es }) : "el mes"}
            </h2>
            <p className="mb-2 text-[0.8125rem] text-texto-secundario">
              {hoyEnVentanaDeReportes(today)
                ? "Se mandan del 1 al 5: estás en plazo."
                : "Se mandan del 1 al 5 de cada mes."}
            </p>
            <ul className="flex flex-col divide-y divide-borde border-y border-borde">
              {filasReporte.map((f) => (
                <li key={f.cliente.id} className="flex items-center gap-3 px-2 py-3">
                  <p className="min-w-0 flex-1 truncate font-semibold">{f.cliente.nombre}</p>
                  <button
                    onClick={() =>
                      guardar(() =>
                        guardarReporteAds(f.cliente.id, f.periodo, f.estado === "enviado" ? "pendiente" : "enviado"),
                      )
                    }
                    className={cn(
                      "shrink-0 rounded-[8px] px-2.5 py-1 text-[0.8125rem] font-medium",
                      f.estado === "enviado" && "bg-verde/15 text-verde",
                      f.estado === "pendiente" && !f.atrasado && "bg-ambar/15 text-ambar",
                      f.atrasado && "bg-terracota/15 text-terracota",
                    )}
                  >
                    {f.estado === "enviado" ? "Enviado" : f.atrasado ? "Atrasado" : "Pendiente"}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

function Boton({
  activo,
  tono,
  onClick,
  children,
}: {
  activo: boolean;
  tono: "verde" | "terracota";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={activo}
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-[8px] border px-2.5 py-1 text-[0.8125rem] font-medium",
        activo
          ? tono === "verde"
            ? "border-verde/30 bg-verde/15 text-verde"
            : "border-terracota/30 bg-terracota/15 text-terracota"
          : "border-borde text-texto-secundario",
      )}
    >
      {children}
    </button>
  );
}
