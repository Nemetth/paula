"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const DURACION_SALIDA = 220;

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
  // Stay mounted for the exit animation after `open` flips to false.
  const [montado, setMontado] = useState(open);
  if (open && !montado) setMontado(true);
  const cerrando = montado && !open;

  useEffect(() => {
    if (!cerrando) return;
    const t = setTimeout(() => setMontado(false), DURACION_SALIDA);
    return () => clearTimeout(t);
  }, [cerrando]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!montado) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center lg:p-6">
      <button
        aria-label="Cerrar"
        className="velo absolute inset-0 backdrop-blur-[2px]"
        data-cerrando={cerrando || undefined}
        style={{ background: "color-mix(in oklab, #1b1712 38%, transparent)" }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-cerrando={cerrando || undefined}
        className="hoja relative z-10 max-h-[85vh] w-full max-w-[640px] overflow-y-auto rounded-t-[24px] bg-bg-elevada px-5 pb-8 pt-2 shadow-[var(--shadow-sheet)] lg:rounded-[24px]"
        style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-borde lg:hidden" aria-hidden />
        <div className="mb-4 flex items-center justify-between lg:mt-3">
          <p className="titulo-serif text-[1.25rem] font-medium">{title}</p>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="tocable -mr-1.5 rounded-full p-1.5 text-texto-secundario hover:bg-borde/50"
          >
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
    <button
      onClick={onClick}
      className="tocable rounded-[14px] border border-borde bg-bg px-4 py-3.5 text-left text-[0.9375rem] font-medium hover:border-terracota/40"
    >
      {children}
    </button>
  );
}

export function BotonPrimario({
  children,
  onClick,
  disabled,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "boton-primario tocable mt-1 w-full rounded-[12px] px-5 py-3 text-center font-medium disabled:opacity-60",
        className,
      )}
    >
      {children}
    </button>
  );
}
