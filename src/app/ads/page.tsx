"use client";

import { useMemo, useState } from "react";
import { differenceInCalendarDays, format, parse } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { Check, ChevronDown, CircleAlert, ExternalLink } from "lucide-react";
import {
  actualizarCliente,
  guardarChequeoAds,
  guardarReporteAds,
  guardarTextoReporte,
  registrarAds,
  useAdsChequeos,
} from "@/lib/supabase/data";
import { usePlan } from "@/lib/supabase/use-plan";
import {
  FilaReporte,
  TonoCuenta,
  clientesAds,
  cuentasConRutina,
  diasDeRevision,
  enLaSemana,
  hoyEnVentanaDeReportes,
  nombreDia,
  proximoRecambio,
  reportesDelMes,
  saludCuenta,
  semanaDe,
} from "@/lib/domain/ads";
import { completarUnidad } from "@/lib/domain/completar";
import { fechaCorta, fromISODate, toISODate } from "@/lib/domain/dates";
import { ESTADO_CUENTA_ADS_LABEL } from "@/lib/domain/labels";
import { AdsEstado, CADENCIA_RECAMBIO_DIAS, Client } from "@/lib/domain/types";
import { Cargando, EmptyState } from "@/components/empty-state";
import { Encabezado } from "@/components/encabezado";
import { cn, indice } from "@/lib/utils";

const TONO_CUENTA: Record<TonoCuenta, string> = {
  verde: "bg-verde",
  ambar: "bg-ambar",
  rojo: "bg-acento",
  gris: "bg-borde",
};

const boton = "tocable shrink-0 rounded-[8px] border border-borde px-3 py-2 text-[0.8125rem] font-medium hover:bg-borde/40";

export default function AdsPage() {
  const today = useMemo(() => new Date(), []);
  const hoyISO = toISODate(today);
  const ctx = usePlan();
  const chequeos = useAdsChequeos();
  const [error, setError] = useState<string | null>(null);

  if (!ctx) return <Cargando />;
  const { clients, reportes, adsHistorial, estructura, plan } = ctx;

  const cuentas = clientesAds(clients);
  const conRutina = cuentasConRutina(clients);
  const chequeoHoy = new Map((chequeos ?? []).filter((c) => c.fecha === hoyISO).map((c) => [c.clienteId, c]));
  const semana = semanaDe(today);
  const diaRevision = diasDeRevision(clients, estructura);
  const revisiones = conRutina
    .map((c) => {
      const dia = enLaSemana(today, diaRevision.get(c.id) ?? 1);
      const hecha = adsHistorial.find((r) => r.tipo === "revision" && r.clienteId === c.id && r.ref === semana);
      return { cliente: c, dia, hecha };
    })
    .sort((a, b) => a.dia.localeCompare(b.dia) || a.cliente.nombre.localeCompare(b.cliente.nombre));
  const recambios = conRutina
    .map((c) => ({ cliente: c, toca: proximoRecambio(c, clients, today) }))
    .sort((a, b) => a.toca.localeCompare(b.toca));
  const filasReporte = reportesDelMes(clients, reportes, today, estructura);
  const periodoReporte = filasReporte[0]?.periodo;
  const contexto = { clients, historial: adsHistorial, estructura };

  async function guardar(accion: () => Promise<unknown>) {
    setError(null);
    try {
      await accion();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar. Probá de nuevo.");
    }
  }

  /** Tick a routine the same way Hoy does when it is in the plan, so Hoy shows it done too. */
  function hacer(prefijo: string, cliente: Client, directo: () => Promise<unknown>) {
    const unidad = plan.asignaciones.find((a) => a.unidad.id.startsWith(`${prefijo}:${cliente.id}:`) && a.fecha <= hoyISO)?.unidad;
    return guardar(() => (unidad ? completarUnidad(unidad, { clients }) : directo()));
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
            <h2 className="mb-1 text-[0.9375rem] font-semibold">Todos los días: chequeo rápido</h2>
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
                const salud = saludCuenta(c, chequeos ?? [], today, contexto);
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

          {conRutina.length > 0 && (
            <>
              <section className="entra" style={indice(2)}>
                <h2 className="mb-1 text-[0.9375rem] font-semibold">Una vez por semana: revisión de anuncios</h2>
                <p className="mb-2 text-[0.8125rem] text-texto-secundario">
                  Cada cuenta tiene su día, repartidas en la semana. Aparece sola en Hoy y en el Calendario.
                </p>
                <ul className="papel flex flex-col divide-y divide-borde/80 px-1.5">
                  {revisiones.map(({ cliente: c, dia, hecha }) => {
                    const atrasada = !hecha && dia < hoyISO;
                    return (
                      <li key={c.id} className="flex items-center gap-3 px-2 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{c.nombre}</p>
                          <p className={cn("text-[0.8125rem]", atrasada ? "font-medium text-acento-texto" : "text-texto-secundario")}>
                            {hecha
                              ? `Revisada el ${fechaCorta(hecha.fecha)}`
                              : dia === hoyISO
                                ? "Le toca hoy"
                                : atrasada
                                  ? `Le tocaba el ${nombreDia(fromISODate(dia).getDay())}`
                                  : `Le toca el ${nombreDia(fromISODate(dia).getDay())}`}
                          </p>
                        </div>
                        {hecha ? (
                          <span className="flex shrink-0 items-center gap-1 rounded-[8px] bg-verde/15 px-3 py-2 text-[0.8125rem] font-medium text-verde">
                            <Check size={14} /> Hecha
                          </span>
                        ) : (
                          <button
                            onClick={() =>
                              hacer("ads-revision", c, async () => {
                                await registrarAds({ clienteId: c.id, tipo: "revision", ref: semana, fecha: hoyISO });
                                await actualizarCliente(c.id, { adsUltimaRevision: hoyISO });
                              })
                            }
                            className={boton}
                          >
                            Revisada hoy
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section className="entra" style={indice(3)}>
                <h2 className="mb-1 text-[0.9375rem] font-semibold">Cada {CADENCIA_RECAMBIO_DIAS} días: recambio de anuncios</h2>
                <p className="mb-2 text-[0.8125rem] text-texto-secundario">
                  Se cuenta desde el último recambio. Cuando le toca a una cuenta, te avisa y aparece en Hoy.
                </p>
                <ul className="papel flex flex-col divide-y divide-borde/80 px-1.5">
                  {recambios.map(({ cliente: c, toca }) => {
                    const dias = differenceInCalendarDays(fromISODate(toca), today);
                    return (
                      <li key={c.id} className="flex items-center gap-3 px-2 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{c.nombre}</p>
                          <p className={cn("text-[0.8125rem]", dias <= 0 ? "font-medium text-acento-texto" : "text-texto-secundario")}>
                            {dias < 0
                              ? `Le toca desde hace ${-dias} ${dias === -1 ? "día" : "días"}`
                              : dias === 0
                                ? "Le toca hoy"
                                : `Le toca el ${fechaCorta(toca)}`}
                            {c.adsRefreshCreativos ? ` · último el ${fechaCorta(c.adsRefreshCreativos)}` : " · sin recambio cargado"}
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            hacer("ads-recambio", c, async () => {
                              await registrarAds({ clienteId: c.id, tipo: "recambio", ref: hoyISO, fecha: hoyISO });
                              await actualizarCliente(c.id, { adsRefreshCreativos: hoyISO });
                            })
                          }
                          className={boton}
                        >
                          Renové hoy
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </>
          )}

          {filasReporte.length > 0 && (
            <section className="entra" style={indice(4)}>
              <h2 className="mb-1 text-[0.9375rem] font-semibold">
                A principio de mes: reportes de{" "}
                {periodoReporte ? format(parse(periodoReporte, "yyyy-MM", new Date()), "MMMM", { locale: es }) : "el mes"}
              </h2>
              <p className="mb-2 text-[0.8125rem] text-texto-secundario">
                {hoyEnVentanaDeReportes(today)
                  ? "Repartidos del 1 al 5, cada cliente en su día: estás en plazo."
                  : "Se reparten del 1 al 5 de cada mes, cada cliente en su día."}{" "}
                Abrí cada uno para escribir el análisis y la nueva estrategia.
              </p>
              <ul className="papel flex flex-col divide-y divide-borde/80 px-1.5">
                {filasReporte.map((f) => (
                  <FilaDeReporte
                    key={f.cliente.id}
                    fila={f}
                    onEnviado={() =>
                      f.estado === "enviado"
                        ? guardar(() => guardarReporteAds(f.cliente.id, f.periodo, "pendiente"))
                        : hacer("ads-reporte", f.cliente, () => guardarReporteAds(f.cliente.id, f.periodo, "enviado"))
                    }
                    onTexto={(cambios) => guardar(() => guardarTextoReporte(f.cliente.id, f.periodo, cambios))}
                  />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

/** One client's report: its day, sent or not, and the month's analysis and new strategy. */
function FilaDeReporte({
  fila: f,
  onEnviado,
  onTexto,
}: {
  fila: FilaReporte;
  onEnviado: () => void;
  onTexto: (cambios: { analisis?: string; estrategia?: string }) => void;
}) {
  const [abierta, setAbierta] = useState(false);
  const texto = (campo: "analisis" | "estrategia", etiqueta: string, placeholder: string) => (
    <label className="flex flex-col gap-1">
      <span className="text-[0.8125rem] font-medium text-texto-secundario">{etiqueta}</span>
      <textarea
        key={f.reporte?.[campo] ?? ""}
        defaultValue={f.reporte?.[campo] ?? ""}
        rows={3}
        placeholder={placeholder}
        onBlur={(e) => {
          if (e.target.value.trim() !== (f.reporte?.[campo] ?? "")) onTexto({ [campo]: e.target.value });
        }}
        className="input resize-y text-[0.9375rem]"
      />
    </label>
  );
  return (
    <li className="px-2 py-3">
      <div className="flex items-center gap-3">
        <button onClick={() => setAbierta((a) => !a)} aria-expanded={abierta} className="tocable flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{f.cliente.nombre}</span>
            <span className="block text-[0.8125rem] text-texto-secundario">
              {f.estado === "enviado"
                ? `Enviado${f.reporte?.enviadoEn ? ` el ${fechaCorta(f.reporte.enviadoEn)}` : ""}`
                : f.dia
                  ? `Para el ${fechaCorta(f.dia)}`
                  : "Del 1 al 5"}
              {(f.reporte?.analisis || f.reporte?.estrategia) && " · con análisis"}
            </span>
          </span>
          <ChevronDown size={16} className={cn("shrink-0 text-texto-secundario transition-transform duration-300", abierta && "rotate-180")} />
        </button>
        <button
          onClick={onEnviado}
          className={cn(
            "tocable shrink-0 rounded-[8px] px-3 py-2 text-[0.8125rem] font-medium",
            f.estado === "enviado" && "bg-verde/15 text-verde",
            f.estado === "pendiente" && !f.atrasado && "bg-ambar/15 text-ambar",
            f.atrasado && "bg-acento/15 text-acento-texto",
          )}
        >
          {f.estado === "enviado" ? "Enviado" : f.atrasado ? "Atrasado" : "Pendiente"}
        </button>
      </div>
      {abierta && (
        <div className="aparece mt-3 flex flex-col gap-3">
          {texto("analisis", "Análisis del mes", "Qué funcionó, qué no, resultados…")}
          {texto("estrategia", "Nueva estructura o estrategia", "Qué cambia el mes que viene…")}
        </div>
      )}
    </li>
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
