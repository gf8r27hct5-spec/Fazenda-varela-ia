 'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { supabasePublishableKey, supabaseUrl } from '@/lib/supabase/config';

export async function signIn(formData: FormData) {
  const email = String(formData.get('email') || '').trim();
  if (!email) redirect('/?erro=email');
  // Email links may open in a different browser from the one that requested
  // them. The implicit flow does not require a PKCE verifier cookie there.
  const supabase = createSupabaseClient(supabaseUrl, supabasePublishableKey, {
    auth: { flowType: 'implicit', persistSession: false, autoRefreshToken: false },
  });
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000');
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${siteUrl.replace(/\/$/, '')}/auth/callback` } });
  redirect(error ? '/?erro=login' : '/?enviado=1');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}

export async function createFarm(formData: FormData) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/');
  const nome = String(formData.get('nome') || '').trim();
  if (!nome) redirect('/?erro=nome');
  const { error } = await supabase.from('fazendas').insert({ nome, cidade: String(formData.get('cidade') || '').trim() || null, estado: 'PA', proprietario_id: user.id });
  if (error) redirect('/?erro=fazenda');
  revalidatePath('/');
  redirect('/');
}
