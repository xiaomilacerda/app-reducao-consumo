import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/** Server-only session lookup; getUser() is validated by Supabase Auth. */
export async function getRequestSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase não configurado");
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      // Refresh cookies is handled by middleware; a read-only API response
      // must not invent/set cookies at this layer.
      setAll() {},
    },
  });
}
