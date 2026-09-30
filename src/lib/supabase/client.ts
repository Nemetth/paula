import { createClient } from "@supabase/supabase-js";

// No generated Database type yet (this project isn't reachable through the
// connected Supabase account, so `generate_typescript_types` can't run here) —
// `any` keeps `.from(table)` usable instead of every table resolving to
// `never`. Swap in a generated Database type once available.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: ReturnType<typeof createClient<any>> | undefined;

/** Single shared browser client (session persisted in localStorage). The app
 * is entirely client-rendered — an installed PWA, not an SSR app — so there's
 * no need for the cookie-based @supabase/ssr client. */
export function supabase() {
  if (!client) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client = createClient<any>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return client;
}
