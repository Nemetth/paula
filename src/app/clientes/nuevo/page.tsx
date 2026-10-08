"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ClienteForm, clienteFormValuesToInput } from "@/components/cliente-form";
import { crearCliente } from "@/lib/supabase/data";

export default function NuevoClientePage() {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-[640px] px-4 pt-2 lg:max-w-[720px] lg:px-8 lg:pt-4">
      <header className="entra mb-6 flex items-center gap-3 lg:mb-8">
        <Link href="/clientes" aria-label="Volver" className="tocable -ml-1.5 rounded-full p-1.5 text-texto-secundario hover:bg-borde/50">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="titulo-serif text-[1.875rem] font-medium leading-[1.15] lg:text-[2.25rem]">Nuevo cliente</h1>
      </header>

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
