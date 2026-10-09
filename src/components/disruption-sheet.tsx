"use client";

import { useState } from "react";
import { addDays } from "date-fns";
import { RefreshCw } from "lucide-react";
import {
  actualizarCliente,
  actualizarGrabacion,
  actualizarPieza,
  bloquearDia,
  guardarHorasDia,
} from "@/lib/supabase/data";
import { fromISODate, toISODate } from "@/lib/domain/dates";
import { Asignacion } from "@/lib/domain/planner";
import { completarUnidad } from "@/lib/domain/completar";
import { Client, Grabacion } from "@/lib/domain/types";
import { BotonPrimario, OpcionSheet, Sheet } from "@/components/sheet";

type Paso = "menu" | "no-llegue" | "adelante" | "cliente-frenado" | "grabacion" | "no-trabajo" | "tope";

const campo = "input";
const etiquetaCampo = "text-[0.8125rem] font-medium text-texto-secundario";

export function DisruptionSheet({
  open,
  onClose,
  clients,
  today,
  tareasHoy,
  tareasProximas,
  grabacionesPendientes,
}: {
  open: boolean;
  onClose: () => void;
  clients: Client[];
  today: string;
  /** Today's tasks: "no llegué a X" picks from these. */
  tareasHoy: Asignacion[];
  /** Upcoming tasks: "adelanté X" picks from these. */
  tareasProximas: Asignacion[];
  grabacionesPendientes: Grabacion[];
}) {
  const [paso, setPaso] = useState<Paso>("menu");
  const [seleccion, setSeleccion] = useState("");
  const [fecha, setFecha] = useState(today);
  const [piezas, setPiezas] = useState(3);
  const [confirmado, setConfirmado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function cerrar() {
    onClose();
    setPaso("menu");
    setConfirmado(null);
    setError(null);
    setSeleccion("");
  }

  async function ejecutar(accion: () => Promise<void>, mensaje: string) {
    setError(null);
    try {
      await accion();
      setConfirmado(mensaje);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar. Probá de nuevo.");
    }
  }

  const manana = toISODate(addDays(fromISODate(today), 1));
  const nombreCliente = new Map(clients.map((c) => [c.id, c.nombre]));
  const etiqueta = (a: Asignacion) =>
    `${nombreCliente.get(a.unidad.clienteId ?? "") ?? ""} · ${a.unidad.etiqueta}`;
  const movibles = tareasHoy.filter((t) => t.unidad.piezaId);

  return (
    <Sheet open={open} title="Algo cambió" onClose={cerrar}>
      {confirmado ? (
        <div className="flex flex-col items-center pt-2 text-center">
          <span className="pop mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-verde/12 text-verde">
            <RefreshCw size={24} strokeWidth={2} className="reacomoda" />
          </span>
          <p className="titulo-serif text-[1.25rem] font-medium">Plan reacomodado</p>
          <p className="entra mt-1 mb-5 max-w-[34ch] text-[0.9375rem] text-texto-secundario" style={{ "--i": 3 } as React.CSSProperties}>
            {confirmado}
          </p>
          <BotonPrimario onClick={cerrar}>Listo</BotonPrimario>
        </div>
      ) : paso === "menu" ? (
        <div className="flex flex-col gap-2">
          <OpcionSheet onClick={() => setPaso("no-llegue")}>No llegué a algo de hoy</OpcionSheet>
          <OpcionSheet onClick={() => setPaso("adelante")}>Adelanté algo</OpcionSheet>
          <OpcionSheet onClick={() => setPaso("cliente-frenado")}>Un cliente está frenado</OpcionSheet>
          <OpcionSheet onClick={() => setPaso("grabacion")}>Se corrió una grabación</OpcionSheet>
          <OpcionSheet onClick={() => setPaso("tope")}>Hoy puedo hacer menos piezas</OpcionSheet>
          <OpcionSheet onClick={() => setPaso("no-trabajo")}>Hoy no trabajo</OpcionSheet>
        </div>
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
                disabled={!seleccion}
                onClick={() =>
                  ejecutar(async () => {
                    const piezaId = movibles.find((t) => t.unidad.id === seleccion)?.unidad.piezaId;
                    if (piezaId) await actualizarPieza(piezaId, { noAntesDe: manana });
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
                      {etiqueta(t)} · {t.fecha}
                    </option>
                  ))}
                </select>
              </label>
              <BotonPrimario
                disabled={!seleccion}
                onClick={() =>
                  ejecutar(async () => {
                    const a = tareasProximas.find((t) => t.unidad.id === seleccion);
                    if (a) await completarUnidad(a.unidad);
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
            disabled={!seleccion}
            onClick={() =>
              ejecutar(
                () => actualizarCliente(seleccion, { estado: "en-pausa" }),
                `${nombreCliente.get(seleccion) ?? "El cliente"} quedó en pausa: su trabajo salió del plan.`,
              )
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
                      {nombreCliente.get(g.clienteId) ?? "Cliente"} · {g.fecha}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className={etiquetaCampo}>Nueva fecha</span>
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={campo} />
              </label>
              <p className="text-[0.8125rem] text-texto-secundario">La entrega se corre con ella (7 días después).</p>
              <BotonPrimario
                disabled={!seleccion || !fecha}
                onClick={() =>
                  ejecutar(() => actualizarGrabacion(seleccion, { fecha }), "Grabación movida: la entrega y el plan se recalcularon.")
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
              value={piezas}
              onChange={(e) => setPiezas(Number(e.target.value))}
              className={campo}
            />
          </label>
          <BotonPrimario onClick={() => ejecutar(() => guardarHorasDia(today, piezas), "Actualizado: hoy vas a ver menos piezas y el resto se reparte.")}>
            Confirmar
          </BotonPrimario>
        </div>
      ) : (
        <div>
          <p className="text-[0.9375rem] text-texto-secundario">
            Hoy queda sin lugar y lo pendiente se reparte en los próximos días.
          </p>
          <BotonPrimario
            onClick={() =>
              ejecutar(async () => {
                const ref = clients[0];
                if (!ref) throw new Error("Cargá un cliente primero.");
                await bloquearDia({ clienteId: ref.id, fecha: today, motivo: "no-trabaje" });
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
