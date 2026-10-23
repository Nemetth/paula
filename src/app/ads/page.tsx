"use client";

import { useMemo, useState } from "react";
import { format, parse } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { Check, CircleAlert, ExternalLink } from "lucide-react";
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
  TonoCuenta,
  hoyEnVentanaDeReportes,
  reportesDelMes,
  saludCuenta,
} from "@/lib/domain/ads";
import { fechaCorta, toISODate } from "@/lib/domain/dates";
import { ESTADO_CUENTA_ADS_LABEL } from "@/lib/domain/labels";
import { AdsEstado } from "@/lib/domain/types";
import { Cargando, EmptyState } from "@/components/empty-state";
import { Encabezado } from "@/components/encabezado";
import { cn, indice } from "@/lib/utils";

const TONO_CUENTA: Record<TonoCuenta, string> = {
  verde: "bg-verde",
  ambar: "bg-ambar",
  rojo: "bg-acento",
  gris: "bg-borde",
};

export default function AdsPage() {
  const today = useMemo(() => new Date(), []);
  const hoyISO = toISODate(today);
  const clients = useClients();
  const chequeos = useAdsChequeos();
  const reportes = useAdsReportes();
  const [error, setError] = useState<string | null>(null);

  if (!clients) return <Cargando />;

  const cuentas = clientesAds(clients);
  const chequeoHoy = new Map((chequeos ?? []).filter((c) => c.fecha === hoyISO).map((c) => [c.clienteId, c]));
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
      <Encabezado titulo="Ads" arriba={format(today, "EEEE d 'de' MMMM", { locale: es })} />

      {error && <p className="mb-4 text-[0.8125rem] text-[var(--color-error)]">{error}</p>}

      {cuentas.length === 0 ? (
        <EmptyState
          title="No hay cuentas de Ads"
          detail="Los clientes con servicio Ads o Contenido + Ads aparecen acá."
        />
      ) : (
        <div className="flex flex-col gap-9">
          <section className="entra" style={indice(1)}>
            <h2 className="mb-1 text-[0.9375rem] font-semibold">Chequeo de hoy</h2>
            <p className="mb-2 text-[0.8125rem] text-texto-secundario">
              Dejá una nota corta de lo que viste: queda en el historial de cada cliente.
            </p>
            <ul className="papel flex flex-col divide-y divide-borde/80 px-1.5">
              {cuentas.map((c) => {
                const chequeo = chequeoHoy.get(c.id);
                const estado = chequeo?.estado;
                const ultimaNota = (chequeos ?? [])
                  .filter((x) => x.clienteId === c.id && x.fecha < hoyISO && x.nota)
                  .sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
                const salud = saludCuenta(c, chequeos ?? [], today);
                return (
                  <li key={c.id} className="flex flex-col gap-2 px-2 py-3">
                    <div className="flex items-center gap-3">
                      <span
                        role="img"
                        aria-label={salud.motivo}
                        title={salud.motivo}
                        className={cn("h-3 w-3 shrink-0 rounded-full", TONO_CUENTA[salud.tono])}
                      />
                      <div className="min-w-0 flex-1">
                        <Link href={`/clientes/${c.id}`} className="block truncate font-semibold hover:underline">
                          {c.nombre}
                        </Link>
                        <p className="flex items-center gap-2 text-[0.8125rem] text-texto-secundario">
                          <span className={cn(salud.tono === "rojo" && "font-medium text-acento-texto", salud.tono === "ambar" && "font-medium text-ambar")}>
                            {salud.tono === "verde" ? ESTADO_CUENTA_ADS_LABEL[c.adsEstadoCuenta] : salud.motivo}
                          </span>
                          {c.adsCuentaUrl && (
                            <a
                              href={/^https?:\/\//i.test(c.adsCuentaUrl) ? c.adsCuentaUrl : `https://${c.adsCuentaUrl}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 font-medium text-acento-texto"
                            >
                              Abrir cuenta <ExternalLink size={12} />
                            </a>
                          )}
                        </p>
                      </div>
                      <Boton
                        activo={estado === "ok"}
                        tono="verde"
                        onClick={() => guardar(() => guardarChequeoAds(c.id, hoyISO, "ok" as AdsEstado))}
                      >
                        <Check size={14} /> OK
                      </Boton>
                      <Boton
                        activo={estado === "revisar"}
                        tono="acento"
                        onClick={() => guardar(() => guardarChequeoAds(c.id, hoyISO, "revisar" as AdsEstado))}
                      >
                        <CircleAlert size={14} /> Revisar
                      </Boton>
                    </div>
                    <input
                      key={chequeo?.nota ?? ""}
                      defaultValue={chequeo?.nota ?? ""}
                      onBlur={(e) => {
                        const nota = e.target.value;
                        if (nota.trim() === (chequeo?.nota ?? "")) return;
                        guardar(() => guardarChequeoAds(c.id, hoyISO, estado ?? "ok", nota));
                      }}
                      placeholder={ultimaNota ? `Última nota (${fechaCorta(ultimaNota.fecha)}): ${ultimaNota.nota}` : "Nota del chequeo"}
                      aria-label={`Nota del chequeo de ${c.nombre}`}
                      className="input py-1.5 text-[0.875rem]"
                    />
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
                      <p className={cn("text-[0.8125rem]", vencida ? "text-acento-texto" : "text-texto-secundario")}>
                        {dias === Infinity ? "Nunca revisada" : dias === 0 ? "Revisada hoy" : `Hace ${dias} d`}
                      </p>
                    </div>
                    <button
                      onClick={() => guardar(() => actualizarCliente(c.id, { adsUltimaRevision: hoyISO }))}
                      className="tocable shrink-0 rounded-[8px] border border-borde px-3 py-2 text-[0.8125rem] font-medium hover:bg-borde/40"
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
                      "tocable shrink-0 rounded-[8px] px-3 py-2 text-[0.8125rem] font-medium",
                      f.estado === "enviado" && "bg-verde/15 text-verde",
                      f.estado === "pendiente" && !f.atrasado && "bg-ambar/15 text-ambar",
                      f.atrasado && "bg-acento/15 text-acento-texto",
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
  tono: "verde" | "acento";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={activo}
      className={cn(
        "tocable flex shrink-0 items-center gap-1 rounded-[8px] border px-3 py-2 text-[0.8125rem] font-medium",
        activo
          ? tono === "verde"
            ? "pop border-verde/30 bg-verde/15 text-verde"
            : "pop border-acento/30 bg-acento/15 text-acento-texto"
          : "border-borde text-texto-secundario hover:bg-borde/40",
      )}
    >
      {children}
    </button>
  );
}
