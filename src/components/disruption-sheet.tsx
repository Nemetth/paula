"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { bloquearDia, guardarHorasDia } from "@/lib/supabase/data";
import { Client } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

type Paso = "menu" | "no-trabaje" | "grabacion" | "horas";

export function DisruptionSheet({
  open,
  onClose,
  clients,
  today,
}: {
  open: boolean;
  onClose: () => void;
  clients: Client[];
  today: string;
}) {
  const [paso, setPaso] = useState<Paso>("menu");
  const [clienteId, setClienteId] = useState<string>(clients[0]?.id ?? "");
  const [fecha, setFecha] = useState(today);
  const [horas, setHoras] = useState(4);
  const [confirmado, setConfirmado] = useState<string | null>(null);

  function reset() {
    setPaso("menu");
    setConfirmado(null);
  }

  async function noTrabajeHoy() {
    await Promise.all(
      clients.map((c) => bloquearDia({ clienteId: c.id, fecha: today, motivo: "no-trabaje" })),
    );
    setConfirmado("Marcado — el plan de los próximos días se reorganiza solo.");
  }

  async function grabacionMovida() {
    if (!clienteId) return;
    await bloquearDia({ clienteId, fecha, motivo: "grabacion" });
    setConfirmado("Listo — el resto del ciclo de ese cliente se recalcula.");
  }

  async function guardarHoras() {
    await guardarHorasDia(today, horas);
    setConfirmado("Actualizado — hoy vas a ver menos tareas.");
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        aria-label="Cerrar"
        className="absolute inset-0"
        style={{ background: "color-mix(in oklab, var(--color-texto) 35%, transparent)" }}
        onClick={() => {
          onClose();
          reset();
        }}
      />
      <div className="relative z-10 w-full max-w-[640px] rounded-t-[20px] bg-bg-elevada px-5 pb-8 pt-4 shadow-[var(--shadow-sheet)]"
        style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="font-semibold">Algo cambió</p>
          <button
            onClick={() => {
              onClose();
              reset();
            }}
            aria-label="Cerrar"
            className="text-texto-secundario"
          >
            <X size={20} />
          </button>
        </div>

        {confirmado ? (
          <div>
            <p className="text-[0.9375rem]">{confirmado}</p>
            <button
              onClick={() => {
                onClose();
                reset();
              }}
              className="mt-4 w-full rounded-[12px] bg-terracota px-5 py-3 text-center font-medium text-bg"
            >
              Listo
            </button>
          </div>
        ) : paso === "menu" ? (
          <div className="flex flex-col gap-2">
            <OpcionSheet onClick={() => setPaso("no-trabaje")}>No trabajé hoy</OpcionSheet>
            <OpcionSheet onClick={() => setPaso("grabacion")}>Se corrió una grabación</OpcionSheet>
            <OpcionSheet onClick={() => setPaso("horas")}>Empecé más tarde / menos horas hoy</OpcionSheet>
          </div>
        ) : paso === "no-trabaje" ? (
          <div>
            <p className="text-[0.9375rem] text-texto-secundario">
              Vamos a marcar hoy como no trabajado para todos tus clientes activos. Lo pendiente se reparte
              solo en los próximos días hábiles.
            </p>
            <button
              onClick={noTrabajeHoy}
              className="mt-4 w-full rounded-[12px] bg-terracota px-5 py-3 text-center font-medium text-bg"
            >
              Confirmar
            </button>
          </div>
        ) : paso === "grabacion" ? (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[0.8125rem] font-medium text-texto-secundario">Cliente</span>
              <select
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                className="rounded-[12px] border border-borde bg-bg-elevada px-3 py-2.5"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[0.8125rem] font-medium text-texto-secundario">Nueva fecha de grabación</span>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="rounded-[12px] border border-borde bg-bg-elevada px-3 py-2.5"
              />
            </label>
            <button
              onClick={grabacionMovida}
              className="mt-1 w-full rounded-[12px] bg-terracota px-5 py-3 text-center font-medium text-bg"
            >
              Confirmar
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[0.8125rem] font-medium text-texto-secundario">Horas disponibles hoy</span>
              <input
                type="number"
                min={0}
                max={12}
                step={0.5}
                value={horas}
                onChange={(e) => setHoras(Number(e.target.value))}
                className="rounded-[12px] border border-borde bg-bg-elevada px-3 py-2.5"
              />
            </label>
            <button
              onClick={guardarHoras}
              className="mt-1 w-full rounded-[12px] bg-terracota px-5 py-3 text-center font-medium text-bg"
            >
              Confirmar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function OpcionSheet({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-[12px] border border-borde px-4 py-3.5 text-left text-[0.9375rem] font-medium",
      )}
    >
      {children}
    </button>
  );
}
