import type { SupabaseClient } from '@supabase/supabase-js';

export async function animalRelations(db: SupabaseClient, id: string, farmId: string) {
  const tables = ['pesagens', 'manejos', 'transacoes', 'producao_leite', 'documentos'] as const;
  const results = await Promise.all(tables.map(table => db.from(table).select('id', { count: 'exact', head: true }).eq('fazenda_id', farmId).eq('animal_id', id)));
  const family = await db.from('animais').select('id', { count: 'exact', head: true }).eq('fazenda_id', farmId).or(`mae_id.eq.${id},pai_id.eq.${id},bezerro_id.eq.${id}`);
  if ([...results, family].some(result => result.error)) throw new Error('Não foi possível conferir os registros associados.');
  return {
    pesagens: results[0].count || 0, manejos: results[1].count || 0,
    custos: results[2].count || 0, leite: results[3].count || 0,
    documentos: results[4].count || 0,
    vinculos: family.count || 0,
  };
}

export async function lotRelations(db: SupabaseClient, id: string, farmId: string) {
  const tables = ['pesagens', 'manejos', 'transacoes', 'documentos', 'movimentacoes_estoque'] as const;
  const results = await Promise.all(tables.map(table => db.from(table).select('id', { count: 'exact', head: true }).eq('fazenda_id', farmId).eq('lote_id', id)));
  const animals = await db.from('animais').select('id', { count: 'exact', head: true }).eq('fazenda_id', farmId).eq('lote_id', id);
  if ([...results, animals].some(result => result.error)) throw new Error('Não foi possível conferir os registros associados.');
  return {
    animais: animals.count || 0, pesagens: results[0].count || 0,
    manejos: results[1].count || 0, custos: results[2].count || 0,
    documentos: results[3].count || 0, estoque: results[4].count || 0,
  };
}

export function relatedTotal(values: Record<string, number>, skip: string[] = []) {
  return Object.entries(values).reduce((total, [name, value]) => total + (skip.includes(name) ? 0 : value), 0);
}
