import type { Metadata } from "next";

export const metadata: Metadata = { title: "Plata" };

export default function PlataLayout({ children }: { children: React.ReactNode }) {
  return children;
}
