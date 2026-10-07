"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  CircleCheck,
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
import { DisruptionSheet } from "@/components/disruption-sheet";
import { SobroTiempoSheet } from "@/components/sobro-tiempo-sheet";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";

const fmtHoras = (h: number) => `${Math.round(h * 100) / 100}`.replace(".", ",");

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
    return <div className="px-4 py-8 text-texto-secundario">Cargando...</div>;
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
    <div className="mx-auto max-w-[640px] px-4 pt-6 lg:max-w-[880px] lg:px-8 lg:pt-10">
      <header className="mb-5 flex items-start justify-between lg:mb-8">
        <div>
          <p className="text-[0.8125rem] font-medium text-texto-secundario capitalize">
            {format(today, "EEEE d 'de' MMMM", { locale: es })}
          </p>
          <h1 className="text-[1.25rem] font-semibold">Hoy</h1>
        </div>
        <Link href="/ajustes" aria-label="Ajustes" className="mt-1 text-texto-secundario lg:hidden">
          <Settings size={20} strokeWidth={1.75} />
        </Link>
      </header>

      <div className="mb-5 flex flex-col gap-3 lg:mb-8 lg:flex-row">
        <div className="lg:flex-1">
          <HorasReadout horas={carga?.horas ?? 0} capacidad={carga?.capacidad ?? 0} semaforo={carga?.semaforo} />
        </div>
        {vencidos > 0 && (
          <Link
            href="/plata"
            className="flex items-center gap-2.5 rounded-[12px] bg-terracota/[0.08] border border-terracota/20 px-4 py-3 lg:flex-1"
          >
            <AlertTriangle size={18} className="shrink-0 text-terracota" />
            <p className="text-[0.9375rem] text-texto">
              {vencidos === 1 ? "Tenés 1 cobro vencido" : `Tenés ${vencidos} cobros vencidos`}{" "}
              <span className="font-medium text-terracota">— ver en Plata</span>
            </p>
          </Link>
        )}
      </div>

      {motivoBloqueo && (
        <p className="mb-5 rounded-[12px] border border-borde bg-bg-elevada px-4 py-3 text-[0.9375rem] text-texto-secundario">
          {motivoBloqueo}
        </p>
      )}

      {hitosHoy.length > 0 && (
        <ul className="mb-5 flex flex-col gap-2">
          {hitosHoy.map((h, i) => {
            const Icon = h.tipo === "grabacion" ? Video : PackageCheck;
            return (
              <li
                key={`${h.tipo}-${h.clienteId}-${i}`}
                className="flex items-center gap-2.5 rounded-[12px] bg-bg-elevada border border-borde px-4 py-3"
              >
                <Icon size={18} className="shrink-0 text-terracota" />
                <p className="font-semibold">{h.detalle}</p>
              </li>
            );
          })}
        </ul>
      )}

      {fijos.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 text-[0.8125rem] font-medium text-texto-secundario">Fijos de todos los días</h2>
          <ul className="flex flex-wrap gap-2">
            {fijos.map((f) => {
              const hecho = fijosHechos?.has(f.id) ?? false;
              return (
                <li key={f.id}>
                  <button
                    onClick={() => marcarFijo(todayISO, f.id, !hecho)}
                    aria-pressed={hecho}
                    className={cn(
                      "flex items-center gap-1.5 rounded-[12px] border px-3 py-2 text-[0.9375rem]",
                      hecho ? "border-verde/30 bg-verde/10 text-verde" : "border-borde bg-bg-elevada",
                    )}
                  >
                    {hecho ? <CircleCheck size={16} /> : <Circle size={16} className="text-texto-secundario" />}
                    <span className={hecho ? "line-through" : undefined}>{f.nombre}</span>
                    <span className="text-[0.8125rem] text-texto-secundario">{fmtHoras(f.horas)}h</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {mensajes.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 text-[0.8125rem] font-medium text-texto-secundario">Mensajes para mandar</h2>
          <ul className="flex flex-col gap-2">
            {mensajes.map((m) => (
              <li key={m.id} className="rounded-[12px] border border-borde bg-bg-elevada px-4 py-3">
                <p className="font-semibold">
                  {m.titulo} <span className="font-normal text-texto-secundario">· {m.cliente.nombre}</span>
                </p>
                <p className="mt-0.5 line-clamp-2 text-[0.8125rem] text-texto-secundario">{m.texto}</p>
                <div className="mt-2 flex gap-2">
                  {m.enlace ? (
                    <a
                      href={m.enlace}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => marcarMensajeHecho(m.id, todayISO)}
                      className="flex items-center gap-1.5 rounded-[8px] bg-verde/15 px-2.5 py-1.5 text-[0.8125rem] font-medium text-verde"
                    >
                      <MessageCircle size={14} /> Abrir WhatsApp
                    </a>
                  ) : (
                    <span className="py-1.5 text-[0.8125rem] text-ambar">Sin WhatsApp cargado</span>
                  )}
                  <button
                    onClick={() => marcarMensajeHecho(m.id, todayISO)}
                    className="rounded-[8px] border border-borde px-2.5 py-1.5 text-[0.8125rem] font-medium"
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
          title={hayDatos ? "Vas bien — nada para producir hoy" : "Todavía no hay clientes cargados"}
          detail={
            hayDatos
              ? "No hay piezas pendientes para hoy. Si te sobra tiempo, la app te dice qué adelantar."
              : "Agregá tu primer cliente para que la app arme el plan."
          }
        />
      ) : (
        <ul className="flex flex-col divide-y divide-borde border-y border-borde lg:rounded-[12px] lg:border lg:border-borde lg:bg-bg-elevada lg:px-3">
          {tareas.map((a) => (
            <TareaFila key={a.unidad.id} asignacion={a} cliente={nombreCliente.get(a.unidad.clienteId ?? "")} />
          ))}
        </ul>
      )}

      {alertas.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-[0.8125rem] font-medium text-texto-secundario">Avisos</h2>
          <ul className="flex flex-col gap-2">
            {alertas.slice(0, 5).map((a, i) => (
              <li
                key={`${a.tipo}-${i}`}
                className="flex items-start gap-2.5 rounded-[12px] bg-ambar/10 px-4 py-3 text-[0.9375rem]"
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

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          onClick={() => setSobroAbierto(true)}
          className="flex w-full items-center justify-center gap-2 rounded-[12px] bg-terracota px-5 py-3 text-center text-[0.9375rem] font-medium text-bg"
        >
          <Sparkles size={16} />
          Me sobró tiempo
        </button>
        <button
          onClick={() => setCambioAbierto(true)}
          className="w-full rounded-[12px] border border-borde px-5 py-3 text-center text-[0.9375rem] font-medium text-texto"
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

function TareaFila({ asignacion, cliente }: { asignacion: Asignacion; cliente?: string }) {
  const { unidad, atrasada } = asignacion;
  const tildable = sePuedeTildar(unidad);
  return (
    <li className={cn("flex items-start gap-3 px-2 py-3.5", atrasada && "bg-terracota/[0.06]")}>
      {tildable ? (
        <button
          onClick={() => completarUnidad(unidad)}
          className="mt-0.5 shrink-0 text-texto-secundario transition-colors hover:text-terracota"
          aria-label="Marcar como hecho"
        >
          <Circle size={22} strokeWidth={1.75} />
        </button>
      ) : (
        <FileText size={22} strokeWidth={1.75} className="mt-0.5 shrink-0 text-texto-secundario" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate font-semibold">{cliente ?? unidad.etiqueta}</p>
          {atrasada && (
            <span className="shrink-0 rounded-[8px] bg-terracota/15 px-1.5 py-0.5 text-[0.8125rem] font-medium text-terracota">
              atrasada
            </span>
          )}
        </div>
        <p className="text-[0.9375rem] text-texto-secundario">
          {unidad.etiqueta}
          {unidad.limite ? ` · para el ${unidad.limite}` : ""}
        </p>
      </div>
      <p className="shrink-0 text-[0.8125rem] font-medium text-texto-secundario">{fmtHoras(unidad.horas)}h</p>
    </li>
  );
}

function HorasReadout({
  horas,
  capacidad,
  semaforo,
}: {
  horas: number;
  capacidad: number;
  semaforo?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-[12px] bg-bg-elevada border border-borde px-4 py-3">
      <div>
        <p className="text-[0.8125rem] text-texto-secundario">Horas de hoy</p>
        <p className="font-semibold">
          {fmtHoras(horas)}h <span className="font-normal text-texto-secundario">de {fmtHoras(capacidad)}h libres</span>
        </p>
      </div>
      {semaforo === "sobrecargado" ? (
        <span className="rounded-[8px] bg-ambar/15 px-2 py-1 text-[0.8125rem] font-medium text-ambar">
          Se pasa de horas
        </span>
      ) : (
        <CheckCircle2 size={20} className="text-verde" />
      )}
    </div>
  );
}
