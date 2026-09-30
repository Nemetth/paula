"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { simularCarga } from "@/lib/domain/schedule-engine";
import { VolumenMensual } from "@/lib/domain/types";

export default function SimuladorPage() {
  const [volumenMensual, setVolumenMensual] = useState<VolumenMensual>({ historias: 0, posteos: 0, reels: 0 });
  const [diasProduccion, setDiasProduccion] = useState(8);

  const estimacion = useMemo(
    () => simularCarga({ volumenMensual, diasProduccion }),
    [volumenMensual, diasProduccion],
  );

  return (
    <div className="mx-auto max-w-[640px] px-4 pt-6 lg:max-w-[720px] lg:px-8 lg:pt-10">
      <header className="mb-5 flex items-center gap-3 lg:mb-8">
        <Link href="/clientes" aria-label="Volver" className="text-texto-secundario">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-[1.25rem] font-semibold">Simulador de prospecto</h1>
      </header>

      <div className="lg:rounded-[12px] lg:border lg:border-borde lg:bg-bg-elevada lg:p-8">
      <p className="mb-5 text-[0.9375rem] text-texto-secundario">
        Probá el volumen de un cliente potencial antes de aceptarlo. Esto no crea ningún cliente ni guarda
        nada.
      </p>

      <section className="mb-6">
        <h2 className="mb-3 text-[0.9375rem] font-semibold">Volumen mensual estimado</h2>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Historias">
            <input
              type="number"
              min={0}
              value={volumenMensual.historias}
              onChange={(e) => setVolumenMensual((v) => ({ ...v, historias: Number(e.target.value) }))}
              className="input"
            />
          </Field>
          <Field label="Posteos">
            <input
              type="number"
              min={0}
              value={volumenMensual.posteos}
              onChange={(e) => setVolumenMensual((v) => ({ ...v, posteos: Number(e.target.value) }))}
              className="input"
            />
          </Field>
          <Field label="Reels">
            <input
              type="number"
              min={0}
              value={volumenMensual.reels}
              onChange={(e) => setVolumenMensual((v) => ({ ...v, reels: Number(e.target.value) }))}
              className="input"
            />
          </Field>
        </div>
      </section>

      <section className="mb-6">
        <Field label="Días hábiles para producir las piezas">
          <input
            type="number"
            min={1}
            value={diasProduccion}
            onChange={(e) => setDiasProduccion(Number(e.target.value))}
            className="input"
          />
        </Field>
      </section>

      <div className="rounded-[12px] border border-borde bg-bg-elevada px-4 py-3">
        <p className="text-[0.8125rem] font-medium text-texto-secundario">Estimación de carga</p>
        <p className="font-semibold">
          {estimacion.horasTotales}h totales{" "}
          <span className="font-normal text-texto-secundario">· ~{estimacion.horasPorSemana}h/semana</span>
        </p>
        <p className="mt-0.5 text-[0.9375rem] text-texto-secundario">
          {estimacion.horasPorSemana > 40
            ? "Esto solo ya supera tu tope semanal de 40h — con tu cartera actual encima, probablemente no entra."
            : "Revisá si esto entra en tu semana junto con el resto de tu cartera antes de aceptar."}
        </p>
      </div>

      <Link
        href="/clientes/nuevo"
        className="mt-6 block w-full rounded-[12px] bg-terracota px-5 py-3 text-center font-medium text-bg"
      >
        Te sirve — agregar como cliente
      </Link>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[0.8125rem] font-medium text-texto-secundario">{label}</span>
      {children}
    </label>
  );
}
