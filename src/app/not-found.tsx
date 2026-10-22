import Link from "next/link";
import { InkiAviso } from "@/components/inki-aviso";

export default function NotFound() {
  return (
    <InkiAviso
      etiqueta="Inki no encontró"
      destacado="esta página"
      sello="PÁGINA · NO · ENCONTRADA ·"
      marca="pregunta"
      titulo="Esta página no existe"
      detalle="Puede que el link esté mal escrito o que ya no esté. Volvé a Hoy y seguí desde ahí."
    >
      <Link href="/hoy" className="boton-primario tocable rounded-[14px] px-5 py-3 font-medium">
        Volver a Hoy
      </Link>
    </InkiAviso>
  );
}
