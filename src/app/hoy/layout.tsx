import type { Metadata } from "next";

export const metadata: Metadata = { title: "Hoy" };

export default function HoyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
