export function hojeNaFazenda() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function diasEntre(inicio: string, fim: string) {
  const a = Date.parse(`${inicio.slice(0, 10)}T12:00:00Z`);
  const b = Date.parse(`${fim.slice(0, 10)}T12:00:00Z`);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b-a)/86400000) : null;
}

export function idadeEmMeses(nascimento: string, hoje = hojeNaFazenda()) {
  if (!/^\d{4}-\d\d-\d\d$/.test(nascimento)) return null;
  const [a,m,d] = nascimento.split('-').map(Number);
  const [b,n,e] = hoje.split('-').map(Number);
  return Math.max(0, (b-a)*12+n-m-(e<d?1:0));
}

export function idadeLegivel(nascimento: string, hoje = hojeNaFazenda()) {
  const meses = idadeEmMeses(nascimento, hoje);
  if (meses === null) return 'Idade não informada';
  if (meses < 1) return `${Math.max(0,diasEntre(nascimento, hoje) || 0)} dias`;
  return meses >= 12 ? `${Math.floor(meses/12)} a ${meses%12} m` : `${meses} meses`;
}
