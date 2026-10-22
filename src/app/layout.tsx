import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { AppFrame } from "@/components/app-frame";
import { ServiceWorkerRegister } from "@/components/service-worker-register";

/** One typeface for everything, no serif. */
const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Paula — plan del día",
  description: "Planificación diaria, ciclos de clientes y cobros.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Paula",
  },
};

export const viewport: Viewport = {
  themeColor: "#2a2e36",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${outfit.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-bg text-texto">
        <div className="luz" aria-hidden />
        <ServiceWorkerRegister />
        <AppFrame>{children}</AppFrame>
      </body>
    </html>
  );
}
