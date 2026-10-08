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
import { Cargando, EmptyState } from "@/components/empty-state";
import { cn, indice } from "@/lib/utils";

export default function AdsPage() {
  const today = useMemo(() => new Date(), []);
  const hoyISO = toISODate(today);
  const clients = useClients();
  const chequeos = useAdsChequeos();
  const reportes = useAdsReportes();
  const [error, setError] = useState<string | null>(null);

  if (!clients) return <Cargando />;

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
    <div className="mx-auto max-w-[640px] px-4 pt-2 lg:max-w-[880px] lg:px-8 lg:pt-4">
      <header className="entra mb-6 lg:mb-8">
        <p className="text-[0.8125rem] font-medium text-texto-secundario mayuscula">
          {format(today, "EEEE d 'de' MMMM", { locale: es })}
        </p>
        <h1 className="titulo-serif text-[1.875rem] font-medium leading-[1.15] lg:text-[2.25rem]">Ads</h1>
      </header>

      {error && <p className="mb-4 text-[0.8125rem] text-[var(--color-error)]">{error}</p>}

      {cuentas.length === 0 ? (
        <EmptyState
          title="No hay cuentas de Ads"
          detail="Los clientes con servicio Ads o Contenido + Ads aparecen acá."
        />
      ) : (
        <div className="flex flex-col gap-9">
          <section className="entra" style={indice(1)}>
            <h2 className="mb-2 text-[0.9375rem] font-semibold">Chequeo de hoy</h2>
            <ul className="papel flex flex-col divide-y divide-borde/80 px-1.5">
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

          <section className="entra" style={indice(2)}>
            <h2 className="mb-1 text-[0.9375rem] font-semibold">Revisión a fondo</h2>
            <p className="mb-2 text-[0.8125rem] text-texto-secundario">
              Cada cuenta se revisa a fondo cada {CADENCIA_REVISION_FONDO_DIAS} días. Va rotando: la más atrasada
              aparece en Hoy y es lo primero que se posterga si no entra.
            </p>
            <ul className="papel flex flex-col divide-y divide-borde/80 px-1.5">
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
                      className="tocable shrink-0 rounded-[8px] border border-borde px-2.5 py-1 text-[0.8125rem] font-medium hover:bg-borde/40"
                    >
                      Revisada hoy
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="entra" style={indice(3)}>
            <h2 className="mb-1 text-[0.9375rem] font-semibold">
              Reportes de {periodoReporte ? format(parse(periodoReporte, "yyyy-MM", new Date()), "MMMM", { locale: es }) : "el mes"}
            </h2>
            <p className="mb-2 text-[0.8125rem] text-texto-secundario">
              {hoyEnVentanaDeReportes(today)
                ? "Se mandan del 1 al 5: estás en plazo."
                : "Se mandan del 1 al 5 de cada mes."}
            </p>
            <ul className="papel flex flex-col divide-y divide-borde/80 px-1.5">
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
                      "tocable shrink-0 rounded-[8px] px-2.5 py-1 text-[0.8125rem] font-medium",
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
        "tocable flex shrink-0 items-center gap-1 rounded-[8px] border px-2.5 py-1 text-[0.8125rem] font-medium",
        activo
          ? tono === "verde"
            ? "pop border-verde/30 bg-verde/15 text-verde"
            : "pop border-terracota/30 bg-terracota/15 text-terracota"
          : "border-borde text-texto-secundario hover:bg-borde/40",
      )}
    >
      {children}
    </button>
  );
}
