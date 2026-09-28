import Link from 'next/link';
import { archiveFarmAnimal, archiveFarmRecord, deleteFarmRecord } from '@/app/actions';
type ManagedTable='transacoes'|'centros_custo'|'pesagens'|'producao_leite'|'manejos'|'estoque'|'animais';
export function RecordActions({table,id,label,active=true}:{table:ManagedTable;id:string;label:string;active?:boolean}){
 const archival=table==='animais'||table==='estoque'||table==='centros_custo';
 const action=table==='animais'?archiveFarmAnimal:archival?archiveFarmRecord:deleteFarmRecord;
 return <details className="record-actions"><summary aria-label={`Ações de ${label}`}>•••</summary><div className="record-actions-panel">
  <strong>{label}</strong><Link href={`/painel/editar/${table}/${id}`}>Editar registro</Link>
  {(!archival||active)&&<><p>{archival?'O cadastro e seu histórico serão preservados.':'Tem certeza que deseja excluir este registro? Esta ação não poderá ser desfeita.'}</p>
   <form action={action} className="record-delete-form"><input type="hidden" name="table" value={table}/><input type="hidden" name="id" value={id}/>
    <label>Digite {archival?'ARQUIVAR':'EXCLUIR'} para confirmar<input name="confirmacao" pattern={archival?'ARQUIVAR':'EXCLUIR'} autoComplete="off" required placeholder={archival?'ARQUIVAR':'EXCLUIR'}/></label>
    <button type="submit" className={archival?'':'danger-button'}>{archival?'Arquivar / Inativar':'Excluir registro'}</button>
   </form></>}
 </div></details>;
}
