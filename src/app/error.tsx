"use client";

import { useEffect } from "react";
import Link from "next/link";
import { InkiAviso } from "@/components/inki-aviso";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <InkiAviso
      etiqueta="Inki encontró"
      destacado="un problema"
      sello="ALGO · SALIÓ · MAL ·"
      marca="cruz"
      titulo="Algo salió mal"
      detalle="Esta pantalla no pudo cargar. Probá de nuevo; si sigue igual, volvé a Hoy."
    >
      <button onClick={() => retry()} className="boton-primario tocable rounded-[14px] px-5 py-3 font-medium">
        Probar de nuevo
      </button>
      <Link
        href="/hoy"
        className="tocable rounded-[14px] border border-borde bg-bg-elevada/60 px-5 py-3 font-medium hover:bg-bg-elevada"
      >
        Volver a Hoy
      </Link>
    </InkiAviso>
  );
}
