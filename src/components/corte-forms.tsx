import { createExitRecord, createLotBatchWeighing, createSanitaryRecord } from '@/app/actions';
import { brazilToday } from '@/lib/corte';
import Link from 'next/link';
type Option={id:string;identificacao:string;nome?:string|null;lote_id?:string|null;status?:string};
export function LotWeighingForm({lot,animals}:{lot:string;animals:Option[]}) {
 return <form action={createLotBatchWeighing} className="entry-form"><input type="hidden" name="lote_id" value={lot}/>
  <div className="form-grid"><label>Data da pesagem<input name="data_pesagem" type="date" defaultValue={brazilToday()} required/></label><label>Responsável (opcional)<input name="responsavel"/></label></div>
  <p className="section-note">Preencha somente os animais pesados. Cada peso será salvo na ficha individual.</p>
  <div className="batch-weights">{animals.filter(a=>a.status==='ativo').map(a=><label key={a.id}>{a.identificacao}{a.nome?` · ${a.nome}`:''}<input type="number" min="0.01" step="0.01" inputMode="decimal" name={`peso_${a.id}`} placeholder="kg"/></label>)}</div>
  <label>Observações (opcional)<textarea name="observacoes" rows={2}/></label><button>Salvar pesagens individuais</button>
 </form>;
}
export function SanitaryForm({lots,animals,selectedLot,selectedAnimal}:{lots:{id:string;nome:string}[];animals:Option[];selectedLot?:string;selectedAnimal?:string}) {
 const lot=selectedLot||animals.find(a=>a.id===selectedAnimal)?.lote_id||lots[0]?.id;
 return <div><nav className="filter-pills" aria-label="Escolher lote">{lots.map(l=><Link key={l.id} aria-current={lot===l.id?'page':undefined} href={`/painel/sanidade?lote=${l.id}`}>{l.nome}</Link>)}</nav><form action={createSanitaryRecord} className="entry-form"><input name="lote_id" type="hidden" value={lot}/>
  <p className="section-note">Selecione um ou vários animais do lote para criar um registro em cada ficha.</p>
  <div className="animal-checklist">{animals.filter(a=>a.lote_id===lot&&a.status==='ativo').map(a=><label className="checkbox-row" key={a.id}><input type="checkbox" name="animal_id" value={a.id} defaultChecked={a.id===selectedAnimal}/> {a.identificacao}{a.nome?` · ${a.nome}`:''}</label>)}</div>
  <div className="form-grid"><label>Tipo<select name="tipo"><option value="vacina">Vacina</option><option value="medicamento">Medicamento/tratamento</option><option value="vermifugo">Vermífugo</option><option value="antiparasitario">Antiparasitário</option><option value="vitamina">Vitaminas</option><option value="exame">Exame</option><option value="diagnostico">Diagnóstico</option><option value="procedimento">Procedimento</option><option value="outro">Outro manejo</option></select></label><label>Produto / procedimento<input name="produto" required/></label></div>
  <div className="form-grid"><label>Data da aplicação / início<input name="data_manejo" type="date" defaultValue={brazilToday()} required/></label><label>Próxima dose / reforço<input name="proxima_data" type="date"/></label></div>
  <div className="form-grid"><label>Dose<input name="dose"/></label><label>Unidade da dose<input name="dose_unidade" placeholder="mL, mg..."/></label></div>
  <div className="form-grid"><label>Via de aplicação<input name="via_aplicacao"/></label><label>Lote do produto<input name="lote_produto"/></label></div>
  <div className="form-grid"><label>Motivo do tratamento<input name="motivo"/></label><label>Frequência<input name="frequencia" placeholder="A cada 24 h"/></label></div>
  <div className="form-grid"><label>Duração (dias)<input name="duracao_dias" type="number" min="0"/></label><label>Data final do tratamento<input name="data_fim" type="date"/></label></div>
  <div className="form-grid"><label>Carência (dias)<input name="carencia_dias" type="number" min="0"/></label><label>Data final da carência<input name="data_fim_carencia" type="date"/></label></div>
  <label>Responsável<input name="responsavel"/></label><label>Observações<textarea name="observacoes" rows={2}/></label><button>Registrar para animais selecionados</button>
 </form></div>;
}
export function ExitForm({animal,kind}:{animal:string;kind?:string}) {
 return <form action={createExitRecord} className="entry-form"><input name="animal_id" value={animal} type="hidden"/>
  <div className="form-grid"><label>Tipo de saída<select name="tipo" defaultValue={['venda','abate','morte','transferencia','descarte'].includes(kind||'')?kind:'venda'}><option value="venda">Venda</option><option value="abate">Abate</option><option value="morte">Morte</option><option value="transferencia">Transferência</option><option value="descarte">Descarte</option></select></label><label>Data da saída<input type="date" name="data_saida" defaultValue={brazilToday()} required/></label></div>
  <div className="form-grid"><label>Peso final (kg)<input name="peso_final" type="number" min="0.01" step="0.01" inputMode="decimal"/></label><label>Rendimento de carcaça (%) se conhecido<input name="rendimento_carcaca" type="number" min="0.01" max="100" step="0.01"/></label></div>
  <div className="form-grid"><label>Valor de venda total (R$)<input name="valor_venda" type="number" min="0" step="0.01" defaultValue="0" required/></label><label>Comprador / destino<input name="comprador_destino"/></label></div>
  <div className="form-grid"><label>Frete (R$)<input name="frete" type="number" min="0" step="0.01" defaultValue="0"/></label><label>Outras despesas (R$)<input name="outras_despesas" type="number" min="0" step="0.01" defaultValue="0"/></label></div>
  <label>Observações<textarea name="observacoes" rows={2}/></label>
  <p className="section-note">Valor por kg e por arroba serão calculados depois do registro. A arroba exige rendimento de carcaça informado. Para morte, o valor pode ser zero. O histórico do animal será preservado.</p>
  <label className="checkbox-row"><input type="checkbox" required/> Confirmo a saída deste animal. Ele deixará de contar como ativo.</label>
  <label>Digite ENCERRAR para confirmar<input name="confirmacao" pattern="ENCERRAR" autoComplete="off" required/></label><button>Registrar saída e fechar animal</button>
 </form>;
}
