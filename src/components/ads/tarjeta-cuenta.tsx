"use client";

import { useState } from "react";
import Link from "next/link";
import { differenceInCalendarDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, ExternalLink, FileText, MessageCircle, Trash2 } from "lucide-react";
import {
  actualizarCliente,
  crearFaltaAds,
  crearIdeaAds,
  eliminarIdeaAds,
  marcarIdeaAdsProbada,
} from "@/lib/supabase/data";
import { CuentaAds, EstadoCuentaAds, nombreDia } from "@/lib/domain/ads";
import { fechaCorta, fromISODate, toISODate } from "@/lib/domain/dates";
import { MensajePendiente } from "@/lib/domain/mensajes";
import { AdsFalta, AdsIdea } from "@/lib/domain/types";
import { BotonPrimario, Sheet } from "@/components/sheet";
import { Tilde } from "@/components/tilde";
import { cn } from "@/lib/utils";

export const TONO_ESTADO: Record<EstadoCuentaAds["tono"], string> = {
  rojo: "bg-[var(--color-error)]/12 text-[var(--color-error)]",
  acento: "bg-acento/30 text-acento-texto",
  ambar: "bg-ambar/15 text-ambar",
  verde: "bg-verde/15 text-verde",
  gris: "bg-borde text-texto-secundario",
};

const ROJO = "font-medium text-[var(--color-error)]";

/** A line of the card: a tick when it's due, an icon when it isn't yet (tapping
 * the icon still marks it done, with undo), and when it's due on the right. */
function Fila({
  titulo,
  hecha,
  toca,
  Icono,
  derecha,
  onHacer,
  onDeshacer,
}: {
  titulo: string;
  hecha?: boolean;
  /** Due today or late: gets the tick. */
  toca: boolean;
  Icono: typeof CalendarDays;
  derecha?: React.ReactNode;
  onHacer: () => void;
  onDeshacer?: () => void;
}) {
  return (
    <li className="flex min-h-9 items-center gap-2.5 py-1 text-[0.8125rem]">
      {toca || hecha ? (
        <Tilde hecha={hecha} label={`Marcar ${titulo} como hecho`} onTildar={onHacer} onDeshacer={onDeshacer} />
      ) : (
        <button
          onClick={onHacer}
          aria-label={`Marcar ${titulo} como hecho`}
          title="Marcar como hecho"
          className="tocable flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-texto-secundario hover:bg-borde/50 hover:text-texto"
        >
          <Icono size={15} />
        </button>
      )}
      <span className={cn("min-w-0 flex-1 truncate", hecha && "text-texto-secundario line-through decoration-texto-secundario/50")}>{titulo}</span>
      {derecha && <span className="shrink-0 text-[0.75rem] text-texto-secundario">{derecha}</span>}
    </li>
  );
}

/** One Ads account: its strategy, what to do today, when the next things are due
 * and what Paula noted is missing. */
export function TarjetaCuenta({
  cuenta,
  color,
  ideas,
  material,
  hoyISO,
  conRutina,
  onChequeo,
  onDeshacerChequeo,
  onRevision,
  onDeshacerRevision,
  onRecambio,
  onMaterial,
  onMandarMaterial,
  onFalta,
  onVerReporte,
  guardar,
}: {
  cuenta: CuentaAds;
  color: string;
  ideas: AdsIdea[];
  /** The "pedir material" message, while it's due. */
  material?: MensajePendiente;
  hoyISO: string;
  /** A paused account has no routines to do. */
  conRutina: boolean;
  onChequeo: () => void;
  onDeshacerChequeo: () => void;
  onRevision: () => void;
  onDeshacerRevision?: () => void;
  onRecambio: () => void;
  onMaterial: (m: MensajePendiente) => void;
  onMandarMaterial: (m: MensajePendiente) => void;
  onFalta: (f: AdsFalta) => void;
  onVerReporte: () => void;
  guardar: (accion: () => Promise<unknown>) => void;
}) {
  const { cliente: c, chequeo, revision, recambio, reporte, faltan, estado } = cuenta;
  const [ideasAbiertas, setIdeasAbiertas] = useState(false);
  const [anotando, setAnotando] = useState(false);
  const paraProbar = ideas.filter((i) => !i.probada).length;

  const dias = differenceInCalendarDays(fromISODate(recambio), fromISODate(hoyISO));
  const revisionHoy = revision.dia === hoyISO;
  const revisionTarde = !revision.hecha && revision.dia < hoyISO;
  const mesReporte = reporte && format(fromISODate(`${reporte.periodo}-01`), "MMMM", { locale: es });
  const faltaDelReporte = reporte
    ? !reporte.reporte?.analisis && !reporte.reporte?.estrategia
      ? "falta todo"
      : !reporte.reporte?.analisis
        ? "falta análisis"
        : !reporte.reporte?.estrategia
          ? "falta estrategia"
          : "falta enviar"
    : undefined;

  return (
    <article className="papel flex flex-col px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
        <Link href={`/clientes/${c.id}`} className="min-w-0 truncate font-semibold hover:underline">
          {c.nombre}
        </Link>
        {c.adsCuentaUrl && (
          <a
            href={/^https?:\/\//i.test(c.adsCuentaUrl) ? c.adsCuentaUrl : `https://${c.adsCuentaUrl}`}
            target="_blank"
            rel="noreferrer"
            aria-label={`Abrir la cuenta de ${c.nombre}`}
            className="shrink-0 text-texto-secundario hover:text-texto"
          >
            <ExternalLink size={13} />
          </a>
        )}
        <span className={cn("numeros ml-auto shrink-0 rounded-full px-2.5 py-0.5 text-[0.75rem] font-medium", TONO_ESTADO[estado.tono])}>{estado.texto}</span>
      </div>

      <div className="mt-1.5 flex items-center gap-2 border-b border-borde/70 pb-2 text-[0.8125rem]">
        <span className="shrink-0 text-texto-secundario">Estrategia:</span>
        <input
          key={c.adsEstrategia ?? ""}
          defaultValue={c.adsEstrategia ?? ""}
          placeholder="A definir"
          aria-label={`Estrategia de ${c.nombre}`}
          onBlur={(e) => {
            const texto = e.target.value.trim();
            if (texto !== (c.adsEstrategia ?? "")) guardar(() => actualizarCliente(c.id, { adsEstrategia: texto }));
          }}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className="min-w-0 flex-1 truncate rounded-[6px] bg-transparent px-1 py-0.5 font-medium outline-none placeholder:font-normal placeholder:text-texto-secundario hover:bg-bg-hundida focus:bg-bg-hundida"
        />
        <button
          onClick={() => setIdeasAbiertas(true)}
          className={cn(
            "tocable shrink-0 rounded-full px-2.5 py-0.5 text-[0.75rem] font-medium",
            paraProbar > 0 ? "bg-acento/30 text-acento-texto" : "text-texto-secundario hover:bg-borde/50",
          )}
        >
          {paraProbar > 0 ? `${paraProbar} ${paraProbar === 1 ? "idea" : "ideas"} para probar` : "+ idea"}
        </button>
      </div>

      <ul className="mt-1 flex flex-col divide-y divide-borde/50">
        <Fila titulo="Chequeo de hoy" hecha={!!chequeo} toca Icono={CalendarDays} onHacer={onChequeo} onDeshacer={onDeshacerChequeo} derecha={chequeo?.estado === "revisar" ? <span className={ROJO}>a revisar</span> : undefined} />
        {conRutina && (
          <>
            <Fila
              titulo="Revisión semanal"
              hecha={!!revision.hecha}
              toca={revisionHoy || revisionTarde}
              Icono={CalendarDays}
              onHacer={onRevision}
              onDeshacer={onDeshacerRevision}
              derecha={
                revision.hecha ? (
                  fechaCorta(revision.hecha.fecha)
                ) : revisionHoy ? (
                  <span className="font-medium text-acento-texto">hoy</span>
                ) : revisionTarde ? (
                  <span className={ROJO}>era el {nombreDia(fromISODate(revision.dia).getDay())}</span>
                ) : (
                  nombreDia(fromISODate(revision.dia).getDay())
                )
              }
            />
            <Fila
              titulo="Recambio de anuncios"
              toca={dias <= 0}
              Icono={CalendarDays}
              onHacer={onRecambio}
              derecha={
                dias < 0 ? (
                  <span className={ROJO}>hace {-dias} {dias === -1 ? "día" : "días"}</span>
                ) : dias === 0 ? (
                  <span className="font-medium text-acento-texto">hoy</span>
                ) : (
                  fechaCorta(recambio)
                )
              }
            />
          </>
        )}
        {reporte && (
          <li className="flex min-h-9 items-center gap-2.5 py-1 text-[0.8125rem]">
            <button onClick={onVerReporte} className="tocable flex min-w-0 flex-1 items-center gap-2.5 text-left">
              <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center text-texto-secundario">
                <FileText size={15} />
              </span>
              <span className="min-w-0 flex-1 truncate">Reporte de {mesReporte}</span>
              <span className="shrink-0 text-[0.75rem] text-texto-secundario">
                {reporte.estado === "enviado" ? (
                  <span className="text-verde">enviado ✓</span>
                ) : reporte.atrasado ? (
                  <span className={ROJO}>atrasado</span>
                ) : (
                  faltaDelReporte
                )}
              </span>
            </button>
          </li>
        )}
        {material && (
          <li className="flex min-h-9 items-center gap-2.5 py-1 text-[0.8125rem]">
            <Tilde label="Marcar el pedido de material como hecho" onTildar={() => onMaterial(material)} />
            <span className="min-w-0 flex-1 truncate">Pedir material para el recambio</span>
            {material.enlace ? (
              <a
                href={material.enlace}
                target="_blank"
                rel="noreferrer"
                onClick={() => onMandarMaterial(material)}
                className="tocable flex shrink-0 items-center gap-1 rounded-full bg-verde/15 px-2.5 py-0.5 text-[0.75rem] font-medium text-verde"
              >
                <MessageCircle size={12} /> Mandar
              </a>
            ) : (
              <span className="shrink-0 text-[0.75rem] text-ambar">Sin WhatsApp</span>
            )}
          </li>
        )}
      </ul>

      {faltan.length > 0 && (
        <ul className="mt-1.5 flex flex-col gap-1.5">
          {faltan.map((f) => (
            <li key={f.id} className="flex items-center gap-2.5 rounded-[10px] bg-ambar/12 px-2 py-1 text-[0.8125rem]">
              <Tilde label={`Marcar ${f.texto} como resuelto`} onTildar={() => onFalta(f)} />
              <span className="min-w-0 flex-1">
                <span className="font-semibold text-ambar">Falta:</span> {f.texto}
              </span>
              {f.fecha && (
                <span className={cn("shrink-0 text-[0.75rem] text-texto-secundario", f.fecha < hoyISO && ROJO)}>antes del {fechaCorta(f.fecha)}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {anotando ? (
        <FormFalta clienteId={c.id} guardar={guardar} onCerrar={() => setAnotando(false)} />
      ) : (
        <button
          onClick={() => setAnotando(true)}
          className="tocable mt-1.5 self-start rounded-[8px] px-1 py-0.5 text-[0.75rem] text-texto-secundario hover:text-texto"
        >
          + Anotar algo que falta
        </button>
      )}

      <Sheet open={ideasAbiertas} title={`Ideas para probar · ${c.nombre}`} onClose={() => setIdeasAbiertas(false)}>
        <ListaIdeas clienteId={c.id} ideas={ideas} guardar={guardar} />
      </Sheet>
    </article>
  );
}

function FormFalta({
  clienteId,
  guardar,
  onCerrar,
}: {
  clienteId: string;
  guardar: (accion: () => Promise<unknown>) => void;
  onCerrar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [fecha, setFecha] = useState("");
  function anotar() {
    if (texto.trim()) guardar(() => crearFaltaAds(clienteId, texto.trim(), fecha || undefined));
    onCerrar();
  }
  return (
    <div className="aparece mt-2 flex flex-col gap-2 rounded-[10px] bg-bg-hundida p-2">
      <input
        autoFocus
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && anotar()}
        placeholder="Fotos nuevas, armar la estrategia…"
        aria-label="Qué falta"
        className="input py-1.5 text-[0.875rem]"
      />
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={fecha}
          min={toISODate(new Date())}
          onChange={(e) => setFecha(e.target.value)}
          aria-label="Para cuándo (opcional)"
          className="input min-w-0 flex-1 py-1.5 text-[0.8125rem]"
        />
        <button onClick={onCerrar} className="tocable rounded-[10px] px-2.5 py-1.5 text-[0.8125rem] font-medium text-texto-secundario hover:bg-borde/40">
          Cancelar
        </button>
        <button onClick={anotar} className="boton-primario tocable rounded-[10px] px-3 py-1.5 text-[0.8125rem] font-medium">
          Anotar
        </button>
      </div>
    </div>
  );
}

function ListaIdeas({
  clienteId,
  ideas,
  guardar,
}: {
  clienteId: string;
  ideas: AdsIdea[];
  guardar: (accion: () => Promise<unknown>) => void;
}) {
  const [texto, setTexto] = useState("");
  const orden = [...ideas].sort((a, b) => Number(a.probada) - Number(b.probada) || a.creadaEn.localeCompare(b.creadaEn));
  function agregar() {
    if (!texto.trim()) return;
    const nueva = texto.trim();
    setTexto("");
    guardar(() => crearIdeaAds(clienteId, nueva));
  }
  return (
    <div className="flex flex-col gap-3">
      {orden.length > 0 && (
        <ul className="flex flex-col gap-1">
          {orden.map((i) => (
            <li key={i.id} className="flex items-center gap-3 rounded-[12px] bg-bg-hundida px-3 py-2 text-[0.9375rem]">
              <Tilde
                hecha={i.probada}
                label={`Marcar ${i.texto} como probada`}
                onTildar={() => guardar(() => marcarIdeaAdsProbada(i.id, true))}
                onDeshacer={() => guardar(() => marcarIdeaAdsProbada(i.id, false))}
              />
              <span className={cn("min-w-0 flex-1", i.probada && "text-texto-secundario line-through")}>{i.texto}</span>
              <button
                onClick={() => guardar(() => eliminarIdeaAds(i.id))}
                aria-label={`Borrar ${i.texto}`}
                className="tocable shrink-0 rounded-full p-1.5 text-texto-secundario hover:bg-borde/50 hover:text-texto"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && agregar()}
        placeholder="Una idea para probar"
        aria-label="Nueva idea"
        className="input"
      />
      <BotonPrimario onClick={agregar} disabled={!texto.trim()}>
        Agregar idea
      </BotonPrimario>
    </div>
  );
}
