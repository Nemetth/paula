"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { borrarSuscripcionPush, guardarSuscripcionPush } from "@/lib/supabase/data";

type Estado = "cargando" | "no-soportado" | "sin-clave" | "bloqueado" | "apagado" | "prendido";

/** "Base64url" VAPID key → the bytes pushManager.subscribe wants. */
function claveABytes(base64: string): Uint8Array<ArrayBuffer> {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const crudo = atob((base64 + relleno).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(crudo.length));
  for (let i = 0; i < crudo.length; i++) bytes[i] = crudo.charCodeAt(i);
  return bytes;
}

/** Ajustes: turn the morning notification on or off on this device, and send a test. */
export function AvisoManana() {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const clave = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    let vivo = true;
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        if (vivo) setEstado("no-soportado");
        return;
      }
      if (!clave) {
        if (vivo) setEstado("sin-clave");
        return;
      }
      if (Notification.permission === "denied") {
        if (vivo) setEstado("bloqueado");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!vivo) return;
      setEndpoint(sub?.endpoint ?? null);
      setEstado(sub ? "prendido" : "apagado");
    })().catch(() => vivo && setEstado("no-soportado"));
    return () => {
      vivo = false;
    };
  }, [clave]);

  async function hacer(accion: () => Promise<void>) {
    setTrabajando(true);
    setMensaje(null);
    try {
      await accion();
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : "No se pudo. Probá de nuevo.");
    } finally {
      setTrabajando(false);
    }
  }

  const prender = () =>
    hacer(async () => {
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setEstado(permiso === "denied" ? "bloqueado" : "apagado");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveABytes(clave as string) });
      await guardarSuscripcionPush(sub.toJSON());
      setEndpoint(sub.endpoint);
      setEstado("prendido");
      setMensaje("Listo: mañana a las 8 te llega lo del día.");
    });

  const apagar = () =>
    hacer(async () => {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await borrarSuscripcionPush(sub.endpoint);
        await sub.unsubscribe();
      }
      setEndpoint(null);
      setEstado("apagado");
    });

  const probar = () =>
    hacer(async () => {
      const r = await fetch("/api/aviso-manana", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
      const cuerpo = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(cuerpo.error ?? "No se pudo mandar la prueba.");
      setMensaje("Prueba enviada: tendría que llegarte en unos segundos.");
    });

  const boton = "tocable rounded-[12px] px-4 py-2.5 text-[0.9375rem] font-medium disabled:opacity-60";

  return (
    <section>
      <h2 className="mb-1 flex items-center gap-2 text-[0.9375rem] font-semibold">
        <BellRing size={16} /> Aviso de la mañana
      </h2>
      <p className="mb-3 text-[0.8125rem] text-texto-secundario">
        Todos los días a las 8 te llega una notificación con lo del día en una línea. Se activa en cada dispositivo.
      </p>
      {estado === "cargando" ? null : estado === "no-soportado" ? (
        <p className="text-[0.9375rem] text-texto-secundario">
          Este navegador no recibe notificaciones. En el celular, instalá la app primero (abajo te explica cómo).
        </p>
      ) : estado === "sin-clave" ? (
        <p className="text-[0.9375rem] text-texto-secundario">
          El aviso todavía no está habilitado en la app. Cuando lo esté, acá aparece el botón para activarlo.
        </p>
      ) : estado === "bloqueado" ? (
        <p className="text-[0.9375rem] text-texto-secundario">
          Las notificaciones están bloqueadas para esta app. Habilitalas en los ajustes del navegador y volvé.
        </p>
      ) : estado === "apagado" ? (
        <button type="button" disabled={trabajando} onClick={prender} className={`boton-primario ${boton}`}>
          Activar en este dispositivo
        </button>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={trabajando} onClick={probar} className={`border border-borde hover:bg-borde/40 ${boton}`}>
            Mandarme una prueba
          </button>
          <button type="button" disabled={trabajando} onClick={apagar} className={`text-texto-secundario hover:bg-borde/40 ${boton}`}>
            Desactivar
          </button>
        </div>
      )}
      {mensaje && <p className="mt-2 text-[0.8125rem] text-texto-secundario">{mensaje}</p>}
    </section>
  );
}
