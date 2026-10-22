import { cn } from "@/lib/utils";

/** Page header with the title centered. Side slots hold a back arrow or an
 * action; both are always reserved so the title stays in the middle. */
export function Encabezado({
  titulo,
  nombre,
  arriba,
  bajada,
  izquierda,
  derecha,
  grande = false,
  envolver = false,
  className,
}: {
  titulo: string;
  /** Whose page it is: set after the title, in the accent ("Buen día, Paula"). */
  nombre?: string;
  /** Small line above the title (a date, a month). */
  arriba?: string;
  /** One line under the title: how this page looks right now. */
  bajada?: string;
  izquierda?: React.ReactNode;
  derecha?: React.ReactNode;
  /** The greeting on Hoy is bigger than a regular page title, and may wrap. */
  grande?: boolean;
  /** Let a long title (a client's name) wrap instead of cutting it with "…". */
  envolver?: boolean;
  className?: string;
}) {
  return (
    <header className={cn("entra mb-6 grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 lg:mb-8", className)}>
      <div className="flex justify-start">{izquierda}</div>
      <div className="min-w-0 text-center">
        {arriba && <p className="mayuscula text-[0.8125rem] font-medium text-texto-secundario">{arriba}</p>}
        <h1
          className={cn(
            "titulo leading-[1.12]",
            grande
              ? "text-balance text-[1.875rem] lg:text-[2.5rem]"
              : envolver
                ? "text-balance break-words text-[1.5rem] lg:text-[2.125rem]"
                : "truncate text-[1.75rem] lg:text-[2.125rem]",
          )}
        >
          {titulo}
          {nombre && (
            <>
              , <span className="text-acento-texto">{nombre}</span>
            </>
          )}
        </h1>
        {bajada && <p className="entra mt-1.5 text-[0.9375rem] text-texto-secundario" style={{ "--i": 2 } as React.CSSProperties}>{bajada}</p>}
      </div>
      <div className="flex justify-end">{derecha}</div>
    </header>
  );
}
