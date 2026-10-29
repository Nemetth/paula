// Reading a whole table. No "use client" here: the morning-notification route
// reads the same tables.

import type { SupabaseClient } from "@supabase/supabase-js";

/** Rows per request: the API never returns more than 1000 at once. */
const PAGINA = 1000;

/** Every row of `table`, page by page. A plain select stops at 1000 rows, and a
 * table read short looks like work that isn't there. */
export async function leerTabla<Row>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  table: string,
  filtro?: { columna: string; valor: string },
  /** A column that is unique per row, so no row is skipped or repeated between pages. */
  orden = "id",
): Promise<Row[]> {
  const todas: Row[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    let q = client.from(table).select("*");
    if (filtro) q = q.eq(filtro.columna, filtro.valor);
    const { data, error } = await q.order(orden).range(desde, desde + PAGINA - 1);
    if (error) throw error;
    todas.push(...((data ?? []) as Row[]));
    if (!data || data.length < PAGINA) return todas;
  }
}
