'use client'
import {useCallback,useEffect,useState} from 'react'
import {supabase} from '@/app/lib/supabaseClient'

type Horse={id:string;name:string}
type Case={id:string;horse_id:string;title:string;status:'open'|'monitoring'|'closed';veterinarian:string|null;diagnosis:string|null;treatment_plan:string|null;next_check_on:string|null;opened_at:string}
type Props={horses:Horse[]}
export default function VetCasesPanel({horses}:Props){
 const [cases,setCases]=useState<Case[]>([])
 const [horseId,setHorseId]=useState('')
 const [title,setTitle]=useState('')
 const [veterinarian,setVeterinarian]=useState('')
 const [diagnosis,setDiagnosis]=useState('')
 const [plan,setPlan]=useState('')
 const [checkOn,setCheckOn]=useState('')
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [message,setMessage]=useState('')
 const [filter,setFilter]=useState<'open'|'all'>('open')
 const reload=useCallback(async()=>{
  const {data,error}=await supabase.from('optimus_vet_cases')
   .select('id,horse_id,title,status,veterinarian,diagnosis,treatment_plan,next_check_on,opened_at')
   .order('opened_at',{ascending:false}).limit(100)
  if(error)throw error
  setCases((data||[]) as Case[])
 },[])
 useEffect(()=>{void reload().catch(e=>setError(e instanceof Error?e.message:String(e)))},[reload])
 async function guard(){
  const {data:profile,error}=await supabase.rpc('optimus_task_my_profile')
  if(error||!profile?.active||profile.role!=='admin')throw new Error('Een beheerdersaccount is vereist.')
 }
 async function create(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy||!horseId||!title.trim())return
  setBusy(true);setError('');setMessage('')
  try{
   await guard()
   const {error}=await supabase.from('optimus_vet_cases').insert({
    horse_id:horseId,title:title.trim(),status:'open',
    veterinarian:veterinarian.trim()||null,diagnosis:diagnosis.trim()||null,
    treatment_plan:plan.trim()||null,next_check_on:checkOn||null
   })
   if(error)throw error
   setTitle('');setDiagnosis('');setPlan('');setCheckOn('')
   await reload();setMessage('Dossier aangemaakt.')
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setBusy(false)}
 }
 async function changeStatus(id:string,status:Case['status']){
  if(busy)return
  setBusy(true);setError('');setMessage('')
  try{
   await guard()
   const {error}=await supabase.from('optimus_vet_cases').update({status}).eq('id',id)
   if(error)throw error
   await reload()
   setMessage(status==='closed'?'Dossier afgesloten.':'Dossier bijgewerkt.')
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setBusy(false)}
 }
 const byName=new Map(horses.map(h=>[h.id,h.name]))
 const shown=cases.filter(c=>filter==='all'||c.status!=='closed')
 return <section className="care-cases" aria-label="Veterinaire dossiers">
   <div className="care-cases-head"><div><span>VETERINAIRE OPVOLGING</span><h2>Medische dossiers</h2><p>Behandelingen en controles opvolgen, zonder de historische dossiers te overschrijven.</p></div></div>
   {error?<p role="alert" className="care-alert">{error}</p>:null}{message?<p role="status" className="care-success">{message}</p>:null}
   <div className="care-layout">
    <form className="care-card" onSubmit={e=>void create(e)}>
     <h2>Nieuw dossier</h2>
     <label>Paard<select required value={horseId} onChange={e=>setHorseId(e.target.value)}><option value="">Kies een paard</option>{horses.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select></label>
     <label>Onderwerp<input required value={title} onChange={e=>setTitle(e.target.value)} placeholder="Bijv. kreupelheid, koliek…"/></label>
     <label>Dierenarts<input value={veterinarian} onChange={e=>setVeterinarian(e.target.value)}/></label>
     <label>Diagnose / bevindingen<textarea rows={2} value={diagnosis} onChange={e=>setDiagnosis(e.target.value)}/></label>
     <label>Behandelplan<textarea rows={2} value={plan} onChange={e=>setPlan(e.target.value)}/></label>
     <label>Volgende controle<input type="date" value={checkOn} onChange={e=>setCheckOn(e.target.value)}/></label>
     <button type="submit" disabled={busy||!horseId||!title.trim()}>{busy?'Opslaan…':'Dossier aanmaken'}</button>
    </form>
    <div className="care-card"><div className="care-case-filter"><h2>Dossiers</h2><select aria-label="Filter dossiers" value={filter} onChange={e=>setFilter(e.target.value as 'open'|'all')}><option value="open">Openstaande</option><option value="all">Alle dossiers</option></select></div>
     <div className="care-events">{shown.length===0?<p>Geen dossiers voor deze selectie.</p>:shown.map(c=><article key={c.id}>
      <div><strong>{byName.get(c.horse_id)||'Paard'}</strong><span>{c.status==='open'?'Open':c.status==='monitoring'?'Opvolgen':'Afgesloten'}</span></div>
      <p><strong>{c.title}</strong></p>
      {c.veterinarian?<small>Dierenarts: {c.veterinarian}</small>:null}
      {c.diagnosis?<small>Bevindingen: {c.diagnosis}</small>:null}
      {c.treatment_plan?<small>Behandeling: {c.treatment_plan}</small>:null}
      {c.next_check_on?<small>Controle: {c.next_check_on}</small>:null}
      {c.status!=='closed'?<div className="care-case-actions">{c.status!=='monitoring'?<button disabled={busy} onClick={()=>void changeStatus(c.id,'monitoring')} type="button">Opvolgen</button>:null}<button disabled={busy} onClick={()=>void changeStatus(c.id,'closed')} type="button">Afsluiten</button></div>:null}
     </article>)}</div>
    </div>
   </div>
 </section>
}
