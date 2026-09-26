import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell, Card, Empty, Heading, Stat } from '@/components/app-shell';
import { TrendChart } from '@/components/charts';
import { farmContext, date, money, number, sum } from '@/lib/farm';

export const dynamic = 'force-dynamic';

export default async function Lot({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db, farm } = await farmContext();
  const [lotResult, animalResult, weightResult, costResult] = await Promise.all([
    db.from('lotes').select('*').eq('id', id).eq('fazenda_id', farm.id).eq('sistema', 'corte').maybeSingle(),
    db.from('animais').select('*').eq('fazenda_id', farm.id).eq('lote_id', id),
    db.from('pesagens').select('*').eq('fazenda_id', farm.id).eq('lote_id', id).order('data_pesagem'),
    db.from('transacoes').select('tipo,valor').eq('fazenda_id', farm.id).eq('lote_id', id),
  ]);
  if ([lotResult, animalResult, weightResult, costResult].some(result => result.error)) throw new Error('Falha ao carregar lote');
  const lot = lotResult.data;
  if (!lot) notFound();

  const animals = (animalResult.data || []).filter(animal => animal.status === 'ativo');
  const weights = weightResult.data || [];
  const expenses = (costResult.data || []).filter(item => item.tipo === 'despesa');
  const activeIds = new Set(animals.map(animal => animal.id));
  const individual = weights.filter(item => item.animal_id && activeIds.has(item.animal_id));
  const byDay = new Map<string, { total: number; count: number }>();
  for (const weight of individual) {
    const previous = byDay.get(weight.data_pesagem) || { total: 0, count: 0 };
    byDay.set(weight.data_pesagem, { total: previous.total + Number(weight.peso_kg), count: previous.count + 1 });
  }
  const dailyAverages = [...byDay].sort(([a], [b]) => a.localeCompare(b)).map(([day, values]) => ({ day, average: values.total / values.count }));
  const groupWeights = weights.filter(item => !item.animal_id);
  const latestGroup = groupWeights.at(-1);
  const latestByAnimal = new Map<string, number>();
  for (const weight of individual) latestByAnimal.set(weight.animal_id!, Number(weight.peso_kg));
  const allIndividuallyWeighed = animals.length > 0 && latestByAnimal.size === animals.length;
  const individualTotal = allIndividuallyWeighed ? [...latestByAnimal.values()].reduce((total, kg) => total + kg, 0) : null;
  const latestIndividualDay = dailyAverages.at(-1)?.day;
  const useGroup = !!latestGroup && (!latestIndividualDay || latestGroup.data_pesagem > latestIndividualDay);
  const average = useGroup ? Number(latestGroup!.peso_kg) : individualTotal != null ? individualTotal / animals.length : dailyAverages.at(-1)?.average ?? null;
  const total = useGroup && animals.length ? Number(latestGroup!.peso_kg) * animals.length : individualTotal;
  const history = [...dailyAverages, ...groupWeights.map(item => ({ day: item.data_pesagem, average: Number(item.peso_kg) }))].sort((a, b) => a.day.localeCompare(b.day));
  const last = history.at(-1), before = history.at(-2);
  const daysBetween = last && before ? (new Date(last.day).getTime() - new Date(before.day).getTime()) / 86400000 : 0;
  const gmd = last && before && daysBetween > 0 ? (last.average - before.average) / daysBetween : null;
  const entered = lot.data_entrada ? Math.max(0, Math.floor((Date.now() - new Date(`${lot.data_entrada}T12:00:00`).getTime()) / 86400000)) : null;
  const meta = lot.peso_meta == null ? null : Number(lot.peso_meta);
  const toGoal = meta != null && average != null && gmd != null && gmd > 0 ? Math.max(0, Math.ceil((meta - average) / gmd)) : null;
  const purchase = animals.some(animal => animal.valor_compra != null) ? sum(animals, 'valor_compra') : null;
  const costPerHead = expenses.length && animals.length ? sum(expenses, 'valor') / animals.length : null;

  return <AppShell farm={farm} active="Rebanho">
    <Link href="/painel/rebanho" className="back-link">← Rebanho</Link>
    <Heading eyebrow="Detalhe do lote" title={lot.nome} />
    <p className="section-note">{lot.categoria || 'Categoria não informada'} · {animals.length} animais vinculados</p>
    <div className="stat-grid">
      <Stat label="Animais ativos" value={animals.length} />
      <Stat label="Peso médio registrado" value={average == null ? '—' : `${number(average, 1)} kg`} detail="Pesagens individuais ou do lote" />
      <Stat label="Peso total registrado" value={total == null ? '—' : `${number(total, 1)} kg`} detail={useGroup ? 'Peso médio do lote × animais' : 'Soma da última pesagem de cada animal'} />
      <Stat label="Compra dos animais" value={money(purchase)} detail="Soma dos valores de compra cadastrados" />
      <Stat label="Meta de peso" value={meta == null ? '—' : `${number(meta, 1)} kg`} />
      <Stat label="GMD" value={gmd == null ? '—' : `${number(gmd, 2)} kg/dia`} detail="Entre pesagens em datas distintas" />
      <Stat label="Despesas por cabeça" value={money(costPerHead)} detail="Despesas vinculadas / animais" />
      <Stat label="Custo por arroba produzida" value={gmd != null && daysBetween > 0 && animals.length && expenses.length && gmd > 0 ? money(sum(expenses, 'valor') / ((last!.average - before!.average) * animals.length / 15)) : '—'} detail="Somente com ganho e despesas medidos" />
      <Stat label="Dias no sistema" value={entered == null ? '—' : entered} />
      <Stat label="Projeção até a meta" value={toGoal == null ? '—' : `${toGoal} dias`} detail="Se o GMD atual for mantido" />
    </div>
    <Card title="Evolução do peso médio"><TrendChart points={history.slice(-16).map(item => ({ label: date(item.day).slice(0, 5), value: item.average }))} unit="kg" /></Card>
    <Card title="Projeção econômica"><div className="stat-grid"><Stat label="Custo futuro" value="—" detail="Requer custo diário do lote" /><Stat label="Valor estimado de venda" value="—" detail="Requer preço de venda registrado" /><Stat label="Lucro projetado" value="—" detail="Requer preço e custos futuros" /></div><p className="section-note">As projeções financeiras só aparecerão quando houver dados suficientes para calculá-las.</p></Card>
    <Card title="Animais do lote">{animals.length ? animals.map(animal => <Link className="data-row" key={animal.id} href={`/animais/${animal.id}`}><strong>{animal.nome || animal.identificacao}</strong><span>{animal.identificacao} · {animal.raca || 'Raça não informada'} →</span></Link>) : <Empty title="Nenhum animal vinculado" description="Ao cadastrar um animal, selecione este lote." href="/painel/rebanho" />}</Card>
    <Link className="primary-link" href="/painel/novo/pesagem">+ Registrar pesagem</Link>
  </AppShell>;
}
