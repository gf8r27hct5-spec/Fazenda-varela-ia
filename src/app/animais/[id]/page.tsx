import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { TrendChart } from '@/components/charts';
import { AppShell, Card, Empty, Heading, Stat } from '@/components/app-shell';
import { AnimalActions } from '@/components/management-actions';
import { animalRelations } from '@/lib/related-records';
import { date, farmContext, money, number } from '@/lib/farm';

export const dynamic = 'force-dynamic';

export default async function Animal({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ acao?: string; status?: string; erro?: string; salvo?: string }>;
}) {
  const { id } = await params, search = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db, farm } = await farmContext();
  const [a, w, m, t] = await Promise.all([
    db.from('animais').select('*').eq('id', id).eq('fazenda_id', farm.id).maybeSingle(),
    db.from('pesagens').select('*').eq('animal_id', id).eq('fazenda_id', farm.id).order('data_pesagem', { ascending: false }),
    db.from('producao_leite').select('*').eq('animal_id', id).eq('fazenda_id', farm.id).order('data_producao', { ascending: false }),
    db.from('transacoes').select('*').eq('animal_id', id).eq('fazenda_id', farm.id),
  ]);
  if (a.error || w.error || m.error || t.error) throw new Error('Falha ao carregar a ficha do animal.');
  if (!a.data) notFound();
  const animal = a.data, dairy = animal.sistema === 'leite';
  const weights = w.data || [], latest = weights[0], previous = weights[1];
  const days = latest && previous ? (new Date(latest.data_pesagem).getTime() - new Date(previous.data_pesagem).getTime()) / 86400000 : 0;
  const gmd = latest && previous && days > 0 ? (Number(latest.peso_kg) - Number(previous.peso_kg)) / days : null;
  const [lots, relations] = dairy ? [[], null] : await Promise.all([
    db.from('lotes').select('id,nome').eq('fazenda_id', farm.id).eq('sistema', 'corte').eq('ativo', true).then(result => {
      if (result.error) throw new Error('Falha ao carregar lotes.');
      return result.data || [];
    }),
    search.acao === 'excluir' ? animalRelations(db, id, farm.id) : Promise.resolve(null),
  ]);
  const image = animal.foto_url ? await db.storage.from('fotos-animais').createSignedUrl(animal.foto_url, 3600) : null;

  return <AppShell farm={farm} active={dairy ? 'Leite' : 'Rebanho'}>
    <Link href={dairy ? '/painel/leite' : '/painel/rebanho'} className="back-link">← Voltar</Link>
    <Heading eyebrow="Ficha individual" title={String(animal.nome || animal.identificacao)} />
    <p className="section-note">{animal.identificacao} · {animal.categoria || 'Categoria não informada'} · {animal.status}</p>
    {search.salvo && <p role="status" className="app-notice good">Alteração salva.</p>}
    {!dairy && <AnimalActions animal={animal} lots={lots} relations={relations} action={search.acao} status={search.status} error={search.erro} />}
    {image?.data?.signedUrl && <div className="animal-portrait"><Image src={image.data.signedUrl} alt={`Foto de ${animal.nome || animal.identificacao}`} fill unoptimized sizes="(max-width: 600px) 100vw, 750px" /></div>}
    <div className="stat-grid">
      <Stat label="Peso atual" value={animal.peso_atual || latest ? `${number(Number(animal.peso_atual || latest?.peso_kg), 1)} kg` : '—'} />
      <Stat label="Peso de entrada" value={animal.peso_entrada ? `${number(Number(animal.peso_entrada), 1)} kg` : '—'} />
      <Stat label="GMD" value={gmd != null ? `${number(gmd, 2)} kg/dia` : '—'} />
      <Stat label="Valor de compra" value={money(animal.valor_compra)} />
    </div>
    <Card title="Identificação e manejo"><div className="detail-grid">
      <span>Brinco<strong>{animal.identificacao}</strong></span><span>Raça<strong>{animal.raca || 'Não informada'}</strong></span>
      <span>Sexo<strong>{animal.sexo === 'femea' ? 'Fêmea' : animal.sexo === 'macho' ? 'Macho' : 'Não informado'}</strong></span>
      <span>Data de entrada<strong>{animal.data_entrada ? date(animal.data_entrada) : 'Não informada'}</strong></span>
      <span>Lote<strong>{animal.lote_id ? lots.find(lot => lot.id === animal.lote_id)?.nome || 'Lote cadastrado' : 'Sem lote'}</strong></span>
      <span>Origem<strong>{animal.origem || 'Não informada'}</strong></span><span>Situação<strong>{animal.status}</strong></span>
    </div>{animal.observacoes && <p className="section-note">{animal.observacoes}</p>}</Card>
    {dairy ? <Card title="Produção individual"><TrendChart points={[...(m.data || [])].reverse().map(item => ({ label: date(item.data_producao).slice(0, 5), value: Number(item.litros) }))} unit="L" />
      {m.data?.length ? m.data.map(item => <div className="data-row" key={item.id}><strong>{number(Number(item.litros), 1)} litros</strong><span>{date(item.data_producao)} · {item.turno || '—'}</span></div>) : <Empty title="Sem produção individual" description="Registre uma produção vinculada a esta vaca." />}</Card>
      : <Card title="Histórico de pesagens"><TrendChart points={[...weights].reverse().map(item => ({ label: date(item.data_pesagem).slice(0, 5), value: Number(item.peso_kg) }))} unit="kg" />
        {weights.length ? weights.map(item => <div className="data-row" key={item.id}><strong>{number(Number(item.peso_kg), 1)} kg</strong><span>{date(item.data_pesagem)}</span></div>) : <Empty title="Sem pesagens" description="Registre o primeiro peso deste animal." />}</Card>}
    <Card title="Custos associados">{t.data?.length ? t.data.map(item => <div className="data-row" key={item.id}><strong>{item.descricao}</strong><span>{money(Number(item.valor))}</span></div>) : <Empty title="Sem custos vinculados" description="Lançamentos associados ao animal aparecerão aqui." />}</Card>
  </AppShell>;
}
