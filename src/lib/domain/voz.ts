// How the app talks to Paula: her name, the time of day, and how her day is
// going. Plain functions over the state of the day, so the copy is always
// true to what the plan says and never random.

export const NOMBRE = "Paula";

export function saludo(d: Date): string {
  const h = d.getHours();
  return h < 6 ? "Buenas noches" : h < 13 ? "Buen día" : h < 20 ? "Buenas tardes" : "Buenas noches";
}

/** The line under the greeting: how the day looks, in one breath.
 * Nothing when the day is blocked or empty — Hoy already says why. */
export function bajadaDelDia({ total, hechas }: { total: number; hechas: number }): string | undefined {
  if (total === 0) return undefined;
  const faltan = total - hechas;
  if (faltan === 0) return "Cuando quieras, cerrá el día.";
  if (hechas === 0) return faltan === 1 ? "Hoy es una sola cosa." : `Hoy son ${faltan} cosas, de a una.`;
  return faltan === 1 ? "Te queda una." : `Te quedan ${faltan}, de a una.`;
}

/** How the day is going, under the progress bar. */
export function fraseDelAvance({ total, hechas }: { total: number; hechas: number }): string {
  if (total === 0) return "Día liviano.";
  const faltan = total - hechas;
  if (faltan === 0) return "Día completo. Bien ahí.";
  if (hechas === 0) return "Arrancá por lo de arriba.";
  if (faltan === 1) return "Una más y cerrás el día.";
  if (hechas / total >= 0.5) return "Más de la mitad, seguí así.";
  return "Ya arrancaste. Seguí con lo de arriba.";
}
