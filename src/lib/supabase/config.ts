// Both values are public client configuration, never a service-role or secret key.
// Keep defaults so a new Vercel deployment works before environment variables are added.
export const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://fdpccfgpwnfshdskapwi.supabase.co';

export const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_xe9gijcQh90AMi6miULCnA_jglSbl7W';
