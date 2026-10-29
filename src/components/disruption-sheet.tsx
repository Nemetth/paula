"use client";

import { useState } from "react";
import { addDays } from "date-fns";
import { ArrowLeft, RefreshCw, Sparkles, Undo2 } from "lucide-react";
import {
  actualizarCliente,
  actualizarGrabacion,
  actualizarPieza,
  actualizarPiezas,
  bloquearDia,
  desbloquearDia,
  guardarHorasDia,
  moverEntrega,
  posponerUnidades,
  quitarPospuesta,
} from "@/lib/supabase/data";
import { fechaCorta, fromISODate, toISODate } from "@/lib/domain/dates";
import { AccionAsistente, ContextoAsistente, RespuestaAsistente, describirAccion } from "@/lib/domain/asistente";
import { Entrega } from "@/lib/domain/entregas";
import { Asignacion } from "@/lib/domain/planner";
import { completarUnidad, deshacerHecha, sePuedeTildar } from "@/lib/domain/completar";
import { Client, Grabacion, Pieza } from "@/lib/domain/types";
import { BotonPrimario, OpcionSheet, Sheet } from "@/components/sheet";

type Paso = "menu" | "contar" | "no-llegue" | "adelante" | "cliente-frenado" | "grabacion" | "no-trabajo" | "tope";

const campo = "input";
const etiquetaCampo = "text-[0.8125rem] font-medium text-texto-secundario";

/** What an action returns when it can be taken back. */
type Deshacer = () => Promise<void>;

export function DisruptionSheet({
  open,
  onClose,
  clients,
  piezas,
  today,
  tareasHoy,
  tareasProximas,
  grabacionesPendientes,
  entregas,
}: {
  open: boolean;
  onClose: () => void;
  clients: Client[];
  piezas: Pieza[];
  today: string;
  /** Today's tasks: "no llegué a X" picks from these. */
  tareasHoy: Asignacion[];
  /** Upcoming tasks: "adelanté X" picks from these. */
  tareasProximas: Asignacion[];
  grabacionesPendientes: Grabacion[];
  /** Open deliveries, so "corré la entrega de Deluxe" can name one. */
  entregas: Entrega[];
}) {
  const [paso, setPaso] = useState<Paso>("menu");
  const [seleccion, setSeleccion] = useState("");
  const [fecha, setFecha] = useState(today);
  const [cantidad, setCantidad] = useState(3);
  const [confirmado, setConfirmado] = useState<string | null>(null);
  const [deshacer, setDeshacer] = useState<Deshacer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  function cerrar() {
    onClose();
    setPaso("menu");
    setConfirmado(null);
    setDeshacer(null);
    setError(null);
    setSeleccion("");
  }

  function irA(p: Paso) {
    setError(null);
    setSeleccion("");
    setPaso(p);
  }

  async function ejecutar(accion: () => Promise<Deshacer | void>, mensaje: string) {
    setError(null);
    setTrabajando(true);
    try {
      const atras = await accion();
      setDeshacer(atras ? () => atras : null);
      setConfirmado(mensaje);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar. Probá de nuevo.");
    } finally {
      setTrabajando(false);
    }
  }

  async function volverAtras() {
    if (!deshacer) return;
    setError(null);
    setTrabajando(true);
    try {
      await deshacer();
      cerrar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo deshacer. Probá de nuevo.");
    } finally {
      setTrabajando(false);
    }
  }

  const manana = toISODate(addDays(fromISODate(today), 1));
  const nombreCliente = new Map(clients.map((c) => [c.id, c.nombre]));
  const etiqueta = (a: Asignacion) =>
    `${nombreCliente.get(a.unidad.clienteId ?? "") ?? ""} · ${a.unidad.etiqueta}`;
  const movibles = tareasHoy.filter((t) => t.unidad.piezaId);

  /** What the assistant proposed, with the same writes the options below make.
   * Returns one undo for all of it (today's cap has no previous value to restore). */
  async function aplicarAcciones(acciones: AccionAsistente[]): Promise<Deshacer> {
    const atras: Deshacer[] = [];
    const todas = [...tareasHoy, ...tareasProximas];
    const deshacerTodo = async () => {
      for (const f of atras.reverse()) await f();
    };
    try {
      for (const a of acciones) {
        if (a.tipo === "pasar_tareas") {
          await posponerUnidades(a.unidadIds, a.fecha);
          atras.push(async () => void (await Promise.all(a.unidadIds.map((id) => quitarPospuesta(id)))));
        } else if (a.tipo === "marcar_hechas") {
          for (const id of a.unidadIds) {
            const asig = todas.find((t) => t.unidad.id === id);
            if (!asig || !sePuedeTildar(asig.unidad)) continue;
            const hecha = await completarUnidad(asig.unidad, { clients });
            atras.push(() => deshacerHecha(hecha));
          }
        } else if (a.tipo === "no_trabajo") {
          const ref = clients[0];
          if (!ref) continue;
          const id = await bloquearDia({ clienteId: ref.id, fecha: a.fecha, motivo: "no-trabaje" });
          atras.push(() => desbloquearDia(id));
        } else if (a.tipo === "tope_de_hoy") {
          await guardarHorasDia(today, a.piezas);
        } else if (a.tipo === "mover_grabacion") {
          const antes = grabacionesPendientes.find((g) => g.id === a.grabacionId)?.fecha;
          await actualizarGrabacion(a.grabacionId, { fecha: a.fecha });
          if (antes) atras.push(() => actualizarGrabacion(a.grabacionId, { fecha: antes }));
        } else if (a.tipo === "mover_entrega") {
          const ids = await moverEntrega(a.clienteId, a.fechaActual, a.fechaNueva);
          atras.push(() => actualizarPiezas(ids, { fechaEntrega: a.fechaActual }));
        } else if (a.tipo === "pausar_cliente") {
          const antes = clients.find((c) => c.id === a.clienteId)?.estado;
          await actualizarCliente(a.clienteId, { estado: "en-pausa" });
          if (antes) atras.push(() => actualizarCliente(a.clienteId, { estado: antes }));
        }
      }
    } catch (e) {
      // All or nothing: what already went through is taken back before saying it failed.
      await deshacerTodo().catch(() => undefined);
      throw e;
    }
    return deshacerTodo;
  }

  return (
    <Sheet open={open} title="Algo cambió" onClose={cerrar}>
      {paso !== "menu" && !confirmado && (
        <button
          onClick={() => irA("menu")}
          className="tocable -mt-1 mb-3 flex items-center gap-1.5 rounded-full py-1 pr-3 text-[0.875rem] font-medium text-texto-secundario hover:text-texto"
        >
          <ArrowLeft size={16} /> Otras opciones
        </button>
      )}
      {confirmado ? (
        <div className="flex flex-col items-center pt-2 text-center">
          <span className="pop mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-verde/12 text-verde">
            <RefreshCw size={24} strokeWidth={2} className="reacomoda" />
          </span>
          <p className="titulo text-[1.25rem] font-medium">Plan reacomodado</p>
          <p className="entra mt-1 mb-5 max-w-[34ch] text-[0.9375rem] text-texto-secundario" style={{ "--i": 3 } as React.CSSProperties}>
            {confirmado}
          </p>
          <BotonPrimario onClick={cerrar}>Listo</BotonPrimario>
          {deshacer && (
            <button
              onClick={volverAtras}
              disabled={trabajando}
              className="tocable mt-2 flex w-full items-center justify-center gap-1.5 rounded-[12px] border border-borde px-5 py-3 font-medium hover:bg-borde/40 disabled:opacity-60"
            >
              <Undo2 size={16} /> Deshacer
            </button>
          )}
        </div>
      ) : paso === "menu" ? (
        <div className="flex flex-col gap-2">
          <OpcionSheet onClick={() => irA("contar")}>
            <span className="flex items-center gap-2">
              <Sparkles size={16} className="text-acento-texto" /> Contalo con tus palabras
            </span>
          </OpcionSheet>
          <OpcionSheet onClick={() => irA("no-llegue")}>No llegué a algo de hoy</OpcionSheet>
          <OpcionSheet onClick={() => irA("adelante")}>Adelanté algo</OpcionSheet>
          <OpcionSheet onClick={() => irA("cliente-frenado")}>Un cliente está frenado</OpcionSheet>
          <OpcionSheet onClick={() => irA("grabacion")}>Se corrió una grabación</OpcionSheet>
          <OpcionSheet onClick={() => irA("tope")}>Hoy puedo hacer menos piezas</OpcionSheet>
          <OpcionSheet onClick={() => irA("no-trabajo")}>Hoy no trabajo</OpcionSheet>
        </div>
      ) : paso === "contar" ? (
        <ContarLoQuePaso
          trabajando={trabajando}
          contexto={{
            hoy: today,
            tareas: [...tareasHoy, ...tareasProximas.slice(0, 60)].map((a) => ({
              id: a.unidad.id,
              etiqueta: a.unidad.etiqueta,
              cliente: nombreCliente.get(a.unidad.clienteId ?? ""),
              fecha: a.fecha,
            })),
            clientes: clients.map((c) => ({ id: c.id, nombre: c.nombre })),
            grabaciones: grabacionesPendientes.map((g) => ({ id: g.id, cliente: nombreCliente.get(g.clienteId) ?? "", fecha: g.fecha })),
            entregas: entregas
              .filter((e) => e.semaforo !== "lista")
              .map((e) => ({ clienteId: e.clienteId, cliente: nombreCliente.get(e.clienteId) ?? "", fecha: e.fecha })),
          }}
          onConfirmar={(acciones, descripciones) =>
            ejecutar(
              () => aplicarAcciones(acciones),
              descripciones.length === 1 ? `${descripciones[0]}.` : `${descripciones.length} cambios hechos.`,
            )
          }
        />
      ) : paso === "no-llegue" ? (
        <div className="flex flex-col gap-3">
          {movibles.length === 0 ? (
            <p className="text-[0.9375rem] text-texto-secundario">No hay tareas de hoy para mover.</p>
          ) : (
            <>
              <label className="flex flex-col gap-1">
                <span className={etiquetaCampo}>¿A cuál no llegaste?</span>
                <select value={seleccion} onChange={(e) => setSeleccion(e.target.value)} className={campo}>
                  <option value="">Elegí una tarea</option>
                  {movibles.map((t) => (
                    <option key={t.unidad.id} value={t.unidad.id}>
                      {etiqueta(t)}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-[0.8125rem] text-texto-secundario">Pasa a mañana y el resto del plan se acomoda solo.</p>
              <BotonPrimario
                disabled={!seleccion || trabajando}
                onClick={() =>
                  ejecutar(async () => {
                    const piezaId = movibles.find((t) => t.unidad.id === seleccion)?.unidad.piezaId;
                    if (!piezaId) return;
                    const antes = piezas.find((p) => p.id === piezaId)?.noAntesDe;
                    await actualizarPieza(piezaId, { noAntesDe: manana });
                    // `noAntesDe: undefined` means "leave as is" in the writer, so an empty
                    // previous value goes back as today: it blocks nothing.
                    return () => actualizarPieza(piezaId, { noAntesDe: antes ?? today });
                  }, "Movida a mañana: el plan se reacomodó.")
                }
              >
                Confirmar
              </BotonPrimario>
            </>
          )}
        </div>
      ) : paso === "adelante" ? (
        <div className="flex flex-col gap-3">
          {tareasProximas.length === 0 ? (
            <p className="text-[0.9375rem] text-texto-secundario">No hay tareas próximas para adelantar.</p>
          ) : (
            <>
              <label className="flex flex-col gap-1">
                <span className={etiquetaCampo}>¿Qué adelantaste?</span>
                <select value={seleccion} onChange={(e) => setSeleccion(e.target.value)} className={campo}>
                  <option value="">Elegí una tarea</option>
                  {tareasProximas.map((t) => (
                    <option key={t.unidad.id} value={t.unidad.id}>
                      {etiqueta(t)} · {fechaCorta(t.fecha)}
                    </option>
                  ))}
                </select>
              </label>
              <BotonPrimario
                disabled={!seleccion || trabajando}
                onClick={() =>
                  ejecutar(async () => {
                    const a = tareasProximas.find((t) => t.unidad.id === seleccion);
                    if (!a) return;
                    const hecha = await completarUnidad(a.unidad, { clients });
                    return () => deshacerHecha(hecha);
                  }, "Marcada como hecha: los próximos días quedan más livianos.")
                }
              >
                Confirmar
              </BotonPrimario>
            </>
          )}
        </div>
      ) : paso === "cliente-frenado" ? (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className={etiquetaCampo}>Cliente</span>
            <select value={seleccion} onChange={(e) => setSeleccion(e.target.value)} className={campo}>
              <option value="">Elegí un cliente</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
          <p className="text-[0.8125rem] text-texto-secundario">
            Queda en pausa: su trabajo sale del plan hasta que lo reactives desde su ficha.
          </p>
          <BotonPrimario
            disabled={!seleccion || trabajando}
            onClick={() =>
              ejecutar(async () => {
                const antes = clients.find((c) => c.id === seleccion)?.estado;
                await actualizarCliente(seleccion, { estado: "en-pausa" });
                if (antes) return () => actualizarCliente(seleccion, { estado: antes });
              }, `${nombreCliente.get(seleccion) ?? "El cliente"} quedó en pausa: su trabajo salió del plan.`)
            }
          >
            Confirmar
          </BotonPrimario>
        </div>
      ) : paso === "grabacion" ? (
        <div className="flex flex-col gap-3">
          {grabacionesPendientes.length === 0 ? (
            <p className="text-[0.9375rem] text-texto-secundario">No hay grabaciones pendientes.</p>
          ) : (
            <>
              <label className="flex flex-col gap-1">
                <span className={etiquetaCampo}>Grabación</span>
                <select value={seleccion} onChange={(e) => setSeleccion(e.target.value)} className={campo}>
                  <option value="">Elegí una grabación</option>
                  {grabacionesPendientes.map((g) => (
                    <option key={g.id} value={g.id}>
                      {nombreCliente.get(g.clienteId) ?? "Cliente"} · {fechaCorta(g.fecha)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className={etiquetaCampo}>Nueva fecha</span>
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={campo} />
              </label>
              <p className="text-[0.8125rem] text-texto-secundario">
                La entrega no se mueve. Las piezas arrancan cuando marques la grabación como hecha.
              </p>
              <BotonPrimario
                disabled={!seleccion || fecha < "2000-01-01" || trabajando}
                onClick={() =>
                  ejecutar(async () => {
                    const antes = grabacionesPendientes.find((g) => g.id === seleccion)?.fecha;
                    await actualizarGrabacion(seleccion, { fecha });
                    if (antes) return () => actualizarGrabacion(seleccion, { fecha: antes });
                  }, "Grabación movida: el plan se recalculó.")
                }
              >
                Confirmar
              </BotonPrimario>
            </>
          )}
        </div>
      ) : paso === "tope" ? (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className={etiquetaCampo}>Piezas que puedo hacer hoy</span>
            <input
              type="number"
              min={0}
              max={30}
              step={0.5}
              value={cantidad}
              onChange={(e) => setCantidad(Number(e.target.value))}
              className={campo}
            />
          </label>
          <BotonPrimario
            disabled={trabajando}
            onClick={() =>
              ejecutar(
                () => guardarHorasDia(today, Math.min(Math.max(cantidad || 0, 0), 30)),
                "Actualizado: hoy vas a ver menos piezas y el resto se reparte.",
              )
            }
          >
            Confirmar
          </BotonPrimario>
        </div>
      ) : (
        <div>
          <p className="text-[0.9375rem] text-texto-secundario">
            Hoy queda sin lugar y lo pendiente se reparte en los próximos días.
          </p>
          <BotonPrimario
            disabled={trabajando}
            onClick={() =>
              ejecutar(async () => {
                const ref = clients[0];
                if (!ref) throw new Error("Cargá un cliente primero.");
                const id = await bloquearDia({ clienteId: ref.id, fecha: today, motivo: "no-trabaje" });
                return () => desbloquearDia(id);
              }, "Marcado: el plan de los próximos días se reorganiza solo.")
            }
          >
            Confirmar
          </BotonPrimario>
        </div>
      )}
      {error && <p className="mt-3 text-[0.8125rem] text-[var(--color-error)]">{error}</p>}
    </Sheet>
  );
}

/** "Contalo con tus palabras": one sentence → the changes it means, shown
 * before anything is touched. Paula can drop any of them, then confirm. */
function ContarLoQuePaso({
  contexto,
  trabajando,
  onConfirmar,
}: {
  contexto: ContextoAsistente;
  trabajando: boolean;
  onConfirmar: (acciones: AccionAsistente[], descripciones: string[]) => void;
}) {
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const [respuesta, setRespuesta] = useState<RespuestaAsistente | null>(null);
  const [elegidas, setElegidas] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function interpretar() {
    setPensando(true);
    setError(null);
    setRespuesta(null);
    try {
      const r = await fetch("/api/asistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto, contexto }),
      });
      const cuerpo = (await r.json().catch(() => ({}))) as RespuestaAsistente & { error?: string };
      if (!r.ok) throw new Error(cuerpo.error ?? "El asistente no respondió. Probá de nuevo.");
      setRespuesta(cuerpo);
      setElegidas(new Set(cuerpo.acciones.map((_, i) => i)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "El asistente no respondió. Probá de nuevo.");
    } finally {
      setPensando(false);
    }
  }

  const acciones = respuesta?.acciones ?? [];
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className={etiquetaCampo}>¿Qué pasó?</span>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Ej.: hoy no llegué a los reels de Deluxe, pasalos al jueves. Y la grabación de Bessone se corrió al lunes."
          className={campo}
        />
      </label>
      <BotonPrimario disabled={!texto.trim() || pensando || trabajando} onClick={interpretar}>
        {pensando ? "Pensando..." : "Ver qué cambia"}
      </BotonPrimario>

      {respuesta && (
        <div className="aparece flex flex-col gap-2">
          {acciones.length > 0 && (
            <>
              <p className={etiquetaCampo}>Esto es lo que entendí. Destildá lo que no va:</p>
              <ul className="flex flex-col gap-1.5">
                {acciones.map((a, i) => (
                  <li key={i}>
                    <label className="flex cursor-pointer items-start gap-2.5 rounded-[12px] bg-bg-hundida px-3 py-2.5 text-[0.9375rem]">
                      <input
                        type="checkbox"
                        checked={elegidas.has(i)}
                        onChange={(e) =>
                          setElegidas((s) => {
                            const next = new Set(s);
                            if (e.target.checked) next.add(i);
                            else next.delete(i);
                            return next;
                          })
                        }
                        className="mt-0.5 h-[16px] w-[16px] shrink-0 accent-[var(--color-oscuro)]"
                      />
                      {describirAccion(a, contexto)}
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
          {respuesta.mensaje && <p className="text-[0.9375rem] text-texto-secundario">{respuesta.mensaje}</p>}
          {acciones.length > 0 && (
            <BotonPrimario
              disabled={elegidas.size === 0 || trabajando}
              onClick={() => {
                const elegir = acciones.filter((_, i) => elegidas.has(i));
                onConfirmar(elegir, elegir.map((a) => describirAccion(a, contexto)));
              }}
            >
              {trabajando ? "Guardando..." : `Hacer ${elegidas.size === 1 ? "este cambio" : `estos ${elegidas.size} cambios`}`}
            </BotonPrimario>
          )}
        </div>
      )}
      {error && <p className="text-[0.8125rem] text-[var(--color-error)]">{error}</p>}
    </div>
  );
}
