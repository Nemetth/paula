import { format } from "date-fns";
import { Check, PackageCheck, Presentation, Video } from "lucide-react";
import { fromISODate } from "@/lib/domain/dates";
import { AvanceTipo, Entrega, ORDEN_TIPOS, SemaforoEntrega } from "@/lib/domain/entregas";
import { TIPO_PIEZA_LABEL } from "@/lib/domain/labels";
import { Hito } from "@/lib/domain/planner";
import { cn } from "@/lib/utils";

export const SEMAFORO_ENTREGA: Record<SemaforoEntrega, { label: string; punto: string; texto: string }> = {
  verde: { label: "En camino", punto: "bg-verde", texto: "text-verde" },
  ambar: { label: "Justa", punto: "bg-ambar", texto: "text-ambar" },
  rojo: { label: "En riesgo", punto: "bg-terracota", texto: "text-terracota" },
  lista: { label: "Lista", punto: "bg-verde", texto: "text-verde" },
};

export const fechaDM = (iso: string) => format(fromISODate(iso), "d/M");

export function SemaforoPunto({ semaforo, className }: { semaforo: SemaforoEntrega; className?: string }) {
  const s = SEMAFORO_ENTREGA[semaforo];
  return (
    <span
      role="img"
      aria-label={s.label}
      title={s.label}
      className={cn("flex h-3 w-3 shrink-0 items-center justify-center rounded-full", s.punto, className)}
    >
      {semaforo === "lista" && <Check size={9} strokeWidth={3.5} className="text-bg" />}
    </span>
  );
}

/** "historias 10/16 · posteos 2/4 · reels 0/4". */
export function avanceTexto(porTipo: Entrega["porTipo"]): string {
  return ORDEN_TIPOS.filter((t) => porTipo[t])
    .map((t) => {
      const a = porTipo[t] as AvanceTipo;
      return `${TIPO_PIEZA_LABEL[t].varios} ${a.hechas}/${a.total}`;
    })
    .join(" · ");
}

/** One bar per piece type, for the client's file. */
export function AvancePorTipo({ porTipo }: { porTipo: Entrega["porTipo"] }) {
  return (
    <ul className="flex flex-col gap-2">
      {ORDEN_TIPOS.filter((t) => porTipo[t]).map((t) => {
        const a = porTipo[t] as AvanceTipo;
        return (
          <li key={t} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3 text-[0.9375rem]">
            <span className="capitalize text-texto-secundario">{TIPO_PIEZA_LABEL[t].varios}</span>
            <span className="h-2 overflow-hidden rounded-full bg-bg-hundida">
              <span
                className="block h-full rounded-full bg-verde transition-[width] duration-500"
                style={{ width: `${a.total ? (a.hechas / a.total) * 100 : 0}%` }}
              />
            </span>
            <span className="numeros font-medium">
              {a.hechas}/{a.total}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function IconoHito({ tipo, size = 12 }: { tipo: Hito["tipo"]; size?: number }) {
  if (tipo === "grabacion") return <Video size={size} aria-label="Grabación" />;
  if (tipo === "presentacion") return <Presentation size={size} aria-label="Presentación" />;
  return <PackageCheck size={size} aria-label="Entrega" />;
}

/** Client name without the "[Demo]"-style prefix, for tight spaces. */
export const nombreCorto = (nombre: string) => nombre.replace(/^\s*\[[^\]]*\]\s*/, "");
