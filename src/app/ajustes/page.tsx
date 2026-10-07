"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, X } from "lucide-react";
import { guardarEstructuraSemanal, useEstructuraSemanal } from "@/lib/supabase/data";
import { DEFAULT_ESTRUCTURA_SEMANAL, DEFAULT_TIEMPOS_PIEZA, EstructuraSemanal, FijoDiario, PieceType, TiemposPieza } from "@/lib/domain/types";

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

  const fijos = estructura.fijosDiarios ?? [];
  const tiempos: TiemposPieza = estructura.tiemposPieza ?? DEFAULT_TIEMPOS_PIEZA;

  function setTiempo(tipo: PieceType, campo: "edicion" | "guion", horas: number) {
    setEditada({ ...estructura, tiemposPieza: { ...tiempos, [tipo]: { ...tiempos[tipo], [campo]: horas } } });
    setGuardado(false);
  }

  function setFijos(next: FijoDiario[]) {
    setEditada({ ...estructura, fijosDiarios: next });
    setGuardado(false);
  }

  function agregarFijo() {
    setFijos([...fijos, { id: crypto.randomUUID(), nombre: "", horas: 0.5 }]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await guardarEstructuraSemanal({
        ...estructura,
        fijosDiarios: (estructura.fijosDiarios ?? []).filter((f) => f.nombre.trim()),
      });
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
            Cuántas horas trabajás cada día y cuáles son tus días de grabación habituales. A esto se le
            restan los fijos de todos los días para saber cuántas horas libres quedan para producir.
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

        <section>
          <h2 className="mb-1 text-[0.9375rem] font-semibold">Tiempos por tipo de pieza</h2>
          <p className="mb-3 text-[0.8125rem] text-texto-secundario">
            Cuánto tardás en cada una. Son el punto de partida: a medida que cargás horas reales en las piezas, la
            app ajusta sola el tiempo de edición.
          </p>
          <ul className="flex flex-col divide-y divide-borde border-y border-borde">
            {(["historia", "posteo", "reel"] as PieceType[]).map((tipo) => (
              <li key={tipo} className="flex flex-wrap items-center gap-3 px-2 py-3">
                <span className="w-20 shrink-0 text-[0.9375rem] font-medium capitalize">{tipo}</span>
                <label className="flex items-center gap-2 text-[0.8125rem] text-texto-secundario">
                  Edición
                  <input
                    type="number"
                    min={0.05}
                    step={0.05}
                    value={tiempos[tipo].edicion}
                    onChange={(ev) => setTiempo(tipo, "edicion", Number(ev.target.value))}
                    className="input w-20"
                  />
                  h
                </label>
                <label className="flex items-center gap-2 text-[0.8125rem] text-texto-secundario">
                  Guion
                  <input
                    type="number"
                    min={0.05}
                    step={0.05}
                    value={tiempos[tipo].guion}
                    onChange={(ev) => setTiempo(tipo, "guion", Number(ev.target.value))}
                    className="input w-20"
                  />
                  h
                </label>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-1 text-[0.9375rem] font-semibold">Fijos de todos los días</h2>
          <p className="mb-3 text-[0.8125rem] text-texto-secundario">
            Lo que hacés cada día sin falta (revisar cuentas, responder mensajes). Se tildan en Hoy, descuentan
            horas de cada día laboral y nunca se mueven.
          </p>
          {fijos.length > 0 && (
            <ul className="mb-3 flex flex-col divide-y divide-borde border-y border-borde">
              {fijos.map((f) => (
                <li key={f.id} className="flex items-center gap-3 px-2 py-3">
                  <input
                    type="text"
                    value={f.nombre}
                    placeholder="Nombre"
                    onChange={(ev) => setFijos(fijos.map((x) => (x.id === f.id ? { ...x, nombre: ev.target.value } : x)))}
                    className="input min-w-0 flex-1"
                    aria-label="Nombre del fijo"
                  />
                  <input
                    type="number"
                    min={0}
                    max={8}
                    step={0.25}
                    value={f.horas}
                    onChange={(ev) => setFijos(fijos.map((x) => (x.id === f.id ? { ...x, horas: Number(ev.target.value) } : x)))}
                    className="input w-20"
                    aria-label={`Horas de ${f.nombre || "fijo"}`}
                  />
                  <span className="text-[0.8125rem] text-texto-secundario">h</span>
                  <button
                    type="button"
                    onClick={() => setFijos(fijos.filter((x) => x.id !== f.id))}
                    aria-label="Quitar fijo"
                    className="text-texto-secundario"
                  >
                    <X size={18} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={agregarFijo}
            className="rounded-[12px] border border-borde px-4 py-2.5 text-[0.9375rem] font-medium"
          >
            Agregar fijo
          </button>
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
