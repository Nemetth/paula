"use client";

import { useState } from "react";
import { Circle } from "lucide-react";
import { Asignacion } from "@/lib/domain/planner";
import { completarUnidad, sePuedeTildar } from "@/lib/domain/completar";
import { Sheet } from "@/components/sheet";

/** "Me sobró tiempo": suggests what to bring forward. Ticking one marks the
 * piece done, which shortens the upcoming days on the next derivation. */
export function SobroTiempoSheet({
  open,
  onClose,
  capacidadLibre,
  sugerir,
  nombreCliente,
}: {
  open: boolean;
  onClose: () => void;
  capacidadLibre: number;
  sugerir: (horas: number) => Asignacion[];
  nombreCliente: Map<string, string>;
}) {
  const [horas, setHoras] = useState<number | null>(null);
  const horasEfectivas = horas ?? Math.max(Math.round(capacidadLibre * 2) / 2, 1);
  const sugeridas = sugerir(horasEfectivas);

  return (
    <Sheet open={open} title="Me sobró tiempo" onClose={onClose}>
      <label className="mb-4 flex items-center gap-3">
        <span className="text-[0.9375rem]">Horas libres</span>
        <input
          type="number"
          min={0.5}
          max={12}
          step={0.5}
          value={horasEfectivas}
          onChange={(e) => setHoras(Number(e.target.value))}
          className="w-20 rounded-[12px] border border-borde bg-bg-elevada px-3 py-2"
        />
      </label>

      {sugeridas.length === 0 ? (
        <p className="text-[0.9375rem] text-texto-secundario">
          No hay nada para adelantar que entre en ese tiempo. Disfrutalo.
        </p>
      ) : (
        <>
          <p className="mb-2 text-[0.8125rem] text-texto-secundario">Podés adelantar:</p>
          <ul className="flex flex-col divide-y divide-borde border-y border-borde">
            {sugeridas.map((a) => (
              <li key={a.unidad.id} className="flex items-start gap-3 px-1 py-3">
                {sePuedeTildar(a.unidad) ? (
                  <button
                    onClick={() => completarUnidad(a.unidad)}
                    className="mt-0.5 shrink-0 text-texto-secundario hover:text-terracota"
                    aria-label="Marcar como hecho"
                  >
                    <Circle size={22} strokeWidth={1.75} />
                  </button>
                ) : (
                  <span className="w-[22px] shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {nombreCliente.get(a.unidad.clienteId ?? "") ?? a.unidad.etiqueta}
                  </p>
                  <p className="text-[0.9375rem] text-texto-secundario">
                    {a.unidad.etiqueta} · estaba para el {a.fecha}
                  </p>
                </div>
                <p className="shrink-0 text-[0.8125rem] font-medium text-texto-secundario">{a.unidad.horas}h</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </Sheet>
  );
}
