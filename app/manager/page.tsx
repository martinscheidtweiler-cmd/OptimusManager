'use client'

import {useEffect,useState} from 'react'
import Image from 'next/image'
import {supabase} from '@/app/lib/supabaseClient'

import TodayTab from '@/app/components/TodayTab/TodayTab'
import HorsesTab from '@/app/components/HorsesTab/HorsesTab'
import VetTab from '@/app/components/VetTab/VetTab'
import EarthTab from '@/app/components/EarthTab/EarthTab'
import PlaceTab from '@/app/components/PlaceTab/PlaceTab'
import FarrierTab from '@/app/components/FarrierTab/FarrierTab'
import StockTab from '@/app/components/StockTab/StockTab'
import HorseIdTab from '@/app/components/HorseIdTab/HorseIdTab'

import StaffDashboard from '@/app/components/StaffDashboard/StaffDashboard'
import './desktop.css'

type Module = 'Today'|'Horses'|'Vet'|'Place'|'Earth'|'Farrier'|'Stock'|'HorseID'|'Staff'
type VetQuickRequest={menu:'Vaccinations'|'Deworming'|'Visits';horseId:string;vaccineType?:'flu_tetanus'|'rhino'}
type NavItem = {key:Module;label:string;symbol:string}
const modules:NavItem[]=[
 {key:'Today',label:'Vandaag',symbol:'◫'},
 {key:'Horses',label:'Paarden',symbol:'♞'},
 {key:'Vet',label:'Dierenarts',symbol:'✚'},
 {key:'Place',label:'Locaties',symbol:'⌖'},
 {key:'Earth',label:'Optimus Earth',symbol:'◎'},
 {key:'Farrier',label:'Hoefsmid',symbol:'∷'},
 {key:'Stock',label:'Medicatie',symbol:'▤'},
 {key:'HorseID',label:'HorseID',symbol:'✉'},
 {key:'Staff',label:'Personeel',symbol:'▥'},
]
const validModules=new Set<Module>(modules.map(m=>m.key))

function initialModule():Module{
 if(typeof window==='undefined')return 'Today'
 const value=new URLSearchParams(window.location.search).get('tab') as Module|null
 return value&&validModules.has(value)?value:'Today'
}

export default function ManagerModules(){
 const [active,setActive]=useState<Module>('Today')
 const [name,setName]=useState('')
 const [ready,setReady]=useState(false)
 const [authError,setAuthError]=useState('')
 const [vetKey,setVetKey]=useState(0)
 const [vetRequest,setVetRequest]=useState<VetQuickRequest|null>(null)
 const [farrierKey,setFarrierKey]=useState(0)
 const [farrierInitialHorseId,setFarrierInitialHorseId]=useState<string|null>(null)
 const [mobileMoreOpen,setMobileMoreOpen]=useState(false)

 useEffect(()=>{
  let live=true
  const verify=async()=>{
   const {data:{user},error:userError}=await supabase.auth.getUser()
   if(userError||!user){setAuthError('Log in om Optimus Manager te gebruiken.');setReady(true);return}
   const {data:profile,error}=await supabase.rpc('optimus_task_my_profile')
   if(!live)return
   if(error||!profile||!profile.active){setAuthError('Geen toegang. Een actief Optimus-account is vereist.');setReady(true);return}
   if(['member','planner'].includes(profile.role)){window.location.replace('/move');return}
   if(profile.role!=='admin'){setAuthError('Geen toegang tot beheer.');setReady(true);return}
   setName(String(profile.name||'Beheerder'))
   setActive(initialModule())
   setReady(true)
  }
  void verify()
  const onPop=()=>setActive(initialModule())
  window.addEventListener('popstate',onPop)
  return()=>{live=false;window.removeEventListener('popstate',onPop)}
 },[])

 useEffect(()=>{
  if(!mobileMoreOpen)return
  const previousOverflow=document.body.style.overflow
  document.body.style.overflow='hidden'
  const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape')setMobileMoreOpen(false)}
  window.addEventListener('keydown',onKeyDown)
  return()=>{document.body.style.overflow=previousOverflow;window.removeEventListener('keydown',onKeyDown)}
 },[mobileMoreOpen])

 function selectTab(tab:Module){
  setMobileMoreOpen(false)
  setActive(tab)
  if(tab==='Vet'){setVetRequest(null);setVetKey(x=>x+1)}
  if(tab==='Farrier'){setFarrierInitialHorseId(null);setFarrierKey(x=>x+1)}
  window.history.replaceState(null,'','/manager?tab='+encodeURIComponent(tab))
 }

 function openHorseCare(menu:VetQuickRequest['menu']|'Farrier',horseId:string,vaccineType?:VetQuickRequest['vaccineType']){
  if(menu==='Farrier'){
   setFarrierInitialHorseId(horseId)
   setActive('Farrier')
   setFarrierKey(x=>x+1)
   window.history.replaceState(null,'','/manager?tab=Farrier')
   return
  }
  setVetRequest({menu,horseId,vaccineType})
  setActive('Vet')
  setVetKey(x=>x+1)
  window.history.replaceState(null,'','/manager?tab=Vet')
 }

 async function signOut(){await supabase.auth.signOut();window.location.replace('/manager')}
 const activeLabel=modules.find(m=>m.key===active)?.label||active
 const mobileMoreActive=!(['Today','Horses','Vet'] as Module[]).includes(active)
 const mobilePrimary=modules.filter(m=>['Today','Horses','Vet'].includes(m.key))
 const mobileSecondary=modules.filter(m=>['Place','Earth','Farrier','Stock','HorseID','Staff'].includes(m.key))

 function renderModule(){
  switch(active){
   case 'Today':return <TodayTab/>
   case 'Horses':return <HorsesTab onVetQuickAction={openHorseCare}/>
   case 'Vet':return <VetTab key={vetKey} initialRequest={vetRequest}/>
   case 'Place':return <PlaceTab/>
   case 'Earth':return <EarthTab/>
   case 'Farrier':return <FarrierTab key={farrierKey} initialHorseId={farrierInitialHorseId || undefined}/>
   case 'Stock':return <StockTab/>
   case 'HorseID':return <HorseIdTab/>
   case 'Staff':return <StaffDashboard/>
  }
 }
 if(!ready)return <main className="td-loading">Optimus wordt geladen…</main>
 if(authError)return <main className="td-auth"><div><Image src="/optimus-logo-black.png" alt="Optimus" width={300} height={153} className="td-auth-logo" priority/><h1>Optimus Manager</h1><p>{authError}</p><a href="/login">Aanmelden</a></div></main>

 return <div className={`td-app${mobileMoreOpen?' td-mobile-more-open':''}`}>
   <aside className="td-sidebar">
     <div className="td-brandline"><Image src="/optimus-logo-white.png" alt="Optimus" width={220} height={112} className="td-brandmark" priority/></div>
     <nav className="td-nav" aria-label="Optimus modules">
       {modules.map(m=><button type="button" key={m.key} className={active===m.key?'active':''} onClick={()=>selectTab(m.key)}><span>{m.symbol}</span>{m.label}</button>)}
     </nav>
     <div className="td-sidefoot"><strong>{name}</strong><small>Beheerder</small><button className="td-logout" type="button" onClick={()=>void signOut()}>Uitloggen</button></div>
   </aside>
   <div className="td-shell">
     <header className="td-topbar"><div className="td-topbar-title"><span className="td-topbar-eyebrow">STAL OPTIMUS / BEHEER</span><strong>{activeLabel}</strong></div><div className="td-user"><div className="td-language-slot" data-language-slot></div><a className="td-quick-action" href="/move">Paarden verplaatsen</a><span>{name}</span><div className="td-avatar td-desktop-avatar">{name.slice(0,2).toUpperCase()}</div><button className="td-avatar td-mobile-avatar" type="button" aria-label="Open menu" onClick={()=>setMobileMoreOpen(true)}>{name.slice(0,2).toUpperCase()}</button></div></header>
     <nav className="td-mobile-nav" aria-label="Mobiele navigatie">
       {mobilePrimary.map(m=><button key={m.key} type="button" className={active===m.key?'active':''} aria-current={active===m.key?'page':undefined} onClick={()=>selectTab(m.key)}><span>{m.symbol}</span><small>{m.label}</small></button>)}
       <button type="button" className={mobileMoreActive||mobileMoreOpen?'active':''} aria-expanded={mobileMoreOpen} aria-haspopup="dialog" onClick={()=>setMobileMoreOpen(true)}><span>•••</span><small>Meer</small></button>
     </nav>
     {mobileMoreOpen&&<div className="td-mobile-more-overlay">
       <button className="td-mobile-more-backdrop" type="button" aria-label="Close menu" onClick={()=>setMobileMoreOpen(false)} />
       <section className="td-mobile-more-sheet" role="dialog" aria-modal="true" aria-labelledby="td-mobile-more-title">
         <div className="td-mobile-sheet-handle" />
         <header className="td-mobile-sheet-header"><div><Image src="/optimus-logo-black.png" alt="Optimus" width={132} height={68} className="td-mobile-logo"/><h2 id="td-mobile-more-title">Menu</h2></div><button type="button" aria-label="Close menu" onClick={()=>setMobileMoreOpen(false)}>×</button></header>
         <div className="td-mobile-profile"><div className="td-avatar">{name.slice(0,2).toUpperCase()}</div><div><strong>{name}</strong><small>Beheerder</small></div></div>
         <nav className="td-mobile-more-links" aria-label="More sections">
           {mobileSecondary.map(m=><button key={m.key} type="button" className={active===m.key?'active':''} onClick={()=>selectTab(m.key)}><span>{m.symbol}</span><strong>{m.label}</strong><span className="td-mobile-link-arrow">›</span></button>)}
         </nav>
         <div className="td-mobile-settings"><span>Taal</span><div className="td-mobile-language-slot" data-language-slot-mobile /></div>
         <a className="td-mobile-move-link" href="/move">↔ <span>Paarden verplaatsen</span><b>›</b></a>
         <button className="td-mobile-logout" type="button" onClick={()=>void signOut()}>Uitloggen</button>
       </section>
     </div>}
     <main className="td-container">{renderModule()}</main>
   </div>
 </div>
}
