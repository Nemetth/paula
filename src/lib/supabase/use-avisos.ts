"use client";

// Everything that wants Paula's attention, in one place: the alerts (what is
// late, what is stuck, what is running out) and the WhatsApp messages due. Hoy
// shows the alerts on one folded line; the bell shows both.

import { useMemo } from "react";
import { AlertaGlobal, alertasGlobales } from "@/lib/domain/alertas";
import { MensajePendiente, mensajesPendientes } from "@/lib/domain/mensajes";
import { useMensajesHechos } from "./data";
import { PlanContext } from "./use-plan";

export interface Avisos {
  alertas: AlertaGlobal[];
  mensajes: MensajePendiente[];
}

const VACIO: Avisos = { alertas: [], mensajes: [] };

export function useAvisos(ctx: PlanContext | null): Avisos {
  const hechos = useMensajesHechos();
  return useMemo(() => {
    if (!ctx || !hechos) return VACIO;
    return {
      alertas: alertasGlobales({
        plan: ctx.plan,
        clients: ctx.clients,
        piezas: ctx.piezas,
        cobros: ctx.cobros,
        reportes: ctx.reportes,
        today: ctx.today,
      }),
      mensajes: mensajesPendientes({
        today: ctx.today,
        clients: ctx.clients,
        piezas: ctx.piezas,
        grabaciones: ctx.grabaciones,
        cobros: ctx.cobros,
        hechos,
        plan: ctx.plan,
      }),
    };
  }, [ctx, hechos]);
}
