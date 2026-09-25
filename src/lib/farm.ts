import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function farmContext() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/');
  const { data: farms, error } = await db.from('fazendas').select('id,nome,cidade,estado').order('criado_em').limit(1);
  if (error) throw new Error('Falha ao carregar a fazenda.');
  if (!farms?.length) redirect('/');
  return { db, farm: farms[0], user };
}
export function money(value: number | null | undefined) { return value == null ? '—' : value.toLocaleString('pt-BR', {style:'currency',currency:'BRL'}); }
export function number(value: number | null | undefined, digits=0) { return value == null ? '—' : value.toLocaleString('pt-BR', {maximumFractionDigits:digits}); }
export function date(value: string) { return new Date(`${value.slice(0,10)}T12:00:00`).toLocaleDateString('pt-BR'); }
export function sum<T>(items:T[], field:keyof T) { return items.reduce((total,item)=>total + (Number(item[field]) || 0),0); }
export function monthBounds() { const now = new Date(); const year=now.getFullYear(), month=now.getMonth(); return {start:`${year}-${String(month+1).padStart(2,'0')}-01`, end:`${year}-${String(month+2).padStart(2,'0')}-01`, label:now.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}; }
