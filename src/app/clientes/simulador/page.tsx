"use client";

import { Encabezado } from "@/components/encabezado";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EstimacionCarga } from "@/components/estimacion-carga";
import { CamposEntrega, diasEntregaValidos } from "@/components/cliente-form";
import { SEMAFORO_ENTREGA, SemaforoPunto, avanceTexto } from "@/components/entrega";
import { Cargando } from "@/components/empty-state";
import { DEFAULT_ANTICIPACION, POR_CICLO, TipoCiclo } from "@/lib/domain/ciclos";
import { fechaCorta } from "@/lib/domain/dates";
import { simularProspecto } from "@/lib/domain/simulador";
import { Client, DEFAULT_MARGEN_DIAS, VolumenMensual } from "@/lib/domain/types";
import { DEFAULT_FLUJO } from "@/lib/supabase/data";
import { usePlan } from "@/lib/supabase/use-plan";
import { cn } from "@/lib/utils";

export default function SimuladorPage() {
  const ctx = usePlan();
  const [volumen, setVolumen] = useState<VolumenMensual>({ historias: 0, posteos: 0, reels: 0 });
  const [ciclo, setCiclo] = useState<TipoCiclo>("mensual");
  const [dia, setDia] = useState<number | undefined>(undefined);
  const [dia2, setDia2] = useState<number | undefined>(undefined);
  const [anticipacion, setAnticipacion] = useState<number | undefined>(undefined);
  const [margen, setMargen] = useState(DEFAULT_MARGEN_DIAS);

  const prospecto = useMemo<Client>(
    () => ({
      id: "prospecto",
      nombre: "El prospecto",
      tipo: "mensual",
      estado: "en-produccion",
      intocable: false,
      servicio: "contenido",
      volumenMensual: volumen,
      flujo: {
        ...DEFAULT_FLUJO,
        cicloTipo: ciclo,
        diaEntrega: dia,
        diaEntrega2: dia2,
        diasAnticipacion: anticipacion,
        margenDias: margen,
        mandaCalendario: false,
      },
      activo: true,
      creadoEn: new Date().toISOString(),
      adsEstadoCuenta: "activa",
    }),
    [volumen, ciclo, dia, dia2, anticipacion, margen],
  );
  const total = volumen.historias + volumen.posteos + volumen.reels;
  const conDia = diasEntregaValidos(ciclo, dia, dia2);
  const sim = useMemo(
    () => (ctx && total > 0 && conDia ? simularProspecto(ctx.entrada, ctx.plan, prospecto) : undefined),
    [ctx, prospecto, total, conDia],
  );
  const nombre = (id: string) => ctx?.clients.find((c) => c.id === id)?.nombre ?? "";

  return (
    <div className="mx-auto max-w-[640px] px-4 pt-2 lg:max-w-[720px] lg:px-8 lg:pt-4">
      <Encabezado
        titulo="¿Me entra este cliente?"
        izquierda={
          <Link href="/clientes" aria-label="Volver" className="tocable rounded-full p-1.5 text-texto-secundario hover:bg-borde/50">
            <ArrowLeft size={20} />
          </Link>
        }
      />

      <div className="lg:rounded-[20px] lg:border lg:border-borde lg:bg-bg-elevada lg:p-8 lg:shadow-papel">
        <p className="mb-5 text-[0.9375rem] text-texto-secundario">
          Cargá cómo sería y la app arma tu plan real con él adentro: ves qué entregas se complican y qué días te pasás.
          No crea ningún cliente ni guarda nada.
        </p>

        <section className="mb-5">
          <h2 className="mb-3 text-[0.9375rem] font-semibold">Ciclo</h2>
          <div className="grid grid-cols-2 gap-3">
            <CamposEntrega
              tipo={ciclo}
              dia={dia}
              dia2={dia2}
              onTipo={(t) => {
                setCiclo(t);
                setDia(undefined);
                setDia2(undefined);
                setAnticipacion(undefined);
              }}
              onDia={setDia}
              onDia2={setDia2}
            />
            <Field label="Arranca días antes">
              <input
                type="number"
                min={0}
                max={60}
                value={anticipacion ?? DEFAULT_ANTICIPACION[ciclo]}
                onChange={(e) => setAnticipacion(Math.max(Number(e.target.value), 0))}
                className="input"
              />
            </Field>
            <Field label="Margen (días)">
              <input type="number" min={0} max={30} value={margen} onChange={(e) => setMargen(Math.max(Number(e.target.value), 0))} className="input" />
            </Field>
          </div>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-[0.9375rem] font-semibold">Volumen {POR_CICLO[ciclo]}</h2>
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                ["historias", "Historias"],
                ["posteos", "Posteos"],
                ["reels", "Reels"],
              ] as [keyof VolumenMensual, string][]
            ).map(([campo, label]) => (
              <Field key={campo} label={label}>
                <input
                  type="number"
                  min={0}
                  value={volumen[campo]}
                  onChange={(e) => setVolumen((v) => ({ ...v, [campo]: Math.max(Number(e.target.value), 0) }))}
                  className="input"
                />
              </Field>
            ))}
          </div>
        </section>

        <EstimacionCarga volumen={volumen} ciclo={ciclo} />

        <section className="mt-6" aria-live="polite">
          <h2 className="titulo mb-2 text-[1.125rem]">Con tu plan real</h2>
          {!ctx ? (
            <Cargando />
          ) : total === 0 || !conDia ? (
            <p className="text-[0.9375rem] text-texto-secundario">Completá el día de entrega y el volumen para ver cómo queda.</p>
          ) : !sim ? (
            <p className="text-[0.9375rem] text-texto-secundario">No se pudo calcular con esos datos.</p>
          ) : (
            <div className="flex flex-col gap-4">
              <div
                className={cn(
                  "rounded-[14px] px-4 py-3 text-[0.9375rem] font-medium",
                  sim.empeoran.length === 0 && sim.diasSobrecargados.length === 0 && sim.propias.every((e) => e.semaforo === "verde")
                    ? "bg-verde/12 text-verde"
                    : sim.empeoran.some((e) => e.despues === "rojo") || sim.propias.some((e) => e.semaforo === "rojo")
                      ? "bg-acento/15 text-acento-texto"
                      : "bg-ambar/15 text-ambar",
                )}
              >
                {sim.empeoran.length === 0 && sim.diasSobrecargados.length === 0 && sim.propias.every((e) => e.semaforo === "verde")
                  ? "Entra sin complicar a nadie."
                  : sim.empeoran.length > 0
                    ? `Entra, pero se ${sim.empeoran.length === 1 ? "complica 1 entrega" : `complican ${sim.empeoran.length} entregas`} de tu cartera.`
                    : "Entra justo: mirá los días cargados."}
              </div>

              <div>
                <p className="mb-1.5 text-[0.8125rem] font-medium text-texto-secundario">Sus entregas</p>
                <ul className="papel flex flex-col divide-y divide-borde/80 px-1.5">
                  {sim.propias.map((e) => (
                    <li key={e.fecha} className="flex items-center gap-3 px-2 py-2.5 text-[0.9375rem]">
                      <SemaforoPunto semaforo={e.semaforo} />
                      <span className="flex-1">
                        {fechaCorta(e.fecha)} <span className="text-texto-secundario">· arranca {fechaCorta(e.inicio)} · {avanceTexto(e.porTipo)}</span>
                      </span>
                      <span className={cn("text-[0.8125rem] font-medium", SEMAFORO_ENTREGA[e.semaforo].texto)}>{SEMAFORO_ENTREGA[e.semaforo].label}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {sim.empeoran.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[0.8125rem] font-medium text-texto-secundario">Se complican</p>
                  <ul className="papel flex flex-col divide-y divide-borde/80 px-1.5">
                    {sim.empeoran.map((e) => (
                      <li key={`${e.clienteId}-${e.fecha}`} className="flex items-center gap-3 px-2 py-2.5 text-[0.9375rem]">
                        <SemaforoPunto semaforo={e.despues} />
                        <span className="flex-1">
                          {nombre(e.clienteId)} <span className="text-texto-secundario">· entrega {fechaCorta(e.fecha)}</span>
                        </span>
                        <span className="text-[0.8125rem] text-texto-secundario">
                          {SEMAFORO_ENTREGA[e.antes].label} → <span className={cn("font-medium", SEMAFORO_ENTREGA[e.despues].texto)}>{SEMAFORO_ENTREGA[e.despues].label}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {sim.diasSobrecargados.length > 0 && (
                <p className="text-[0.9375rem]">
                  <span className="font-medium">Te pasarías del tope</span>{" "}
                  <span className="text-texto-secundario">
                    el {sim.diasSobrecargados.slice(0, 6).map(fechaCorta).join(", ")}
                    {sim.diasSobrecargados.length > 6 && ` y ${sim.diasSobrecargados.length - 6} días más`}.
                  </span>
                </p>
              )}
              <p className="text-[0.75rem] text-texto-secundario">
                Simula sus próximas dos entregas, como si no grabara (o grabara antes de arrancar).
              </p>
            </div>
          )}
        </section>

        <Link
          href="/clientes/nuevo"
          className="boton-primario tocable mt-6 block w-full rounded-[14px] px-5 py-3.5 text-center font-medium"
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
