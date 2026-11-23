'use client'

import { useEffect, useMemo, useState } from 'react'
import type { DragEvent } from 'react'
import { supabase } from '@/app/lib/supabaseClient'
import PlaceManager from './maps/PlaceManager'
import './PlaceTab.css'

type Site = { id:string; slug:string; name:string }
type DragPayload = { horseIds:string[] }
const mappedSites = new Set(['vremde','sint-katelijne-waver','bevel'])
function getDraggedHorseIds(e:DragEvent):string[]{
 try{
  const raw=e.dataTransfer.getData('application/json')
  if(raw){
   const decoded=JSON.parse(raw) as DragPayload
   if(Array.isArray(decoded.horseIds))return decoded.horseIds.filter(x=>typeof x==='string')
  }
 }catch{/* ignore invalid drag data */}
 return e.dataTransfer.getData('text/plain').split(',').map(x=>x.trim()).filter(Boolean)
}

export default function PlaceTab(){
 const [sites,setSites]=useState<Site[]>([])
 const [activeSlug,setActiveSlug]=useState('')
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [pendingSiteDrop,setPendingSiteDrop]=useState<{horseIds:string[];targetSiteSlug:string}|null>(null)
 useEffect(()=>{
  let mounted=true
  async function refresh(){
   const {data,error:siteError}=await supabase.from('sites').select('id,slug,name').eq('active',true).order('sort_order',{ascending:true}).order('name')
   if(!mounted)return
   if(siteError)setError(siteError.message)
   else{
    const valid=(data||[]) as Site[]
    setSites(valid)
    setActiveSlug(prev=>valid.some(x=>x.slug===prev)?prev:(valid.find(x=>x.slug==='vremde')||valid[0])?.slug||'')
   }
   setLoading(false)
  }
  void refresh().catch(e=>{if(mounted){setLoading(false);setError(e instanceof Error?e.message:'Locaties laden mislukt')}})
  return()=>{mounted=false}
 },[])
 const activeSite=useMemo(()=>sites.find(s=>s.slug===activeSlug)||null,[sites,activeSlug])
 function onDrop(slug:string,e:DragEvent){
  e.preventDefault()
  const ids=getDraggedHorseIds(e)
  if(!ids.length)return
  setPendingSiteDrop({horseIds:[...new Set(ids)],targetSiteSlug:slug})
  setActiveSlug(slug)
 }
 if(loading)return <section className="place-tab-shell"><p>Locaties laden…</p></section>
 if(error)return <section className="place-tab-shell"><p role="alert">Locaties kunnen niet worden geladen: {error}</p></section>
 if(!activeSite)return <section className="place-tab-shell"><p>Er zijn geen actieve locaties in de database.</p></section>
 return <div className="place-tab-shell">
  <div className="place-tab-hero">
   <div><span className="place-tab-kicker">STAL & WEIDES</span><h2 className="place-tab-title">Locaties</h2><p className="place-tab-subtitle">Waar staan de paarden? Bekijk de weides, stallen en actuele bezetting.</p>
    <a className="place-quick-link" href="/move">Paarden snel verplaatsen</a>
   </div>
   <div className="place-tab-hero-stats">
    <div className="place-tab-stat-card"><span>Actieve sites</span><strong>{sites.length}</strong></div>
    <div className="place-tab-stat-card"><span>Geselecteerd</span><strong>{activeSite.name}</strong></div>
   </div>
  </div>
  <div className="place-tab-layout">
   <aside className="place-tab-sidebar"><div className="place-tab-panel-head"><div><p className="place-tab-eyebrow">STAL OPTIMUS</p><h3>Sites</h3></div></div>
    <div className="place-tab-site-list">{sites.map(site=>
     <button key={site.id} type="button" className={`place-tab-site-card ${activeSlug===site.slug?'active':''}`}
      onClick={()=>{setActiveSlug(site.slug);setPendingSiteDrop(null)}}
      onDragOver={e=>e.preventDefault()} onDrop={e=>onDrop(site.slug,e)}>
      <div className="place-tab-site-top"><h4>{site.name}</h4><span className="place-tab-site-badge active">Beschikbaar</span></div>
      <p>{mappedSites.has(site.slug)?'Interactieve kaart':'Stallen en weides'}</p>
      <div className="place-tab-site-drop-note">Sleep hierheen of gebruik Snel verplaatsen</div>
     </button>)}</div>
   </aside>
   <section className="place-tab-main">
    <PlaceManager key={activeSite.id} siteSlug={activeSite.slug} siteLabel={activeSite.name}
     pendingSiteDrop={pendingSiteDrop} onClearPendingSiteDrop={()=>setPendingSiteDrop(null)}/>
   </section>
  </div>
 </div>
}
