"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, X } from "lucide-react";
import { guardarEstructuraSemanal, useEstructuraSemanal } from "@/lib/supabase/data";
import {
  DEFAULT_ESTRUCTURA_SEMANAL,
  EstructuraSemanal,
  FijoDiario,
  PieceType,
  diasDeTrabajo,
  pesosPieza,
  topePiezas,
} from "@/lib/domain/types";
import { TIPO_PIEZA_LABEL } from "@/lib/domain/labels";

const DIAS: { valor: number; label: string }[] = [
  { valor: 1, label: "Lunes" },
  { valor: 2, label: "Martes" },
  { valor: 3, label: "Miércoles" },
  { valor: 4, label: "Jueves" },
  { valor: 5, label: "Viernes" },
  { valor: 6, label: "Sábado" },
  { valor: 0, label: "Domingo" },
];

const casilla = "h-[16px] w-[16px] accent-[var(--color-terracota)]";

export default function AjustesPage() {
  const estructuraGuardada = useEstructuraSemanal();
  // `null` = no local edits yet, so the form mirrors whatever loads from
  // Supabase; any edit takes over as the source of truth from then on.
  const [editada, setEditada] = useState<EstructuraSemanal | null>(null);
  const [saving, setSaving] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const estructura = editada ?? estructuraGuardada ?? DEFAULT_ESTRUCTURA_SEMANAL;
  const trabajo = diasDeTrabajo(estructura);
  const pesos = pesosPieza(estructura);

  function editar(next: EstructuraSemanal) {
    setEditada(next);
    setGuardado(false);
  }

  function toggleTrabajo(dia: number) {
    editar({
      ...estructura,
      diasTrabajo: trabajo.includes(dia) ? trabajo.filter((d) => d !== dia) : [...trabajo, dia],
    });
  }

  function toggleGrabacion(dia: number) {
    const tiene = estructura.diasGrabacionHabituales.includes(dia);
    editar({
      ...estructura,
      diasGrabacionHabituales: tiene
        ? estructura.diasGrabacionHabituales.filter((d) => d !== dia)
        : [...estructura.diasGrabacionHabituales, dia],
    });
  }

  const fijos = estructura.fijosDiarios ?? [];

  function setPeso(tipo: PieceType, valor: number) {
    editar({ ...estructura, pesoPieza: { ...pesos, [tipo]: valor } });
  }

  function setFijos(next: FijoDiario[]) {
    editar({ ...estructura, fijosDiarios: next });
  }

  function agregarFijo() {
    setFijos([...fijos, { id: crypto.randomUUID(), nombre: "", horas: 0 }]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await guardarEstructuraSemanal({
        ...estructura,
        diasTrabajo: trabajo,
        topePiezasDia: topePiezas(estructura),
        pesoPieza: pesos,
        fijosDiarios: (estructura.fijosDiarios ?? []).filter((f) => f.nombre.trim()),
      });
      setGuardado(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[640px] px-4 pt-2 lg:max-w-[720px] lg:px-8 lg:pt-4">
      <header className="entra mb-6 flex items-center gap-3 lg:mb-8">
        <Link href="/hoy" aria-label="Volver" className="tocable -ml-1.5 rounded-full p-1.5 text-texto-secundario hover:bg-borde/50 lg:hidden">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="titulo-serif text-[1.875rem] font-medium leading-[1.15] lg:text-[2.25rem]">Ajustes</h1>
      </header>

      <form onSubmit={handleSubmit} className="entra flex flex-col gap-8 pb-10">
        <section>
          <h2 className="mb-1 text-[0.9375rem] font-semibold">Cuánto hacés por día</h2>
          <p className="mb-3 text-[0.8125rem] text-texto-secundario">
            El plan cuenta piezas, no horas. Cada día de trabajo entra hasta este tope, y cada entrega se reparte
            parejo entre los días que tiene antes de su fecha.
          </p>
          <label className="papel flex items-center gap-3 px-3.5 py-3">
            <span className="flex-1 text-[0.9375rem] font-medium">Tope de piezas por día</span>
            <input
              type="number"
              min={1}
              max={50}
              step={0.5}
              value={topePiezas(estructura)}
              onChange={(ev) => editar({ ...estructura, topePiezasDia: Math.max(Number(ev.target.value), 0.5) })}
              className="input w-20"
            />
          </label>
        </section>

        <section>
          <h2 className="mb-1 text-[0.9375rem] font-semibold">Cuánto pesa cada pieza</h2>
          <p className="mb-3 text-[0.8125rem] text-texto-secundario">
            En historias: si un reel te lleva lo mismo que 2 historias, poné 2 en reel y 1 en historia.
          </p>
          <ul className="papel flex flex-col divide-y divide-borde/80 px-1.5">
            {(["historia", "posteo", "reel"] as PieceType[]).map((tipo) => (
              <li key={tipo} className="flex items-center gap-3 px-2 py-3">
                <span className="flex-1 text-[0.9375rem] font-medium capitalize">{TIPO_PIEZA_LABEL[tipo].uno}</span>
                <input
                  type="number"
                  min={0.5}
                  max={10}
                  step={0.5}
                  value={pesos[tipo]}
                  onChange={(ev) => setPeso(tipo, Math.max(Number(ev.target.value), 0.5))}
                  className="input w-20"
                  aria-label={`Peso de ${TIPO_PIEZA_LABEL[tipo].uno}`}
                />
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-1 text-[0.9375rem] font-semibold">Tu semana</h2>
          <p className="mb-3 text-[0.8125rem] text-texto-secundario">
            Qué días trabajás y cuáles son tus días de grabación habituales. Los días que no trabajás no reciben piezas.
          </p>
          <ul className="papel flex flex-col divide-y divide-borde/80 px-1.5">
            {DIAS.map(({ valor, label }) => (
              <li key={valor} className="flex items-center gap-3 px-2 py-3">
                <span className="w-24 shrink-0 text-[0.9375rem] font-medium">{label}</span>
                <label className="flex items-center gap-2 text-[0.8125rem] text-texto-secundario">
                  <input type="checkbox" checked={trabajo.includes(valor)} onChange={() => toggleTrabajo(valor)} className={casilla} />
                  Trabajo
                </label>
                <label className="ml-auto flex items-center gap-2 text-[0.8125rem] text-texto-secundario">
                  <input
                    type="checkbox"
                    checked={estructura.diasGrabacionHabituales.includes(valor)}
                    onChange={() => toggleGrabacion(valor)}
                    className={casilla}
                  />
                  Grabación
                </label>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-1 text-[0.9375rem] font-semibold">Fijos de todos los días</h2>
          <p className="mb-3 text-[0.8125rem] text-texto-secundario">
            Lo que hacés cada día sin falta (revisar cuentas, responder mensajes). Se tildan en Hoy y nunca se mueven.
          </p>
          {fijos.length > 0 && (
            <ul className="mb-3 papel flex flex-col divide-y divide-borde/80 px-1.5">
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
            className="tocable rounded-[12px] border border-dashed border-borde px-4 py-2.5 text-[0.9375rem] font-medium hover:border-terracota/50 hover:text-terracota"
          >
            Agregar fijo
          </button>
        </section>

        <button
          type="submit"
          disabled={saving}
          className="boton-primario tocable sticky bottom-[calc(96px+env(safe-area-inset-bottom,0px))] z-20 w-full rounded-[14px] px-5 py-3.5 text-center font-medium disabled:opacity-60 lg:bottom-6"
        >
          {saving ? "Guardando..." : guardado ? "Guardado" : "Guardar cambios"}
        </button>
      </form>
    </div>
  );
}
