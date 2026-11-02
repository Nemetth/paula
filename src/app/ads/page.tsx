"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Star } from "lucide-react";
import {
  desmarcarMensajeHecho,
  guardarChequeoAds,
  guardarFechaAds,
  guardarReporteAds,
  guardarTextoReporte,
  marcarFaltaAds,
  marcarMensajeHecho,
  quitarChequeoAds,
  useAdsChequeos,
  useAdsFaltan,
  useAdsFechas,
  useAdsIdeas,
  useTareasHechas,
} from "@/lib/supabase/data";
import { useAvisos, usePlan } from "@/lib/supabase/use-plan";
import {
  CuentaAds,
  FechaDeAds,
  FilaReporte,
  PESO_RECAMBIO,
  PESO_REPORTE,
  PESO_REVISION,
  clientesAds,
  cuentasConRutina,
  cuentasDeAds,
  fechasDeAds,
  reportesDelMes,
  semanaDe,
  venceReporte,
} from "@/lib/domain/ads";
import { colorCliente } from "@/lib/domain/calendario";
import { completarUnidad, deshacerHecha } from "@/lib/domain/completar";
import { fechaCorta, toISODate } from "@/lib/domain/dates";
import { MensajePendiente } from "@/lib/domain/mensajes";
import { UnidadTrabajo } from "@/lib/domain/planner";
import { AdsFalta, Client } from "@/lib/domain/types";
import { PanelReportes } from "@/components/ads/panel-reportes";
import { TarjetaCuenta } from "@/components/ads/tarjeta-cuenta";
import { avisarConDeshacer } from "@/components/aviso-deshacer";
import { Cargando, EmptyState } from "@/components/empty-state";
import { BotonPrimario, Sheet } from "@/components/sheet";
import { Tilde } from "@/components/tilde";
import { cn, indice } from "@/lib/utils";

/** An Ads routine as a unit of work, the same one Hoy ticks, so both show it done. */
function rutina(tipo: "ads-revision" | "ads-recambio" | "ads-reporte", clienteId: string, ref: string, etiqueta: string, peso: number): UnidadTrabajo {
  return { id: `${tipo}:${clienteId}:${ref}`, tipo, categoria: "ads", clienteId, etiqueta, peso, repartir: false, intocable: false };
}

export default function AdsPage() {
  const today = useMemo(() => new Date(), []);
  const hoyISO = toISODate(today);
  const ctx = usePlan();
  const { mensajes } = useAvisos();
  const chequeos = useAdsChequeos();
  const ideas = useAdsIdeas();
  const faltan = useAdsFaltan();
  const fechasGuardadas = useAdsFechas();
  const hechasHoy = useTareasHechas(hoyISO);
  const [error, setError] = useState<string | null>(null);
  const [reporteAbierto, setReporteAbierto] = useState<{ clienteId: string; campo: "analisis" | "estrategia" } | null>(null);
  const [fechaEditada, setFechaEditada] = useState<string | null>(null);

  if (!ctx) return <Cargando />;
  const { clients, reportes, adsHistorial, estructura } = ctx;

  const filasReporte = reportesDelMes(clients, reportes, today, estructura);
  const paraPedir = mensajes.filter((m) => m.tipo === "pedir-material-ads");
  const cuentas = cuentasDeAds({
    clients,
    chequeos: chequeos ?? [],
    historial: adsHistorial,
    reportes: filasReporte,
    faltan: faltan ?? [],
    materialPendiente: new Set(paraPedir.map((m) => m.cliente.id)),
    estructura,
    today,
  });
  const conRutina = new Set(cuentasConRutina(clients).map((c) => c.id));
  const nuevas = cuentasConRutina(clients).filter((c) => !filasReporte.some((f) => f.cliente.id === c.id));
  const fechas = fechasDeAds(clients, fechasGuardadas ?? [], today);
  const semana = semanaDe(today);
  const paraHoy = cuentas.reduce((s, c) => s + c.paraHoy, 0);
  const atrasadas = cuentas.reduce((s, c) => s + c.atrasadas, 0);
  const enviados = filasReporte.filter((f) => f.estado === "enviado").length;
  const editada = fechas.find((f) => f.id === fechaEditada);

  function guardar(accion: () => Promise<unknown>) {
    setError(null);
    void accion().catch((e) => setError(e instanceof Error ? e.message : "No se pudo guardar. Probá de nuevo."));
  }

  /** Do a routine, leaving the way back on the global notice. */
  function hacer(unidad: UnidadTrabajo, cliente: Client) {
    guardar(async () => {
      const hecha = await completarUnidad(unidad, { clients });
      avisarConDeshacer(`${cliente.nombre}: ${unidad.etiqueta}`, () => guardar(() => deshacerHecha(hecha)));
    });
  }

  function hacerFalta(f: AdsFalta) {
    guardar(async () => {
      await marcarFaltaAds(f.id, true);
      avisarConDeshacer(`Resuelto: ${f.texto}`, () => guardar(() => marcarFaltaAds(f.id, false)));
    });
  }

  function hacerMaterial(m: MensajePendiente) {
    guardar(async () => {
      await marcarMensajeHecho(m.id, hoyISO);
      avisarConDeshacer(`${m.cliente.nombre}: material pedido`, () => guardar(() => desmarcarMensajeHecho(m.id)));
    });
  }

  function alternarEnviado(f: FilaReporte) {
    const id = `ads-reporte:${f.cliente.id}:${f.periodo}`;
    if (f.estado === "enviado") {
      const registro = (hechasHoy ?? []).find((r) => r.unidadId === id);
      guardar(() => (registro ? deshacerHecha(registro) : guardarReporteAds(f.cliente.id, f.periodo, "pendiente")));
    } else {
      const mes = format(new Date(`${f.periodo}-15T12:00:00`), "MMMM", { locale: es });
      hacer(rutina("ads-reporte", f.cliente.id, f.periodo, `Reporte de Ads de ${mes}`, PESO_REPORTE), f.cliente);
    }
  }

  function verReporte(c: CuentaAds) {
    setReporteAbierto({ clienteId: c.cliente.id, campo: c.reporte?.reporte?.analisis ? "estrategia" : "analisis" });
    document.getElementById(`reporte-${c.cliente.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="mx-auto max-w-[640px] px-4 pt-2 lg:max-w-[960px] lg:px-8 xl:max-w-[1360px] xl:pt-0">
      <header className="entra mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-center sm:text-left">
          <p className="mayuscula text-[0.8125rem] font-medium text-texto-secundario">{format(today, "EEEE d 'de' MMMM", { locale: es })}</p>
          <h1 className="titulo text-[1.75rem] leading-[1.12] xl:text-[2rem]">Ads</h1>
        </div>
        {cuentas.length > 0 && (
          <dl className="grid grid-cols-3 gap-2">
            <Dato valor={paraHoy} texto={paraHoy === 1 ? "cosa para hoy" : "cosas para hoy"} tono="text-acento-texto" />
            <Dato valor={atrasadas} texto={atrasadas === 1 ? "atrasada" : "atrasadas"} tono={atrasadas > 0 ? "text-[var(--color-error)]" : undefined} />
            <Dato valor={`${enviados} de ${filasReporte.length}`} texto="reportes enviados" />
          </dl>
        )}
      </header>

      {error && <p className="mb-3 text-center text-[0.8125rem] text-[var(--color-error)]">{error}</p>}

      {clientesAds(clients).length === 0 ? (
        <EmptyState title="No hay cuentas de Ads" detail="Los clientes con servicio Ads o Contenido + Ads aparecen acá." />
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3 px-1">
              <h2 className="flex items-center gap-2 text-[0.875rem] font-semibold">
                <span className="h-2 w-2 rounded-full bg-acento-texto" aria-hidden /> Qué hacer y qué falta, por cliente
              </h2>
              <p className="hidden text-[0.75rem] text-texto-secundario sm:block">Tildá lo que vas haciendo</p>
            </div>

            {fechas.length > 0 && (
              <section className="papel entra px-4 py-2.5" style={indice(1)}>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <h3 className="flex items-center gap-1.5 text-[0.8125rem] font-semibold">
                    <Star size={13} className="text-acento-texto" /> Campañas por fechas especiales
                  </h3>
                  <p className="text-[0.75rem] text-texto-secundario">listas 15 días antes</p>
                </div>
                <ul className="flex flex-col divide-y divide-borde/50">
                  {fechas.map((f) => (
                    <FilaFecha key={f.id} f={f} onElegir={() => setFechaEditada(f.id)} guardar={guardar} />
                  ))}
                </ul>
              </section>
            )}

            <div className="grid items-start gap-3 md:grid-cols-2">
              {cuentas.map((c, i) => {
                const id = c.cliente.id;
                const registroRevision = (hechasHoy ?? []).find((r) => r.unidadId === `ads-revision:${id}:${semana}`);
                return (
                  <div key={id} className="entra" style={indice(Math.min(i + 2, 8))}>
                    <TarjetaCuenta
                      cuenta={c}
                      color={colorCliente(clients, id)}
                      ideas={(ideas ?? []).filter((x) => x.clienteId === id)}
                      material={paraPedir.find((m) => m.cliente.id === id)}
                      hoyISO={hoyISO}
                      conRutina={conRutina.has(id)}
                      onChequeo={() => guardar(() => guardarChequeoAds(id, hoyISO, "ok"))}
                      onDeshacerChequeo={() => guardar(() => quitarChequeoAds(id, hoyISO))}
                      onRevision={() => hacer(rutina("ads-revision", id, semana, "Revisión semanal de anuncios", PESO_REVISION), c.cliente)}
                      onDeshacerRevision={registroRevision ? () => guardar(() => deshacerHecha(registroRevision)) : undefined}
                      onRecambio={() => hacer(rutina("ads-recambio", id, c.recambio, "Recambio de anuncios", PESO_RECAMBIO), c.cliente)}
                      onMaterial={hacerMaterial}
                      onMandarMaterial={(m) => guardar(() => marcarMensajeHecho(m.id, hoyISO))}
                      onFalta={hacerFalta}
                      onVerReporte={() => verReporte(c)}
                      guardar={guardar}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {(filasReporte.length > 0 || nuevas.length > 0) && (
            <aside className="entra xl:sticky xl:top-14" style={indice(2)}>
              <PanelReportes
                filas={filasReporte}
                nuevas={nuevas}
                vence={venceReporte(today)}
                color={(id) => colorCliente(clients, id)}
                abierto={reporteAbierto}
                onAbrir={setReporteAbierto}
                onEnviado={alternarEnviado}
                onTexto={(f, cambios) => guardar(() => guardarTextoReporte(f.cliente.id, f.periodo, cambios))}
              />
            </aside>
          )}
        </div>
      )}

      <Sheet open={!!editada} title={editada ? `${editada.nombre} · a quién le aplica` : ""} onClose={() => setFechaEditada(null)}>
        {editada && <ElegirClientes key={editada.id} f={editada} cuentas={cuentasConRutina(clients)} guardar={guardar} onCerrar={() => setFechaEditada(null)} />}
      </Sheet>
    </div>
  );
}

function Dato({ valor, texto, tono }: { valor: number | string; texto: string; tono?: string }) {
  return (
    <div className="papel px-3 py-2">
      <dd className={cn("numeros titulo text-[1.125rem] leading-tight", tono)}>{valor}</dd>
      <dt className="text-[0.6875rem] leading-tight text-texto-secundario">{texto}</dt>
    </div>
  );
}

/** A special date: tick it once its campaigns are ready, tap the names to choose who it applies to. */
function FilaFecha({ f, onElegir, guardar }: { f: FechaDeAds; onElegir: () => void; guardar: (accion: () => Promise<unknown>) => void }) {
  return (
    <li className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 text-[0.8125rem]", f.hecha && "opacity-55")}>
      <Tilde
        hecha={f.hecha}
        label={`Marcar las campañas de ${f.nombre} como armadas`}
        onTildar={() => guardar(() => guardarFechaAds(f.id, { hecha: true }))}
        onDeshacer={() => guardar(() => guardarFechaAds(f.id, { hecha: false }))}
      />
      <span className={cn("font-semibold", f.hecha && "line-through")}>{f.nombre}</span>
      <span className={cn("text-[0.75rem]", f.vencida ? "font-medium text-[var(--color-error)]" : "text-acento-texto")}>armar antes del {fechaCorta(f.armarAntes)}</span>
      <button onClick={onElegir} aria-label={`Elegir a qué clientes aplica ${f.nombre}`} className="tocable ml-auto flex flex-wrap justify-end gap-1">
        {f.clientes.map((c) => (
          <span key={c.id} className="rounded-[6px] bg-bg-hundida px-1.5 py-0.5 text-[0.6875rem] text-texto-secundario">
            {c.nombre}
          </span>
        ))}
      </button>
    </li>
  );
}

function ElegirClientes({
  f,
  cuentas,
  guardar,
  onCerrar,
}: {
  f: FechaDeAds;
  cuentas: Client[];
  guardar: (accion: () => Promise<unknown>) => void;
  onCerrar: () => void;
}) {
  const [elegidos, setElegidos] = useState(new Set(f.clientes.map((c) => c.id)));
  return (
    <div className="flex flex-col gap-1">
      {cuentas.map((c) => (
        <label key={c.id} className="tocable flex cursor-pointer items-center gap-3 rounded-[12px] px-2 py-2.5 hover:bg-bg-hundida">
          <input
            type="checkbox"
            checked={elegidos.has(c.id)}
            onChange={() =>
              setElegidos((prev) => {
                const next = new Set(prev);
                if (next.has(c.id)) next.delete(c.id);
                else next.add(c.id);
                return next;
              })
            }
            className="h-[18px] w-[18px] shrink-0 accent-[var(--color-oscuro)]"
          />
          {c.nombre}
        </label>
      ))}
      <BotonPrimario
        className="mt-3"
        onClick={() => {
          guardar(() => guardarFechaAds(f.id, { clientes: [...elegidos] }));
          onCerrar();
        }}
      >
        Guardar
      </BotonPrimario>
    </div>
  );
}
