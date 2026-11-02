"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { actualizarPiezas, marcarMensajeHecho, moverEntrega } from "@/lib/supabase/data";
import { fechaCorta, toISODate } from "@/lib/domain/dates";
import { LineaUrgente } from "@/lib/domain/hoy";
import { enlaceWhatsapp, textoMensaje } from "@/lib/domain/mensajes";
import { Asignacion } from "@/lib/domain/planner";
import { Client } from "@/lib/domain/types";
import { avisarConDeshacer } from "@/components/aviso-deshacer";
import { BotonPrimario, Sheet } from "@/components/sheet";
import { Tilde } from "@/components/tilde";
import { colorCliente } from "@/lib/domain/calendario";

const FILA = "flex items-center gap-2.5 rounded-[14px] border border-l-[3px] border-borde/70 border-l-[var(--color-error)] bg-bg-elevada px-3 py-2 shadow-[var(--shadow-papel)]";

type LineaEntrega = Extract<LineaUrgente, { tipo: "entrega" }>;

/** One line of Urgente. The message to the client stays out of sight until she
 * taps "Correr entrega". */
export function FilaUrgente({
  linea,
  clients,
  onCorrer,
  onTildar,
}: {
  linea: LineaUrgente;
  clients: Client[];
  onCorrer: (l: LineaEntrega) => void;
  onTildar: (a: Asignacion) => void;
}) {
  const clienteId = linea.tipo === "unidad" ? linea.asignacion.unidad.clienteId : linea.clienteId;
  const cliente = clients.find((c) => c.id === clienteId);
  const nombre = cliente && (
    <Link href={`/clientes/${cliente.id}`} className="inline-flex items-center gap-1.5 font-semibold hover:underline">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colorCliente(clients, cliente.id) }} aria-hidden />
      {cliente.nombre}
    </Link>
  );

  if (linea.tipo === "entrega") {
    return (
      <div className={FILA}>
        <p className="min-w-0 flex-1 text-[0.8125rem] leading-snug">
          {nombre} <span className="text-texto-secundario">· faltan {linea.faltan} · {linea.vencida ? "venció" : "no llega al"}{linea.vencida ? " el" : ""} {fechaCorta(linea.fecha)}</span>
        </p>
        <button
          onClick={() => onCorrer(linea)}
          className="tocable shrink-0 rounded-[10px] border border-borde px-2.5 py-1.5 text-[0.75rem] font-medium hover:bg-borde/40"
        >
          Correr entrega
        </button>
      </div>
    );
  }
  if (linea.tipo === "reporte") {
    return (
      <div className={FILA}>
        <p className="min-w-0 flex-1 text-[0.8125rem] leading-snug">
          {nombre} <span className="text-texto-secundario">· {linea.etiqueta} · venció el {fechaCorta(linea.fecha)}</span>
        </p>
        <Link href="/ads" aria-label="Ir a Ads" className="tocable shrink-0 rounded-full p-1.5 text-texto-secundario hover:bg-borde/50 hover:text-texto">
          <ArrowRight size={15} />
        </Link>
      </div>
    );
  }
  const { unidad } = linea.asignacion;
  return (
    <div className={FILA}>
      <Tilde label={`Marcar ${unidad.etiqueta} como hecho`} onTildar={() => onTildar(linea.asignacion)} />
      <p className="min-w-0 flex-1 text-[0.8125rem] leading-snug">
        {nombre}
        {nombre && " "}
        <span className={nombre ? "text-texto-secundario" : "font-medium"}>
          {nombre && "· "}
          {unidad.etiqueta}
          {unidad.limite && ` · ${unidad.limite < toISODate(new Date()) ? "venció el" : "para el"} ${fechaCorta(unidad.limite)}`}
        </span>
      </p>
    </div>
  );
}

/** "Correr entrega": the date the plan can really make (she can pick another),
 * the WhatsApp to tell the client, and the move itself. Each is on its own: she
 * may have already told them. */
export function CorrerEntrega({ linea, clients, onClose }: { linea: LineaEntrega | null; clients: Client[]; onClose: () => void }) {
  const cliente = linea ? clients.find((c) => c.id === linea.clienteId) : undefined;
  return (
    <Sheet open={!!linea && !!cliente} title={cliente ? `Correr la entrega de ${cliente.nombre}` : "Correr la entrega"} onClose={onClose}>
      {linea && cliente && <Contenido key={linea.clave} linea={linea} cliente={cliente} onClose={onClose} />}
    </Sheet>
  );
}

function Contenido({ linea, cliente, onClose }: { linea: LineaEntrega; cliente: Client; onClose: () => void }) {
  const [fecha, setFecha] = useState(linea.fechaNueva);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hoy = toISODate(new Date());
  const texto = textoMensaje("correr-entrega", { cliente, fechaEntrega: linea.fecha, fechaNueva: fecha || undefined });
  const enlace = enlaceWhatsapp(cliente.contactoWhatsapp, texto);

  async function mover() {
    setTrabajando(true);
    setError(null);
    try {
      const ids = await moverEntrega(cliente.id, linea.fecha, fecha);
      avisarConDeshacer(`${cliente.nombre}: entrega movida al ${fechaCorta(fecha)}`, () => {
        void actualizarPiezas(ids, { fechaEntrega: linea.fecha }).catch(console.error);
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo mover. Probá de nuevo.");
      setTrabajando(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[0.9375rem] text-texto-secundario">
        Era para el {fechaCorta(linea.fecha)} y faltan {linea.faltan} {linea.faltan === 1 ? "pieza" : "piezas"}.
      </p>
      <label className="flex flex-col gap-1">
        <span className="text-[0.8125rem] font-medium text-texto-secundario">Nueva fecha</span>
        <input type="date" value={fecha} min={hoy} onChange={(e) => setFecha(e.target.value)} className="input" />
      </label>
      <div className="rounded-[14px] bg-bg-hundida px-4 py-3">
        <p className="text-[0.875rem]">{texto}</p>
        {enlace ? (
          <a
            href={enlace}
            target="_blank"
            rel="noreferrer"
            onClick={() => void marcarMensajeHecho(`correr-entrega__${cliente.id}__${linea.fecha}@${fecha}`, hoy).catch(console.error)}
            className="tocable mt-2.5 inline-flex items-center gap-1.5 rounded-[10px] bg-verde px-3 py-1.5 text-[0.8125rem] font-medium text-white shadow-papel"
          >
            <MessageCircle size={14} /> Abrir WhatsApp
          </a>
        ) : (
          <p className="mt-2 text-[0.8125rem] text-ambar">Sin WhatsApp cargado</p>
        )}
      </div>
      {error && <p className="text-[0.8125rem] text-[var(--color-error)]">{error}</p>}
      <BotonPrimario onClick={mover} disabled={trabajando || !fecha}>
        {trabajando ? "Moviendo..." : fecha ? `Mover la entrega al ${fechaCorta(fecha)}` : "Elegí una fecha"}
      </BotonPrimario>
    </div>
  );
}
