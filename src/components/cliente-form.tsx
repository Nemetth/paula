"use client";

import { useState } from "react";
import {
  Client,
  ClienteEstado,
  ClienteTipo,
  DEFAULT_MARGEN_DIAS,
  FlujoConfig,
  Servicio,
  VolumenMensual,
} from "@/lib/domain/types";
import { DEFAULT_ANTICIPACION, POR_CICLO, TipoCiclo } from "@/lib/domain/ciclos";
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

/** Weekdays in Paula's order (Monday first), with their 0 = Sunday number. */
export const DIAS_SEMANA: [number, string][] = [
  [1, "Lunes"],
  [2, "Martes"],
  [3, "Miércoles"],
  [4, "Jueves"],
  [5, "Viernes"],
  [6, "Sábado"],
  [0, "Domingo"],
];

const tipoCiclo = (f: FlujoConfig): TipoCiclo =>
  f.cicloTipo === "semanal" || f.cicloTipo === "quincenal" ? f.cicloTipo : "mensual";

export const CICLO_LABEL: Record<TipoCiclo, string> = {
  mensual: "Una vez por mes",
  quincenal: "Cada 15 días",
  semanal: "Una vez por semana",
};

const diaDelMes = (n?: number) => n != null && Number.isInteger(n) && n >= 1 && n <= 31;

/** Whether the delivery day(s) are complete for the cycle type. */
export function diasEntregaValidos(tipo: TipoCiclo, dia?: number, dia2?: number): boolean {
  if (tipo === "semanal") return dia != null && dia >= 0 && dia <= 6;
  if (tipo === "quincenal") return diaDelMes(dia) && diaDelMes(dia2) && dia !== dia2;
  return diaDelMes(dia);
}

/** Switching the cycle type: a weekday isn't a day of the month (and back), so
 * the day is kept only when it still means something; the lead time goes back
 * to the new type's default. */
export function cambioDeCiclo(flujo: FlujoConfig, tipo: TipoCiclo): Partial<FlujoConfig> {
  const antes = tipoCiclo(flujo);
  const mismoSentido = (antes === "semanal") === (tipo === "semanal");
  return {
    cicloTipo: tipo,
    diaEntrega: mismoSentido ? flujo.diaEntrega : undefined,
    diaEntrega2: tipo === "quincenal" && mismoSentido ? flujo.diaEntrega2 : undefined,
    diasAnticipacion: undefined,
  };
}

/** The cycle type and its delivery day(s): a weekday, a day of the month, or
 * the two days of the month of a twice-a-month client. Controlled: the caller
 * decides when to save. Rendered as two cells of a two-column grid. */
export function CamposEntrega({
  tipo,
  dia,
  dia2,
  onTipo,
  onDia,
  onDia2,
  error,
}: {
  tipo: TipoCiclo;
  dia?: number;
  dia2?: number;
  onTipo: (t: TipoCiclo) => void;
  onDia: (n?: number) => void;
  onDia2: (n?: number) => void;
  error?: string;
}) {
  const numero = (valor: number | undefined, onCambio: (n?: number) => void, placeholder: string, id?: string) => (
    <input
      id={id}
      aria-invalid={!!error}
      type="number"
      min={1}
      max={31}
      value={valor ?? ""}
      placeholder={placeholder}
      onChange={(e) => onCambio(e.target.value === "" ? undefined : Math.min(Math.max(Math.floor(Number(e.target.value)), 1), 31))}
      className="input"
    />
  );
  return (
    <>
      <Field label="Entrega">
        <select value={tipo} onChange={(e) => onTipo(e.target.value as TipoCiclo)} className="input">
          {(Object.keys(CICLO_LABEL) as TipoCiclo[]).map((t) => (
            <option key={t} value={t}>
              {CICLO_LABEL[t]}
            </option>
          ))}
        </select>
      </Field>
      {tipo === "semanal" ? (
        <Field label="Qué día" error={error}>
          <select
            id="field-diaEntrega"
            aria-invalid={!!error}
            value={dia ?? ""}
            onChange={(e) => onDia(e.target.value === "" ? undefined : Number(e.target.value))}
            className="input"
          >
            <option value="">Elegí</option>
            {DIAS_SEMANA.map(([n, nombre]) => (
              <option key={n} value={n}>
                {nombre}
              </option>
            ))}
          </select>
        </Field>
      ) : tipo === "quincenal" ? (
        <Field label="Qué días del mes" error={error}>
          <span className="grid grid-cols-2 gap-2">
            {numero(dia, onDia, "1", "field-diaEntrega")}
            {numero(dia2, onDia2, "15")}
          </span>
        </Field>
      ) : (
        <Field label="Qué día del mes" error={error}>
          {numero(dia, onDia, "15", "field-diaEntrega")}
        </Field>
      )}
    </>
  );
}

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
  return {
    nombre: v.nombre.trim(),
    rubro: v.rubro.trim() || undefined,
    servicio: v.servicio,
    tipo: v.tipo,
    estado: v.estado,
    intocable: v.intocable,
    volumenMensual: v.volumenMensual,
    flujo: { ...v.flujo, cicloTipo: tipoCiclo(v.flujo) },
    contactoWhatsapp: v.contactoWhatsapp.trim() || undefined,
    ventanaCobro: [v.ventanaCobroInicio, v.ventanaCobroFin] as [number, number],
    montoMensual: v.montoMensual ? Number(v.montoMensual) : undefined,
    notas: v.notas.trim() || undefined,
  };
}

type FormErrors = Partial<Record<"nombre" | "contactoWhatsapp" | "ventanaCobroFin" | "diaEntrega", string>>;

function validate(v: ClienteFormValues): FormErrors {
  const errors: FormErrors = {};
  if (!v.nombre.trim()) errors.nombre = "Ingresá el nombre del cliente.";
  const wa = v.contactoWhatsapp.trim();
  const esLink = /^https?:\/\//i.test(wa);
  if (wa && !esLink && wa.replace(/\D/g, "").length < 8) {
    errors.contactoWhatsapp = "Ingresá un número con código de área o un link de grupo.";
  }
  const tipo = tipoCiclo(v.flujo);
  if (v.servicio !== "ads" && !diasEntregaValidos(tipo, v.flujo.diaEntrega, v.flujo.diaEntrega2)) {
    errors.diaEntrega =
      tipo === "quincenal"
        ? "Elegí los dos días del mes en que entregás (por ejemplo 1 y 15)."
        : "Elegí el día de entrega: con eso se calculan las fechas y se generan las piezas.";
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

  function setFlujo(cambios: Partial<FlujoConfig>) {
    setValues((v) => ({ ...v, flujo: { ...v.flujo, ...cambios } }));
    if ("diaEntrega" in cambios) setErrors((e) => ({ ...e, diaEntrega: undefined }));
  }

  const ciclo = tipoCiclo(values.flujo);
  const anticipacion = values.flujo.diasAnticipacion ?? DEFAULT_ANTICIPACION[ciclo];
  const margen = values.flujo.margenDias ?? DEFAULT_MARGEN_DIAS;
  const porCiclo = POR_CICLO[ciclo];

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
      {values.servicio !== "ads" && (
        <EstimacionCarga volumen={values.volumenMensual} ciclo={ciclo} excluirId={initial?.id} />
      )}

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
            className="h-[16px] w-[16px] accent-[var(--color-oscuro)]"
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
        <Section title="Ciclo de entrega">
          <div className="grid grid-cols-2 gap-3">
            <CamposEntrega
              tipo={ciclo}
              dia={values.flujo.diaEntrega}
              dia2={values.flujo.diaEntrega2}
              error={errors.diaEntrega}
              onTipo={(t) => setFlujo(cambioDeCiclo(values.flujo, t))}
              onDia={(n) => setFlujo({ diaEntrega: n })}
              onDia2={(n) => setFlujo({ diaEntrega2: n })}
            />
            <Field label="Arranca días antes">
              <input
                type="number"
                min={0}
                max={60}
                value={anticipacion}
                onChange={(e) => setFlujo({ diasAnticipacion: Math.max(Number(e.target.value), 0) })}
                className="input"
              />
            </Field>
            <Field label="Termina días antes (margen)">
              <input
                type="number"
                min={0}
                max={30}
                value={margen}
                onChange={(e) => setFlujo({ margenDias: Math.max(Number(e.target.value), 0) })}
                className="input"
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-[0.9375rem]">
            <input
              type="checkbox"
              checked={values.flujo.tieneGrabacion}
              onChange={(e) => setFlujo({ tieneGrabacion: e.target.checked })}
              className="h-[16px] w-[16px] accent-[var(--color-oscuro)]"
            />
            Graba reels para este cliente
          </label>
          <label className="flex items-center gap-2 text-[0.9375rem]">
            <input
              type="checkbox"
              checked={values.flujo.mandaCalendario}
              onChange={(e) => setFlujo({ mandaCalendario: e.target.checked })}
              className="h-[16px] w-[16px] accent-[var(--color-oscuro)]"
            />
            Le mando un calendario de ideas para aprobar
          </label>
          <div className="grid grid-cols-2 gap-3">
            {values.flujo.mandaCalendario && (
              <Field label="Días que tarda en aprobar">
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={values.flujo.diasAprobacion}
                  onChange={(e) => setFlujo({ diasAprobacion: Math.max(Number(e.target.value), 0) })}
                  className="input"
                />
              </Field>
            )}
            <Field label="Días que tarda en corregir">
              <input
                type="number"
                min={0}
                max={30}
                value={values.flujo.diasCorreccion}
                onChange={(e) => setFlujo({ diasCorreccion: Math.max(Number(e.target.value), 0) })}
                className="input"
              />
            </Field>
          </div>
          <p className="text-[0.8125rem] text-texto-secundario">
            La producción de cada entrega arranca {anticipacion} {anticipacion === 1 ? "día" : "días"} antes y se reparte
            pareja hasta {margen === 0 ? "la entrega" : `${margen} ${margen === 1 ? "día" : "días"} antes`}.{" "}
            {values.flujo.tieneGrabacion
              ? "Historias y posteos entran al plan desde el primer día; los reels, cuando marcás la grabación como hecha."
              : "Las piezas entran al plan desde el primer día."}
            {values.flujo.mandaCalendario &&
              " Si marcás el calendario como armado o enviado, las piezas esperan a que lo marques aprobado."}
          </p>
        </Section>
      )}

      {values.servicio !== "ads" && (
        <Section title={`Volumen ${porCiclo}`}>
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
          <p className="text-[0.8125rem] text-texto-secundario">
            Las piezas de cada entrega se generan solas con estos números (Historia 1, Historia 2…).
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
          aria-label="Notas"
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
