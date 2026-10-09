import { format } from "date-fns";
import { es } from "date-fns/locale";
import { fromISODate } from "@/lib/domain/dates";
import { Entrega } from "@/lib/domain/entregas";
import { Client, margenDe } from "@/lib/domain/types";
import { AvancePorTipo, SEMAFORO_ENTREGA, SemaforoPunto, fechaDM } from "@/components/entrega";
import { cn } from "@/lib/utils";

function cuando(dias: number): string {
  if (dias === 0) return "hoy";
  if (dias === 1) return "mañana";
  if (dias > 1) return `en ${dias} días`;
  return dias === -1 ? "venció ayer" : `venció hace ${-dias} días`;
}

/** The client's next delivery, front and centre: date, traffic light and how
 * far along each piece type is. */
export function EntregaActual({ cliente, entregas }: { cliente: Client; entregas: Entrega[] }) {
  const pendientes = entregas.filter((e) => e.semaforo !== "lista");
  const actual = pendientes[0];
  const siguientes = pendientes.slice(1, 3);

  if (!actual) {
    return (
      <section className="papel mb-8 px-4 py-4">
        <p className="text-[0.8125rem] font-medium text-texto-secundario">Próxima entrega</p>
        <p className="titulo-serif mt-0.5 text-[1.375rem] font-medium">Sin entregas pendientes</p>
        <p className="mt-1 text-[0.8125rem] text-texto-secundario">
          Las piezas aprobadas con fecha de entrega (o con grabación) aparecen acá.
        </p>
      </section>
    );
  }

  const semaforo = SEMAFORO_ENTREGA[actual.semaforo];
  const margen = margenDe(cliente);

  return (
    <section className="papel mb-8 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.8125rem] font-medium text-texto-secundario">Próxima entrega</p>
          <p className="titulo-serif mt-0.5 text-[1.75rem] font-medium leading-tight first-letter:uppercase">
            {format(fromISODate(actual.fecha), "EEEE d 'de' MMMM", { locale: es })}
          </p>
          <p className="mt-0.5 text-[0.9375rem] text-texto-secundario">
            {cuando(actual.dias)}
            {margen > 0 && <> · terminar el {fechaDM(actual.objetivo)}</>}
          </p>
        </div>
        <span
          className={cn(
            "mt-1 flex shrink-0 items-center gap-1.5 rounded-[8px] bg-bg-hundida px-2 py-1 text-[0.8125rem] font-medium",
            semaforo.texto,
          )}
        >
          <SemaforoPunto semaforo={actual.semaforo} />
          {semaforo.label}
        </span>
      </div>

      <p className="numeros mb-2.5 mt-3 text-[0.9375rem]">
        <span className="font-semibold">
          {actual.hechas} de {actual.total}
        </span>{" "}
        <span className="text-texto-secundario">
          listas · faltan {actual.faltan}
          {actual.provisoria && " · parte depende de una grabación"}
        </span>
      </p>
      <AvancePorTipo porTipo={actual.porTipo} />

      {siguientes.length > 0 && (
        <p className="mt-3 border-t border-borde/80 pt-2.5 text-[0.8125rem] text-texto-secundario">
          Después:{" "}
          {siguientes.map((e, i) => (
            <span key={e.fecha}>
              {i > 0 && " · "}
              {fechaDM(e.fecha)} ({e.total} {e.total === 1 ? "pieza" : "piezas"})
            </span>
          ))}
        </p>
      )}
    </section>
  );
}
