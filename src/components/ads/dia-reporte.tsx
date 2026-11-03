"use client";

import { ULTIMO_DIA_REPORTE } from "@/lib/domain/ads";
import { Client } from "@/lib/domain/types";

/** The day of the month an account's report is due. Saves on blur; left empty, the
 * account goes back to days 1 to 5. */
export function CampoDiaReporte({ cliente, onGuardar, autoFocus }: { cliente: Client; onGuardar: (dia: number | null) => void; autoFocus?: boolean }) {
  const actual = cliente.adsDiaReporte ?? null;
  return (
    <div>
      <label className="flex items-center gap-2 text-[0.8125rem]">
        Se entrega el día
        <input
          key={actual ?? ""}
          type="number"
          inputMode="numeric"
          min={1}
          max={31}
          autoFocus={autoFocus}
          defaultValue={actual ?? ""}
          placeholder={String(ULTIMO_DIA_REPORTE)}
          onBlur={(e) => {
            const dia = e.target.value === "" ? null : Number(e.target.value);
            if (dia !== null && (!Number.isInteger(dia) || dia < 1 || dia > 31)) e.target.value = actual === null ? "" : String(actual);
            else if (dia !== actual) onGuardar(dia);
          }}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className="input w-16 px-2 py-1 text-center text-[0.875rem]"
        />
        de cada mes
      </label>
      <p className="mt-1 text-[0.75rem] text-texto-secundario">Vacío: va con los demás, del 1 al {ULTIMO_DIA_REPORTE}.</p>
    </div>
  );
}
