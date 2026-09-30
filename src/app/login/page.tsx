"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase().auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError("Email o contraseña incorrectos.");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-[400px] flex-col justify-center px-6">
      <h1 className="mb-1 text-[1.25rem] font-semibold">Paula</h1>
      <p className="mb-6 text-[0.9375rem] text-texto-secundario">Ingresá para ver tu plan del día.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[0.8125rem] font-medium text-texto-secundario">Email</span>
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[0.8125rem] font-medium text-texto-secundario">Contraseña</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
        </label>

        {error && <p className="text-[0.8125rem] text-terracota">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full rounded-[12px] bg-terracota px-5 py-3 text-center font-medium text-bg disabled:opacity-60"
        >
          {loading ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </div>
  );
}
