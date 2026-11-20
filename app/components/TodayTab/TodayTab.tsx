'use client'
import {useEffect,useMemo,useState} from 'react'
import {supabase} from '@/app/lib/supabaseClient'
import './TodayTab.css'
type Horse={id:string;name:string;horse_type:string|null;stable_location:string|null;pasture_name:string|null;pregnant:boolean|null;farrier_last_done:string|null;farrier_interval_weeks:number|null;last_in_heat_date:string|null}
type Task={id:string;name:string;detail:string;category:string;priority:number}
function daysBetween(date:string){return Math.floor((Date.now()-new Date(date+'T12:00:00').getTime())/86400000)}
export default function TodayTab(){
 const [horses,setHorses]=useState<Horse[]>([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [filter,setFilter]=useState('Alles')
 const [query,setQuery]=useState('')
 useEffect(()=>{let mounted=true;async function load(){
  const result=await supabase.from('horses').select('id,name,horse_type,stable_location,pasture_name,pregnant,farrier_last_done,farrier_interval_weeks,last_in_heat_date').eq('active',true).order('name')
  if(!mounted)return
  if(result.error)setError(result.error.message);else setHorses((result.data||[]) as Horse[])
  setLoading(false)
 }void load();return()=>{mounted=false}},[])
 const tasks=useMemo(()=>{
  const result:Task[]=[]
  for(const h of horses){
   if(h.farrier_last_done&&h.farrier_interval_weeks){
    const due=daysBetween(h.farrier_last_done)-h.farrier_interval_weeks*7
    if(due>=-7)result.push({id:h.id+'-farrier',name:h.name,detail:due>0?`Hoefsmid ${due} dagen achterstallig`:due===0?'Hoefsmid vandaag':`Hoefsmid over ${-due} dagen`,category:'Hoefsmid',priority:due>0?0:1})
   }
   if(h.pregnant)result.push({id:h.id+'-mare',name:h.name,detail:'Drachtig — controleer fokkerijplanning',category:'Fokkerij',priority:2})
  }
  return result.sort((a,b)=>a.priority-b.priority)
 },[horses])
 const visible=tasks.filter(t=>(filter==='Alles'||t.category===filter)&&(t.name+' '+t.detail).toLowerCase().includes(query.toLowerCase()))
 return <section className="today-page">
  <header className="today-heading"><div><span className="today-eyebrow">STAL OPTIMUS</span><h1>Vandaag</h1><p>Wat vraagt je aandacht? Eén overzicht, zonder overbodige planning.</p></div><a className="today-primary" href="/manager?tab=Place">Bekijk locaties</a></header>
  <div className="today-stats"><article><strong>{horses.length}</strong><span>Actieve paarden</span></article><article><strong>{tasks.filter(t=>t.priority===0).length}</strong><span>Achterstallige hoefsmidcontroles</span></article><article><strong>{horses.filter(h=>h.pregnant).length}</strong><span>Drachtige merries</span></article></div>
  <div className="today-section"><div className="today-section-head"><div><h2>Opvolging</h2><p>Gebaseerd op de bestaande paardengegevens. Drachtige merries verschijnen ter controle, niet als automatisch vastgestelde afspraak.</p></div></div>
   <div className="today-controls"><input aria-label="Zoek paard" placeholder="Zoek een paard…" value={query} onChange={e=>setQuery(e.target.value)}/><div className="today-filters">{['Alles','Hoefsmid','Fokkerij'].map(x=><button type="button" key={x} className={filter===x?'selected':''} onClick={()=>setFilter(x)}>{x}</button>)}</div></div>
   {loading?<p>Paarden laden…</p>:error?<p role="alert">Kon gegevens niet laden: {error}</p>:visible.length===0?<p className="today-empty">Geen aandachtspunten voor deze selectie.</p>:<div className="today-items">{visible.map(t=><article key={t.id} className="today-item"><span className="today-dot" data-urgent={t.priority===0}/><div><strong>{t.name}</strong><p>{t.detail}</p></div><span className="today-tag">{t.category}</span></article>)}</div>}
  </div>
  <p className="today-disclaimer">Vaccinaties, ontworming, scans, medicatie en behandelingen worden pas aan dit dashboard toegevoegd nadat hun bestaande databronnen en toegangsrechten gecontroleerd zijn.</p>
 </section>
}
