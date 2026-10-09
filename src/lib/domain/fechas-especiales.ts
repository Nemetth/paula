// Special dates for content planning, by rubro. A starting catalog Paula can
// grow: general commercial dates in Argentina plus a few per rubro. A client's
// rubro is free text, so it is matched by keywords.

import { addDays, format, getDay } from "date-fns";
import { toISODate } from "./dates";
import { Client } from "./types";

export type Rubro = "gastronomia" | "salud" | "turismo" | "moda" | "belleza" | "mascotas";

const PALABRAS: Record<Rubro, string[]> = {
  gastronomia: ["gastronom", "pasteler", "restaurant", "cafe", "comida", "panader", "helader", "cocina", "bodega", "vino"],
  salud: ["salud", "fitness", "gym", "gimnas", "nutri", "medic", "clinica", "kinesio", "deport", "entrena", "yoga", "odonto"],
  turismo: ["turismo", "hotel", "viaje", "hospedaje", "cabana", "alojamiento", "hosteria"],
  moda: ["moda", "ropa", "indumentaria", "calzado", "accesorio", "boutique", "joya"],
  belleza: ["cosmetic", "belleza", "estetica", "peluquer", "maquillaje", "manicura", "barber"],
  mascotas: ["veterinar", "mascota", "petshop", "pet shop", "animal"],
};

const normalizar = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function rubrosDe(rubro?: string): Rubro[] {
  if (!rubro) return [];
  const r = normalizar(rubro);
  return (Object.keys(PALABRAS) as Rubro[]).filter((k) => PALABRAS[k].some((p) => r.includes(p)));
}

interface Regla {
  nombre: string;
  /** Undefined = every rubro. */
  rubro?: Rubro;
  /** Date in a given year. */
  fecha: (anio: number) => Date;
}

const fija = (mes: number, dia: number) => (anio: number) => new Date(anio, mes - 1, dia);

/** n-th `diaSemana` (0 = domingo) of a month. */
const enesimo = (mes: number, diaSemana: number, n: number) => (anio: number) => {
  const primero = new Date(anio, mes - 1, 1);
  const offset = (diaSemana - getDay(primero) + 7) % 7;
  return addDays(primero, offset + (n - 1) * 7);
};

const REGLAS: Regla[] = [
  { nombre: "Año Nuevo", fecha: fija(1, 1) },
  { nombre: "San Valentín", fecha: fija(2, 14) },
  { nombre: "Día Internacional de la Mujer", fecha: fija(3, 8) },
  { nombre: "Día del Trabajador", fecha: fija(5, 1) },
  { nombre: "Día del Padre", fecha: enesimo(6, 0, 3) },
  { nombre: "Día del Amigo", fecha: fija(7, 20) },
  { nombre: "Día de las Infancias", fecha: enesimo(8, 0, 3) },
  { nombre: "Día de la Primavera y del Estudiante", fecha: fija(9, 21) },
  { nombre: "Día de la Madre", fecha: enesimo(10, 0, 3) },
  { nombre: "Halloween", fecha: fija(10, 31) },
  { nombre: "Black Friday", fecha: (anio) => addDays(enesimo(11, 4, 4)(anio), 1) },
  { nombre: "Nochebuena", fecha: fija(12, 24) },
  { nombre: "Navidad", fecha: fija(12, 25) },
  { nombre: "Fin de año", fecha: fija(12, 31) },

  { nombre: "Día Mundial del Malbec", rubro: "gastronomia", fecha: fija(4, 17) },
  { nombre: "Día Mundial del Chocolate", rubro: "gastronomia", fecha: fija(7, 7) },
  { nombre: "Día Internacional del Café", rubro: "gastronomia", fecha: fija(10, 1) },
  { nombre: "Día Mundial del Dulce de Leche", rubro: "gastronomia", fecha: fija(10, 11) },
  { nombre: "Día Mundial de la Alimentación", rubro: "gastronomia", fecha: fija(10, 16) },
  { nombre: "Día Mundial de la Pasta", rubro: "gastronomia", fecha: fija(10, 25) },

  { nombre: "Día Mundial de la Actividad Física", rubro: "salud", fecha: fija(4, 6) },
  { nombre: "Día Mundial de la Salud", rubro: "salud", fecha: fija(4, 7) },
  { nombre: "Día Mundial del Corazón", rubro: "salud", fecha: fija(9, 29) },
  { nombre: "Día contra el Cáncer de Mama", rubro: "salud", fecha: fija(10, 19) },
  { nombre: "Día Mundial de la Diabetes", rubro: "salud", fecha: fija(11, 14) },

  { nombre: "Día Mundial del Turismo", rubro: "turismo", fecha: fija(9, 27) },

  { nombre: "Día del Animal", rubro: "mascotas", fecha: fija(4, 29) },
  { nombre: "Día del Veterinario", rubro: "mascotas", fecha: fija(8, 6) },
  { nombre: "Día Internacional del Gato", rubro: "mascotas", fecha: fija(8, 8) },
  { nombre: "Día Mundial de los Animales", rubro: "mascotas", fecha: fija(10, 4) },
];

export interface FechaEspecial {
  fecha: string;
  nombre: string;
  /** Clients it applies to; empty for general dates (every rubro). */
  clienteIds: string[];
}

/** Special dates in the month of `ancla`: general ones always, rubro ones only
 * when an active client works in that rubro. */
export function fechasEspecialesDelMes(ancla: Date, clients: Client[]): FechaEspecial[] {
  const anio = ancla.getFullYear();
  const mes = format(ancla, "yyyy-MM");
  const activos = clients.filter((c) => c.activo && c.estado !== "en-pausa" && c.servicio !== "ads");
  const out: FechaEspecial[] = [];
  for (const r of REGLAS) {
    const fecha = toISODate(r.fecha(anio));
    if (!fecha.startsWith(mes)) continue;
    if (!r.rubro) {
      out.push({ fecha, nombre: r.nombre, clienteIds: [] });
      continue;
    }
    const clienteIds = activos.filter((c) => rubrosDe(c.rubro).includes(r.rubro as Rubro)).map((c) => c.id);
    if (clienteIds.length > 0) out.push({ fecha, nombre: r.nombre, clienteIds });
  }
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha));
}
