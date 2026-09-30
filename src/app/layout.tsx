import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppFrame } from "@/components/app-frame";
import { ServiceWorkerRegister } from "@/components/service-worker-register";

const inter = Inter({
  variable: "--font-inter",
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
  themeColor: "#d9502d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-bg text-texto">
        <ServiceWorkerRegister />
        <AppFrame>{children}</AppFrame>
      </body>
    </html>
  );
}
