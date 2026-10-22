"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, Trash2, MessageCircle } from "lucide-react";
import { useMemo, useState } from "react";
import {
  actualizarCliente,
  eliminarCliente,
  useAdsChequeos,
  useClients,
  useCobros,
  useGrabaciones,
  useIdeas,
  usePiezas,
} from "@/lib/supabase/data";
import { ClienteForm, clienteFormValuesToInput, errorMessage } from "@/components/cliente-form";
import { SeccionCiclo, SeccionGrabaciones, SeccionPiezas } from "@/components/ficha/piezas-grabaciones";
import {
  SeccionAds,
  SeccionHistorial,
  SeccionIdeas,
  SeccionMensajes,
  SeccionReunion,
} from "@/components/ficha/otras";
import { toISODate } from "@/lib/domain/dates";
import { usePlan } from "@/lib/supabase/use-plan";
import { EntregaActual } from "@/components/ficha/entrega-actual";
import { ESTADO_CLIENTE_LABEL, TIPO_CLIENTE_LABEL } from "@/lib/domain/labels";
import { ClienteEstado } from "@/lib/domain/types";
import { Cargando, EmptyState } from "@/components/empty-state";
import { Encabezado } from "@/components/encabezado";
import { BotonPrimario, Sheet } from "@/components/sheet";

export default function ClienteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [borrando, setBorrando] = useState(false);
  const hoyISO = useMemo(() => toISODate(new Date()), []);

  const clients = useClients();
  const todasLasPiezas = usePiezas();
  const todasLasGrabaciones = useGrabaciones();
  const ideas = useIdeas();
  const chequeos = useAdsChequeos();
  const cobros = useCobros();
  const ctx = usePlan();
  const cliente = clients?.find((c) => c.id === id);

  if (clients === undefined) return <Cargando />;
  if (!cliente) {
    return (
      <div className="mx-auto max-w-[640px] px-4 pt-2 lg:max-w-[720px] lg:px-8 lg:pt-4">
        <Encabezado
          titulo="Cliente"
          izquierda={
            <Link href="/clientes" aria-label="Volver" className="tocable rounded-full p-1.5 text-texto-secundario hover:bg-borde/50">
              <ArrowLeft size={20} />
            </Link>
          }
        />
        <EmptyState
          title="No encontramos a este cliente"
          detail="Puede que se haya eliminado o que el link esté mal. Elegí uno de tu lista."
        />
        <div className="mt-4 flex justify-center">
          <Link href="/clientes" className="boton-primario tocable rounded-[14px] px-5 py-3 font-medium">
            Ver clientes
          </Link>
        </div>
      </div>
    );
  }

  const piezas = (todasLasPiezas ?? []).filter((p) => p.clienteId === id);
  const grabaciones = (todasLasGrabaciones ?? []).filter((g) => g.clienteId === id);

  if (editando) {
    return (
      <div className="mx-auto max-w-[640px] px-4 pt-2 lg:max-w-[720px] lg:px-8 lg:pt-4">
        <Encabezado
          titulo={`Editar ${cliente.nombre}`}
          izquierda={
            <button onClick={() => setEditando(false)} aria-label="Volver" className="tocable rounded-full p-1.5 text-texto-secundario hover:bg-borde/50">
              <ArrowLeft size={20} />
            </button>
          }
        />
        <div className="lg:rounded-[20px] lg:border lg:border-borde lg:bg-bg-elevada lg:p-8 lg:shadow-papel">
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
    <div className="mx-auto max-w-[640px] px-4 pt-2 lg:max-w-[720px] lg:px-8 lg:pt-4">
      <Encabezado
        titulo={cliente.nombre}
        envolver
        izquierda={
          <Link href="/clientes" aria-label="Volver" className="tocable rounded-full p-1.5 text-texto-secundario hover:bg-borde/50">
            <ArrowLeft size={20} />
          </Link>
        }
        derecha={
          <div className="flex items-center">
        <button onClick={() => setEditando(true)} aria-label="Editar" className="tocable rounded-full p-2 text-texto-secundario hover:bg-borde/50">
          <Pencil size={19} />
        </button>
        <button
          onClick={() => {
            setErrorAccion(null);
            setEliminando(true);
          }}
          aria-label="Eliminar"
          className="tocable rounded-full p-2 text-texto-secundario hover:bg-acento/10 hover:text-acento-texto"
        >
          <Trash2 size={19} />
        </button>
          </div>
        }
      />

      <div className="entra" style={{ "--i": 1 } as React.CSSProperties}>
        {errorAccion && !eliminando && (
          <p role="alert" className="mb-4 text-center text-[0.8125rem] text-[var(--color-error)]">
            {errorAccion}
          </p>
        )}
        <div className="mb-8 flex flex-wrap items-center justify-center gap-2">
          <select
            value={cliente.estado}
            onChange={(e) => {
              setErrorAccion(null);
              actualizarCliente(cliente.id, { estado: e.target.value as ClienteEstado }).catch((err) =>
                setErrorAccion(errorMessage(err)),
              );
            }}
            aria-label="Estado del cliente"
            className="rounded-[8px] border border-borde bg-bg-elevada px-2 py-1 text-[0.8125rem] font-medium"
          >
            {(Object.keys(ESTADO_CLIENTE_LABEL) as ClienteEstado[]).map((e) => (
              <option key={e} value={e}>
                {ESTADO_CLIENTE_LABEL[e]}
              </option>
            ))}
          </select>
          <span className="rounded-[8px] bg-borde/60 px-2 py-1 text-[0.8125rem] font-medium text-texto-secundario">
            {TIPO_CLIENTE_LABEL[cliente.tipo]}
          </span>
          {cliente.intocable && (
            <span className="rounded-[8px] bg-ambar/15 px-2 py-1 text-[0.8125rem] font-medium text-ambar">Intocable</span>
          )}
          {!cliente.activo && (
            <span className="rounded-[8px] bg-ambar/15 px-2 py-1 text-[0.8125rem] font-medium text-ambar">Pausado</span>
          )}
          {cliente.contactoWhatsapp && (
            <a
              href={
                /^https?:\/\//i.test(cliente.contactoWhatsapp)
                  ? cliente.contactoWhatsapp
                  : `https://wa.me/${cliente.contactoWhatsapp.replace(/[^\d]/g, "")}`
              }
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-[0.8125rem] font-medium text-verde"
            >
              <MessageCircle size={14} /> WhatsApp
            </a>
          )}
        </div>

        {cliente.servicio !== "ads" && (
          <>
            {ctx && <EntregaActual cliente={cliente} entregas={ctx.entregas.filter((e) => e.clienteId === cliente.id)} />}
            <SeccionCiclo
              piezas={piezas}
              grabaciones={grabaciones}
              cliente={cliente}
              todasLasPiezas={todasLasPiezas ?? []}
            />
            <SeccionPiezas cliente={cliente} piezas={piezas} grabaciones={grabaciones} />
            <SeccionGrabaciones cliente={cliente} grabaciones={grabaciones} piezas={piezas} />
          </>
        )}
        <SeccionAds cliente={cliente} chequeos={chequeos ?? []} hoyISO={hoyISO} />
        {cliente.servicio !== "ads" && <SeccionIdeas cliente={cliente} ideas={ideas ?? []} />}
        <SeccionReunion cliente={cliente} piezas={piezas} grabaciones={grabaciones} cobros={cobros ?? []} />
        {cliente.servicio !== "ads" && <SeccionHistorial piezas={piezas} grabaciones={grabaciones} />}
        <SeccionMensajes cliente={cliente} grabaciones={grabaciones} hoyISO={hoyISO} />

        {cliente.notas && (
          <section className="mb-6">
            <h2 className="mb-2 text-[0.9375rem] font-semibold">Notas</h2>
            <p className="text-[0.9375rem] text-texto-secundario">{cliente.notas}</p>
          </section>
        )}
      </div>

      <Sheet open={eliminando} title={`¿Eliminar a ${cliente.nombre}?`} onClose={() => !borrando && setEliminando(false)}>
        <div className="flex flex-col gap-3">
          <p className="text-[0.9375rem] text-texto-secundario">
            Se borran también sus piezas, grabaciones, ideas y cobros. No se puede deshacer. Si solo querés frenarlo por
            un tiempo, ponelo en pausa.
          </p>
          {errorAccion && <p className="text-[0.8125rem] text-[var(--color-error)]">{errorAccion}</p>}
          <BotonPrimario
            disabled={borrando}
            onClick={async () => {
              setBorrando(true);
              setErrorAccion(null);
              try {
                await eliminarCliente(cliente.id);
                router.push("/clientes");
              } catch (err) {
                console.error(err);
                setErrorAccion(errorMessage(err).replace("guardar", "eliminar"));
                setBorrando(false);
              }
            }}
          >
            {borrando ? "Eliminando..." : "Sí, eliminar"}
          </BotonPrimario>
          <button
            onClick={() => setEliminando(false)}
            disabled={borrando}
            className="tocable w-full rounded-[12px] border border-borde px-5 py-3 text-center font-medium hover:bg-borde/40 disabled:opacity-60"
          >
            Cancelar
          </button>
        </div>
      </Sheet>
    </div>
  );
}
