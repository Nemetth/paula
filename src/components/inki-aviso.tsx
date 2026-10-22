import Image from "next/image";
import { Sello } from "@/components/sello";

/** Inki's stamp as a full notice: for the screens where something went wrong
 * (404, a crashed page). Same paper and photo as his easter egg, so finding
 * him in a bad moment feels like the same joke, not a new component. */
export function InkiAviso({
  etiqueta,
  destacado,
  sello,
  marca,
  titulo,
  detalle,
  children,
}: {
  /** Stamp caption, first line: "Inki no encontró". */
  etiqueta: string;
  /** Stamp caption, highlighted: "esta página". */
  destacado: string;
  /** Text around the postmark's rim. */
  sello: string;
  marca: "cruz" | "pregunta";
  titulo: string;
  detalle: string;
  /** The way out: buttons or links. */
  children: React.ReactNode;
}) {
  return (
    <div role="alert" className="flex min-h-[72vh] items-center justify-center px-6 py-10">
      <div className="flex flex-col items-center text-center">
        <div className="estampilla-llega relative w-[min(66vw,250px)]">
          <div className="estampilla">
            <div className="estampilla-foto">
              <Image
                src="/inki.jpg"
                alt="Inki, un perrito de pelo largo color miel y blanco, sentado y mirando a cámara"
                width={720}
                height={960}
                priority
                sizes="250px"
                className="block h-full w-full object-cover"
              />
            </div>
            <p className="estampilla-texto">
              {etiqueta}
              <br />
              <strong>{destacado}</strong>
            </p>
          </div>
          <Sello
            texto={sello}
            marca={marca}
            className="matasellos pointer-events-none absolute -bottom-8 -right-9 h-[84px] w-[84px]"
          />
        </div>
        <h1 className="titulo entra mt-12 text-balance text-[1.5rem]" style={{ "--i": 3 } as React.CSSProperties}>
          {titulo}
        </h1>
        <p className="entra mt-1 max-w-[34ch] text-[0.9375rem] text-texto-secundario" style={{ "--i": 4 } as React.CSSProperties}>
          {detalle}
        </p>
        <div className="entra mt-6 flex flex-wrap justify-center gap-2.5" style={{ "--i": 5 } as React.CSSProperties}>
          {children}
        </div>
      </div>
    </div>
  );
}
