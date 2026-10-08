import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { AppFrame } from "@/components/app-frame";
import { ServiceWorkerRegister } from "@/components/service-worker-register";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

/** Display serif for titles and money/hour readouts only — Inter stays the
 * workhorse for every row and control. */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "opsz"],
  style: ["normal", "italic"],
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
  themeColor: "#d9502d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${inter.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-bg text-texto">
        <div className="luz" aria-hidden />
        <ServiceWorkerRegister />
        <AppFrame>{children}</AppFrame>
      </body>
    </html>
  );
}
