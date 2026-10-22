"use client";

import { useEffect, useState } from "react";
import { Download, Share, Smartphone } from "lucide-react";

/** Chrome's install prompt, kept until the user taps the button. */
interface EventoInstalar extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Estado = "cargando" | "instalada" | "instalable" | "ios" | "manual";

/** "Instalar en el celu": the app is already a PWA; this puts the install one tap
 * away (Android/desktop) or says how to do it by hand (iPhone, other browsers). */
export function InstalarApp() {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [evento, setEvento] = useState<EventoInstalar | null>(null);

  useEffect(() => {
    const instalada =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    // The browser decides later whether it offers the prompt: until then, show the manual way.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEstado(instalada ? "instalada" : ios ? "ios" : "manual");

    const alOfrecer = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoInstalar);
      setEstado("instalable");
    };
    const alInstalar = () => setEstado("instalada");
    window.addEventListener("beforeinstallprompt", alOfrecer);
    window.addEventListener("appinstalled", alInstalar);
    return () => {
      window.removeEventListener("beforeinstallprompt", alOfrecer);
      window.removeEventListener("appinstalled", alInstalar);
    };
  }, []);

  if (estado === "cargando") return null;

  return (
    <section>
      <h2 className="mb-1 text-[0.9375rem] font-semibold">Instalar en el celu</h2>
      <p className="mb-3 text-[0.8125rem] text-texto-secundario">
        Con la app instalada se abre a pantalla completa, como cualquier otra, directo en Hoy.
      </p>
      <div className="papel flex items-start gap-3 px-4 py-3.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-acento/35 text-acento-texto">
          <Smartphone size={18} />
        </span>
        <div className="min-w-0 flex-1 text-[0.9375rem]">
          {estado === "instalada" && <p className="font-medium">Ya la tenés instalada.</p>}
          {estado === "instalable" && (
            <>
              <p className="mb-2 font-medium">Instalá Paula en este dispositivo.</p>
              <button
                type="button"
                onClick={async () => {
                  await evento?.prompt();
                  setEvento(null);
                }}
                className="boton-primario tocable flex items-center gap-2 rounded-[12px] px-4 py-2 text-[0.9375rem] font-medium"
              >
                <Download size={16} /> Instalar
              </button>
            </>
          )}
          {estado === "ios" && (
            <p>
              En el iPhone: abrí esta página en <b>Safari</b>, tocá <Share size={14} className="inline -translate-y-px" />{" "}
              <b>Compartir</b> y elegí <b>Agregar a pantalla de inicio</b>.
            </p>
          )}
          {estado === "manual" && (
            <p>
              Desde el celu, abrí esta página en Chrome, tocá el menú <b>⋮</b> y elegí <b>Instalar aplicación</b> (o{" "}
              <b>Agregar a la pantalla principal</b>).
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
