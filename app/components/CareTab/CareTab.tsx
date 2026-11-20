'use client'
import {useCallback,useEffect,useState} from 'react'
import {supabase} from '@/app/lib/supabaseClient'
import './CareTab.css'

type Horse={id:string;name:string}
type Event={id:string;horse_id:string;category:string;performed_on:string;result:string|null;notes:string|null;next_due_on:string|null;veterinarian:string|null}
const categories=[['scan','Echo / scan'],['insemination','Inseminatie'],['pregnancy','Drachtcontrole'],['foaling','Geboorte'],['flush','Embryospoeling'],['vaccination','Vaccinatie'],['deworming','Ontworming'],['farrier','Hoefsmid'],['veterinary','Dierenarts'],['other','Overige zorg']] as const
const today=()=>new Date().toLocaleDateString('en-CA')
export default function CareTab(){
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
   if(authError||!user)throw new Error('Log opnieuw in.')
   const {data:profile,error:profileError}=await supabase.rpc('optimus_task_my_profile')
   if(profileError||!profile?.active||profile.role!=='admin')throw new Error('Geen beheerdersrechten.')
   const {error:insertError}=await supabase.from('optimus_care_events').insert({
    horse_id:horseId,category,performed_on:performedOn,result:result.trim()||null,
    notes:notes.trim()||null,next_due_on:nextDue||null,veterinarian:veterinarian.trim()||null,
    created_by:user.id
   })
   if(insertError)throw insertError
   await load()
   setResult('');setNotes('');setNextDue('');setVeterinarian('')
   setSuccess('Registratie opgeslagen.')
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setBusy(false)}
 }
 const byName=new Map(horses.map(h=>[h.id,h.name]))
 return <section className="care-page">
  <header className="care-head"><span>GEZONDHEID & FOKKERIJ</span><h1>Zorgregistratie</h1><p>Scan, inseminatie, dracht, geboorte, vaccinatie en behandelingen op één plaats.</p></header>
  {error?<p className="care-alert" role="alert">{error}</p>:null}
  {success?<p className="care-success" role="status">{success}</p>:null}
  <div className="care-layout">
   <form className="care-card" onSubmit={e=>void save(e)}>
    <h2>Nieuwe registratie</h2>
    <label>Paard<select required value={horseId} onChange={e=>setHorseId(e.target.value)}><option value="">Kies een paard</option>{horses.map(h=><option value={h.id} key={h.id}>{h.name}</option>)}</select></label>
    <label>Soort gebeurtenis<select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
    <label>Datum<input required type="date" value={performedOn} onChange={e=>setPerformedOn(e.target.value)}/></label>
    <label>Resultaat<input value={result} onChange={e=>setResult(e.target.value)} placeholder="Bijv. positief, behandeld…"/></label>
    <label>Volgende controle<input type="date" value={nextDue} onChange={e=>setNextDue(e.target.value)}/></label>
    <label>Dierenarts / uitvoerder<input value={veterinarian} onChange={e=>setVeterinarian(e.target.value)} placeholder="Naam"/></label>
    <label>Notities<textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Aanvullende informatie"/></label>
    <button disabled={busy||!horseId||loading} type="submit">{busy?'Opslaan…':'Registratie opslaan'}</button>
   </form>
   <div className="care-card care-history"><h2>Recente registraties</h2>
    {loading?<p>Laden…</p>:events.length===0?<p>Nog geen registraties.</p>:
     <div className="care-events">{events.map(ev=><article key={ev.id}>
      <div><strong>{byName.get(ev.horse_id)||'Paard'}</strong><span>{ev.performed_on}</span></div>
      <p>{categories.find(([id])=>id===ev.category)?.[1]||ev.category}{ev.result?' · '+ev.result:''}</p>
      {ev.notes?<small>{ev.notes}</small>:null}
      {ev.next_due_on?<small>Volgende controle: {ev.next_due_on}</small>:null}
     </article>)}</div>}
   </div>
  </div>
 </section>
}
