"use client";

import { useClients, useEstructuraSemanal } from "@/lib/supabase/data";
import { fmtPiezas, simularCargaPiezas } from "@/lib/domain/planner";
import { DEFAULT_ESTRUCTURA_SEMANAL, VolumenMensual } from "@/lib/domain/types";

/** Monthly load of a (new or prospective) client in pieces, on top of the rest
 * of the active portfolio, against Paula's daily cap × working days. */
export function EstimacionCarga({ volumen, excluirId }: { volumen: VolumenMensual; excluirId?: string }) {
  const clients = useClients();
  const estructura = useEstructuraSemanal() ?? DEFAULT_ESTRUCTURA_SEMANAL;

  const propia = simularCargaPiezas(volumen, estructura);
  const cartera = (clients ?? [])
    .filter((c) => c.id !== excluirId && c.activo && c.estado !== "en-pausa" && c.servicio !== "ads")
    .reduce((s, c) => s + simularCargaPiezas(c.volumenMensual, estructura).piezasMes, 0);
  const total = cartera + propia.piezasMes;
  const libre = propia.capacidadMes - total;

  return (
    <div className="rounded-[16px] bg-bg-hundida px-4 py-3.5">
      <p className="text-[0.8125rem] font-medium text-texto-secundario">Estimación de carga</p>
      <p className="numeros">
        <span className="titulo-serif text-[1.75rem] font-medium">{fmtPiezas(propia.piezasMes)}</span> piezas por mes{" "}
        <span className="font-normal text-texto-secundario">
          · con tu cartera, {fmtPiezas(total)} de ~{propia.capacidadMes}
        </span>
      </p>
      <p className="mt-0.5 text-[0.9375rem] text-texto-secundario">
        {libre < 0
          ? `No entra: te pasás ~${fmtPiezas(-libre)} piezas de tu tope del mes.`
          : `Entra: te quedan ~${fmtPiezas(libre)} piezas libres en el mes.`}
      </p>
      <p className="mt-1 text-[0.75rem] text-texto-secundario">
        Cuenta con el peso de cada tipo y tu tope de piezas por día (se cambian en Ajustes).
      </p>
    </div>
  );
}
