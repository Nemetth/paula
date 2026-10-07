"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { MessageCircle, Trash2 } from "lucide-react";
import {
  actualizarCliente,
  crearIdea,
  eliminarIdea,
  marcarIdeaUsada,
} from "@/lib/supabase/data";
import { CADENCIA_REVISION_FONDO_DIAS, diasDesdeRevision } from "@/lib/domain/ads";
import { fechaEntregaDe } from "@/lib/domain/planner";
import { fromISODate } from "@/lib/domain/dates";
import { ESTADO_PIEZA_LABEL } from "@/lib/domain/labels";
import { MENSAJES, TipoMensaje, enlaceWhatsapp, textoMensaje } from "@/lib/domain/mensajes";
import { AdsChequeo, Client, Cobro, Grabacion, Idea, Pieza } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { Seccion, botonPrimario, botonSecundario, campo, listaFilas } from "./seccion";

const fecha = (iso: string) => format(fromISODate(iso), "d MMM", { locale: es });

export function SeccionAds({ cliente, chequeos, hoyISO }: { cliente: Client; chequeos: AdsChequeo[]; hoyISO: string }) {
  if (cliente.servicio === "contenido") return null;
  const dias = diasDesdeRevision(cliente, new Date());
  const hoy = chequeos.find((c) => c.clienteId === cliente.id && c.fecha === hoyISO);
  return (
    <Seccion titulo="Ads">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[0.9375rem]">
        <dt className="text-texto-secundario">Chequeo de hoy</dt>
        <dd className="text-right font-medium">{hoy ? (hoy.estado === "ok" ? "OK" : "Revisar") : "Sin chequear"}</dd>
        <dt className="text-texto-secundario">Revisión a fondo</dt>
        <dd className={cn("text-right font-medium", dias >= CADENCIA_REVISION_FONDO_DIAS && "text-terracota")}>
          {dias === Infinity ? "Nunca" : dias === 0 ? "Hoy" : `Hace ${dias} d`}
        </dd>
      </dl>
      <Link href="/ads" className="mt-2 inline-block text-[0.8125rem] font-medium text-terracota">
        Ir a Ads
      </Link>
    </Seccion>
  );
}

export function SeccionIdeas({ cliente, ideas }: { cliente: Client; ideas: Idea[] }) {
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const suyas = ideas.filter((i) => i.clienteId === cliente.id).sort((a, b) => Number(a.usada) - Number(b.usada) || b.creadaEn.localeCompare(a.creadaEn));

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    setError(null);
    try {
      await crearIdea(cliente.id, texto.trim());
      setTexto("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    }
  }

  return (
    <Seccion titulo="Banco de ideas" detalle="Ideas para no quedarte en blanco al armar el calendario. Marcá las que ya usaste.">
      <form onSubmit={agregar} className="mb-3 flex gap-2">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Nueva idea"
          aria-label="Nueva idea"
          className={`${campo} min-w-0 flex-1`}
        />
        <button type="submit" className={botonPrimario}>
          Agregar
        </button>
      </form>
      {error && <p className="mb-2 text-[0.8125rem] text-[var(--color-error)]">{error}</p>}
      {suyas.length > 0 && (
        <ul className={listaFilas}>
          {suyas.map((i) => (
            <li key={i.id} className="flex items-center gap-3 px-2 py-2.5">
              <input
                type="checkbox"
                checked={i.usada}
                onChange={(e) => marcarIdeaUsada(i.id, e.target.checked)}
                aria-label="Idea usada"
                className="h-[16px] w-[16px] accent-[var(--color-terracota)]"
              />
              <p className={cn("min-w-0 flex-1", i.usada && "text-texto-secundario line-through")}>{i.texto}</p>
              <button onClick={() => eliminarIdea(i.id)} aria-label="Eliminar idea" className="text-texto-secundario">
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Seccion>
  );
}

export function SeccionReunion({
  cliente,
  piezas,
  grabaciones,
  cobros,
}: {
  cliente: Client;
  piezas: Pieza[];
  grabaciones: Grabacion[];
  cobros: Cobro[];
}) {
  const [notas, setNotas] = useState(cliente.notasReunion ?? "");
  const [error, setError] = useState<string | null>(null);

  const porAprobar = piezas.filter((p) => p.estado === "idea").length;
  const proximas = piezas
    .filter((p) => p.estado === "grabada" || p.estado === "editada")
    .map((p) => fechaEntregaDe(p, grabaciones))
    .filter((f): f is string => !!f)
    .sort();
  const impagos = cobros.filter((c) => c.clienteId === cliente.id && c.estado !== "pagado").length;

  const temas = [
    porAprobar > 0 && `${porAprobar} ${porAprobar === 1 ? "idea" : "ideas"} para aprobar`,
    proximas[0] && `Próxima entrega: ${fecha(proximas[0])}`,
    impagos > 0 && `${impagos} ${impagos === 1 ? "cobro pendiente" : "cobros pendientes"}`,
  ].filter(Boolean) as string[];

  return (
    <Seccion titulo="Preparador de reuniones" detalle="Lo que hay para hablar con este cliente, y tus notas.">
      {temas.length > 0 ? (
        <ul className="mb-3 list-disc pl-5 text-[0.9375rem]">
          {temas.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      ) : (
        <p className="mb-3 text-[0.9375rem] text-texto-secundario">Nada pendiente para hablar.</p>
      )}
      <textarea
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
        onBlur={async () => {
          if (notas === (cliente.notasReunion ?? "")) return;
          setError(null);
          try {
            await actualizarCliente(cliente.id, { notasReunion: notas });
          } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo guardar.");
          }
        }}
        rows={4}
        placeholder="Notas para la próxima reunión"
        aria-label="Notas para la reunión"
        className={`${campo} w-full`}
      />
      {error && <p className="mt-1 text-[0.8125rem] text-[var(--color-error)]">{error}</p>}
    </Seccion>
  );
}

export function SeccionHistorial({ piezas, grabaciones }: { piezas: Pieza[]; grabaciones: Grabacion[] }) {
  const entregadas = piezas
    .filter((p) => p.estado === "entregada" || p.estado === "programada")
    .sort((a, b) => (fechaEntregaDe(b, grabaciones) ?? "").localeCompare(fechaEntregaDe(a, grabaciones) ?? ""));
  return (
    <Seccion titulo="Historial de entregas">
      {entregadas.length === 0 ? (
        <p className="text-[0.9375rem] text-texto-secundario">Todavía no hay entregas.</p>
      ) : (
        <ul className={listaFilas}>
          {entregadas.map((p) => {
            const f = fechaEntregaDe(p, grabaciones);
            return (
              <li key={p.id} className="flex items-center gap-3 px-2 py-2.5 text-[0.9375rem]">
                <p className="min-w-0 flex-1 truncate">{p.titulo ?? p.tipo}</p>
                <p className="text-[0.8125rem] text-texto-secundario">
                  {ESTADO_PIEZA_LABEL[p.estado]}
                  {f ? ` · ${fecha(f)}` : ""}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Seccion>
  );
}

export function SeccionMensajes({ cliente, grabaciones, hoyISO }: { cliente: Client; grabaciones: Grabacion[]; hoyISO: string }) {
  const proxima = grabaciones
    .filter((g) => !g.hecha && g.fecha >= hoyISO)
    .map((g) => g.fecha)
    .sort()[0];

  return (
    <Seccion titulo="Mensajes pre-armados" detalle="Abren WhatsApp con el mensaje listo para mandar.">
      {!cliente.contactoWhatsapp && (
        <p className="mb-2 text-[0.8125rem] text-ambar">Este cliente no tiene WhatsApp cargado: editalo para usar los mensajes.</p>
      )}
      <ul className="flex flex-col gap-2">
        {MENSAJES.map(({ tipo, titulo }) => (
          <Mensaje key={tipo} tipo={tipo} titulo={titulo} cliente={cliente} fechaGrabacion={proxima} />
        ))}
      </ul>
    </Seccion>
  );
}

function Mensaje({
  tipo,
  titulo,
  cliente,
  fechaGrabacion,
}: {
  tipo: TipoMensaje;
  titulo: string;
  cliente: Client;
  fechaGrabacion?: string;
}) {
  const texto = textoMensaje(tipo, { cliente, fechaGrabacion });
  const enlace = enlaceWhatsapp(cliente.contactoWhatsapp, texto);
  return (
    <li className="rounded-[12px] border border-borde bg-bg-elevada px-4 py-3">
      <div className="mb-1 flex items-center justify-between gap-3">
        <p className="font-medium">{titulo}</p>
        {enlace ? (
          <a href={enlace} target="_blank" rel="noreferrer" className={`${botonSecundario} flex items-center gap-1.5 py-1.5 text-verde`}>
            <MessageCircle size={14} /> Abrir
          </a>
        ) : null}
      </div>
      <p className="text-[0.8125rem] text-texto-secundario">{texto}</p>
    </li>
  );
}
