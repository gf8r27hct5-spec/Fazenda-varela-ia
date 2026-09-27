import Link from 'next/link';
import {AppShell,Card,Heading} from '@/components/app-shell';
import {createDairyCalf} from '@/app/actions';
import {farmContext} from '@/lib/farm';
import {hojeNaFazenda} from '@/lib/reproducao';

export const dynamic='force-dynamic';
export default async function NewCalf({searchParams}:{searchParams:Promise<{mae?:string}>}){
  const q=await searchParams,{db,farm}=await farmContext();
  const {data:mothers,error}=await db.from('animais').select('id,identificacao,nome').eq('fazenda_id',farm.id).eq('sistema','leite').neq('categoria','Cria leiteira').eq('status','ativo').order('identificacao');
  if(error)throw new Error('Falha ao carregar vacas leiteiras');
  return <AppShell farm={farm} active="Leite"><Link className="back-link" href="/painel/reproducao">← Reprodução</Link><Heading eyebrow="LEITE · CRIAS" title="Cadastrar cria"/>
    <p className="section-note">Use este cadastro para bezerros já nascidos. Para registrar também o histórico de um parto, abra a ficha da mãe e escolha “Registrar parto”.</p>
    <Card title="Bezerro ou bezerra">{mothers?.length?<form action={createDairyCalf} className="entry-form">
      <label>Mãe *<select name="mae_id" defaultValue={q.mae||''} required><option value="">Selecione a vaca leiteira</option>{mothers.map(m=><option key={m.id} value={m.id}>{m.nome||m.identificacao} · {m.identificacao}</option>)}</select></label>
      <div className="form-grid"><label>Brinco / identificação *<input name="identificacao" required maxLength={80}/></label><label>Nome<input name="nome" maxLength={120}/></label></div>
      <div className="form-grid"><label>Sexo<select name="sexo"><option value="">Não informado</option><option value="femea">Fêmea</option><option value="macho">Macho</option></select></label><label>Raça<input name="raca" maxLength={120}/></label></div>
      <div className="form-grid"><label>Data de nascimento *<input name="data_nascimento" type="date" max={hojeNaFazenda()} required/></label><label>Pai / touro (se conhecido)<input name="pai_touro" maxLength={120}/></label></div>
      <div className="form-grid"><label>Peso ao nascer (kg)<input name="peso_entrada" type="number" min="0.01" step="0.01"/></label><label>Peso atual (kg)<input name="peso_atual" type="number" min="0.01" step="0.01"/></label></div>
      <div className="form-grid"><label>Situação<select name="situacao_cria"><option value="mamando">Mamando</option><option value="desmamada">Desmamada</option><option value="vendida">Vendida</option><option value="transferida">Transferida</option><option value="morta">Morta</option></select></label><label>Data do desmame<input name="data_desmame" type="date"/></label></div>
      <label>Desmame previsto (opcional, para alertas)<input name="data_prevista_desmame" type="date"/></label><label>Foto (opcional)<input type="file" name="foto" accept="image/jpeg,image/png,image/webp,image/heic"/></label><label>Observações<textarea name="observacoes" rows={3}/></label><button type="submit">Salvar cria na atividade leiteira</button>
    </form>:<><p className="section-note">Cadastre a mãe antes de registrar a cria.</p><Link href="/painel/novo/leite" className="module-action">+ Cadastrar vaca leiteira</Link></>}</Card>
  </AppShell>;
}
