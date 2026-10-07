"use client";

import { X } from "lucide-react";

export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        aria-label="Cerrar"
        className="absolute inset-0"
        style={{ background: "color-mix(in oklab, var(--color-texto) 35%, transparent)" }}
        onClick={onClose}
      />
      <div
        className="relative z-10 max-h-[85vh] w-full max-w-[640px] overflow-y-auto rounded-t-[20px] bg-bg-elevada px-5 pb-8 pt-4 shadow-[var(--shadow-sheet)]"
        style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="font-semibold">{title}</p>
          <button onClick={onClose} aria-label="Cerrar" className="text-texto-secundario">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function OpcionSheet({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-[12px] border border-borde px-4 py-3.5 text-left text-[0.9375rem] font-medium">
      {children}
    </button>
  );
}

export function BotonPrimario({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="mt-1 w-full rounded-[12px] bg-terracota px-5 py-3 text-center font-medium text-bg disabled:opacity-60"
    >
      {children}
    </button>
  );
}
