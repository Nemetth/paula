import { differenceInCalendarDays } from "date-fns";
import { reportesDelMes } from "./ads";
import { cobrosVencidos } from "./cobros";
import { DIAS_APROBACION_DEMORADA } from "./mensajes";
import { Plan } from "./planner";
import { AdsReporte, Client, Cobro, Pieza } from "./types";

export type AlertaGrupo = "atraso" | "aprobacion" | "cobro" | "contenido" | "ads" | "carga";

export interface AlertaGlobal {
  id: string;
  grupo: AlertaGrupo;
  mensaje: string;
  href?: string;
}

/** Everything that deserves a look, in one list: late work, approvals taking
 * too long, overdue payments, content running out and overloaded days. */
export function alertasGlobales(input: {
  plan: Plan;
  clients: Client[];
  piezas: Pieza[];
  cobros: Cobro[];
  reportes: AdsReporte[];
  today: Date;
}): AlertaGlobal[] {
  const { plan, clients, piezas, cobros, reportes, today } = input;
  const out: AlertaGlobal[] = [];

  plan.alertas.forEach((a, i) => {
    const grupo: AlertaGrupo =
      a.tipo === "vencida" || a.tipo === "no-entra"
        ? "atraso"
        : a.tipo === "dia-sobrecargado"
          ? "carga"
          : a.tipo === "contenido-por-acabarse" || a.tipo === "calendario-nuevo"
            ? "contenido"
            : "atraso";
    out.push({
      id: `plan-${a.tipo}-${i}`,
      grupo,
      mensaje: a.mensaje,
      href: a.clienteId ? `/clientes/${a.clienteId}` : "/calendario",
    });
  });

  for (const c of clients.filter((x) => x.activo && x.estado !== "en-pausa")) {
    const demoradas = piezas.filter(
      (p) =>
        p.clienteId === c.id &&
        p.estado === "idea" &&
        differenceInCalendarDays(today, new Date(p.creadaEn)) >= DIAS_APROBACION_DEMORADA,
    ).length;
    if (demoradas > 0 || c.estado === "esperando-aprobacion") {
      out.push({
        id: `aprobacion-${c.id}`,
        grupo: "aprobacion",
        mensaje:
          demoradas > 0
            ? `${c.nombre}: ${demoradas} ${demoradas === 1 ? "idea espera" : "ideas esperan"} aprobación hace más de ${DIAS_APROBACION_DEMORADA} días`
            : `${c.nombre}: esperando aprobación`,
        href: `/clientes/${c.id}`,
      });
    }
  }

  const vencidos = cobrosVencidos(cobros, clients, today);
  for (const cobro of vencidos) {
    const nombre = clients.find((c) => c.id === cobro.clienteId)?.nombre ?? "Cliente";
    out.push({ id: `cobro-${cobro.id}`, grupo: "cobro", mensaje: `Cobro vencido: ${nombre} (${cobro.periodo})`, href: "/plata" });
  }

  const atrasados = reportesDelMes(clients, reportes, today).filter((r) => r.atrasado);
  if (atrasados.length > 0) {
    out.push({
      id: "ads-reportes",
      grupo: "ads",
      mensaje: `${atrasados.length} ${atrasados.length === 1 ? "reporte de Ads atrasado" : "reportes de Ads atrasados"}`,
      href: "/ads",
    });
  }

  return out;
}
