import { useId } from "react";

/** A round postmark: text running around the rim, a mark in the middle (a
 * check unless told otherwise). Draws in `currentColor`; the caller sets
 * color, size and tilt. */
export function Sello({
  texto,
  marca = "check",
  className,
}: {
  texto: string;
  marca?: "check" | "cruz" | "pregunta";
  className?: string;
}) {
  const arco = `sello-arco-${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 100 100" aria-hidden className={className}>
      <defs>
        <path id={arco} d="M50 50 m-35 0 a35 35 0 1 1 70 0 a35 35 0 1 1 -70 0" />
      </defs>
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="50" cy="50" r="27" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <text fontSize="10" fontWeight="600" fill="currentColor">
        <textPath href={`#${arco}`} textLength="216" lengthAdjust="spacing">
          {texto}
        </textPath>
      </text>
      {marca === "pregunta" ? (
        <text x="50" y="62" textAnchor="middle" fontSize="34" fontWeight="700" fill="currentColor">
          ?
        </text>
      ) : (
        <path
          d={marca === "cruz" ? "M40 40 l20 20 M60 40 l-20 20" : "M38 52 l8 8 l16 -18"}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
