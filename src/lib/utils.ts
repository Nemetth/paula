import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/** Stagger slot for the `.entra` arrival animation (capped in CSS). */
export function indice(i: number): React.CSSProperties {
  return { "--i": i } as React.CSSProperties;
}
