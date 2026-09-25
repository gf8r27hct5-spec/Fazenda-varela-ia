import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabasePublishableKey, supabaseUrl } from './config';

export async function createClient() {
  const store = await cookies();
  return createServerClient(
    supabaseUrl,
    supabasePublishableKey,
    { cookies: {
      getAll() { return store.getAll(); },
      setAll(items) {
        try { items.forEach(({ name, value, options }) => store.set(name, value, options)); }
        catch { /* Server Components cannot set cookies; the proxy refreshes sessions. */ }
      },
    } },
  );
}
