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
      <h2 className="mb-1 text-[0.9375rem] font-semibold">{titulo}</h2>
      {detalle && <p className="mb-2 text-[0.8125rem] text-texto-secundario">{detalle}</p>}
      {children}
    </section>
  );
}

export const campo = "rounded-[12px] border border-borde bg-bg-elevada px-3 py-2";
export const botonSecundario = "rounded-[12px] border border-borde px-3 py-2 text-[0.9375rem] font-medium";
export const botonPrimario = "rounded-[12px] bg-terracota px-4 py-2 text-[0.9375rem] font-medium text-bg";
export const listaFilas = "flex flex-col divide-y divide-borde border-y border-borde";
