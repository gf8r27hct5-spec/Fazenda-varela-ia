import Link from 'next/link';
import {notFound} from 'next/navigation';
import {editDairyAnimal,editFarmRecord} from '@/app/actions';
import {AppShell,Heading} from '@/components/app-shell';
import {farmContext} from '@/lib/farm';

export const dynamic='force-dynamic';
const fields:Record<string,{name:string;label:string;type?:string;required?:boolean}[]>={
 transacoes:[{name:'descricao',label:'Descrição',required:true},{name:'categoria',label:'Categoria',required:true},{name:'valor',label:'Valor (R$)',type:'number',required:true},{name:'data_competencia',label:'Data',type:'date',required:true},{name:'status',label:'Situação',type:'status'}],
 centros_custo:[{name:'nome',label:'Nome',required:true},{name:'descricao',label:'Descrição'},{name:'ativo',label:'Situação',type:'active'}],
 pesagens:[{name:'peso_kg',label:'Peso (kg)',type:'number',required:true},{name:'data_pesagem',label:'Data',type:'date',required:true},{name:'responsavel',label:'Responsável'},{name:'observacoes',label:'Observações'}],
 producao_leite:[{name:'litros',label:'Litros',type:'number',required:true},{name:'data_producao',label:'Data',type:'date',required:true},{name:'turno',label:'Turno',type:'turno'},{name:'preco_litro',label:'Preço por litro (R$)',type:'number'},{name:'observacoes',label:'Observações'}],
 manejos:[{name:'produto',label:'Vacina, medicamento ou manejo',required:true},{name:'data_manejo',label:'Data',type:'date',required:true},{name:'dose',label:'Dose'},{name:'proxima_data',label:'Próximo reforço',type:'date'},{name:'data_fim_carencia',label:'Fim da carência',type:'date'},{name:'responsavel',label:'Responsável'},{name:'observacoes',label:'Observações'}],
 estoque:[{name:'nome',label:'Nome',required:true},{name:'categoria',label:'Categoria'},{name:'unidade',label:'Unidade',required:true},{name:'quantidade_atual',label:'Quantidade atual',type:'number',required:true},{name:'estoque_minimo',label:'Estoque mínimo',type:'number'},{name:'consumo_medio_dia',label:'Consumo médio por dia',type:'number'},{name:'ativo',label:'Situação',type:'active'}],
 animais:[{name:'identificacao',label:'Brinco / identificação',required:true},{name:'nome',label:'Nome'},{name:'raca',label:'Raça'},{name:'peso_atual',label:'Peso atual (kg)',type:'number'},{name:'status',label:'Situação',type:'statusAnimal'},{name:'observacoes',label:'Observações'}]
};
const destinations:Record<string,string>={transacoes:'financeiro',centros_custo:'financeiro',pesagens:'pesagens',producao_leite:'leite',manejos:'sanidade',estoque:'estoque',animais:'leite'};
export default async function EditRecord({params,searchParams}:{params:Promise<{tipo:string;id:string}>;searchParams:Promise<{erro?:string}>}){
 const {tipo,id}=await params,{erro}=await searchParams;if(!fields[tipo]||!/^[a-f\d-]{36}$/i.test(id))notFound();
 const {db,farm}=await farmContext(),{data:row,error}=await db.from(tipo).select('*').eq('id',id).eq('fazenda_id',farm.id).maybeSingle();
 if(error||!row||tipo==='transacoes'&&row.origem==='saida')notFound();
 if(tipo==='animais'&&row.sistema==='corte')return <AppShell farm={farm} active="Rebanho"><Link className="back-link" href={`/animais/${id}?acao=editar#acoes`}>Editar animal de corte na ficha →</Link></AppShell>;
 const back=`/painel/${destinations[tipo]}`;
 return <AppShell farm={farm} active={tipo==='producao_leite'||tipo==='animais'?'Leite':tipo==='transacoes'||tipo==='centros_custo'?'Financeiro':'Mais'}><Link className="back-link" href={back}>← Voltar</Link><Heading eyebrow="Correção de cadastro" title="Editar registro"/>
 {erro&&<p role="alert" className="app-notice bad">Não foi possível salvar. Confira os campos e tente novamente.</p>}
 <section className="app-card"><form action={tipo==='animais'?editDairyAnimal:editFarmRecord} className="entry-form"><input type="hidden" name="table" value={tipo}/><input type="hidden" name="id" value={id}/>
 {fields[tipo].map(f=><label key={f.name}>{f.label}{f.type==='status'?<select name={f.name} defaultValue={String(row[f.name]||'pago')}><option value="pago">Pago / recebido</option><option value="pendente">Pendente</option></select>:f.type==='active'?<select name={f.name} defaultValue={row.ativo?'sim':'nao'}><option value="sim">Ativo</option><option value="nao">Arquivado</option></select>:f.type==='statusAnimal'?<select name={f.name} defaultValue={String(row[f.name]||'ativo')}><option value="ativo">Ativo</option><option value="inativo">Inativo</option></select>:f.type==='turno'?<select name={f.name} defaultValue={String(row[f.name]||'')}><option value="">Não informado</option><option value="manha">Manhã</option><option value="tarde">Tarde</option><option value="noite">Noite</option><option value="total_dia">Total do dia</option></select>:<input name={f.name} type={f.type||'text'} step={f.type==='number'?'0.01':undefined} min={f.type==='number'?'0':undefined} required={f.required} defaultValue={String(row[f.name]??'')}/>}</label>)}
 <button type="submit">Salvar alterações</button></form></section></AppShell>;
}
