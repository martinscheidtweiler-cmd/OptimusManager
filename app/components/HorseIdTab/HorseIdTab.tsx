'use client'
import {useCallback,useEffect,useMemo,useState} from 'react'
import {supabase} from '@/app/lib/supabaseClient'
import './HorseIdTab.css'

type Review={
 id:string;movement_key:string;horse_id:string;horse_name:string;chip_number:string|null;
 from_site_name:string;to_site_name:string;from_establishment:string|null;
 to_establishment:string|null;movement_at:string;status:string
}
function label(value:string|null){return value?.trim()||'[NOG CONTROLEREN]'}
function makeDraft(rows:Review[]){
 const lines=rows.map(x=>`• ${x.horse_name}
  Chipnummer: ${label(x.chip_number)}
  Van: ${x.from_site_name} — inrichting: ${label(x.from_establishment)}
  Naar: ${x.to_site_name} — inrichting: ${label(x.to_establishment)}
  Datum: ${new Date(x.movement_at).toLocaleString('nl-BE')}`)
 return `CONCEPT — NIET VERZONDEN
Aan: veronique@dsf.be
Onderwerp: HorseID — te controleren paardenverplaatsingen

Dag Veronique,

Kan je nakijken of voor de onderstaande verplaatsingen een aanpassing in HorseID nodig is? Alleen een sitewijziging betekent niet automatisch een wijziging van geregistreerde inrichting.

${lines.join('\n\n')}

Controleer chipnummers en officiële inrichtingsnummers voor verwerking.
HorseID: https://www.horseid.be

Alvast bedankt.`
}
export default function HorseIdTab(){
 const [rows,setRows]=useState<Review[]>([])
 const [selected,setSelected]=useState<string[]>([])
 const [busy,setBusy]=useState(false)
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [success,setSuccess]=useState('')
 const load=useCallback(async()=>{
   const {data,error}=await supabase.from('optimus_horseid_outbox')
    .select('id,movement_key,horse_id,horse_name,chip_number,from_site_name,to_site_name,from_establishment,to_establishment,movement_at,status')
    .eq('status','draft').order('movement_at',{ascending:false}).limit(300)
   if(error)throw error
   const items=(data||[]) as Review[]
   setRows(items)
   setSelected(previous=>previous.length?previous.filter(id=>items.some(x=>x.id===id)):items.map(x=>x.id))
 },[])
 useEffect(()=>{let live=true;void load().catch(e=>{if(live)setError(e instanceof Error?e.message:String(e))}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[load])
 const active=useMemo(()=>rows.filter(r=>selected.includes(r.id)),[rows,selected])
 const missing=active.filter(r=>!r.chip_number||!r.from_establishment||!r.to_establishment).length
 const concept=useMemo(()=>makeDraft(active),[active])
 async function save(row:Review){
   if(busy)return
   setBusy(true);setError('');setSuccess('')
   try{
    const {data:profile,error:profileError}=await supabase.rpc('optimus_task_my_profile')
    if(profileError||!profile?.active||profile.role!=='admin')throw new Error('Alleen beheerders kunnen HorseID-concepten wijzigen.')
    const {error}=await supabase.from('optimus_horseid_outbox').update({
      chip_number:row.chip_number?.trim()||null,
      from_establishment:row.from_establishment?.trim()||null,
      to_establishment:row.to_establishment?.trim()||null
    }).eq('id',row.id).eq('status','draft')
    if(error)throw error
    setSuccess('Gegevens opgeslagen. Er is niets verzonden.')
   }catch(e){setError(e instanceof Error?e.message:String(e))}
   finally{setBusy(false)}
 }
 async function markReviewed(row:Review){
  if(busy)return
  if(!row.chip_number?.trim()||!row.from_establishment?.trim()||!row.to_establishment?.trim()){
    setError('Vul eerst chipnummer en beide officiële inrichtingsnummers in en sla deze op.')
    return
  }
  if(!window.confirm('Alleen de interne HorseID-controle afsluiten? Er wordt geen e-mail verzonden of HorseID-record aangepast.'))return
  setBusy(true);setError('');setSuccess('')
  try{
   const {data:profile,error:profileError}=await supabase.rpc('optimus_task_my_profile')
   if(profileError||!profile?.active||profile.role!=='admin')throw new Error('Geen beheerdersrechten.')
   const {error}=await supabase.from('optimus_horseid_outbox').update({
    chip_number:row.chip_number.trim(),from_establishment:row.from_establishment.trim(),
    to_establishment:row.to_establishment.trim(),status:'reviewed'
   }).eq('id',row.id).eq('status','draft')
   if(error)throw error
   await load()
   setSuccess('Interne controle gemarkeerd als nagekeken. Er is geen e-mail verzonden.')
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setBusy(false)}
 }
 async function copy(){
  setError('');setSuccess('')
  if(!active.length)return
  try{await navigator.clipboard.writeText(concept);setSuccess('Concept gekopieerd. Er is geen e-mail verzonden.')}
  catch{setError('Kopiëren mislukt. Selecteer de tekst hieronder en kopieer die handmatig.')}
 }
 function change(id:string,field:'chip_number'|'from_establishment'|'to_establishment',value:string){
   setRows(previous=>previous.map(r=>r.id===id?{...r,[field]:value}:r))
 }
 return <section className="horseid-page">
  <header><span>ADMINISTRATIE</span><h1>HorseID-controles</h1><p>Verplaatsingen tussen sites worden als concept bewaard. Controleer eerst of de geregistreerde inrichting werkelijk verandert.</p></header>
  {error?<p role="alert" className="horseid-error">{error}</p>:null}
  {success?<p role="status" className="horseid-success">{success}</p>:null}
  <div className="horseid-grid">
   <section className="horseid-panel"><div className="horseid-panel-heading"><h2>Te controleren</h2><button type="button" onClick={()=>setSelected(selected.length===rows.length?[]:rows.map(r=>r.id))}>{selected.length===rows.length?'Deselecteer alles':'Selecteer alles'}</button></div>
    {loading?<p>Laden…</p>:rows.length===0?<p>Geen openstaande HorseID-concepten.</p>:
     <div className="horseid-rows">{rows.map(row=><article key={row.id}>
      <label className="horseid-choice"><input type="checkbox" checked={selected.includes(row.id)} onChange={()=>setSelected(p=>p.includes(row.id)?p.filter(id=>id!==row.id):[...p,row.id])}/><strong>{row.horse_name}</strong></label>
      <p>{row.from_site_name} → {row.to_site_name}</p>
      <small>{new Date(row.movement_at).toLocaleString('nl-BE')}</small>
      <div className="horseid-fields"><label>Chipnummer<input value={row.chip_number||''} onChange={e=>change(row.id,'chip_number',e.target.value)} placeholder="Officieel chipnummer"/></label>
      <label>Inrichting van<input value={row.from_establishment||''} onChange={e=>change(row.id,'from_establishment',e.target.value)} placeholder="Officieel nummer"/></label>
      <label>Inrichting naar<input value={row.to_establishment||''} onChange={e=>change(row.id,'to_establishment',e.target.value)} placeholder="Officieel nummer"/></label></div>
      <div className="horseid-row-actions"><button type="button" className="horseid-save" disabled={busy} onClick={()=>void save(row)}>{busy?'Opslaan…':'Bewaar controlegegevens'}</button><button type="button" disabled={busy} onClick={()=>void markReviewed(row)}>Controle afronden (niet verzonden)</button></div>
     </article>)}</div>}
   </section>
   <section className="horseid-panel horseid-preview"><h2>Gecombineerd e-mailconcept</h2>
    <p>{active.length} paard(en) geselecteerd. {missing?'Bij '+missing+' paard(en) ontbreken nog officiële gegevens.':'De verplichte controlevelden zijn ingevuld.'}</p>
    <textarea aria-label="HorseID e-mailconcept" rows={18} readOnly value={active.length?concept:'Selecteer één of meer paarden om een concept te maken.'}/>
    <button type="button" disabled={!active.length} onClick={()=>void copy()}>Kopieer e-mailconcept</button>
    <p className="horseid-warning">Deze module verzendt nooit automatisch e-mails. Alleen na menselijke controle mag een concept extern worden gebruikt.</p>
   </section>
  </div>
 </section>
}
