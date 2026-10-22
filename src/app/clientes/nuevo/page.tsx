"use client";

import { Encabezado } from "@/components/encabezado";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ClienteForm, clienteFormValuesToInput } from "@/components/cliente-form";
import { crearCliente } from "@/lib/supabase/data";

export default function NuevoClientePage() {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-[640px] px-4 pt-2 lg:max-w-[720px] lg:px-8 lg:pt-4">
      <Encabezado
        titulo="Nuevo cliente"
        izquierda={
          <Link href="/clientes" aria-label="Volver" className="tocable rounded-full p-1.5 text-texto-secundario hover:bg-borde/50">
            <ArrowLeft size={20} />
          </Link>
        }
      />

      <div className="lg:rounded-[20px] lg:border lg:border-borde lg:bg-bg-elevada lg:p-8 lg:shadow-papel">
        <ClienteForm
          submitLabel="Guardar y generar ciclo"
          onSubmit={async (values) => {
            const cliente = await crearCliente(clienteFormValuesToInput(values));
            router.push(`/clientes/${cliente.id}`);
          }}
        />
      </div>
    </div>
  );
}
