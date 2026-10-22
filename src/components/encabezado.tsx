import { cn } from "@/lib/utils";

/** Page header with the title centered. Side slots hold a back arrow or an
 * action; both are always reserved so the title stays in the middle. */
export function Encabezado({
  titulo,
  arriba,
  izquierda,
  derecha,
  grande = false,
  className,
}: {
  titulo: string;
  /** Small line above the title (a date, a month). */
  arriba?: string;
  izquierda?: React.ReactNode;
  derecha?: React.ReactNode;
  /** The greeting on Hoy is bigger than a regular page title. */
  grande?: boolean;
  className?: string;
}) {
  return (
    <header className={cn("entra mb-6 grid grid-cols-[minmax(2.75rem,1fr)_auto_minmax(2.75rem,1fr)] items-center gap-2 lg:mb-8", className)}>
      <div className="flex justify-start">{izquierda}</div>
      <div className="min-w-0 max-w-[58vw] text-center lg:max-w-[460px]">
        {arriba && <p className="mayuscula text-[0.8125rem] font-medium text-texto-secundario">{arriba}</p>}
        <h1
          className={cn(
            "titulo truncate leading-[1.15]",
            grande ? "text-[2.125rem] lg:text-[2.5rem]" : "text-[1.75rem] lg:text-[2.125rem]",
          )}
        >
          {titulo}
        </h1>
      </div>
      <div className="flex justify-end">{derecha}</div>
    </header>
  );
}
