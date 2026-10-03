"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, Trash2, Video, MessageCircle } from "lucide-react";
import { useState } from "react";
import { actualizarCliente, eliminarCliente, useBlockedDates, useClients } from "@/lib/supabase/data";
import { ClienteForm, clienteFormValuesToInput, errorMessage } from "@/components/cliente-form";
import { activeCicloInstancia } from "@/lib/domain/schedule-engine";
import { FlowStage } from "@/lib/domain/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const STAGE_LABEL: Record<FlowStage, string> = {
  calendario: "Calendario",
  aprobacion: "Aprobación",
  grabacion: "Grabación",
  produccion: "Producción",
  presentacion: "Presentación",
  correccion: "Corrección",
  ajustes: "Ajustes",
  programacion: "Programación",
};

export default function ClienteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const clients = useClients();
  const blockedDates = useBlockedDates();
  const cliente = clients?.find((c) => c.id === id);

  if (clients === undefined) return <div className="px-4 py-8 text-texto-secundario">Cargando...</div>;
  if (!cliente) {
    return <div className="px-4 py-8 text-texto-secundario">No se encontró el cliente.</div>;
  }

  const blockedSet = new Set((blockedDates ?? []).filter((b) => b.clienteId === id).map((b) => b.fecha));
  const ciclo = activeCicloInstancia(cliente, new Date(), blockedSet);

  if (editando) {
    return (
      <div className="mx-auto max-w-[640px] px-4 pt-6 lg:max-w-[720px] lg:px-8 lg:pt-10">
        <header className="mb-5 flex items-center gap-3 lg:mb-8">
          <button onClick={() => setEditando(false)} aria-label="Volver" className="text-texto-secundario">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-[1.25rem] font-semibold">Editar {cliente.nombre}</h1>
        </header>
        <div className="lg:rounded-[12px] lg:border lg:border-borde lg:bg-bg-elevada lg:p-8">
          <ClienteForm
            initial={cliente}
            submitLabel="Guardar cambios"
            onSubmit={async (values) => {
              await actualizarCliente(cliente.id, clienteFormValuesToInput(values));
              setEditando(false);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[640px] px-4 pt-6 lg:max-w-[720px] lg:px-8 lg:pt-10">
      <header className="mb-5 flex items-center gap-3 lg:mb-8">
        <Link href="/clientes" aria-label="Volver" className="text-texto-secundario">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="flex-1 text-[1.25rem] font-semibold truncate">{cliente.nombre}</h1>
        <button onClick={() => setEditando(true)} aria-label="Editar" className="text-texto-secundario">
          <Pencil size={19} />
        </button>
        <button
          onClick={async () => {
            if (confirm(`¿Eliminar a ${cliente.nombre}? Esto borra su historial.`)) {
              try {
                await eliminarCliente(cliente.id);
                router.push("/clientes");
              } catch (err) {
                console.error(err);
                alert(errorMessage(err).replace("guardar", "eliminar"));
              }
            }
          }}
          aria-label="Eliminar"
          className="text-texto-secundario"
        >
          <Trash2 size={19} />
        </button>
      </header>

      <div className="lg:rounded-[12px] lg:border lg:border-borde lg:bg-bg-elevada lg:p-8">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Pill>{cliente.servicio === "ambos" ? "Contenido + Ads" : cliente.servicio === "ads" ? "Solo Ads" : "Contenido"}</Pill>
        {!cliente.activo && <Pill tone="ambar">Pausado</Pill>}
        {cliente.contactoWhatsapp && (
          <a
            href={`https://wa.me/${cliente.contactoWhatsapp.replace(/[^\d]/g, "")}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-[0.8125rem] font-medium text-verde"
          >
            <MessageCircle size={14} /> WhatsApp
          </a>
        )}
      </div>

      {cliente.servicio !== "ads" && (
        <section className="mb-6">
          <h2 className="mb-2 text-[0.9375rem] font-semibold">Volumen mensual</h2>
          <div className="flex gap-4 text-[0.9375rem] text-texto-secundario">
            <span>{cliente.volumenMensual.historias} historias</span>
            <span>{cliente.volumenMensual.posteos} posteos</span>
            <span>{cliente.volumenMensual.reels} reels</span>
          </div>
        </section>
      )}

      {ciclo && (
        <section className="mb-6">
          <h2 className="mb-2 text-[0.9375rem] font-semibold">Ciclo actual ({ciclo.periodo})</h2>
          <ul className="flex flex-col divide-y divide-borde border-y border-borde">
            {ciclo.ventanas.map((v) => (
              <li key={v.etapa} className="flex items-center justify-between px-2 py-2.5">
                <span className="flex items-center gap-1.5 text-[0.9375rem]">
                  {v.etapa === "grabacion" && <Video size={14} className="text-texto-secundario" />}
                  {STAGE_LABEL[v.etapa]}
                </span>
                <span className="text-[0.8125rem] text-texto-secundario">
                  {format(v.inicio, "d MMM", { locale: es })} – {format(v.fin, "d MMM", { locale: es })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {cliente.notas && (
        <section className="mb-6">
          <h2 className="mb-2 text-[0.9375rem] font-semibold">Notas</h2>
          <p className="text-[0.9375rem] text-texto-secundario">{cliente.notas}</p>
        </section>
      )}
      </div>
    </div>
  );
}

function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "ambar" }) {
  return (
    <span
      className={
        tone === "ambar"
          ? "rounded-[8px] bg-ambar/15 px-2 py-1 text-[0.8125rem] font-medium text-ambar"
          : "rounded-[8px] bg-borde/60 px-2 py-1 text-[0.8125rem] font-medium text-texto-secundario"
      }
    >
      {children}
    </span>
  );
}
