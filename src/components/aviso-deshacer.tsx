"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { Undo2 } from "lucide-react";

// A notice that outlives the component that raised it: moving a delivery from
// a message makes that message disappear, but the way back has to stay.
let global: AvisoDeshacer | null = null;
let siguiente = 0;
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((l) => l());

export function avisarConDeshacer(texto: string, deshacer: () => void) {
  siguiente += 1;
  global = { id: -siguiente, texto, deshacer };
  avisar();
}

/** Rendered once by the app frame. */
export function AvisoGlobal() {
  const aviso = useSyncExternalStore(
    (l) => {
      oyentes.add(l);
      return () => oyentes.delete(l);
    },
    () => global,
    () => null,
  );
  const cerrar = useCallback(() => {
    global = null;
    avisar();
  }, []);
  return <AvisoDeshacerToast aviso={aviso} onCerrar={cerrar} />;
}

const DURACION = 6000;

export interface AvisoDeshacer {
  /** Changes with every notice, so a new one restarts the timer. */
  id: number;
  texto: string;
  deshacer: () => void;
}

/** Small notice above the nav after a swipe or a tick, with the way back. */
export function AvisoDeshacerToast({ aviso, onCerrar }: { aviso: AvisoDeshacer | null; onCerrar: () => void }) {
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(onCerrar, DURACION);
    return () => clearTimeout(t);
  }, [aviso, onCerrar]);

  if (!aviso) return null;
  return (
    <div
      key={aviso.id}
      role="status"
      className="aviso-sube destacado pointer-events-auto fixed bottom-[calc(96px+env(safe-area-inset-bottom,0px))] left-1/2 z-50 flex w-[min(92vw,420px)] -translate-x-1/2 items-center gap-3 rounded-[18px] py-2.5 pl-4 pr-2.5 lg:bottom-8"
    >
      <p className="min-w-0 flex-1 truncate text-[0.9375rem]">{aviso.texto}</p>
      <button
        onClick={() => {
          aviso.deshacer();
          onCerrar();
        }}
        className="tocable flex shrink-0 items-center gap-1.5 rounded-[12px] bg-acento px-3 py-1.5 text-[0.8125rem] font-semibold text-sobre-acento"
      >
        <Undo2 size={14} strokeWidth={2.25} /> Deshacer
      </button>
    </div>
  );
}
