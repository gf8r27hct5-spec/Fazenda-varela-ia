import Link from 'next/link';
import { archiveCutLot, changeCutAnimalStatus, deleteCutAnimal, deleteCutLot, moveCutAnimal, moveCutLotAnimals, updateCutAnimal, updateCutLot } from '@/app/actions';
import { Icon } from '@/components/icons';
import { Empty } from '@/components/app-shell';
import { relatedTotal } from '@/lib/related-records';

type Entry = Record<string, string | number | boolean | null>;
type Relations = Record<string, number>;
type Option = { id: string; nome: string };

function Feedback({ error }: { error?: string }) {
  return error ? <p role="alert" className="app-notice bad">Não foi possível concluir a operação. Confira os dados e tente novamente.</p> : null;
}
function ConfirmDelete({ entity, id, relations, related, error, action }: { entity: 'animal' | 'lote'; id: string; relations: Relations; related: number; error?: string; action: (form: FormData) => Promise<void> }) {
  const hasAnimals = entity === 'lote' && !!relations.animais;
  return <section className="app-card management-panel" id="acoes">
    <h2>Excluir {entity === 'lote' ? 'lote' : 'cadastro'}</h2>
    <p>Tem certeza que deseja excluir este {entity}? Esta ação não poderá ser desfeita.</p>
    <Feedback error={error} />
    {hasAnimals ? <p className="app-notice bad">Este lote possui {relations.animais} animais vinculados. Mova ou remova todos antes de excluí-lo. A exclusão está bloqueada enquanto houver animais ativos.</p> : <>
      {related > 0 && <div className="linked-warning"><strong>Registros relacionados encontrados</strong><ul>{Object.entries(relations).filter(([key, count]) => key !== 'animais' && count).map(([key, count]) => <li key={key}>{key}: {count}</li>)}</ul><p>A exclusão completa removerá os registros associados. Se quiser manter o histórico, escolha Arquivar/Inativar.</p></div>}
      <form action={action} className="entry-form"><input type="hidden" name="id" value={id} /><input type="hidden" name="registros_esperados" value={related} />
        {related > 0 && <label className="checkbox-row"><input type="checkbox" name="confirmar_relacionados" value="sim" required /> Confirmo também a exclusão de todos os registros relacionados.</label>}
        <label>Para confirmar, digite EXCLUIR<input name="confirmacao" autoComplete="off" required pattern="EXCLUIR" /></label>
        <button type="submit" className="danger-button">Excluir definitivamente</button>
      </form>
    </>}
    <Link href={entity === 'animal' ? `/animais/${id}?acao=status&status=inativo` : `/lotes/${id}?acao=arquivar`} className="text-link">Prefiro arquivar →</Link>
  </section>;
}

export function AnimalActions({ animal, lots, relations, action, status, error }: { animal: Entry; lots: Option[]; relations: Relations | null; action?: string; status?: string; error?: string }) {
  const id = String(animal.id), base = `/animais/${id}`;
  const statuses = [['inativo', 'Arquivar/Inativar'], ['vendido', 'Marcar como vendido'], ['abatido', 'Marcar como abatido'], ['morto', 'Marcar como morto'], ['ativo', 'Reativar']] as const;
  return <><details className="actions-menu"><summary aria-label="Ações do animal"><Icon name="dots" size={22} /> Ações</summary><div className="actions-links">
    <Link href={`${base}?acao=editar#acoes`}>Editar</Link><Link href={`${base}?acao=mover#acoes`}>Mover de lote</Link>
    {statuses.filter(([value]) => value !== animal.status).map(([value, label]) => <Link key={value} href={`${base}?acao=status&status=${value}#acoes`}>{label}</Link>)}
    <Link className="danger-link" href={`${base}?acao=excluir#acoes`}>Excluir cadastro</Link>
  </div></details>
  {action === 'editar' && <section className="app-card management-panel" id="acoes"><h2>Editar animal de corte</h2><Feedback error={error} />
    <form action={updateCutAnimal} className="entry-form"><input type="hidden" name="id" value={id} /><div className="form-grid"><label>Brinco<input name="identificacao" defaultValue={String(animal.identificacao || '')} required /></label><label>Nome<input name="nome" defaultValue={String(animal.nome || '')} /></label></div>
      <div className="form-grid"><label>Categoria<input name="categoria" defaultValue={String(animal.categoria || '')} /></label><label>Raça<input name="raca" defaultValue={String(animal.raca || '')} /></label></div>
      <div className="form-grid"><label>Sexo<select name="sexo" defaultValue={String(animal.sexo || '')}><option value="">Não informado</option><option value="femea">Fêmea</option><option value="macho">Macho</option></select></label><label>Lote<select name="lote_id" defaultValue={String(animal.lote_id || '')}><option value="">Sem lote</option>{lots.map(lot => <option key={lot.id} value={lot.id}>{lot.nome}</option>)}</select></label></div>
      <div className="form-grid"><label>Data de nascimento<input type="date" name="data_nascimento" defaultValue={String(animal.data_nascimento || '')} /></label><label>Data de entrada<input type="date" name="data_entrada" defaultValue={String(animal.data_entrada || '')} /></label></div>
      <div className="form-grid"><label>Peso de entrada (kg)<input type="number" step="0.01" min="0" name="peso_entrada" defaultValue={String(animal.peso_entrada || '')} /></label><label>Peso atual (kg)<input type="number" step="0.01" min="0" name="peso_atual" defaultValue={String(animal.peso_atual || '')} /></label></div>
      <label>Valor de compra (R$)<input type="number" step="0.01" min="0" name="valor_compra" defaultValue={String(animal.valor_compra || '')} /></label><label>Origem<input name="origem" defaultValue={String(animal.origem || '')} /></label><label>Observações<textarea name="observacoes" defaultValue={String(animal.observacoes || '')} /></label><button>Salvar alterações</button>
    </form></section>}
  {action === 'mover' && <section className="app-card management-panel" id="acoes"><h2>Mover de lote</h2><Feedback error={error} /><form action={moveCutAnimal} className="entry-form"><input type="hidden" name="id" value={id} /><label>Destino<select name="lote_id" defaultValue={String(animal.lote_id || '')}><option value="">Sem lote</option>{lots.map(lot => <option key={lot.id} value={lot.id}>{lot.nome}</option>)}</select></label><button>Confirmar mudança</button></form></section>}
  {action === 'status' && statuses.some(([value]) => value === status) && <section className="app-card management-panel" id="acoes"><h2>{statuses.find(([value]) => value === status)?.[1]}</h2><Feedback error={error} /><p>O animal permanecerá no histórico. Animais inativos, vendidos, abatidos ou mortos deixam de contar como ativos.</p><form action={changeCutAnimalStatus} className="entry-form"><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value={status} /><button>Confirmar alteração</button></form></section>}
  {action === 'excluir' && relations && <ConfirmDelete entity="animal" id={id} relations={relations} related={relatedTotal(relations)} error={error} action={deleteCutAnimal} />}
  </>;
}

export function LotActions({ lot, lots, animals, relations, action, error }: { lot: Entry; lots: Option[]; animals: Entry[]; relations: Relations | null; action?: string; error?: string }) {
  const id = String(lot.id), base = `/lotes/${id}`;
  return <><details className="actions-menu"><summary aria-label="Ações do lote"><Icon name="dots" size={22} /> Ações</summary><div className="actions-links">
    <Link href={`${base}?acao=editar#acoes`}>Editar lote</Link><Link href="/painel/novo/corte">Adicionar animais</Link><Link href={`${base}?acao=mover#acoes`}>Mover animais</Link><Link href={`${base}?acao=arquivar#acoes`}>Arquivar lote</Link><Link className="danger-link" href={`${base}?acao=excluir#acoes`}>Excluir lote</Link>
  </div></details>
  {action === 'editar' && <section className="app-card management-panel" id="acoes"><h2>Editar lote</h2><Feedback error={error} /><form action={updateCutLot} className="entry-form"><input type="hidden" name="id" value={id} /><label>Nome<input name="nome" defaultValue={String(lot.nome)} required /></label><div className="form-grid"><label>Categoria<input name="categoria" defaultValue={String(lot.categoria || '')} /></label><label>Raça<input name="raca" defaultValue={String(lot.raca || '')} /></label></div><label>Meta de peso (kg)<input name="peso_meta" type="number" min="0" step="0.01" defaultValue={String(lot.peso_meta || '')} /></label><button>Salvar lote</button></form></section>}
  {action === 'mover' && <section className="app-card management-panel" id="acoes"><h2>Mover animais</h2><Feedback error={error} />{animals.length ? <form action={moveCutLotAnimals} className="entry-form"><input type="hidden" name="id" value={id} /><p>Selecione os animais e o lote de destino.</p><div className="animal-checklist">{animals.map(animal => <label key={String(animal.id)} className="checkbox-row"><input type="checkbox" name="animal_id" value={String(animal.id)} /> {String(animal.identificacao)} {animal.nome ? `· ${animal.nome}` : ''}</label>)}</div><label>Destino<select name="lote_id"><option value="">Sem lote</option>{lots.filter(item => item.id !== id).map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label><button>Mover selecionados</button></form> : <Empty title="Sem animais no lote" description="Adicione um animal antes de mover." />}</section>}
  {action === 'arquivar' && <section className="app-card management-panel" id="acoes"><h2>Arquivar lote</h2><Feedback error={error} /><p>O lote deixará de contar como ativo. Os animais e seus históricos serão preservados.</p><form action={archiveCutLot} className="entry-form"><input type="hidden" name="id" value={id} /><button>Arquivar lote</button></form></section>}
  {action === 'excluir' && relations && <ConfirmDelete entity="lote" id={id} relations={relations} related={relatedTotal(relations, ['animais'])} error={error} action={deleteCutLot} />}
  </>;
}
