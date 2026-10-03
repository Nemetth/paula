"use client";

import { useMemo, useState } from "react";
import { Client, CicloTipo, FlujoConfig, Servicio, VolumenMensual } from "@/lib/domain/types";
import { DEFAULT_FLUJO } from "@/lib/supabase/data";
import { simularCarga } from "@/lib/domain/schedule-engine";

export interface ClienteFormValues {
  nombre: string;
  rubro: string;
  servicio: Servicio;
  volumenMensual: VolumenMensual;
  flujo: FlujoConfig;
  contactoWhatsapp: string;
  ventanaCobroInicio: number;
  ventanaCobroFin: number;
  montoMensual: string;
  notas: string;
}

const CICLO_LABEL: Record<CicloTipo, string> = {
  mensual: "Mensual",
  semanal: "Semanal",
  diario: "Diario",
  "solo-ads": "Solo Ads (sin contenido)",
  personalizado: "Personalizado",
};

function valuesFromClient(c?: Client): ClienteFormValues {
  if (!c) {
    return {
      nombre: "",
      rubro: "",
      servicio: "contenido",
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
  return {
    nombre: v.nombre.trim(),
    rubro: v.rubro.trim() || undefined,
    servicio: v.servicio,
    volumenMensual: v.volumenMensual,
    flujo: v.flujo,
    contactoWhatsapp: v.contactoWhatsapp.trim() || undefined,
    ventanaCobro: [v.ventanaCobroInicio, v.ventanaCobroFin] as [number, number],
    montoMensual: v.montoMensual ? Number(v.montoMensual) : undefined,
    notas: v.notas.trim() || undefined,
  };
}

type FormErrors = Partial<Record<"nombre" | "contactoWhatsapp" | "ventanaCobroFin", string>>;

function validate(v: ClienteFormValues): FormErrors {
  const errors: FormErrors = {};
  if (!v.nombre.trim()) errors.nombre = "Ingresá el nombre del cliente.";
  const wa = v.contactoWhatsapp.trim();
  const esLink = /^https?:\/\//i.test(wa);
  if (wa && !esLink && wa.replace(/\D/g, "").length < 8) {
    errors.contactoWhatsapp = "Ingresá un número con código de área o un link de grupo.";
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

  const estimacion = useMemo(
    () => simularCarga({ volumenMensual: values.volumenMensual, diasProduccion: values.flujo.diasProduccion }),
    [values.volumenMensual, values.flujo.diasProduccion],
  );

  function set<K extends keyof ClienteFormValues>(key: K, value: ClienteFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function setFlujo<K extends keyof FlujoConfig>(key: K, value: FlujoConfig[K]) {
    setValues((v) => ({ ...v, flujo: { ...v.flujo, [key]: value } }));
  }

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
      <div className="rounded-[12px] border border-borde bg-bg-elevada px-4 py-3">
        <p className="text-[0.8125rem] font-medium text-texto-secundario">Estimación de carga</p>
        <p className="font-semibold">
          {estimacion.horasTotales}h totales <span className="font-normal text-texto-secundario">· ~{estimacion.horasPorSemana}h/semana</span>
        </p>
        <p className="mt-0.5 text-[0.8125rem] text-texto-secundario">
          {estimacion.horasPorSemana > 40
            ? "Esto solo, ya supera tu tope semanal de 40h."
            : "Con tu cartera actual, revisá si entra en la semana antes de aceptar."}
        </p>
      </div>

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

      <Section title="Flujo de trabajo">
        <Field label="Tipo de ciclo">
          <select
            value={values.flujo.cicloTipo}
            onChange={(e) => setFlujo("cicloTipo", e.target.value as CicloTipo)}
            className="input"
          >
            {Object.entries(CICLO_LABEL).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        {values.flujo.cicloTipo === "personalizado" && (
          <Field label="Duración de cada período (días)">
            <input
              type="number"
              min={1}
              value={values.flujo.duracionPeriodoDias ?? 30}
              onChange={(e) => setFlujo("duracionPeriodoDias", Number(e.target.value))}
              className="input"
            />
          </Field>
        )}

        {values.flujo.cicloTipo !== "solo-ads" && (
          <>
            <Checkbox
              label="Manda calendario de ideas para aprobar"
              checked={values.flujo.mandaCalendario}
              onChange={(v) => setFlujo("mandaCalendario", v)}
            />
            {values.flujo.mandaCalendario && (
              <Field label="Días que tarda en aprobar el calendario">
                <input
                  type="number"
                  min={0}
                  value={values.flujo.diasAprobacion}
                  onChange={(e) => setFlujo("diasAprobacion", Number(e.target.value))}
                  className="input"
                />
              </Field>
            )}

            <Checkbox
              label="Hay grabación"
              checked={values.flujo.tieneGrabacion}
              onChange={(v) => setFlujo("tieneGrabacion", v)}
            />
            {values.flujo.tieneGrabacion && (
              <>
                <Field label="Días de viaje extra para grabar (si es fuera de la ciudad)">
                  <input
                    type="number"
                    min={0}
                    value={values.flujo.diasViajeGrabacion}
                    onChange={(e) => setFlujo("diasViajeGrabacion", Number(e.target.value))}
                    className="input"
                  />
                </Field>
                <Field label="Reels entregados X días después de grabar (dejar vacío si no aplica)">
                  <input
                    type="number"
                    min={0}
                    value={values.flujo.diasEntregaPostGrabacion ?? ""}
                    onChange={(e) =>
                      setFlujo(
                        "diasEntregaPostGrabacion",
                        e.target.value === "" ? undefined : Number(e.target.value),
                      )
                    }
                    className="input"
                  />
                </Field>
              </>
            )}

            <Field label="Días hábiles para producir las piezas">
              <input
                type="number"
                min={1}
                value={values.flujo.diasProduccion}
                onChange={(e) => setFlujo("diasProduccion", Number(e.target.value))}
                className="input"
              />
            </Field>
            <Field label="Días que tarda en corregir">
              <input
                type="number"
                min={0}
                value={values.flujo.diasCorreccion}
                onChange={(e) => setFlujo("diasCorreccion", Number(e.target.value))}
                className="input"
              />
            </Field>
            <Field label="Días para hacer ajustes después de la corrección">
              <input
                type="number"
                min={0}
                value={values.flujo.diasAjustes}
                onChange={(e) => setFlujo("diasAjustes", Number(e.target.value))}
                className="input"
              />
            </Field>
            <Field label="Margen de cierre antes de que empiece el período (días hábiles)">
              <input
                type="number"
                min={0}
                value={values.flujo.diasMargenCierre}
                onChange={(e) => setFlujo("diasMargenCierre", Number(e.target.value))}
                className="input"
              />
            </Field>
          </>
        )}
      </Section>

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
        className="w-full rounded-[12px] bg-terracota px-5 py-3 text-center font-medium text-bg disabled:opacity-60"
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

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2.5 py-1">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-[18px] w-[18px] accent-[var(--color-terracota)]"
      />
      <span className="text-[0.9375rem]">{label}</span>
    </label>
  );
}
