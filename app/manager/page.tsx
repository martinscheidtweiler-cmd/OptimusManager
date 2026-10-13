'use client'

import {useEffect,useState} from 'react'
import {supabase} from '@/app/lib/supabaseClient'

import HorsesTab from '@/app/components/HorsesTab/HorsesTab'
import PlanningTab from '@/app/components/PlanningTab/PlanningTab'
import VetTab from '@/app/components/VetTab/VetTab'
import PlaceTab from '@/app/components/PlaceTab/PlaceTab'
import FarrierTab from '@/app/components/FarrierTab/FarrierTab'
import OperationsTab from '@/app/components/OperationsTab/OperationsTab'

import './desktop.css'

type Module = 'Horses'|'Planning'|'Vet'|'Place'|'Farrier'|'Operations'
type NavItem = {key:Module;label:string;symbol:string}
const modules:NavItem[]=[
 {key:'Horses',label:'Horses',symbol:'♞'},
 {key:'Planning',label:'Planning',symbol:'▤'},
 {key:'Vet',label:'Vet',symbol:'✚'},
 {key:'Place',label:'Place',symbol:'⌖'},
 {key:'Farrier',label:'Farrier',symbol:'∷'},
 {key:'Operations',label:'Ruiterbord',symbol:'▦'}
]
const validModules=new Set<Module>(modules.map(m=>m.key))

function initialModule():Module{
 if(typeof window==='undefined')return 'Horses'
 const value=new URLSearchParams(window.location.search).get('tab') as Module|null
 return value&&validModules.has(value)?value:'Horses'
}

export default function ManagerModules(){
 const [active,setActive]=useState<Module>('Horses')
 const [name,setName]=useState('')
 const [ready,setReady]=useState(false)
 const [vetKey,setVetKey]=useState(0)
 const [farrierKey,setFarrierKey]=useState(0)

 useEffect(()=>{
  let live=true
  const verify=async()=>{
   if(window.matchMedia('(max-width: 720px)').matches){window.location.replace('/tasks');return}
   const session=(await supabase.auth.getSession()).data.session
   if(!session){window.location.replace('/tasks');return}
   const {data:profile,error}=await supabase.rpc('optimus_task_my_profile')
   if(!live)return
   if(error||!profile||profile.role!=='admin'||!profile.active){window.location.replace('/tasks');return}
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
  if(tab==='Vet')setVetKey(x=>x+1)
  if(tab==='Farrier')setFarrierKey(x=>x+1)
  window.history.replaceState(null,'','/manager?tab='+encodeURIComponent(tab))
 }

 async function signOut(){await supabase.auth.signOut();window.location.replace('/tasks')}
 const activeLabel=modules.find(m=>m.key===active)?.label||active

 function renderModule(){
  switch(active){
   case 'Horses':return <HorsesTab/>
   case 'Planning':return <PlanningTab/>
   case 'Vet':return <VetTab key={vetKey}/>
   case 'Place':return <PlaceTab/>
   case 'Farrier':return <FarrierTab key={farrierKey}/>
   case 'Operations':return <OperationsTab/>
  }
 }
 if(!ready)return <main className="td-loading">Optimus wordt geladen…</main>

 return <div className="td-app">
   <aside className="td-sidebar">
     <div className="td-brandline"><div className="td-logo">O</div><div><div className="td-brand">OPTIMUS</div><small>TASKS</small></div></div>
     <nav className="td-nav" aria-label="Optimus modules">
       <a href="/tasks/index.html?view=home"><span>▦</span> Dashboard</a>
       <a href="/tasks/index.html?view=week"><span>▦</span> Weekplanner</a>
       <a href="/tasks/index.html?view=tasks"><span>☑</span> Taken</a>
       <a href="/tasks/index.html?view=team"><span>♧</span> Medewerkers</a>
       {modules.map(m=><button type="button" key={m.key} className={active===m.key?'active':''} onClick={()=>selectTab(m.key)}><span>{m.symbol}</span>{m.label}</button>)}
     </nav>
     <div className="td-sidefoot"><strong>{name}</strong><small>Beheerder</small><button className="td-logout" type="button" onClick={()=>void signOut()}>Uitloggen</button></div>
   </aside>
   <div className="td-shell">
     <header className="td-topbar"><span>OPTIMUS / {activeLabel}</span><div className="td-user"><span>{name}</span><div className="td-avatar">{name.slice(0,2).toUpperCase()}</div></div></header>
     <main className="td-container">{renderModule()}</main>
   </div>
 </div>
}
