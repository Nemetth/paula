"use client";

import { MessageCircle } from "lucide-react";
import { marcarMensajeHecho } from "@/lib/supabase/data";
import { MensajePendiente } from "@/lib/domain/mensajes";
import { toISODate } from "@/lib/domain/dates";

/** WhatsApp messages due now, ready to send. They live in the bell, not in Hoy. */
export function MensajesPendientes({ mensajes }: { mensajes: MensajePendiente[] }) {
  const hoy = toISODate(new Date());
  return (
    <ul className="flex flex-col gap-2">
      {mensajes.map((m) => (
        <li key={m.id} className="rounded-[14px] bg-bg-hundida px-4 py-3">
          <p className="font-semibold">
            {m.titulo} <span className="font-normal text-texto-secundario">· {m.cliente.nombre}</span>
          </p>
          <p className="mt-1.5 line-clamp-3 text-[0.8125rem] text-texto-secundario">{m.texto}</p>
          <div className="mt-2.5 flex gap-2">
            {m.enlace ? (
              <a
                href={m.enlace}
                target="_blank"
                rel="noreferrer"
                onClick={() => marcarMensajeHecho(m.id, hoy)}
                className="tocable flex items-center gap-1.5 rounded-[10px] bg-verde px-3 py-1.5 text-[0.8125rem] font-medium text-white shadow-papel"
              >
                <MessageCircle size={14} /> Abrir WhatsApp
              </a>
            ) : (
              <span className="py-1.5 text-[0.8125rem] text-ambar">Sin WhatsApp cargado</span>
            )}
            <button
              onClick={() => marcarMensajeHecho(m.id, hoy)}
              className="tocable rounded-[10px] border border-borde bg-bg-elevada px-3 py-1.5 text-[0.8125rem] font-medium hover:bg-borde/40"
            >
              Ya lo mandé
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
