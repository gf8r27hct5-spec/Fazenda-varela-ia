import Link from 'next/link';
import { AppShell, Heading } from '@/components/app-shell';
import { farmContext } from '@/lib/farm';
import { getFarmAlertSettings, type AlertSettings } from '@/lib/farm-alerts';
import { saveAlertSettings } from '../actions';
export const dynamic='force-dynamic';
const fields:{key:keyof AlertSettings;label:string;help:string;unit:string;step?:string}[]=[
 {key:'dias_sem_pesagem',label:'Sem pesagem',help:'Dias desde a última pesagem ou entrada.',unit:'dias'},
 {key:'gmd_minimo',label:'GMD mínimo',help:'Requer pelo menos duas pesagens em datas diferentes.',unit:'kg/dia',step:'0.01'},
 {key:'antecedencia_vacina',label:'Reforço sanitário',help:'Avisar antes da data de reforço registrada.',unit:'dias'},
 {key:'antecedencia_parto',label:'Parto previsto',help:'Avisar antes da previsão registrada da vaca.',unit:'dias'},
 {key:'idade_desmame',label:'Idade de desmame',help:'Referência para revisão da cria; não desmama automaticamente.',unit:'dias'},
 {key:'estoque_minimo_padrao',label:'Estoque mínimo padrão',help:'Usado somente quando o item não tem mínimo próprio; na unidade cadastrada do item.',unit:'unidades',step:'0.1'},
 {key:'dias_estoque',label:'Previsão de estoque',help:'Requer consumo médio diário informado no item.',unit:'dias'},
 {key:'queda_producao_pct',label:'Queda da produção',help:'Comparada apenas quando existem registros anteriores suficientes.',unit:'%',step:'0.1'},
 {key:'aumento_despesa_pct',label:'Aumento de despesa',help:'Comparação por categoria ou período com histórico suficiente.',unit:'%',step:'0.1'},
];
export default async function AlertConfiguration({searchParams}:{searchParams:Promise<{erro?:string;salvo?:string}>}){
 const {db,farm}=await farmContext(),[values,flash]=await Promise.all([getFarmAlertSettings(db,farm.id),searchParams]);
 return <AppShell farm={farm} active="Mais"><Link className="text-link" href="/painel/alertas">← Voltar aos alertas</Link><Heading eyebrow="Preferências da propriedade" title="Configurar alertas"/><p className="section-note">Estes limites mudam apenas os avisos. Não alteram pesagens, animais ou outros registros.</p>
 {flash.erro&&<p role="alert" className="app-notice bad">Confira os valores permitidos e tente novamente.</p>}{flash.salvo&&<p role="status" className="app-notice good">Preferências salvas.</p>}
 <form action={saveAlertSettings} className="attention-settings"><div className="attention-settings-grid">{fields.map(f=><label key={f.key}><span>{f.label}</span><small>{f.help}</small><span className="attention-setting-input"><input type="number" name={f.key} defaultValue={values[f.key]} step={f.step||'1'} required/><em>{f.unit}</em></span></label>)}</div><button className="module-action" type="submit">Salvar preferências</button></form>
 </AppShell>;
}
