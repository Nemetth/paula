"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { guardarEstructuraSemanal, useEstructuraSemanal } from "@/lib/supabase/data";
import { DEFAULT_ESTRUCTURA_SEMANAL, EstructuraSemanal } from "@/lib/domain/types";

const DIAS: { valor: number; label: string }[] = [
  { valor: 1, label: "Lunes" },
  { valor: 2, label: "Martes" },
  { valor: 3, label: "Miércoles" },
  { valor: 4, label: "Jueves" },
  { valor: 5, label: "Viernes" },
  { valor: 6, label: "Sábado" },
  { valor: 0, label: "Domingo" },
];

export default function AjustesPage() {
  const estructuraGuardada = useEstructuraSemanal();
  // `null` = no local edits yet, so the form mirrors whatever loads from
  // Supabase; any edit takes over as the source of truth from then on.
  const [editada, setEditada] = useState<EstructuraSemanal | null>(null);
  const [saving, setSaving] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const estructura = editada ?? estructuraGuardada ?? DEFAULT_ESTRUCTURA_SEMANAL;

  function setHoras(dia: number, horas: number) {
    setEditada({ ...estructura, horasPorDia: { ...estructura.horasPorDia, [dia]: horas } });
    setGuardado(false);
  }

  function toggleGrabacion(dia: number) {
    const tiene = estructura.diasGrabacionHabituales.includes(dia);
    setEditada({
      ...estructura,
      diasGrabacionHabituales: tiene
        ? estructura.diasGrabacionHabituales.filter((d) => d !== dia)
        : [...estructura.diasGrabacionHabituales, dia],
    });
    setGuardado(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await guardarEstructuraSemanal(estructura);
      setGuardado(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[640px] px-4 pt-6 lg:max-w-[720px] lg:px-8 lg:pt-10">
      <header className="mb-5 flex items-center gap-3 lg:mb-8">
        <Link href="/hoy" aria-label="Volver" className="text-texto-secundario lg:hidden">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-[1.25rem] font-semibold">Ajustes</h1>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6 pb-10 lg:rounded-[12px] lg:border lg:border-borde lg:bg-bg-elevada lg:p-8">
        <section>
          <h2 className="mb-1 text-[0.9375rem] font-semibold">Tu semana</h2>
          <p className="mb-3 text-[0.8125rem] text-texto-secundario">
            Cuántas horas tenés libres cada día y cuáles son tus días de grabación habituales — esto es lo
            que usa el plan de hoy para saber cuánto entra.
          </p>
          <ul className="flex flex-col divide-y divide-borde border-y border-borde">
            {DIAS.map(({ valor, label }) => (
              <li key={valor} className="flex items-center gap-3 px-2 py-3">
                <span className="w-24 shrink-0 text-[0.9375rem] font-medium">{label}</span>
                <input
                  type="number"
                  min={0}
                  max={24}
                  step={0.5}
                  value={estructura.horasPorDia[valor] ?? 0}
                  onChange={(ev) => setHoras(valor, Number(ev.target.value))}
                  className="input w-20"
                  aria-label={`Horas disponibles el ${label}`}
                />
                <span className="text-[0.8125rem] text-texto-secundario">h</span>
                <label className="ml-auto flex items-center gap-2 text-[0.8125rem] text-texto-secundario">
                  <input
                    type="checkbox"
                    checked={estructura.diasGrabacionHabituales.includes(valor)}
                    onChange={() => toggleGrabacion(valor)}
                    className="h-[16px] w-[16px] accent-[var(--color-terracota)]"
                  />
                  Grabación
                </label>
              </li>
            ))}
          </ul>
        </section>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-[12px] bg-terracota px-5 py-3 text-center font-medium text-bg disabled:opacity-60"
        >
          {saving ? "Guardando..." : guardado ? "Guardado" : "Guardar cambios"}
        </button>
      </form>
    </div>
  );
}
