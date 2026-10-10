'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { farmContext } from '@/lib/farm';
import { ALERT_SETTING_LIMITS, DEFAULT_ALERT_SETTINGS, type AlertSettings } from '@/lib/farm-alerts';

export async function saveAlertSettings(form:FormData) {
 const {db,farm}=await farmContext();
 const values={} as AlertSettings;
 for(const key of Object.keys(DEFAULT_ALERT_SETTINGS) as (keyof AlertSettings)[]){
  const raw=String(form.get(key)??'').trim().replace(',','.');const numeric=Number(raw),[min,max]=ALERT_SETTING_LIMITS[key];
  if(!raw||!Number.isFinite(numeric)||numeric<min||numeric>max||key!=='gmd_minimo'&&key!=='estoque_minimo_padrao'&&key!=='queda_producao_pct'&&key!=='aumento_despesa_pct'&&!Number.isInteger(numeric))redirect('/painel/alertas/configuracoes?erro=limites');
  values[key]=numeric;
 }
 const {error}=await db.from('configuracoes_alertas').upsert({fazenda_id:farm.id,...values,atualizado_em:new Date().toISOString()},{onConflict:'fazenda_id'});
 if(error)redirect('/painel/alertas/configuracoes?erro=salvar');
 revalidatePath('/painel');revalidatePath('/painel/alertas');revalidatePath('/painel/alertas/configuracoes');
 redirect('/painel/alertas/configuracoes?salvo=1');
}
