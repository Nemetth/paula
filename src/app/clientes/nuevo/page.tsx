"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ClienteForm, clienteFormValuesToInput } from "@/components/cliente-form";
import { crearCliente } from "@/lib/supabase/data";

export default function NuevoClientePage() {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-[640px] px-4 pt-6 lg:max-w-[720px] lg:px-8 lg:pt-10">
      <header className="mb-5 flex items-center gap-3 lg:mb-8">
        <Link href="/clientes" aria-label="Volver" className="text-texto-secundario">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-[1.25rem] font-semibold">Nuevo cliente</h1>
      </header>

      <div className="lg:rounded-[12px] lg:border lg:border-borde lg:bg-bg-elevada lg:p-8">
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
