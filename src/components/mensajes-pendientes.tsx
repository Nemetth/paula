"use client";

import { useState } from "react";
import { CalendarClock, MessageCircle } from "lucide-react";
import { actualizarPiezas, marcarMensajeHecho, moverEntrega } from "@/lib/supabase/data";
import { MensajePendiente } from "@/lib/domain/mensajes";
import { fechaCorta, toISODate } from "@/lib/domain/dates";
import { avisarConDeshacer } from "@/components/aviso-deshacer";

/** WhatsApp messages due now, ready to send. When a message proposes moving a
 * delivery, the move is one tap away too: send it, move it, the plan rebuilds. */
export function MensajesPendientes({ mensajes }: { mensajes: MensajePendiente[] }) {
  const hoy = toISODate(new Date());
  const marcarHecho = (id: string) => void marcarMensajeHecho(id, hoy).catch(console.error);
  return (
    <ul className="flex flex-col gap-2">
      {mensajes.map((m) => (
        <li key={m.id} className="rounded-[14px] bg-bg-hundida px-4 py-3">
          <p className="font-semibold">
            {m.titulo} <span className="font-normal text-texto-secundario">· {m.cliente.nombre}</span>
          </p>
          <p className="mt-1.5 line-clamp-3 text-[0.8125rem] text-texto-secundario">{m.texto}</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {m.enlace ? (
              <a
                href={m.enlace}
                target="_blank"
                rel="noreferrer"
                onClick={() => marcarHecho(m.id)}
                className="tocable flex items-center gap-1.5 rounded-[10px] bg-verde px-3 py-1.5 text-[0.8125rem] font-medium text-white shadow-papel"
              >
                <MessageCircle size={14} /> Abrir WhatsApp
              </a>
            ) : (
              <span className="py-1.5 text-[0.8125rem] text-ambar">Sin WhatsApp cargado</span>
            )}
            <button
              onClick={() => marcarHecho(m.id)}
              className="tocable rounded-[10px] border border-borde bg-bg-elevada px-3 py-1.5 text-[0.8125rem] font-medium hover:bg-borde/40"
            >
              Ya lo mandé
            </button>
            {m.corrimiento && <MoverEntrega clienteId={m.cliente.id} nombre={m.cliente.nombre} {...m.corrimiento} />}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Moves every piece of the delivery to the date the plan can really make. The
 * message disappears once the move lands, so the undo lives in the global notice. */
function MoverEntrega({
  clienteId,
  nombre,
  fechaEntrega,
  fechaNueva,
}: {
  clienteId: string;
  nombre: string;
  fechaEntrega: string;
  fechaNueva: string;
}) {
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function mover() {
    setTrabajando(true);
    setError(null);
    try {
      const ids = await moverEntrega(clienteId, fechaEntrega, fechaNueva);
      avisarConDeshacer(`${nombre}: entrega movida al ${fechaCorta(fechaNueva)}`, () => {
        void actualizarPiezas(ids, { fechaEntrega }).catch(console.error);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo mover. Probá de nuevo.");
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <>
      <button
        disabled={trabajando}
        onClick={mover}
        className="tocable flex items-center gap-1.5 rounded-[10px] border border-borde bg-bg-elevada px-3 py-1.5 text-[0.8125rem] font-medium hover:bg-borde/40 disabled:opacity-60"
      >
        <CalendarClock size={14} /> Mover al {fechaCorta(fechaNueva)}
      </button>
      {error && <p className="w-full text-[0.8125rem] text-[var(--color-error)]">{error}</p>}
    </>
  );
}
