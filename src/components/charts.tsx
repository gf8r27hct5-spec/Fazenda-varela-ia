import { Empty } from './app-shell';

type Month = { label: string; income: number; expense: number };

export function MonthlyChart({ months }: { months: Month[] }) {
  if (!months.some(month => month.income || month.expense)) {
    return <Empty title="A história começa aqui" description="Ao registrar receitas e despesas, o movimento financeiro aparece neste gráfico." />;
  }
  const max = Math.max(1, ...months.flatMap(month => [month.income, month.expense]));
  const upper = Math.ceil(max / Math.pow(10, Math.floor(Math.log10(max)))) * Math.pow(10, Math.floor(Math.log10(max)));
  const ticks = [upper, upper / 2, 0];
  return <div className="finance-chart">
    <div className="chart-legend"><span><i className="legend-income" />Receitas</span><span><i className="legend-expense" />Despesas</span></div>
    <div className="finance-plot" role="img" aria-label={months.map(month => `${month.label}: receitas ${month.income}, despesas ${month.expense} reais`).join('; ')}>
      <div className="finance-axis">{ticks.map(tick => <span key={tick}>{tick >= 1000 ? `${Number((tick / 1000).toFixed(1))} mil` : tick.toLocaleString('pt-BR')}</span>)}</div>
      <div className="finance-bars">{months.map((month, index) => <div className="finance-month" key={index}>
        <div className="finance-pair"><span className="finance-bar income-bar" style={{ height: `${month.income / upper * 100}%` }} title={`Receitas: R$ ${month.income.toLocaleString('pt-BR')}`} /><span className="finance-bar expense-bar" style={{ height: `${month.expense / upper * 100}%` }} title={`Despesas: R$ ${month.expense.toLocaleString('pt-BR')}`} /></div>
        <small>{month.label}</small>
      </div>)}</div>
    </div>
  </div>;
}

export function TrendChart({ points, unit = '' }: { points: { label: string; value: number }[]; unit?: string }) {
  if (!points.length) return <Empty title="Sua evolução vai aparecer aqui" description="Os registros de cada período formam este gráfico automaticamente." />;
  const values = points.slice(-20);
  const minimum = Math.min(...values.map(point => point.value));
  const maximum = Math.max(...values.map(point => point.value));
  const padding = Math.max((maximum - minimum) * .2, maximum * .04, 1);
  const low = Math.max(0, minimum - padding);
  const high = maximum + padding;
  const coords = values.map((point, index) => ({
    x: values.length === 1 ? 180 : 24 + index / (values.length - 1) * 312,
    y: 158 - (point.value - low) / (high - low) * 126,
  }));
  const path = coords.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const final = coords.at(-1)!;
  return <div className="trend-chart" role="img" aria-label={values.map(point => `${point.label}: ${point.value} ${unit}`).join('; ')}>
    <svg viewBox="0 0 360 182" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="chart-area" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#238965" stopOpacity=".25" /><stop offset="1" stopColor="#238965" stopOpacity="0" /></linearGradient></defs>
      {[30, 94, 158].map(y => <line key={y} x1="24" x2="336" y1={y} y2={y} stroke="#e9eee8" strokeWidth="1" strokeDasharray="3 5" />)}
      <path d={`${path} L${final.x} 170 L${coords[0].x} 170 Z`} fill="url(#chart-area)" />
      <path d={path} fill="none" stroke="#087253" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {coords.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r={index === coords.length - 1 ? 5 : 3} fill="#087253" stroke="white" strokeWidth="2" vectorEffect="non-scaling-stroke" />)}
    </svg>
    <div className="trend-labels"><span>{values[0].label}</span><strong>{values.at(-1)?.value.toLocaleString('pt-BR')} {unit}</strong><span>{values.at(-1)?.label}</span></div>
  </div>;
}

export function CategoryChart({ items }: { items: [string, number][] }) {
  if (!items.length) return <Empty title="Categorias ainda vazias" description="As despesas registradas mostrarão como os custos se distribuem." />;
  const palette = ['#086647', '#8ba559', '#e1aa76', '#7aabc1', '#c47a6b', '#a794b8'];
  const total = items.reduce((value, item) => value + item[1], 0);
  let offset = 0;
  const segments = items.map(([, value], index) => {
    const from = offset; offset += value / total * 100;
    return `${palette[index % palette.length]} ${from}% ${offset}%`;
  }).join(', ');
  return <div className="category-chart"><div className="donut" style={{ background: `conic-gradient(${segments})` }}><div><small>DESPESAS</small><strong>{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}</strong></div></div><div className="category-list">{items.map(([name, value], index) => <div key={name}><i style={{ background: palette[index % palette.length] }} /><span>{name}</span><b>{Math.round(value / total * 100)}%</b></div>)}</div></div>;
}
