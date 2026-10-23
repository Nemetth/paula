// Morning notification. Vercel Cron calls GET every morning (see vercel.json)
// with `Authorization: Bearer $CRON_SECRET`; POST sends a test to one device
// that is already subscribed, from Ajustes.

import webpush, { PushSubscription, WebPushError } from "web-push";
import { avisoDelDia, supabaseServidor } from "@/lib/servidor/aviso-del-dia";

function configurarPush(): string | null {
  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  const contacto = process.env.VAPID_SUBJECT;
  if (!publica || !privada || !contacto) {
    return "Faltan NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY o VAPID_SUBJECT.";
  }
  webpush.setVapidDetails(contacto, publica, privada);
  return null;
}

async function enviar(suscripciones: { id: string; suscripcion: PushSubscription }[]) {
  const aviso = await avisoDelDia();
  const carga = JSON.stringify({ ...aviso, url: "/hoy" });
  let enviados = 0;
  const vencidas: string[] = [];
  await Promise.all(
    suscripciones.map(async (s) => {
      try {
        await webpush.sendNotification(s.suscripcion, carga, { TTL: 6 * 60 * 60 });
        enviados += 1;
      } catch (e) {
        // The browser dropped the subscription: forget it.
        if (e instanceof WebPushError && (e.statusCode === 404 || e.statusCode === 410)) vencidas.push(s.id);
        else console.error("[aviso-manana] no se pudo enviar", e);
      }
    }),
  );
  if (vencidas.length > 0) await supabaseServidor().from("push_suscripciones").delete().in("id", vencidas);
  return { aviso, enviados, borradas: vencidas.length };
}

export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  const falta = configurarPush();
  if (falta) return Response.json({ error: falta }, { status: 500 });

  const { data, error } = await supabaseServidor().from("push_suscripciones").select("id, suscripcion");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(await enviar(data ?? []));
}

export async function POST(request: Request) {
  const falta = configurarPush();
  if (falta) return Response.json({ error: falta }, { status: 500 });

  const { endpoint } = (await request.json().catch(() => ({}))) as { endpoint?: string };
  if (!endpoint) return Response.json({ error: "Falta el endpoint." }, { status: 400 });
  // Only devices that already subscribed: this can't be used to push anywhere else.
  const { data, error } = await supabaseServidor().from("push_suscripciones").select("id, suscripcion").eq("id", endpoint);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) return Response.json({ error: "Este dispositivo no está suscripto." }, { status: 404 });
  return Response.json(await enviar(data));
}
