'use client'
import {useEffect,useMemo,useState} from 'react'
import {supabase} from '@/app/lib/supabaseClient'
import './TodayTab.css'
type Horse={id:string;name:string;horse_type:string|null;stable_location:string|null;pasture_name:string|null;pregnant:boolean|null;farrier_last_done:string|null;farrier_interval_weeks:number|null;last_in_heat_date:string|null}
type Event={id:string;horse_id:string;category:string;next_due_on:string;result:string|null}
type Stock={id:string;name:string;current_stock:number;next_expiry_date:string|null}
type Threshold={medicine_id:string;minimum_quantity:number}
type Vaccination={id:string;horse_id:string;vaccine_type:string;next_due_on:string|null;administered_on:string}
type Deworming={id:string;horse_id:string;next_due_on:string|null;administered_on:string}
type Task={id:string;name:string;detail:string;category:string;priority:number;date?:string}
function daysBetween(date:string){return Math.floor((Date.now()-new Date(date+'T12:00:00').getTime())/86400000)}
const categoryLabels:Record<string,string>={scan:'Echo',insemination:'Inseminatie',pregnancy:'Drachtcontrole',foaling:'Geboorte',flush:'Embryospoeling',vaccination:'Vaccinatie',deworming:'Ontworming',farrier:'Hoefsmid',veterinary:'Dierenarts',other:'Zorg'}
export default function TodayTab(){
 const [horses,setHorses]=useState<Horse[]>([])
 const [events,setEvents]=useState<Event[]>([])
 const [stock,setStock]=useState<Stock[]>([])
 const [thresholds,setThresholds]=useState<Threshold[]>([])
 const [vaccinations,setVaccinations]=useState<Vaccination[]>([])
 const [deworming,setDeworming]=useState<Deworming[]>([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [careAvailable,setCareAvailable]=useState(false)
 const [filter,setFilter]=useState('Alles')
 const [query,setQuery]=useState('')
 useEffect(()=>{
  let mounted=true
  async function load(){
    const [h,c,s,t,v,d]=await Promise.all([
      supabase.from('horses').select('id,name,horse_type,stable_location,pasture_name,pregnant,farrier_last_done,farrier_interval_weeks,last_in_heat_date').eq('active',true).order('name'),
      supabase.from('optimus_care_events').select('id,horse_id,category,next_due_on,result').not('next_due_on','is',null).order('next_due_on',{ascending:true}).limit(500),
      supabase.from('medicine_stock_view').select('id,name,current_stock,next_expiry_date').limit(500),
      supabase.from('optimus_medicine_thresholds').select('medicine_id,minimum_quantity').limit(500),
      supabase.from('vaccination_records').select('id,horse_id,vaccine_type,next_due_on,administered_on').order('administered_on',{ascending:false}).limit(2000),
      supabase.from('deworming_records').select('id,horse_id,next_due_on,administered_on').order('administered_on',{ascending:false}).limit(2000)
    ])
    if(!mounted)return
    if(h.error)setError(h.error.message)
    else setHorses((h.data||[]) as Horse[])
    if(!c.error){setEvents((c.data||[]) as Event[]);setCareAvailable(true)}
    if(!s.error)setStock((s.data||[]) as Stock[])
    if(!t.error)setThresholds((t.data||[]) as Threshold[])
    if(!v.error)setVaccinations((v.data||[]) as Vaccination[])
    if(!d.error)setDeworming((d.data||[]) as Deworming[])
    setLoading(false)
  }
  void load().catch(e=>{if(mounted){setError(e instanceof Error?e.message:'Laden mislukt');setLoading(false)}})
  return()=>{mounted=false}
 },[])
 const tasks=useMemo(()=>{
  const result:Task[]=[]
  const byHorse=new Map(horses.map(h=>[h.id,h.name]))
  for(const h of horses){
   if(h.farrier_last_done&&h.farrier_interval_weeks){
    const due=daysBetween(h.farrier_last_done)-h.farrier_interval_weeks*7
    if(due>=-7)result.push({id:h.id+'-farrier',name:h.name,detail:due>0?`Hoefsmid ${due} dagen achterstallig`:due===0?'Hoefsmid vandaag':`Hoefsmid over ${-due} dagen`,category:'Hoefsmid',priority:due>0?0:1})
   }
   if(h.pregnant)result.push({id:h.id+'-mare',name:h.name,detail:'Drachtig — controleer fokkerijplanning',category:'Fokkerij',priority:2})
  }
  for(const event of events){
   if(!byHorse.has(event.horse_id))continue
   const overdue=daysBetween(event.next_due_on)
   if(overdue< -14)continue
   const label=categoryLabels[event.category]||'Zorg'
   result.push({
    id:'care-'+event.id,name:byHorse.get(event.horse_id)||'Paard',
    detail:`${label}: ${overdue>0?overdue+' dagen achterstallig':overdue===0?'vandaag':'over '+(-overdue)+' dagen'}`,
    category:['scan','insemination','pregnancy','foaling','flush'].includes(event.category)?'Fokkerij':event.category==='farrier'?'Hoefsmid':'Zorg',
    priority:overdue>0?0:overdue===0?1:2,date:event.next_due_on
   })
  }

  const latestVaccination=new Set<string>()
  for(const vaccination of vaccinations){
   const key=vaccination.horse_id+':'+vaccination.vaccine_type
   if(latestVaccination.has(key))continue
   latestVaccination.add(key)
   if(!byHorse.has(vaccination.horse_id)||!vaccination.next_due_on)continue
   const overdue=daysBetween(vaccination.next_due_on)
   if(overdue < -14)continue
   const vaccine=vaccination.vaccine_type==='rhino'?'Rhino':'Griep/tetanus'
   result.push({id:'vax-'+vaccination.id,name:byHorse.get(vaccination.horse_id)||'Paard',
     detail:`Vaccinatie ${vaccine}: ${overdue>0?overdue+' dagen achterstallig':overdue===0?'vandaag':'over '+(-overdue)+' dagen'}`,
     category:'Zorg',priority:overdue>0?0:overdue===0?1:2,date:vaccination.next_due_on})
  }
  const latestDeworming=new Set<string>()
  for(const record of deworming){
   if(latestDeworming.has(record.horse_id))continue
   latestDeworming.add(record.horse_id)
   if(!byHorse.has(record.horse_id)||!record.next_due_on)continue
   const overdue=daysBetween(record.next_due_on)
   if(overdue < -14)continue
   result.push({id:'deworm-'+record.id,name:byHorse.get(record.horse_id)||'Paard',
     detail:`Ontworming: ${overdue>0?overdue+' dagen achterstallig':overdue===0?'vandaag':'over '+(-overdue)+' dagen'}`,
     category:'Zorg',priority:overdue>0?0:overdue===0?1:2,date:record.next_due_on})
  }
  return result.sort((a,b)=>a.priority-b.priority||(a.date||'').localeCompare(b.date||''))
 },[horses,events,vaccinations,deworming])
 const thresholdByProduct=new Map(thresholds.map(t=>[t.medicine_id,Number(t.minimum_quantity)]))
 const lowStock=stock.filter(x=>thresholdByProduct.has(x.id)&&Number(x.current_stock)<=Number(thresholdByProduct.get(x.id)))
 const visible=tasks.filter(t=>(filter==='Alles'||t.category===filter)&&(t.name+' '+t.detail).toLowerCase().includes(query.toLowerCase()))
 return <section className="today-page">
  <header className="today-heading"><div><span className="today-eyebrow">STAL OPTIMUS</span><h1>Vandaag</h1><p>Wat vraagt je aandacht? Eén overzicht, zonder overbodige planning.</p></div><a className="today-primary" href="/move">Paarden verplaatsen</a></header>
  <div className="today-stats">
   <article><strong>{horses.length}</strong><span>Actieve paarden</span></article>
   <article><strong>{tasks.filter(t=>t.priority===0).length}</strong><span>Achterstallige controles</span></article>
   <article><strong>{horses.filter(h=>h.pregnant).length}</strong><span>Drachtige merries</span></article>
   <article><strong>{lowStock.length}</strong><span>Producten met lage voorraad</span></article>
  </div>
  <div className="today-section"><div className="today-section-head"><div><h2>Opvolging</h2><p>Op basis van bestaande vaccinatie-, ontwormings- en hoefsmidgegevens en nieuwe zorgregistraties.</p></div></div>
   <div className="today-controls"><input aria-label="Zoek paard" placeholder="Zoek een paard…" value={query} onChange={e=>setQuery(e.target.value)}/><div className="today-filters">{['Alles','Hoefsmid','Fokkerij','Zorg'].map(x=><button type="button" key={x} className={filter===x?'selected':''} onClick={()=>setFilter(x)}>{x}</button>)}</div></div>
   {loading?<p>Paarden laden…</p>:error?<p role="alert">Kon gegevens niet laden: {error}</p>:visible.length===0?<p className="today-empty">Geen aandachtspunten voor deze selectie.</p>:<div className="today-items">{visible.map(t=><article key={t.id} className="today-item"><span className="today-dot" data-urgent={t.priority===0}/><div><strong>{t.name}</strong><p>{t.detail}</p></div><span className="today-tag">{t.category}</span></article>)}</div>}
  </div>
  <p className="today-disclaimer">{careAvailable?'Ingeplande controles komen uit Zorg & fokkerij.':'Zorg- en medicatiegegevens worden na activering van de database-migraties aan dit overzicht gekoppeld.'} Wijzigingen aan de planning zijn geen vervanging van veterinaire beoordeling.</p>
 </section>
}
