"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Dog } from "lucide-react";
import { Sello } from "@/components/sello";

const DURACION_SALIDA = 220;

/** Floating dog above the "+": opens Inki's stamp, the site's supervisor.
 * Desktop only: on a phone it covered the rows. */
export function Inki() {
  const [abierta, setAbierta] = useState(false);

  return (
    <>
      <button
        onClick={() => setAbierta(true)}
        aria-label="Inki, supervisor del sitio"
        className="tocable group fixed bottom-[100px] right-8 z-40 hidden h-14 w-14 items-center justify-center rounded-[18px] bg-acento text-sobre-acento shadow-boton lg:flex"
      >
        <Dog
          size={26}
          strokeWidth={1.9}
          className="origin-bottom transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:-rotate-12 group-active:-rotate-12"
        />
      </button>
      <Estampilla abierta={abierta} onClose={() => setAbierta(false)} />
    </>
  );
}

function Estampilla({ abierta, onClose }: { abierta: boolean; onClose: () => void }) {
  // Stay mounted for the exit animation after `abierta` flips to false.
  const [montada, setMontada] = useState(abierta);
  if (abierta && !montada) setMontada(true);
  const cerrando = montada && !abierta;

  useEffect(() => {
    if (!cerrando) return;
    const t = setTimeout(() => setMontada(false), DURACION_SALIDA);
    return () => clearTimeout(t);
  }, [cerrando]);

  useEffect(() => {
    if (!abierta) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abierta, onClose]);

  if (!montada) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <button
        aria-label="Cerrar"
        className="velo absolute inset-0 backdrop-blur-[2px]"
        data-cerrando={cerrando || undefined}
        style={{ background: "color-mix(in oklab, #12151a 40%, transparent)" }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Este sitio está supervisado por Inki"
        data-cerrando={cerrando || undefined}
        className="estampilla-llega relative z-10 w-[min(78vw,300px)]"
        onClick={onClose}
      >
        <div className="estampilla">
          <div className="estampilla-foto">
            <Image
              src="/inki.jpg"
              alt="Inki, un perrito de pelo largo color miel y blanco, sentado y mirando a cámara"
              width={720}
              height={960}
              priority
              sizes="300px"
              className="block h-full w-full object-cover"
            />
          </div>
          <p className="estampilla-texto">
            Este sitio está
            <br />
            supervisado por <strong>Inki</strong>
          </p>
        </div>
        <Matasellos />
      </div>
    </div>
  );
}

/** Postmark that half-covers the stamp's corner, like it was just mailed. */
function Matasellos() {
  return (
    <Sello
      texto="SUPERVISOR · OFICIAL · INKI ·"
      className="matasellos pointer-events-none absolute -bottom-8 -right-9 h-[84px] w-[84px]"
    />
  );
}
