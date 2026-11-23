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
 const [editingCaseId,setEditingCaseId]=useState<string|null>(null)
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
  if(error||!profile?.active||profile.role!=='admin')throw new Error('Administrator access is required.')
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
   setTitle('');setVeterinarian('');setDiagnosis('');setPlan('');setCheckOn('')
   await reload();setMessage('Case created.')
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
   setMessage(status==='closed'?'Case closed.':'Case updated.')
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setBusy(false)}
 }
 async function updateCase(e:React.FormEvent<HTMLFormElement>,item:Case){
  e.preventDefault();if(busy)return
  const form=new FormData(e.currentTarget)
  setBusy(true);setError('');setMessage('')
  try{
   await guard()
   const {error}=await supabase.from('optimus_vet_cases').update({
    title:String(form.get('title')||'').trim(),
    veterinarian:String(form.get('veterinarian')||'').trim()||null,
    diagnosis:String(form.get('diagnosis')||'').trim()||null,
    treatment_plan:String(form.get('treatment_plan')||'').trim()||null,
    next_check_on:String(form.get('next_check_on')||'')||null,
   }).eq('id',item.id)
   if(error)throw error
   await reload();setEditingCaseId(null);setMessage('Case updated.')
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setBusy(false)}
 }
 const byName=new Map(horses.map(h=>[h.id,h.name]))
 const shown=cases.filter(c=>filter==='all'||c.status!=='closed')
 return <section className="care-cases" aria-label="Veterinary care cases">
   <div className="care-cases-head"><div><span>VETERINARY FOLLOW-UP</span><h2>Open care cases</h2><p>Track concerns, treatment plans and check dates while keeping the full history.</p></div></div>
   {error?<p role="alert" className="care-alert">{error}</p>:null}{message?<p role="status" className="care-success">{message}</p>:null}
   <div className="care-layout">
    <form className="care-card" onSubmit={e=>void create(e)}>
     <h2>Open a care case</h2>
     <label>Horse<select required value={horseId} onChange={e=>setHorseId(e.target.value)}><option value="">Choose a horse</option>{horses.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select></label>
     <label>Concern<input required value={title} onChange={e=>setTitle(e.target.value)} placeholder="For example: lameness, colic…"/></label>
     <label>Veterinarian<input value={veterinarian} onChange={e=>setVeterinarian(e.target.value)}/></label>
     <label>Diagnosis / findings<textarea rows={2} value={diagnosis} onChange={e=>setDiagnosis(e.target.value)}/></label>
     <label>Treatment plan<textarea rows={2} value={plan} onChange={e=>setPlan(e.target.value)}/></label>
     <label>Next check<input type="date" value={checkOn} onChange={e=>setCheckOn(e.target.value)}/></label>
     <button type="submit" disabled={busy||!horseId||!title.trim()}>{busy?'Saving…':'Create case'}</button>
    </form>
    <div className="care-card"><div className="care-case-filter"><h2>Cases</h2><select aria-label="Filter cases" value={filter} onChange={e=>setFilter(e.target.value as 'open'|'all')}><option value="open">Open cases</option><option value="all">All cases</option></select></div>
     <div className="care-events">{shown.length===0?<p>No cases in this view.</p>:shown.map(c=><article key={c.id}>
      <div><strong>{byName.get(c.horse_id)||'Horse'}</strong><span>{c.status==='open'?'Open':c.status==='monitoring'?'Monitoring':'Closed'}</span></div>
      {editingCaseId===c.id?<form className="care-case-edit" onSubmit={e=>void updateCase(e,c)}>
       <label>Concern<input name="title" required defaultValue={c.title}/></label>
       <label>Veterinarian<input name="veterinarian" defaultValue={c.veterinarian||''}/></label>
       <label>Diagnosis / findings<textarea name="diagnosis" rows={2} defaultValue={c.diagnosis||''}/></label>
       <label>Treatment plan<textarea name="treatment_plan" rows={2} defaultValue={c.treatment_plan||''}/></label>
       <label>Next check<input name="next_check_on" type="date" defaultValue={c.next_check_on||''}/></label>
       <div className="care-case-actions"><button disabled={busy} type="submit">Save changes</button><button disabled={busy} type="button" onClick={()=>setEditingCaseId(null)}>Cancel</button></div>
      </form>:<><p><strong>{c.title}</strong></p>
      {c.veterinarian?<small>Veterinarian: {c.veterinarian}</small>:null}
      {c.diagnosis?<small>Findings: {c.diagnosis}</small>:null}
      {c.treatment_plan?<small>Treatment: {c.treatment_plan}</small>:null}
      {c.next_check_on?<small>Next check: {c.next_check_on}</small>:null}
      </>}
      {editingCaseId!==c.id?<div className="care-case-actions"><button disabled={busy} type="button" onClick={()=>setEditingCaseId(c.id)}>Edit case</button>
      {c.status==='closed'?<button disabled={busy} onClick={()=>void changeStatus(c.id,'open')} type="button">Reopen case</button>:null}
      {c.status!=='closed'?<div className="care-case-actions">{c.status!=='monitoring'?<button disabled={busy} onClick={()=>void changeStatus(c.id,'monitoring')} type="button">Monitor</button>:null}<button disabled={busy} onClick={()=>void changeStatus(c.id,'closed')} type="button">Close case</button></div>:null}
      </div>:null}
     </article>)}</div>
    </div>
   </div>
 </section>
}
