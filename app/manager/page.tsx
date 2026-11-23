'use client'

import {useEffect,useState} from 'react'
import {supabase} from '@/app/lib/supabaseClient'

import TodayTab from '@/app/components/TodayTab/TodayTab'
import HorsesTab from '@/app/components/HorsesTab/HorsesTab'
import VetTab from '@/app/components/VetTab/VetTab'
import PlaceTab from '@/app/components/PlaceTab/PlaceTab'
import FarrierTab from '@/app/components/FarrierTab/FarrierTab'
import CareTab from '@/app/components/CareTab/CareTab'
import StockTab from '@/app/components/StockTab/StockTab'
import HorseIdTab from '@/app/components/HorseIdTab/HorseIdTab'

import './desktop.css'

type Module = 'Today'|'Horses'|'Vet'|'Place'|'Farrier'|'Care'|'Stock'|'HorseID'
type VetQuickRequest={menu:'Vaccinations'|'Deworming'|'Visits';horseId:string;vaccineType?:'flu_tetanus'|'rhino'}
type NavItem = {key:Module;label:string;symbol:string}
const modules:NavItem[]=[
 {key:'Today',label:'Vandaag',symbol:'◫'},
 {key:'Horses',label:'Paarden',symbol:'♞'},
 {key:'Vet',label:'Dierenarts',symbol:'✚'},
 {key:'Place',label:'Locaties',symbol:'⌖'},
 {key:'Farrier',label:'Hoefsmid',symbol:'∷'},
 {key:'Care',label:'Zorg & fokkerij',symbol:'✦'},
 {key:'Stock',label:'Medicatie',symbol:'▤'},
 {key:'HorseID',label:'HorseID',symbol:'✉'},
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

 function selectTab(tab:Module){
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

 function renderModule(){
  switch(active){
   case 'Today':return <TodayTab/>
   case 'Horses':return <HorsesTab onVetQuickAction={openHorseCare}/>
   case 'Vet':return <VetTab key={vetKey} initialRequest={vetRequest}/>
   case 'Place':return <PlaceTab/>
   case 'Farrier':return <FarrierTab key={farrierKey} initialHorseId={farrierInitialHorseId || undefined}/>
   case 'Care':return <CareTab/>
   case 'Stock':return <StockTab/>
   case 'HorseID':return <HorseIdTab/>
  }
 }
 if(!ready)return <main className="td-loading">Optimus wordt geladen…</main>
 if(authError)return <main className="td-auth"><div><div className="td-auth-logo">O</div><h1>Optimus Manager</h1><p>{authError}</p><a href="/login">Aanmelden</a></div></main>

 return <div className="td-app">
   <aside className="td-sidebar">
     <div className="td-brandline"><div className="td-logo">O</div><div><div className="td-brand">OPTIMUS</div><small>STALMANAGER</small></div></div>
     <nav className="td-nav" aria-label="Optimus modules">
       {modules.map(m=><button type="button" key={m.key} className={active===m.key?'active':''} onClick={()=>selectTab(m.key)}><span>{m.symbol}</span>{m.label}</button>)}
     </nav>
     <div className="td-sidefoot"><strong>{name}</strong><small>Beheerder</small><button className="td-logout" type="button" onClick={()=>void signOut()}>Uitloggen</button></div>
   </aside>
   <div className="td-shell">
     <header className="td-topbar"><div className="td-topbar-title"><span className="td-topbar-eyebrow">STAL OPTIMUS / BEHEER</span><strong>{activeLabel}</strong></div><div className="td-user"><a className="td-quick-action" href="/move">Paarden verplaatsen</a><span>{name}</span><div className="td-avatar">{name.slice(0,2).toUpperCase()}</div></div></header>
     <nav className="td-mobile-nav" aria-label="Mobiele navigatie">{modules.map(m=><button key={m.key} type="button" className={active===m.key?'active':''} onClick={()=>selectTab(m.key)}><span>{m.symbol}</span><small>{m.label}</small></button>)}</nav>
     <main className="td-container">{renderModule()}</main>
   </div>
 </div>
}
