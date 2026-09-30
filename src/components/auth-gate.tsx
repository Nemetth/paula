"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/supabase/auth-context";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLoginRoute = pathname === "/login";

  useEffect(() => {
    if (loading) return;
    if (!session && !isLoginRoute) router.replace("/login");
    if (session && isLoginRoute) router.replace("/hoy");
  }, [loading, session, isLoginRoute, router]);

  if (loading) return null;
  if (!session && !isLoginRoute) return null;
  if (session && isLoginRoute) return null;

  return <>{children}</>;
}
