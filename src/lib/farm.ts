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
export function milkDailyTotals(items: { data_producao?: string | number | boolean | null; animal_id?: string | number | boolean | null; litros?: string | number | boolean | null }[]) {
  const days = new Map<string, typeof items>();
  for (const item of items) {
    const key = String(item.data_producao).slice(0, 10);
    days.set(key, [...(days.get(key) || []), item]);
  }
  return [...days].sort(([left], [right]) => left.localeCompare(right)).map(([day, entries]) => {
    // The tank measures the entire herd; individual records from the same day
    // describe its composition and must not be added on top of it.
    const tank = entries.filter(entry => !entry.animal_id);
    return { day, liters: sum(tank.length ? tank : entries, 'litros') };
  });
}
export function monthBounds() { const now = new Date(); const [year,month]=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'numeric'}).format(now).split('-').map(Number); const nextYear=month===12?year+1:year, nextMonth=month===12?1:month+1; return {start:`${year}-${String(month).padStart(2,'0')}-01`, end:`${nextYear}-${String(nextMonth).padStart(2,'0')}-01`, label:new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',month:'long',year:'numeric'}).format(now)}; }
