'use client'
import {useCallback,useEffect,useState} from 'react'
import {supabase} from '@/app/lib/supabaseClient'
import {useLocale} from '../LanguageProvider'
import './CareTab.css'

type Horse={id:string;name:string}
type Event={id:string;horse_id:string;category:string;performed_on:string;result:string|null;notes:string|null;next_due_on:string|null;veterinarian:string|null}
const categories=[['scan','Ultrasound / scan'],['insemination','Insemination'],['pregnancy','Pregnancy check'],['foaling','Foaling'],['flush','Embryo flush'],['other','Other breeding care']] as const
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
export default function CareTab({onBack}:{onBack?:()=>void}={}){
 useLocale()
 const [horses,setHorses]=useState<Horse[]>([])
 const [events,setEvents]=useState<Event[]>([])
 const [horseId,setHorseId]=useState('')
 const [category,setCategory]=useState<string>('scan')
 const [performedOn,setPerformedOn]=useState(today)
 const [nextDue,setNextDue]=useState('')
 const [result,setResult]=useState('')
 const [notes,setNotes]=useState('')
 const [veterinarian,setVeterinarian]=useState('')
 const [busy,setBusy]=useState(false)
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [success,setSuccess]=useState('')
 const load=useCallback(async()=>{
  const [h,e]=await Promise.all([
   supabase.from('horses').select('id,name').eq('active',true).order('name'),
   supabase.from('optimus_care_events').select('id,horse_id,category,performed_on,result,notes,next_due_on,veterinarian').order('performed_on',{ascending:false}).limit(200)
  ])
  if(h.error)throw h.error
  if(e.error)throw e.error
  setHorses((h.data||[]) as Horse[])
  setEvents((e.data||[]) as Event[])
 },[])
 useEffect(()=>{let live=true;void load().catch(e=>{if(live)setError(e instanceof Error?e.message:String(e))}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[load])
 async function save(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault()
  if(!horseId||busy)return
  setBusy(true);setError('');setSuccess('')
  try{
   const {data:{user},error:authError}=await supabase.auth.getUser()
   if(authError||!user)throw new Error('Please sign in again.')
   const {data:profile,error:profileError}=await supabase.rpc('optimus_task_my_profile')
   if(profileError||!profile?.active||profile.role!=='admin')throw new Error('Administrator access is required.')
   const {error:insertError}=await supabase.from('optimus_care_events').insert({
    horse_id:horseId,category,performed_on:performedOn,result:result.trim()||null,
    notes:notes.trim()||null,next_due_on:nextDue||null,veterinarian:veterinarian.trim()||null,
    created_by:user.id
   })
   if(insertError)throw insertError
   await load()
   setResult('');setNotes('');setNextDue('');setVeterinarian('')
   setSuccess('Record saved.')
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setBusy(false)}
 }
 const byName=new Map(horses.map(h=>[h.id,h.name]))
 return <section className="care-page">
  <header className="care-head"><div><span>BREEDING & CARE</span><h1>Breeding records</h1><p>Record scans, insemination, pregnancy checks and births, then keep every follow-up with the horse.</p></div>{onBack?<button type="button" onClick={onBack}>← Care overview</button>:null}</header>
  {error?<p className="care-alert" role="alert">{error}</p>:null}
  {success?<p className="care-success" role="status">{success}</p>:null}
  <p className="care-legacy-note">Vaccination, deworming and farrier records stay in their dedicated registers. <a href="/manager?tab=Vet">Open veterinary care</a> · <a href="/manager?tab=Farrier">Open farrier records</a></p>
  <div className="care-layout">
   <form className="care-card" onSubmit={e=>void save(e)}>
    <h2>New breeding record</h2>
    <label>Horse<select required value={horseId} onChange={e=>setHorseId(e.target.value)}><option value="">Choose a horse</option>{horses.map(h=><option value={h.id} key={h.id}>{h.name}</option>)}</select></label>
    <label>Record type<select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
    <label>Date<input required type="date" value={performedOn} onChange={e=>setPerformedOn(e.target.value)}/></label>
    <label>Result<input value={result} onChange={e=>setResult(e.target.value)} placeholder="For example: positive, treated…"/></label>
    <label>Next check<input type="date" value={nextDue} onChange={e=>setNextDue(e.target.value)}/></label>
    <label>Veterinarian / provider<input value={veterinarian} onChange={e=>setVeterinarian(e.target.value)} placeholder="Name"/></label>
    <label>Notes<textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Additional details"/></label>
    <button disabled={busy||!horseId||loading} type="submit">{busy?'Saving…':'Save record'}</button>
   </form>
   <div className="care-card care-history"><h2>Recent records</h2>
    {loading?<p>Loading…</p>:events.length===0?<p>No records yet.</p>:
     <div className="care-events">{events.map(ev=><article key={ev.id}>
      <div><strong>{byName.get(ev.horse_id)||'Horse'}</strong><span>{new Date(`${ev.performed_on}T12:00:00`).toLocaleDateString(document.documentElement.lang||'en-GB')}</span></div>
      <p>{categories.find(([id])=>id===ev.category)?.[1]||ev.category}{ev.result?' · '+ev.result:''}</p>
      {ev.notes?<small>{ev.notes}</small>:null}
      {ev.next_due_on?<small>Next check: {new Date(`${ev.next_due_on}T12:00:00`).toLocaleDateString(document.documentElement.lang||'en-GB')}</small>:null}
     </article>)}</div>}
   </div>
  </div>
 </section>
}
