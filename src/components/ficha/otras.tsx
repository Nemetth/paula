"use client";

import { useState } from "react";
import Link from "next/link";
import { differenceInCalendarDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { Check, CircleAlert, ExternalLink, MessageCircle } from "lucide-react";
import { BotonEliminar } from "@/components/boton-eliminar";
import { CampoFecha } from "@/components/clientes/tarjeta-cliente";
import {
  actualizarCliente,
  crearIdea,
  crearOActualizarCobro,
  eliminarIdea,
  guardarChequeoAds,
  marcarIdeaUsada,
} from "@/lib/supabase/data";
import { CADENCIA_REVISION_FONDO_DIAS, diasDesdeRevision } from "@/lib/domain/ads";
import { cobrosDelPeriodo, estadoCobro } from "@/lib/domain/cobros";
import { Entrega, historialCliente } from "@/lib/domain/entregas";
import { fromISODate, nombreMes, toISODate } from "@/lib/domain/dates";
import { ESTADO_CUENTA_ADS_LABEL } from "@/lib/domain/labels";
import { MENSAJES, TipoMensaje, enlaceWhatsapp, textoMensaje } from "@/lib/domain/mensajes";
import { proximoAumento } from "@/lib/domain/plata";
import {
  AdsChequeo,
  AdsEstado,
  AdsEstadoCuenta,
  Client,
  Cobro,
  DIAS_REFRESH_CREATIVOS,
  Grabacion,
  Idea,
  Pieza,
} from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { Seccion, botonPrimario, botonSecundario, campo, listaFilas } from "./seccion";

const fecha = (iso: string) => format(fromISODate(iso), "d MMM", { locale: es });
const etiqueta = "text-[0.8125rem] font-medium text-texto-secundario";

function useGuardar() {
  const [error, setError] = useState<string | null>(null);
  async function guardar(accion: () => Promise<unknown>) {
    setError(null);
    try {
      await accion();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar. Probá de nuevo.");
    }
  }
  return { error, guardar };
}

/** "https://..." as typed, or with the scheme added when it was left out. */
const conEsquema = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

// ---------- Ads ----------

export function PanelAds({ cliente, chequeos, hoyISO }: { cliente: Client; chequeos: AdsChequeo[]; hoyISO: string }) {
  const { error, guardar } = useGuardar();
  const hoy = fromISODate(hoyISO);

  if (cliente.servicio === "contenido") {
    return (
      <Seccion titulo="Ads">
        <p className="text-[0.9375rem] text-texto-secundario">
          Este cliente no tiene Ads. Si empieza, cambiale el servicio a «Contenido + Ads» desde Clientes.
        </p>
      </Seccion>
    );
  }

  const suyos = chequeos.filter((c) => c.clienteId === cliente.id).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const deHoy = suyos.find((c) => c.fecha === hoyISO);
  const historial = suyos.filter((c) => c.nota || c.estado === "revisar").slice(0, 20);
  const diasFondo = diasDesdeRevision(cliente, hoy);
  const diasRefresh = cliente.adsRefreshCreativos
    ? differenceInCalendarDays(hoy, fromISODate(cliente.adsRefreshCreativos))
    : undefined;
  const refreshVencido = diasRefresh === undefined || diasRefresh > DIAS_REFRESH_CREATIVOS;

  return (
    <>
      <Seccion titulo="Cuenta">
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className={etiqueta}>Estado de la cuenta</span>
            <select
              value={cliente.adsEstadoCuenta}
              onChange={(e) => guardar(() => actualizarCliente(cliente.id, { adsEstadoCuenta: e.target.value as AdsEstadoCuenta }))}
              className={cn(campo, cliente.adsEstadoCuenta === "frenada-pago" && "border-acento text-acento-texto")}
            >
              {(Object.keys(ESTADO_CUENTA_ADS_LABEL) as AdsEstadoCuenta[]).map((e) => (
                <option key={e} value={e}>
                  {ESTADO_CUENTA_ADS_LABEL[e]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={etiqueta}>Link al Administrador de anuncios</span>
            <input
              key={cliente.adsCuentaUrl ?? ""}
              type="url"
              inputMode="url"
              defaultValue={cliente.adsCuentaUrl ?? ""}
              placeholder="https://adsmanager.facebook.com/..."
              onBlur={(e) => {
                const url = e.target.value.trim();
                if (url !== (cliente.adsCuentaUrl ?? "")) guardar(() => actualizarCliente(cliente.id, { adsCuentaUrl: url }));
              }}
              className={campo}
            />
          </label>
          {cliente.adsCuentaUrl && (
            <a
              href={conEsquema(cliente.adsCuentaUrl)}
              target="_blank"
              rel="noreferrer"
              className={`${botonSecundario} flex items-center justify-center gap-1.5`}
            >
              Abrir la cuenta <ExternalLink size={14} />
            </a>
          )}
        </div>
      </Seccion>

      <Seccion titulo="Creativos">
        <div className="flex flex-col gap-2">
          <p className={cn("text-[0.9375rem]", refreshVencido ? "font-medium text-acento-texto" : "text-texto-secundario")}>
            {diasRefresh === undefined
              ? "Sin fecha del último refresh."
              : diasRefresh === 0
                ? "Renovados hoy."
                : `Último refresh hace ${diasRefresh} ${diasRefresh === 1 ? "día" : "días"}${refreshVencido ? `: pasaron más de ${DIAS_REFRESH_CREATIVOS}, toca renovarlos.` : "."}`}
          </p>
          <div className="flex gap-2">
            <CampoFecha
              valor={cliente.adsRefreshCreativos}
              onGuardar={(f) => guardar(() => actualizarCliente(cliente.id, { adsRefreshCreativos: f }))}
            />
            <button
              onClick={() => guardar(() => actualizarCliente(cliente.id, { adsRefreshCreativos: hoyISO }))}
              className={`${botonPrimario} shrink-0`}
            >
              Renové hoy
            </button>
          </div>
        </div>
      </Seccion>

      <Seccion titulo="Chequeo de hoy">
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            {(
              [
                ["ok", "OK", Check],
                ["revisar", "Revisar", CircleAlert],
              ] as const
            ).map(([estado, label, Icono]) => (
              <button
                key={estado}
                onClick={() => guardar(() => guardarChequeoAds(cliente.id, hoyISO, estado as AdsEstado))}
                aria-pressed={deHoy?.estado === estado}
                className={cn(
                  "tocable flex flex-1 items-center justify-center gap-1.5 rounded-[12px] border px-3 py-2 text-[0.9375rem] font-medium",
                  deHoy?.estado === estado
                    ? estado === "ok"
                      ? "pop border-verde/30 bg-verde/15 text-verde"
                      : "pop border-acento/30 bg-acento/15 text-acento-texto"
                    : "border-borde text-texto-secundario hover:bg-borde/40",
                )}
              >
                <Icono size={15} /> {label}
              </button>
            ))}
          </div>
          <textarea
            key={deHoy?.nota ?? ""}
            defaultValue={deHoy?.nota ?? ""}
            onBlur={(e) => {
              const nota = e.target.value;
              if (nota.trim() === (deHoy?.nota ?? "")) return;
              guardar(() => guardarChequeoAds(cliente.id, hoyISO, deHoy?.estado ?? "ok", nota));
            }}
            rows={2}
            placeholder="Nota del chequeo (qué viste, qué cambiaste)"
            aria-label="Nota del chequeo de hoy"
            className={`${campo} w-full`}
          />
          <p className="text-[0.8125rem] text-texto-secundario">
            Revisión a fondo:{" "}
            <span className={cn("font-medium", diasFondo >= CADENCIA_REVISION_FONDO_DIAS && "text-acento-texto")}>
              {diasFondo === Infinity ? "nunca" : diasFondo === 0 ? "hoy" : `hace ${diasFondo} d`}
            </span>{" "}
            · <Link href="/ads" className="font-medium text-acento-texto">Ir a Ads</Link>
          </p>
        </div>
      </Seccion>

      <Seccion titulo="Historial de chequeos">
        {historial.length === 0 ? (
          <p className="text-[0.9375rem] text-texto-secundario">Las notas de cada chequeo aparecen acá.</p>
        ) : (
          <ul className={listaFilas}>
            {historial.map((c) => (
              <li key={c.id} className="flex gap-3 px-2 py-2.5 text-[0.9375rem]">
                <span className="numeros w-14 shrink-0 text-[0.8125rem] text-texto-secundario">{fecha(c.fecha)}</span>
                <span className="min-w-0 flex-1">
                  {c.estado === "revisar" && (
                    <span className="mr-1.5 rounded-[8px] bg-acento/15 px-1.5 py-0.5 text-[0.75rem] font-medium text-acento-texto">
                      revisar
                    </span>
                  )}
                  {c.nota ?? <span className="text-texto-secundario">Sin nota</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Seccion>
      {error && <p className="-mt-4 mb-4 text-[0.8125rem] text-[var(--color-error)]">{error}</p>}
    </>
  );
}

// ---------- Plata ----------

export function PanelPlata({
  cliente,
  cobros,
  piezas,
  entregas,
  today,
}: {
  cliente: Client;
  cobros: Cobro[];
  piezas: Pieza[];
  entregas: Entrega[];
  today: Date;
}) {
  const { error, guardar } = useGuardar();
  const historial = historialCliente({ cliente, piezas, entregas, cobros, today });
  const periodo = toISODate(today).slice(0, 7);
  const delMes = cobrosDelPeriodo([cliente], cobros, periodo)[0];
  const estado = delMes ? estadoCobro(delMes, today) : undefined;
  const anteriores = cobros
    .filter((c) => c.clienteId === cliente.id && c.periodo < periodo)
    .sort((a, b) => b.periodo.localeCompare(a.periodo))
    .slice(0, 6);
  const aumento = proximoAumento(cliente, today);

  /** Saves the month's cobro with what it shows now (it may not be saved yet), plus the change. */
  function cambiarCobro(cambios: Partial<Pick<Cobro, "estado" | "fechaPago" | "fechaVencimiento" | "monto">>) {
    if (!delMes) return;
    guardar(() =>
      crearOActualizarCobro(cliente.id, periodo, {
        fechaVencimiento: delMes.fechaVencimiento,
        monto: delMes.monto,
        ...cambios,
      }),
    );
  }

  return (
    <>
      <Seccion titulo={`Cobro de ${nombreMes(periodo, today)}`}>
        {!delMes ? (
          <p className="text-[0.9375rem] text-texto-secundario">Este mes no tiene cobro (el cliente arrancó después del vencimiento).</p>
        ) : (
          <div className="flex flex-col gap-3">
            <button
              onClick={() =>
                cambiarCobro(
                  estado === "pagado"
                    ? { estado: "pendiente" }
                    : { estado: "pagado", fechaPago: toISODate(today) },
                )
              }
              className={cn(
                "tocable rounded-[12px] px-4 py-3 text-[0.9375rem] font-medium",
                estado === "pagado" && "pop bg-verde/15 text-verde",
                estado === "vencido" && "bg-acento/15 text-acento-texto",
                estado === "pendiente" && "bg-ambar/15 text-ambar",
              )}
            >
              {estado === "pagado"
                ? `Cobrado${delMes.fechaPago ? ` el ${fecha(delMes.fechaPago)}` : ""} · tocá para desmarcar`
                : estado === "vencido"
                  ? "Vencido · tocá cuando cobres"
                  : "Pendiente · tocá cuando cobres"}
            </button>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className={etiqueta}>Vence</span>
                <CampoFecha valor={delMes.fechaVencimiento} onGuardar={(f) => cambiarCobro({ fechaVencimiento: f })} />
              </label>
              <label className="flex flex-col gap-1">
                <span className={etiqueta}>Monto del mes</span>
                <input
                  key={delMes.monto ?? ""}
                  type="number"
                  min={0}
                  defaultValue={delMes.monto ?? ""}
                  onBlur={(e) => {
                    const n = e.target.value === "" ? undefined : Number(e.target.value);
                    if (n !== delMes.monto && (n === undefined || n >= 0)) cambiarCobro({ monto: n });
                  }}
                  className={campo}
                />
              </label>
            </div>
            <p className="text-[0.8125rem] text-texto-secundario">
              Paga del {cliente.ventanaCobro?.[0] ?? 1} al {cliente.ventanaCobro?.[1] ?? "fin"} de cada mes
              {cliente.montoMensual ? ` · abono de $${cliente.montoMensual.toLocaleString("es-AR")}` : ""}.
            </p>
          </div>
        )}
      </Seccion>

      <Seccion titulo="Próximo aumento">
        <div className="flex items-center justify-between gap-3">
          <p className={cn("text-[0.9375rem]", aumento.dias < 0 && "font-medium text-acento-texto")}>
            {aumento.dias < 0 ? `Atrasado: tocaba el ${fecha(aumento.fecha)}` : `El ${fecha(aumento.fecha)} (en ${aumento.dias} días)`}
          </p>
          <button
            onClick={() => guardar(() => actualizarCliente(cliente.id, { ultimoAumento: toISODate(today) }))}
            className={`${botonSecundario} shrink-0`}
          >
            Aumenté hoy
          </button>
        </div>
      </Seccion>

      <Seccion titulo="Historial con el cliente" detalle="Números para hablar de un aumento.">
        <dl className="grid grid-cols-2 gap-2 text-[0.9375rem]">
          <Dato titulo="Trabajan juntos" valor={historial.meses < 1 ? "menos de un mes" : `${historial.meses} ${historial.meses === 1 ? "mes" : "meses"}`} />
          <Dato titulo="Entregas terminadas" valor={String(historial.entregasTerminadas)} />
          <Dato
            titulo="A tiempo"
            valor={historial.conFecha === 0 ? "sin datos aún" : `${historial.aTiempo} de ${historial.conFecha}`}
          />
          <Dato titulo={`Piezas en ${today.getFullYear()}`} valor={String(historial.piezasDelAnio)} />
          <Dato titulo={`Cobrado en ${today.getFullYear()}`} valor={`$${historial.cobradoDelAnio.toLocaleString("es-AR")}`} />
          <Dato titulo="Pagos fuera de fecha" valor={String(historial.pagosTarde)} />
        </dl>
        {historial.conFecha === 0 && historial.entregasTerminadas > 0 && (
          <p className="mt-2 text-[0.8125rem] text-texto-secundario">
            La puntualidad se mide desde ahora: cada pieza que tildás guarda el día.
          </p>
        )}
      </Seccion>

      {anteriores.length > 0 && (
        <Seccion titulo="Meses anteriores">
          <ul className={listaFilas}>
            {anteriores.map((c) => {
              const e = estadoCobro(c, today);
              return (
                <li key={c.id} className="flex items-center justify-between gap-3 px-2 py-2.5 text-[0.9375rem]">
                  <span className="first-letter:uppercase">{nombreMes(c.periodo, today)}</span>
                  <span
                    className={cn(
                      "text-[0.8125rem] font-medium",
                      e === "pagado" ? "text-verde" : e === "vencido" ? "text-acento-texto" : "text-ambar",
                    )}
                  >
                    {e === "pagado" ? "Cobrado" : e === "vencido" ? "Vencido" : "Pendiente"}
                    {c.monto ? ` · $${c.monto.toLocaleString("es-AR")}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </Seccion>
      )}
      {error && <p className="-mt-4 mb-4 text-[0.8125rem] text-[var(--color-error)]">{error}</p>}
    </>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-[12px] bg-bg-hundida px-3 py-2">
      <dt className="text-[0.75rem] font-medium text-texto-secundario">{titulo}</dt>
      <dd className="numeros font-semibold">{valor}</dd>
    </div>
  );
}

// ---------- Notas ----------

/** A text field that saves on blur when it changed. */
function NotaGuardable({
  valor,
  onGuardar,
  placeholder,
  etiqueta: aria,
  filas = 4,
}: {
  valor?: string;
  onGuardar: (texto: string) => Promise<unknown>;
  placeholder: string;
  etiqueta: string;
  filas?: number;
}) {
  const [texto, setTexto] = useState(valor ?? "");
  const [estado, setEstado] = useState<"" | "guardado" | "error">("");
  return (
    <>
      <textarea
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setEstado("");
        }}
        onBlur={async () => {
          if (texto === (valor ?? "")) return;
          try {
            await onGuardar(texto);
            setEstado("guardado");
          } catch {
            setEstado("error");
          }
        }}
        rows={filas}
        placeholder={placeholder}
        aria-label={aria}
        className={`${campo} w-full`}
      />
      {estado && (
        <p className={cn("mt-1 text-[0.8125rem]", estado === "error" ? "text-[var(--color-error)]" : "text-verde")}>
          {estado === "error" ? "No se pudo guardar. Probá de nuevo." : "Guardado"}
        </p>
      )}
    </>
  );
}

export function SeccionNotas({ cliente }: { cliente: Client }) {
  return (
    <Seccion titulo="Notas" detalle="Lo que tengas que saber de este cliente.">
      <NotaGuardable
        valor={cliente.notas}
        onGuardar={(notas) => actualizarCliente(cliente.id, { notas })}
        placeholder="Particularidades, accesos, tono, lo que pidió…"
        etiqueta="Notas del cliente"
      />
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
                className="h-[16px] w-[16px] accent-[var(--color-oscuro)]"
              />
              <p className={cn("min-w-0 flex-1", i.usada && "text-texto-secundario line-through")}>{i.texto}</p>
              <BotonEliminar etiqueta="idea" onConfirmar={() => void eliminarIdea(i.id).catch(console.error)} />
            </li>
          ))}
        </ul>
      )}
    </Seccion>
  );
}

export function SeccionReunion({
  cliente,
  entregas,
  cobros,
  today,
}: {
  cliente: Client;
  entregas: Entrega[];
  cobros: Cobro[];
  today: Date;
}) {
  const proxima = entregas.find((e) => e.semaforo !== "lista");
  const periodo = toISODate(today).slice(0, 7);
  const impagos = [
    ...cobros.filter((c) => c.clienteId === cliente.id && c.periodo < periodo),
    ...cobrosDelPeriodo([cliente], cobros, periodo),
  ].filter((c) => estadoCobro(c, today) === "vencido").length;

  const temas = [
    proxima && `Próxima entrega: ${fecha(proxima.fecha)} (${proxima.hechas} de ${proxima.total} listas)`,
    proxima?.esperaGrabacion && "Hay que grabar para avanzar con la entrega",
    impagos > 0 && `${impagos} ${impagos === 1 ? "cobro vencido" : "cobros vencidos"}`,
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
      <NotaGuardable
        valor={cliente.notasReunion}
        onGuardar={(notasReunion) => actualizarCliente(cliente.id, { notasReunion })}
        placeholder="Notas para la próxima reunión"
        etiqueta="Notas para la reunión"
      />
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
    <li className="papel px-4 py-3">
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
