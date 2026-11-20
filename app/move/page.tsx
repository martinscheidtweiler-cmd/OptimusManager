'use client'

import {useEffect,useMemo,useState} from 'react'
import {supabase} from '@/app/lib/supabaseClient'
import './move.css'

type Site={id:string;name:string}
type Unit={id:string;name:string;site_id:string;active:boolean;unit_type:string}
type CurrentHorse={horse_id:string;horse_name:string;horse_active:boolean|null;site_id:string;unit_id:string|null}
type Profile={name:string;role:string;active:boolean}

export default function MoveHorses(){
 const [profile,setProfile]=useState<Profile|null>(null)
 const [authorized,setAuthorized]=useState(false)
 const [ready,setReady]=useState(false)
 const [sites,setSites]=useState<Site[]>([])
 const [units,setUnits]=useState<Unit[]>([])
 const [horses,setHorses]=useState<CurrentHorse[]>([])
 const [source,setSource]=useState('')
 const [destination,setDestination]=useState('')
 const [excluded,setExcluded]=useState<string[]>([])
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [message,setMessage]=useState('')
 async function refresh(){
  const [siteResult,unitResult,horseResult]=await Promise.all([
   supabase.from('sites').select('id,name').eq('active',true).order('name'),
   supabase.from('place_units').select('id,name,site_id,active,unit_type').eq('active',true).order('name'),
   supabase.from('horse_current_places_v2').select('horse_id,horse_name,horse_active,site_id,unit_id'),
  ])
  if(siteResult.error)throw siteResult.error
  if(unitResult.error)throw unitResult.error
  if(horseResult.error)throw horseResult.error
  setSites((siteResult.data||[]) as Site[])
  setUnits((unitResult.data||[]) as Unit[])
  setHorses(((horseResult.data||[]) as CurrentHorse[]).filter(h=>h.horse_active!==false))
 }
 useEffect(()=>{
  let live=true
  async function initialize(){
   try{
    const {data:{user},error:authError}=await supabase.auth.getUser()
    if(authError||!user)throw new Error('Meld je eerst aan.')
    const {data:account,error:profileError}=await supabase.rpc('optimus_task_my_profile')
    if(profileError||!account?.active||!['admin','member','planner'].includes(account.role))throw new Error('Geen toegang tot paardenverplaatsingen.')
    if(!live)return
    setProfile(account as Profile)
    setAuthorized(true)
    await refresh()
   }catch(e){if(live)setError(e instanceof Error?e.message:'Kon gegevens niet laden.')}
   finally{if(live)setReady(true)}
  }
  void initialize()
  return()=>{live=false}
 },[])
 const current=useMemo(()=>horses.filter(h=>h.unit_id===source),[horses,source])
 const selected=useMemo(()=>current.filter(h=>!excluded.includes(h.horse_id)),[current,excluded])
 const destinationUnit=units.find(u=>u.id===destination)
 const sourceUnit=units.find(u=>u.id===source)
 const crossSite=Boolean(sourceUnit&&destinationUnit&&sourceUnit.site_id!==destinationUnit.site_id)
 function selectSource(value:string){setSource(value);setExcluded([]);setMessage('');setError('')}
 function toggleExclude(id:string){setExcluded(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id])}
 async function submit(){
  if(busy||!sourceUnit||!destinationUnit||source===destination||!selected.length)return
  setBusy(true);setError('');setMessage('')
  try{
   // A single transaction handles every selected horse, plus HorseID review drafts.
   const {data,error:moveError}=await supabase.rpc('optimus_move_group',{
    p_horse_ids:selected.map(h=>h.horse_id),
    p_destination_unit:destinationUnit.id,
    p_request_id:crypto.randomUUID(),
   })
   if(moveError)throw new Error(moveError.message)
   const moved=Number(data??0)
   setSource('');setDestination('');setExcluded([])
   try{await refresh()}catch(e){setError('Verplaatsing geslaagd, maar vernieuwen mislukt: '+(e instanceof Error?e.message:String(e)))}
   setMessage(`${moved} paard(en) verplaatst naar ${destinationUnit.name}.${crossSite?' HorseID-controleconcepten zijn opgeslagen; er is geen e-mail verstuurd.':''}`)
  }catch(e){setError(e instanceof Error?e.message:'Verplaatsing mislukt. Er zijn geen wijzigingen opgeslagen.')}
  finally{setBusy(false)}
 }
 async function signOut(){await supabase.auth.signOut();window.location.replace('/login')}
 if(!ready)return <main className="quick-move-page"><p>Locaties laden…</p></main>
 if(!authorized)return <main className="quick-move-page"><div className="quick-move-alert"><h1>Geen toegang</h1><p>{error}</p><a href="/login">Aanmelden</a></div></main>
 return <main className="quick-move-page">
   <header className="quick-move-header"><div className="quick-move-brand"><span>O</span><div><strong>OPTIMUS</strong><small>PAARDEN VERPLAATSEN</small></div></div><div className="quick-move-user"><span>{profile?.name}</span>{profile?.role==='admin'?<a href="/manager?tab=Place">Beheer</a>:null}<button type="button" onClick={()=>void signOut()}>Uitloggen</button></div></header>
   <section className="quick-move-intro"><span>SNELLE REGISTRATIE</span><h1>Verplaats een groep.</h1><p>Kies waar de paarden nu staan en waar ze naartoe gaan. Alle paarden van de huidige weide worden automatisch geselecteerd.</p></section>
   {error?<p role="alert" className="quick-move-error">{error}</p>:null}
   {message?<p role="status" className="quick-move-success">{message}</p>:null}
   <div className="quick-move-grid">
    <section className="quick-move-card"><div className="quick-move-step">01 <span>VAN</span></div><h2>Huidige plaats</h2><label htmlFor="quick-move-from">Kies weide of stal</label><select id="quick-move-from" value={source} disabled={busy} onChange={e=>selectSource(e.target.value)}><option value="">Selecteer huidige plaats</option>
    {sites.map(site=><optgroup key={site.id} label={site.name}>{units.filter(u=>u.site_id===site.id).map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</optgroup>)}
    </select>
    {source?<div className="quick-move-horses"><div className="quick-move-horse-heading"><strong>{selected.length} van {current.length} geselecteerd</strong><button type="button" onClick={()=>setExcluded([])} disabled={busy}>Selecteer alles</button></div>{current.length?current.map(h=><label key={h.horse_id} className="quick-move-horse"><input type="checkbox" checked={!excluded.includes(h.horse_id)} disabled={busy} onChange={()=>toggleExclude(h.horse_id)}/>{h.horse_name}</label>):<p>Geen paarden op deze plaats.</p>}</div>:null}
    </section>
    <section className="quick-move-card"><div className="quick-move-step">02 <span>NAAR</span></div><h2>Nieuwe plaats</h2><label htmlFor="quick-move-to">Kies bestemming</label><select id="quick-move-to" value={destination} disabled={busy} onChange={e=>{setDestination(e.target.value);setMessage('')}}><option value="">Selecteer bestemming</option>
    {sites.map(site=><optgroup key={site.id} label={site.name}>{units.filter(u=>u.site_id===site.id&&u.id!==source).map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</optgroup>)}
    </select>
    {crossSite?<p className="quick-move-note">Andere site: na de verplaatsing wordt een HorseID-concept opgeslagen voor controle. Er wordt niets automatisch verzonden.</p>:null}
    {selected.length&&destinationUnit?<div className="quick-move-summary">{selected.length} paard(en) naar <strong>{sites.find(s=>s.id===destinationUnit.site_id)?.name} / {destinationUnit.name}</strong></div>:null}
    <button type="button" className="quick-move-confirm" disabled={busy||!source||!destination||source===destination||!selected.length} onClick={()=>void submit()}>{busy?'Verplaatsen…':`Bevestig verplaatsing (${selected.length})`}</button>
    </section>
   </div>
 </main>
}
