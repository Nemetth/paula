"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  Check,
  FileText,
  MessageCircle,
  PackageCheck,
  Settings,
  Sparkles,
  Video,
} from "lucide-react";
import { ensureSettings, marcarFijo, marcarMensajeHecho, useFijosHechos, useMensajesHechos } from "@/lib/supabase/data";
import { usePlan } from "@/lib/supabase/use-plan";
import { Asignacion, sugerirAdelanto, tareasDelDia } from "@/lib/domain/planner";
import { mensajesPendientes } from "@/lib/domain/mensajes";
import { completarUnidad, sePuedeTildar } from "@/lib/domain/completar";
import { toISODate } from "@/lib/domain/dates";
import { cobrosVencidos } from "@/lib/domain/cobros";
import { colorCliente } from "@/lib/domain/calendario";
import { Client } from "@/lib/domain/types";
import { DisruptionSheet } from "@/components/disruption-sheet";
import { SobroTiempoSheet } from "@/components/sobro-tiempo-sheet";
import { Cargando, EmptyState } from "@/components/empty-state";
import { Tilde } from "@/components/tilde";
import { cn, indice } from "@/lib/utils";

const fmtHoras = (h: number) => `${Math.round(h * 100) / 100}`.replace(".", ",");

function saludo(d: Date) {
  const h = d.getHours();
  return h < 6 ? "Buenas noches" : h < 13 ? "Buen día" : h < 20 ? "Buenas tardes" : "Buenas noches";
}

export default function HoyPage() {
  const today = useMemo(() => new Date(), []);
  const todayISO = toISODate(today);
  const [cambioAbierto, setCambioAbierto] = useState(false);
  const [sobroAbierto, setSobroAbierto] = useState(false);

  const ctx = usePlan();
  const fijosHechos = useFijosHechos(todayISO);
  const mensajesHechos = useMensajesHechos();

  useEffect(() => {
    ensureSettings();
  }, []);

  const mensajes = useMemo(
    () =>
      ctx && mensajesHechos
        ? mensajesPendientes({
            today,
            clients: ctx.clients,
            piezas: ctx.piezas,
            grabaciones: ctx.grabaciones,
            cobros: ctx.cobros,
            hechos: mensajesHechos,
          })
        : [],
    [ctx, mensajesHechos, today],
  );

  const vencidos = useMemo(
    () => (ctx ? cobrosVencidos(ctx.cobros, ctx.clients, today).length : 0),
    [ctx, today],
  );

  if (!ctx) {
    return <Cargando />;
  }
  const { plan, clients, grabaciones, estructura } = ctx;

  const carga = plan.cargaPorDia[todayISO];
  const tareas = tareasDelDia(plan, todayISO);
  const hitosHoy = plan.hitos.filter((h) => h.fecha === todayISO);
  const nombreCliente = new Map(clients.map((c) => [c.id, c.nombre]));
  const fijos = estructura.fijosDiarios ?? [];
  const alertas = plan.alertas.filter((a) => a.tipo !== "dia-sobrecargado" || a.fecha === todayISO);
  const proximas = plan.asignaciones.filter((a) => a.fecha > todayISO);
  const hayDatos = clients.some((c) => c.activo);

  const motivoBloqueo =
    carga?.bloqueo === "grabacion"
      ? "Hoy es día de grabación: el día entero queda bloqueado."
      : carga?.bloqueo === "viaje"
        ? "Hoy es día de viaje: no hay horas de producción."
        : carga?.bloqueo === "no-trabajo"
          ? "Hoy marcaste que no trabajás."
          : carga?.bloqueo === "libre-semana"
            ? "Hoy es un día libre en tu semana."
            : null;

  return (
    <div className="mx-auto max-w-[640px] px-4 pt-2 lg:max-w-[880px] lg:px-8 lg:pt-4">
      <header className="entra mb-6 flex items-start justify-between lg:mb-8">
        <div>
          <p className="text-[0.8125rem] font-medium text-texto-secundario mayuscula">
            {format(today, "EEEE d 'de' MMMM", { locale: es })}
          </p>
          <h1 className="titulo-serif mt-0.5 text-[2.125rem] font-medium leading-[1.1] lg:text-[2.5rem]">
            {saludo(today)}
          </h1>
        </div>
        <Link
          href="/ajustes"
          aria-label="Ajustes"
          className="tocable mt-1 rounded-full p-2 text-texto-secundario hover:bg-borde/50 lg:hidden"
        >
          <Settings size={20} strokeWidth={1.75} />
        </Link>
      </header>

      <div className="mb-6 flex flex-col gap-3 lg:mb-8 lg:flex-row">
        <div className="entra lg:flex-1" style={indice(1)}>
          <DiaReadout
            horas={carga?.horas ?? 0}
            capacidad={carga?.capacidad ?? 0}
            semaforo={carga?.semaforo}
            tareas={tareas}
            clients={clients}
          />
        </div>
        {vencidos > 0 && (
          <Link
            href="/plata"
            style={indice(2)}
            className="entra tocable flex items-center gap-3 rounded-[16px] bg-terracota/[0.08] px-4 py-3.5 hover:bg-terracota/[0.12] lg:w-[300px]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-terracota/15">
              <AlertTriangle size={17} className="text-terracota" />
            </span>
            <p className="text-[0.9375rem] text-texto">
              {vencidos === 1 ? "Tenés 1 cobro vencido" : `Tenés ${vencidos} cobros vencidos`}
              <span className="block font-medium text-terracota">Ver en Plata →</span>
            </p>
          </Link>
        )}
      </div>

      {motivoBloqueo && (
        <p className="papel entra mb-6 px-4 py-3 text-[0.9375rem] text-texto-secundario">{motivoBloqueo}</p>
      )}

      {hitosHoy.length > 0 && (
        <ul className="mb-6 flex flex-col gap-2">
          {hitosHoy.map((h, i) => {
            const Icon = h.tipo === "grabacion" ? Video : PackageCheck;
            return (
              <li
                key={`${h.tipo}-${h.clienteId}-${i}`}
                style={indice(i + 2)}
                className="papel entra flex items-center gap-3 px-4 py-3"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-terracota/10">
                  <Icon size={18} className="text-terracota" />
                </span>
                <p className="font-semibold">{h.detalle}</p>
              </li>
            );
          })}
        </ul>
      )}

      {fijos.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-[0.8125rem] font-medium text-texto-secundario">Fijos de todos los días</h2>
          <ul className="flex flex-wrap gap-2">
            {fijos.map((f, i) => {
              const hecho = fijosHechos?.has(f.id) ?? false;
              return (
                <li key={f.id} className="entra" style={indice(i + 2)}>
                  <button
                    onClick={() => marcarFijo(todayISO, f.id, !hecho)}
                    aria-pressed={hecho}
                    className={cn(
                      "tocable flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3.5 text-[0.9375rem]",
                      hecho
                        ? "border-verde/25 bg-verde/10 text-verde"
                        : "border-borde bg-bg-elevada shadow-papel hover:border-verde/40",
                    )}
                  >
                    <span
                      key={hecho ? "si" : "no"}
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full border-[1.5px]",
                        hecho ? "pop border-verde bg-verde text-bg" : "border-texto-secundario/40",
                      )}
                    >
                      {hecho && <Check size={14} strokeWidth={3} />}
                    </span>
                    <span className={hecho ? "line-through decoration-verde/50" : undefined}>{f.nombre}</span>
                    <span className="numeros text-[0.8125rem] text-texto-secundario">{fmtHoras(f.horas)}h</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {mensajes.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-[0.8125rem] font-medium text-texto-secundario">Mensajes para mandar</h2>
          <ul className="flex flex-col gap-2">
            {mensajes.map((m, i) => (
              <li key={m.id} className="papel entra px-4 py-3.5" style={indice(i + 3)}>
                <p className="font-semibold">
                  {m.titulo} <span className="font-normal text-texto-secundario">· {m.cliente.nombre}</span>
                </p>
                <p className="mt-1.5 line-clamp-2 rounded-[10px] bg-bg-hundida px-3 py-2 text-[0.8125rem] text-texto-secundario">
                  {m.texto}
                </p>
                <div className="mt-2.5 flex gap-2">
                  {m.enlace ? (
                    <a
                      href={m.enlace}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => marcarMensajeHecho(m.id, todayISO)}
                      className="tocable flex items-center gap-1.5 rounded-[10px] bg-verde px-3 py-1.5 text-[0.8125rem] font-medium text-bg shadow-papel"
                    >
                      <MessageCircle size={14} /> Abrir WhatsApp
                    </a>
                  ) : (
                    <span className="py-1.5 text-[0.8125rem] text-ambar">Sin WhatsApp cargado</span>
                  )}
                  <button
                    onClick={() => marcarMensajeHecho(m.id, todayISO)}
                    className="tocable rounded-[10px] border border-borde px-3 py-1.5 text-[0.8125rem] font-medium hover:bg-borde/40"
                  >
                    Ya lo mandé
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tareas.length === 0 ? (
        <EmptyState
          sol={hayDatos}
          title={hayDatos ? "Vas bien — nada para producir hoy" : "Todavía no hay clientes cargados"}
          detail={
            hayDatos
              ? "No hay piezas pendientes para hoy. Si te sobra tiempo, la app te dice qué adelantar."
              : "Agregá tu primer cliente para que la app arme el plan."
          }
        />
      ) : (
        <section>
          <h2 className="mb-2 flex items-baseline justify-between text-[0.8125rem] font-medium text-texto-secundario">
            Para producir hoy
            <span className="numeros">
              {tareas.length} {tareas.length === 1 ? "tarea" : "tareas"}
            </span>
          </h2>
          <ul className="papel flex flex-col divide-y divide-borde/80 overflow-hidden px-1.5 py-1">
            {tareas.map((a, i) => (
              <TareaFila
                key={a.unidad.id}
                asignacion={a}
                cliente={nombreCliente.get(a.unidad.clienteId ?? "")}
                color={colorCliente(clients, a.unidad.clienteId)}
                orden={i + 3}
              />
            ))}
          </ul>
        </section>
      )}

      {alertas.length > 0 && (
        <section className="mt-7">
          <h2 className="mb-2 text-[0.8125rem] font-medium text-texto-secundario">Avisos</h2>
          <ul className="flex flex-col gap-2">
            {alertas.slice(0, 5).map((a, i) => (
              <li
                key={`${a.tipo}-${i}`}
                style={indice(i + 4)}
                className="entra flex items-start gap-2.5 rounded-[14px] bg-ambar/10 px-4 py-3 text-[0.9375rem]"
              >
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-ambar" />
                <span>{a.mensaje}</span>
              </li>
            ))}
            {alertas.length > 5 && (
              <li className="px-1 text-[0.8125rem] text-texto-secundario">y {alertas.length - 5} más</li>
            )}
          </ul>
        </section>
      )}

      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <button
          onClick={() => setSobroAbierto(true)}
          className="boton-primario tocable group flex w-full items-center justify-center gap-2 rounded-[14px] px-5 py-3.5 text-center text-[0.9375rem] font-medium"
        >
          <Sparkles
            size={16}
            className="transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:rotate-[20deg] group-hover:scale-125"
          />
          Me sobró tiempo
        </button>
        <button
          onClick={() => setCambioAbierto(true)}
          className="tocable w-full rounded-[14px] border border-borde bg-bg-elevada/60 px-5 py-3.5 text-center text-[0.9375rem] font-medium text-texto hover:bg-bg-elevada"
        >
          Algo cambió
        </button>
      </div>

      <DisruptionSheet
        open={cambioAbierto}
        onClose={() => setCambioAbierto(false)}
        clients={clients.filter((c) => c.activo)}
        today={todayISO}
        tareasHoy={tareas}
        tareasProximas={proximas.filter((a) => sePuedeTildar(a.unidad))}
        grabacionesPendientes={grabaciones.filter((g) => !g.hecha)}
      />
      <SobroTiempoSheet
        open={sobroAbierto}
        onClose={() => setSobroAbierto(false)}
        capacidadLibre={Math.max((carga?.capacidad ?? 0) - (carga?.horas ?? 0), 0)}
        sugerir={(horas) => sugerirAdelanto(plan, todayISO, horas)}
        nombreCliente={nombreCliente}
      />
    </div>
  );
}

function TareaFila({
  asignacion,
  cliente,
  color,
  orden,
}: {
  asignacion: Asignacion;
  cliente?: string;
  color: string;
  orden: number;
}) {
  const { unidad, atrasada } = asignacion;
  const tildable = sePuedeTildar(unidad);
  const [hecha, setHecha] = useState(false);
  return (
    <li
      style={indice(orden)}
      className={cn(
        "entra flex items-start gap-3 rounded-[12px] px-2.5 py-3.5 transition-colors",
        atrasada && !hecha && "bg-terracota/[0.06]",
        hecha && "fila-hecha",
      )}
    >
      {tildable ? (
        <Tilde
          onTildar={() => {
            setHecha(true);
            completarUnidad(unidad);
          }}
        />
      ) : (
        <FileText size={22} strokeWidth={1.75} className="mt-0.5 shrink-0 text-texto-secundario" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
          <p className="truncate font-semibold">{cliente ?? unidad.etiqueta}</p>
          {atrasada && (
            <span className="shrink-0 rounded-[8px] bg-terracota/15 px-1.5 py-0.5 text-[0.75rem] font-medium text-terracota">
              atrasada
            </span>
          )}
        </div>
        <p className={cn("text-[0.9375rem] text-texto-secundario", hecha && "line-through")}>
          {unidad.etiqueta}
          {unidad.limite ? ` · para el ${unidad.limite}` : ""}
        </p>
      </div>
      <p className="numeros shrink-0 rounded-[8px] bg-bg-hundida px-2 py-0.5 text-[0.8125rem] font-medium text-texto-secundario">
        {fmtHoras(unidad.horas)}h
      </p>
    </li>
  );
}

/** Today's hours as a strip of client-colored segments over the day's
 * capacity — you see whose work fills the day, not just a total. */
function DiaReadout({
  horas,
  capacidad,
  semaforo,
  tareas,
  clients,
}: {
  horas: number;
  capacidad: number;
  semaforo?: string;
  tareas: Asignacion[];
  clients: Client[];
}) {
  const pasada = semaforo === "sobrecargado";
  const total = Math.max(capacidad, horas, 0.0001);
  const porCliente = new Map<string, number>();
  tareas.forEach((t) => {
    const k = t.unidad.clienteId ?? "";
    porCliente.set(k, (porCliente.get(k) ?? 0) + t.unidad.horas);
  });
  const segmentos = [...porCliente.entries()];

  return (
    <div className="papel h-full px-4 pb-4 pt-3.5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.8125rem] text-texto-secundario">Horas de hoy</p>
          <p className="numeros">
            <span className="titulo-serif text-[1.75rem] font-medium leading-tight">{fmtHoras(horas)}</span>
            <span className="text-[0.9375rem] text-texto-secundario"> h de {fmtHoras(capacidad)} h libres</span>
          </p>
        </div>
        {pasada ? (
          <span className="pop mt-1 rounded-[8px] bg-ambar/15 px-2 py-1 text-[0.8125rem] font-medium text-ambar">
            Se pasa de horas
          </span>
        ) : capacidad > 0 ? (
          <span className="pop mt-1 flex items-center gap-1 rounded-[8px] bg-verde/12 px-2 py-1 text-[0.8125rem] font-medium text-verde">
            <Check size={14} strokeWidth={2.5} /> Entra
          </span>
        ) : null}
      </div>
      <div
        className="flex h-2.5 gap-[3px] overflow-hidden rounded-full bg-bg-hundida"
        role="img"
        aria-label={`${fmtHoras(horas)} de ${fmtHoras(capacidad)} horas ocupadas`}
      >
        {segmentos.map(([id, h], i) => (
          <span
            key={id || "suelta"}
            className="segmento h-full first:rounded-l-full last:rounded-r-full"
            style={{
              ...indice(i),
              width: `${(h / total) * 100}%`,
              background: colorCliente(clients, id || undefined),
            }}
            title={`${clients.find((c) => c.id === id)?.nombre ?? "Otras"} · ${fmtHoras(h)} h`}
          />
        ))}
      </div>
    </div>
  );
}
