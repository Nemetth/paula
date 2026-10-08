export function Seccion({
  titulo,
  detalle,
  children,
}: {
  titulo: string;
  detalle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="titulo-serif mb-1 text-[1.25rem] font-medium">{titulo}</h2>
      {detalle && <p className="mb-2 text-[0.8125rem] text-texto-secundario">{detalle}</p>}
      {children}
    </section>
  );
}

export const campo =
  "rounded-[12px] border border-borde bg-bg-elevada px-3 py-2 transition-[border-color,box-shadow] focus:border-terracota focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-terracota)_14%,transparent)] focus:outline-none";
export const botonSecundario =
  "tocable rounded-[12px] border border-borde px-3 py-2 text-[0.9375rem] font-medium hover:bg-borde/40";
export const botonPrimario = "boton-primario tocable rounded-[12px] px-4 py-2 text-[0.9375rem] font-medium";
export const listaFilas = "papel flex flex-col divide-y divide-borde/80 px-1.5";
