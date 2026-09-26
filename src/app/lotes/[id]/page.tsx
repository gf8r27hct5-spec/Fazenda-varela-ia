import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell, Card, Empty, Heading, Stat } from '@/components/app-shell';
import { TrendChart } from '@/components/charts';
import { farmContext, date, money, number, sum } from '@/lib/farm';
import { LotActions } from '@/components/management-actions';
import { lotRelations } from '@/lib/related-records';
import { exitEconomics, healthAlerts, lotWeights, daysBetween, brazilToday } from '@/lib/corte';
import { LotWeighingForm } from '@/components/corte-forms';

export const dynamic = 'force-dynamic';

export default async function Lot({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ acao?: string; erro?: string; salvo?: string }> }) {
  const { id } = await params;
  const search = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db, farm } = await farmContext();
  const [lotResult, animalResult, weightResult, costResult, healthResult, exitResult] = await Promise.all([
    db.from('lotes').select('*').eq('id', id).eq('fazenda_id', farm.id).eq('sistema', 'corte').maybeSingle(),
    db.from('animais').select('*').eq('fazenda_id', farm.id).eq('sistema', 'corte'),
    db.from('pesagens').select('*').eq('fazenda_id', farm.id).eq('lote_id', id).order('data_pesagem'),
    db.from('transacoes').select('tipo,valor,animal_id,origem').eq('fazenda_id', farm.id).eq('lote_id', id),
    db.from('manejos').select('*').eq('fazenda_id', farm.id).eq('lote_id', id).order('data_manejo',{ascending:false}),
    db.from('saidas_corte').select('*').eq('fazenda_id', farm.id).eq('lote_id', id),
  ]);
  if ([lotResult, animalResult, weightResult, costResult, healthResult, exitResult].some(result => result.error)) throw new Error('Falha ao carregar lote');
  const lot = lotResult.data;
  if (!lot) notFound();
  const [availableLots, relations] = await Promise.all([
    db.from('lotes').select('id,nome').eq('fazenda_id', farm.id).eq('sistema', 'corte').eq('ativo', true).then(result => {
      if (result.error) throw new Error('Falha ao carregar lotes.');
      return result.data || [];
    }),
    search.acao === 'excluir' ? lotRelations(db, id, farm.id) : Promise.resolve(null),
  ]);

  const lotAnimals = (animalResult.data || []).filter(animal => animal.lote_id === id);
  const animals = lotAnimals.filter(animal => animal.status === 'ativo');
  const weights = weightResult.data || [];
  const expenses = (costResult.data || []).filter(item => item.tipo === 'despesa');
  const measurements=lotWeights(animals,weights);
  const health=healthAlerts(healthResult.data||[]);
  const exits=exitResult.data||[];
  const closed=exits.map(item=>({item,calc:exitEconomics((animalResult.data||[]).find(a=>a.id===item.animal_id)!,item,(costResult.data||[]).filter(t=>t.animal_id===item.animal_id))}));
  const groupWeights=weights.filter(item=>!item.animal_id).sort((a,b)=>a.data_pesagem.localeCompare(b.data_pesagem));
  const latestGroup=groupWeights.at(-1);
  const useGroup=!!latestGroup && (!measurements.chart.length || latestGroup.data_pesagem>measurements.chart.at(-1)!.day);
  const average=useGroup?Number(latestGroup!.peso_kg):measurements.average;
  const total=useGroup&&animals.length?Number(latestGroup!.peso_kg)*animals.length:measurements.total;
  const history=[...measurements.chart.filter(x=>x.average!=null).map(x=>({day:x.day,average:x.average!})),...groupWeights.map(x=>({day:x.data_pesagem,average:Number(x.peso_kg)}))].sort((a,b)=>a.day.localeCompare(b.day));
  const last=history.at(-1),before=[...history].reverse().find(x=>last&&x.day<last.day);
  const interval=last&&before?daysBetween(before.day,last.day):null;
  const gmd=useGroup&&last&&before&&interval&&interval>0?(last.average-before.average)/interval:measurements.gmd;
  const entered = lot.data_entrada ? daysBetween(lot.data_entrada,brazilToday()) : null;
  const meta = lot.peso_meta == null ? null : Number(lot.peso_meta);
  const toGoal = meta != null && average != null && gmd != null && gmd > 0 ? Math.max(0, Math.ceil((meta - average) / gmd)) : null;
  const purchase = animals.some(animal => animal.valor_compra != null) ? sum(animals, 'valor_compra') : null;
  const costPerHead = expenses.length && animals.length ? sum(expenses, 'valor') / animals.length : null;

  return <AppShell farm={farm} active="Rebanho">
    <Link href="/painel/rebanho" className="back-link">← Rebanho</Link>
    <Heading eyebrow="Detalhe do lote" title={lot.nome} />
    <p className="section-note">{lot.categoria || 'Categoria não informada'} · {animals.length} animais vinculados</p>
    {search.salvo && <p role="status" className="app-notice good">Alteração salva.</p>}
    {search.erro==='pesagem'&&<p role="alert" className="app-notice bad">Falha ao salvar pesagens. Confira pesos positivos e animais que já foram pesados na data.</p>}
    <LotActions lot={lot} lots={availableLots} animals={lotAnimals} relations={relations} action={search.acao} error={search.erro} />
    <div className="stat-grid">
      <Stat label="Animais ativos" value={animals.length} />
      <Stat label="Peso médio registrado" value={average == null ? '—' : `${number(average, 1)} kg`} detail="Pesagens individuais ou do lote" />
      <Stat label="Peso total registrado" value={total == null ? '—' : `${number(total, 1)} kg`} detail={useGroup ? 'Média do lote × animais' : `${measurements.known} animais com peso conhecido`} />
      <Stat label="Compra dos animais" value={money(purchase)} detail="Soma dos valores de compra cadastrados" />
      <Stat label="Meta de peso" value={meta == null ? '—' : `${number(meta, 1)} kg`} />
      <Stat label="GMD" value={gmd == null ? '—' : `${number(gmd, 2)} kg/dia`} detail="Entre pesagens em datas distintas" />
      <Stat label="Pesados nos últimos 30 dias" value={measurements.recent} />
      <Stat label="Sem pesagem recente" value={measurements.stale} />
      <Stat label="Despesas por cabeça" value={money(costPerHead)} detail="Despesas vinculadas / animais" />
      <Stat label="Custo por arroba produzida" value="—" detail="Exige rendimento de carcaça e custos alocados" />
      <Stat label="Dias no sistema" value={entered == null ? '—' : entered} />
      <Stat label="Projeção até a meta" value={toGoal == null ? '—' : `${toGoal} dias`} detail="Se o GMD atual for mantido" />
    </div>
    <Card title="Evolução do peso médio"><TrendChart points={history.slice(-16).map(item => ({ label: date(item.day).slice(0, 5), value: item.average }))} unit="kg" /></Card>
    <Card title="Sanidade do lote"><div className="stat-grid"><Stat label="Próximos reforços" value={health.next.length}/><Stat label="Tratamentos em andamento" value={health.ongoing.length}/><Stat label="Animais em carência" value={new Set(health.withdrawal.map(x=>x.animal_id)).size}/><Stat label="Manejos atrasados" value={health.overdue.length}/></div>{(healthResult.data||[]).slice(0,4).map(item=><div className="data-row" key={item.id}><strong>{item.produto||item.tipo}</strong><span>{date(item.data_manejo)}</span></div>)}<Link className="module-action" href={`/painel/sanidade?lote=${id}`}>+ Registrar vacina ou tratamento</Link></Card>
    <Card title="Fechamento parcial do lote"><div className="stat-grid"><Stat label="Quantidade inicial conhecida" value={lot.quantidade_inicial??lotAnimals.length}/><Stat label="Quantidade atual" value={animals.length}/><Stat label="Vendidos" value={exits.filter(x=>x.tipo==='venda').length}/><Stat label="Abatidos" value={exits.filter(x=>x.tipo==='abate').length}/><Stat label="Perdidos / mortos" value={exits.filter(x=>x.tipo==='morte').length}/><Stat label="Peso médio inicial" value={lotAnimals.some(a=>a.peso_entrada!=null)?`${number(sum(lotAnimals.filter(a=>a.peso_entrada!=null),'peso_entrada')/lotAnimals.filter(a=>a.peso_entrada!=null).length,1)} kg`:'—'}/><Stat label="Peso médio final" value={closed.some(x=>x.calc.final!=null)?`${number(closed.reduce((s,x)=>s+(x.calc.final||0),0)/closed.filter(x=>x.calc.final!=null).length,1)} kg`:'—'}/><Stat label="Ganho médio" value={closed.some(x=>x.calc.gain!=null)?`${number(closed.reduce((s,x)=>s+(x.calc.gain||0),0)/closed.filter(x=>x.calc.gain!=null).length,1)} kg`:'—'}/><Stat label="GMD médio" value={closed.some(x=>x.calc.gmd!=null)?`${number(closed.reduce((s,x)=>s+(x.calc.gmd||0),0)/closed.filter(x=>x.calc.gmd!=null).length,2)} kg/dia`:'—'}/><Stat label="Peso total vendido" value={closed.some(x=>x.item.tipo==='venda'&&x.calc.final!=null)?`${number(closed.filter(x=>x.item.tipo==='venda').reduce((s,x)=>s+(x.calc.final||0),0),1)} kg`:'—'}/><Stat label="Receita de saídas" value={exits.length?money(closed.reduce((s,x)=>s+x.calc.revenue,0)):'—'}/><Stat label="Custo dos encerrados" value={closed.length&&closed.every(x=>x.calc.total!=null)?money(closed.reduce((s,x)=>s+x.calc.total!,0)):'—'}/><Stat label="Lucro / prejuízo" value={closed.length&&closed.every(x=>x.calc.profit!=null)?money(closed.reduce((s,x)=>s+x.calc.profit!,0)):'—'}/><Stat label="Margem" value={closed.length&&closed.every(x=>x.calc.profit!=null)&&closed.reduce((s,x)=>s+x.calc.revenue,0)>0?`${number(closed.reduce((s,x)=>s+x.calc.profit!,0)/closed.reduce((s,x)=>s+x.calc.revenue,0)*100,1)}%`:'—'}/></div><p className="section-note">Somente animais encerrados neste lote. Custos coletivos sem vínculo individual não entram no lucro; valores ausentes ficam vazios.</p></Card>
    <Card title="Projeção econômica"><div className="stat-grid"><Stat label="Custo futuro" value="—" detail="Requer custo diário do lote" /><Stat label="Valor estimado de venda" value="—" detail="Requer preço de venda registrado" /><Stat label="Lucro projetado" value="—" detail="Requer preço e custos futuros" /></div><p className="section-note">As projeções financeiras só aparecerão quando houver dados suficientes para calculá-las.</p></Card>
    <Card title="Animais do lote">{animals.length ? animals.map(animal => <Link className="data-row" key={animal.id} href={`/animais/${animal.id}`}><strong>{animal.nome || animal.identificacao}</strong><span>{animal.identificacao} · {animal.raca || 'Raça não informada'} →</span></Link>) : <Empty title="Nenhum animal vinculado" description="Ao cadastrar um animal, selecione este lote." href="/painel/rebanho" />}</Card>
    <Card title="Registrar pesagem do lote"><div id="pesagem-lote"><LotWeighingForm lot={id} animals={lotAnimals}/></div></Card>
    <Link className="primary-link" href={`/painel/pesagens?lote=${id}`}>Ver todas as pesagens</Link>
  </AppShell>;
}
