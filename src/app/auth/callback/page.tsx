'use client';

import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { supabasePublishableKey, supabaseUrl } from '@/lib/supabase/config';

export default function AuthCallback() {
  const started = useRef(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function confirm() {
      const query = new URLSearchParams(window.location.search);
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      const recovery = query.get('type') === 'recovery' || fragment.get('type') === 'recovery';
      const supabase = createBrowserClient(supabaseUrl, supabasePublishableKey, {
        auth: { detectSessionInUrl: false },
      });
      let authError: Error | null = null;

      if (query.has('error') || fragment.has('error')) {
        authError = new Error('O link expirou ou não pôde ser confirmado.');
      } else if (query.get('token_hash')) {
        const type = query.get('type');
        if (type === 'email' || type === 'magiclink' || type === 'signup' || type === 'recovery') {
          const result = await supabase.auth.verifyOtp({
            token_hash: query.get('token_hash')!,
            type,
          });
          authError = result.error;
        } else {
          authError = new Error('Tipo de confirmação inválido.');
        }
      } else if (query.get('code')) {
        const result = await supabase.auth.exchangeCodeForSession(query.get('code')!);
        authError = result.error;
      } else if (fragment.get('access_token') && fragment.get('refresh_token')) {
        // The default Supabase email template returns an implicit-flow fragment.
        // Fragments never reach a server route, so persist the session in browser cookies.
        const result = await supabase.auth.setSession({
          access_token: fragment.get('access_token')!,
          refresh_token: fragment.get('refresh_token')!,
        });
        authError = result.error;
      } else {
        authError = new Error('Link de confirmação incompleto.');
      }

      if (authError) {
        window.history.replaceState(null, '', '/auth/callback');
        setError(true);
        return;
      }
      window.location.replace(recovery ? '/auth/nova-senha' : '/');
    }

    confirm().catch(() => {
      window.history.replaceState(null, '', '/auth/callback');
      setError(true);
    });
  }, []);

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
      <div>
        <h1>{error ? 'Não foi possível confirmar seu acesso' : 'Confirmando seu acesso…'}</h1>
        {error && <p>O link pode ter expirado. Peça outro e abra o mais recente.</p>}
        {error && <Link href="/?modo=recuperar">Recuperar acesso</Link>}
      </div>
    </main>
  );
}
