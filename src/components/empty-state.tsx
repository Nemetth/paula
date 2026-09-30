export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-[12px] border border-borde bg-bg-elevada px-5 py-8 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-[0.9375rem] text-texto-secundario">{detail}</p>
    </div>
  );
}
