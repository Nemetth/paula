"use client";

import { useState } from "react";
import {
  Client,
  ClienteEstado,
  ClienteTipo,
  DEFAULT_MARGEN_DIAS,
  FlujoConfig,
  InicioDesde,
  Servicio,
  VolumenMensual,
  inicioPorDefecto,
} from "@/lib/domain/types";
import { ESTADO_CLIENTE_LABEL, TIPO_CLIENTE_LABEL } from "@/lib/domain/labels";
import { DEFAULT_FLUJO } from "@/lib/supabase/data";
import { EstimacionCarga } from "@/components/estimacion-carga";

export interface ClienteFormValues {
  nombre: string;
  rubro: string;
  servicio: Servicio;
  tipo: ClienteTipo;
  estado: ClienteEstado;
  intocable: boolean;
  volumenMensual: VolumenMensual;
  flujo: FlujoConfig;
  contactoWhatsapp: string;
  ventanaCobroInicio: number;
  ventanaCobroFin: number;
  montoMensual: string;
  notas: string;
}

const INICIO_LABEL: Record<InicioDesde, string> = {
  aprobacion: "Cuando aprueba el calendario",
  grabacion: "Después de la grabación",
  fecha: "Desde una fecha fija",
};

function valuesFromClient(c?: Client): ClienteFormValues {
  if (!c) {
    return {
      nombre: "",
      rubro: "",
      servicio: "contenido",
      tipo: "mensual",
      estado: "en-produccion",
      intocable: false,
      volumenMensual: { historias: 0, posteos: 0, reels: 0 },
      flujo: { ...DEFAULT_FLUJO },
      contactoWhatsapp: "",
      ventanaCobroInicio: 1,
      ventanaCobroFin: 10,
      montoMensual: "",
      notas: "",
    };
  }
  return {
    nombre: c.nombre,
    rubro: c.rubro ?? "",
    servicio: c.servicio,
    tipo: c.tipo,
    estado: c.estado,
    intocable: c.intocable,
    volumenMensual: c.volumenMensual,
    flujo: c.flujo,
    contactoWhatsapp: c.contactoWhatsapp ?? "",
    ventanaCobroInicio: c.ventanaCobro?.[0] ?? 1,
    ventanaCobroFin: c.ventanaCobro?.[1] ?? 10,
    montoMensual: c.montoMensual != null ? String(c.montoMensual) : "",
    notas: c.notas ?? "",
  };
}

export function clienteFormValuesToInput(v: ClienteFormValues) {
  const inicioDesde = inicioPorDefecto(v.flujo, v.tipo);
  return {
    nombre: v.nombre.trim(),
    rubro: v.rubro.trim() || undefined,
    servicio: v.servicio,
    tipo: v.tipo,
    estado: v.estado,
    intocable: v.intocable,
    volumenMensual: v.volumenMensual,
    flujo: {
      ...v.flujo,
      inicioDesde,
      inicioFecha: inicioDesde === "fecha" ? v.flujo.inicioFecha : undefined,
      tieneGrabacion: inicioDesde === "grabacion",
    },
    contactoWhatsapp: v.contactoWhatsapp.trim() || undefined,
    ventanaCobro: [v.ventanaCobroInicio, v.ventanaCobroFin] as [number, number],
    montoMensual: v.montoMensual ? Number(v.montoMensual) : undefined,
    notas: v.notas.trim() || undefined,
  };
}

type FormErrors = Partial<Record<"nombre" | "contactoWhatsapp" | "ventanaCobroFin" | "inicioFecha", string>>;

function validate(v: ClienteFormValues): FormErrors {
  const errors: FormErrors = {};
  if (!v.nombre.trim()) errors.nombre = "Ingresá el nombre del cliente.";
  const wa = v.contactoWhatsapp.trim();
  const esLink = /^https?:\/\//i.test(wa);
  if (wa && !esLink && wa.replace(/\D/g, "").length < 8) {
    errors.contactoWhatsapp = "Ingresá un número con código de área o un link de grupo.";
  }
  if (inicioPorDefecto(v.flujo, v.tipo) === "fecha" && !v.flujo.inicioFecha) {
    errors.inicioFecha = "Elegí desde qué fecha se puede empezar.";
  }
  if (v.ventanaCobroInicio > v.ventanaCobroFin) {
    errors.ventanaCobroFin = "Tiene que ser igual o posterior al día de inicio.";
  }
  return errors;
}

export function errorMessage(err: unknown): string {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return "No hay conexión. Revisá tu internet y volvé a intentar.";
  }
  const msg = (err as { message?: string } | null)?.message;
  return msg ? `No se pudo guardar: ${msg}` : "No se pudo guardar. Volvé a intentar.";
}

export function ClienteForm({
  initial,
  onSubmit,
  submitLabel = "Guardar cliente",
}: {
  initial?: Client;
  onSubmit: (values: ClienteFormValues) => Promise<void>;
  submitLabel?: string;
}) {
  const [values, setValues] = useState<ClienteFormValues>(() => valuesFromClient(initial));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  function set<K extends keyof ClienteFormValues>(key: K, value: ClienteFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function setFlujo<K extends keyof FlujoConfig>(key: K, value: FlujoConfig[K]) {
    setValues((v) => ({ ...v, flujo: { ...v.flujo, [key]: value } }));
    if (key === "inicioFecha") setErrors((e) => ({ ...e, inicioFecha: undefined }));
  }

  const inicio = inicioPorDefecto(values.flujo, values.tipo);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const found = validate(values);
    setErrors(found);
    setSubmitError(null);
    if (Object.keys(found).length > 0) {
      document.getElementById(`field-${Object.keys(found)[0]}`)?.focus();
      return;
    }
    setSaving(true);
    try {
      await onSubmit(values);
    } catch (err) {
      console.error(err);
      setSubmitError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 pb-10">
      {values.servicio !== "ads" && <EstimacionCarga volumen={values.volumenMensual} excluirId={initial?.id} />}

      <Section title="Datos básicos">
        <Field label="Nombre" error={errors.nombre}>
          <input
            id="field-nombre"
            value={values.nombre}
            maxLength={80}
            onChange={(e) => set("nombre", e.target.value)}
            className="input"
            aria-invalid={!!errors.nombre}
            autoComplete="off"
          />
        </Field>
        <Field label="Rubro">
          <input maxLength={80} value={values.rubro} onChange={(e) => set("rubro", e.target.value)} className="input" />
        </Field>
        <Field label="Servicio">
          <select
            value={values.servicio}
            onChange={(e) => set("servicio", e.target.value as Servicio)}
            className="input"
          >
            <option value="contenido">Contenido</option>
            <option value="ads">Solo Ads</option>
            <option value="ambos">Contenido + Ads</option>
          </select>
        </Field>
        <Field label="Tipo de cliente">
          <select value={values.tipo} onChange={(e) => set("tipo", e.target.value as ClienteTipo)} className="input">
            {(Object.keys(TIPO_CLIENTE_LABEL) as ClienteTipo[]).map((t) => (
              <option key={t} value={t}>
                {TIPO_CLIENTE_LABEL[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Estado">
          <select value={values.estado} onChange={(e) => set("estado", e.target.value as ClienteEstado)} className="input">
            {(Object.keys(ESTADO_CLIENTE_LABEL) as ClienteEstado[]).map((t) => (
              <option key={t} value={t}>
                {ESTADO_CLIENTE_LABEL[t]}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-[0.9375rem]">
          <input
            type="checkbox"
            checked={values.intocable}
            onChange={(e) => set("intocable", e.target.checked)}
            className="h-[16px] w-[16px] accent-[var(--color-terracota)]"
          />
          Intocable: su trabajo nunca se posterga
        </label>
        <Field label="WhatsApp (número o link de grupo)" error={errors.contactoWhatsapp}>
          <input
            id="field-contactoWhatsapp"
            aria-invalid={!!errors.contactoWhatsapp}
            inputMode="tel"
            value={values.contactoWhatsapp}
            onChange={(e) => set("contactoWhatsapp", e.target.value)}
            className="input"
            placeholder="+54 9 ..."
          />
        </Field>
      </Section>

      {values.servicio !== "ads" && (
        <Section title="Volumen mensual">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Historias">
              <input
                type="number"
                min={0}
                value={values.volumenMensual.historias}
                onChange={(e) => set("volumenMensual", { ...values.volumenMensual, historias: Number(e.target.value) })}
                className="input"
              />
            </Field>
            <Field label="Posteos">
              <input
                type="number"
                min={0}
                value={values.volumenMensual.posteos}
                onChange={(e) => set("volumenMensual", { ...values.volumenMensual, posteos: Number(e.target.value) })}
                className="input"
              />
            </Field>
            <Field label="Reels">
              <input
                type="number"
                min={0}
                value={values.volumenMensual.reels}
                onChange={(e) => set("volumenMensual", { ...values.volumenMensual, reels: Number(e.target.value) })}
                className="input"
              />
            </Field>
          </div>
        </Section>
      )}

      {values.servicio !== "ads" && (
        <Section title="Inicio y margen">
          <Field label="Desde cuándo se pueden empezar las piezas">
            <select
              value={inicio}
              onChange={(e) => setFlujo("inicioDesde", e.target.value as InicioDesde)}
              className="input"
            >
              {(Object.keys(INICIO_LABEL) as InicioDesde[]).map((k) => (
                <option key={k} value={k}>
                  {INICIO_LABEL[k]}
                </option>
              ))}
            </select>
          </Field>
          {inicio === "fecha" && (
            <Field label="Fecha de inicio" error={errors.inicioFecha}>
              <input
                id="field-inicioFecha"
                type="date"
                aria-invalid={!!errors.inicioFecha}
                value={values.flujo.inicioFecha ?? ""}
                onChange={(e) => setFlujo("inicioFecha", e.target.value || undefined)}
                className="input"
              />
            </Field>
          )}
          <Field label="Días de margen: terminar antes de la entrega">
            <input
              type="number"
              min={0}
              max={30}
              value={values.flujo.margenDias ?? DEFAULT_MARGEN_DIAS}
              onChange={(e) => setFlujo("margenDias", Math.max(Number(e.target.value), 0))}
              className="input"
            />
          </Field>
          <p className="text-[0.8125rem] text-texto-secundario">
            {inicio === "grabacion"
              ? "Las piezas se reparten en los días después de cada grabación, aunque todavía no esté hecha, "
              : "Las piezas se reparten desde que se pueden empezar "}
            hasta la entrega menos el margen.
          </p>
        </Section>
      )}

      <Section title="Plata">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cobro desde el día">
            <input
              id="field-ventanaCobroInicio"
              type="number"
              min={1}
              max={31}
              value={values.ventanaCobroInicio}
              onChange={(e) => set("ventanaCobroInicio", Number(e.target.value))}
              className="input"
            />
          </Field>
          <Field label="hasta el día" error={errors.ventanaCobroFin}>
            <input
              id="field-ventanaCobroFin"
              aria-invalid={!!errors.ventanaCobroFin}
              type="number"
              min={1}
              max={31}
              value={values.ventanaCobroFin}
              onChange={(e) => set("ventanaCobroFin", Number(e.target.value))}
              className="input"
            />
          </Field>
        </div>
        <Field label="Monto mensual (opcional)">
          <input
            type="number"
            min={0}
            value={values.montoMensual}
            onChange={(e) => set("montoMensual", e.target.value)}
            className="input"
          />
        </Field>
      </Section>

      <Section title="Notas">
        <textarea
          value={values.notas}
          onChange={(e) => set("notas", e.target.value)}
          rows={3}
          className="input resize-none"
        />
      </Section>

      {(Object.keys(errors).length > 0 || submitError) && (
        <div
          role="alert"
          className="rounded-[12px] border border-[var(--color-error)] px-4 py-3 text-[0.875rem] text-[var(--color-error)]"
        >
          {submitError ?? "Revisá los campos marcados antes de guardar."}
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="boton-primario tocable w-full rounded-[14px] px-5 py-3.5 text-center font-medium disabled:opacity-60"
      >
        {saving ? "Guardando..." : submitLabel}
      </button>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-[0.9375rem] font-semibold">{title}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[0.8125rem] font-medium text-texto-secundario">{label}</span>
      {children}
      {error && <span className="text-[0.8125rem] text-[var(--color-error)]">{error}</span>}
    </label>
  );
}
