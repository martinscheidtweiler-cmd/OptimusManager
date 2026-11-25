'use client'
import {useEffect,useState,useCallback} from 'react'
import {supabase} from '@/app/lib/supabaseClient'
import './staff.css'
type Item={id:number;name:string;active:boolean;location_id?:number;phone?:string}
type Shift={id:string;worker_id:number;started_at:string;ended_at:string|null}
type Entry={id:string;shift_id:string;task_id:number;started_at:string;ended_at:string|null}
export default function StaffPhone(){
 const [workers,W]=useState<Item[]>([]),[locations,L]=useState<Item[]>([]),[tasks,T]=useState<Item[]>([]),[contacts,C]=useState<Item[]>([]),[shift,S]=useState<Shift|null>(null),[entry,E]=useState<Entry|null>(null),[place,P]=useState<number|null>(null),[contact,Q]=useState(false),[error,X]=useState(''),[ready,R]=useState(false),[allowed,A]=useState(false),[busy,B]=useState(false),[now,N]=useState(Date.now()),[gps,G]=useState(false),[gpsStatus,H]=useState('Uit')
 const [code,Code]=useState(''),[pairInput,PairInput]=useState('')
 function apply(data:{workers:Item[];locations:Item[];tasks:Item[];contacts:Item[];shift:Shift|null;entry:Entry|null}){W(data.workers);L(data.locations);T(data.tasks);C(data.contacts);S(data.shift);E(data.entry);A(true);X('')}
 const load=useCallback(async()=>{if(!code){R(true);return}const r=await supabase.rpc('staff_phone',{code,action:'load'});if(r.error){X(r.error.message);A(false);S(null);E(null);G(false)}else apply(r.data);R(true)},[code])
 useEffect(()=>{Code(localStorage.getItem('optimus-staff-pair')||'');const t=setInterval(()=>N(Date.now()),1000);return()=>clearInterval(t)},[])
 useEffect(()=>{void load();const t=setInterval(()=>void load(),30000);return()=>clearInterval(t)},[load])
 useEffect(()=>{if('serviceWorker' in navigator)navigator.serviceWorker.register('/staff-sw.js',{scope:'/staff'}).catch(()=>{})},[])
 useEffect(()=>{if(!shift||!gps||!code)return;let last=0;let cancelled=false;if(!navigator.geolocation){H('Niet beschikbaar');return}const id=navigator.geolocation.watchPosition(async p=>{if(cancelled||document.visibilityState!=='visible'||Date.now()-last<15000)return;last=Date.now();const r=await supabase.rpc('staff_phone',{code,action:'position',latitude:p.coords.latitude,longitude:p.coords.longitude,precision_m:p.coords.accuracy});H(r.error?'Synchronisatie mislukt':'Actief · '+new Date().toLocaleTimeString('nl-BE'))},e=>H(e.message),{enableHighAccuracy:true,maximumAge:10000,timeout:20000});return()=>{cancelled=true;navigator.geolocation.clearWatch(id)}},[shift?.id,gps,code])
 async function action(action:string,target?:number){if(busy)return;B(true);X('');const r=await supabase.rpc('staff_phone',{code,action,target:target??null});if(r.error)X(r.error.message);else{if(action==='begin'&&navigator.geolocation){G(true);H('Toestemming gevraagd')}if(action==='end'){G(false);H('Uit');P(null);Q(false)}if(action==='task')P(null);if(action==='clear_position')H('Uit');else apply(r.data)}B(false)}
 async function login(e:React.FormEvent){e.preventDefault();B(true);const value=pairInput.trim().toLowerCase();const r=await supabase.rpc('staff_phone',{code:value,action:'load'});if(r.error)X('Koppelcode ongeldig of ingetrokken.');else{localStorage.setItem('optimus-staff-pair',value);Code(value);PairInput('');apply(r.data)}B(false)}
 const current=tasks.find(t=>t.id===entry?.task_id), seconds=entry?Math.max(0,Math.floor((now-Date.parse(entry.started_at))/1000)):0
 const fmt=[Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(v=>String(v).padStart(2,'0')).join(':')
 return <main className="staff-phone"><style>{`
.staff-phone,.staff-phone *{box-sizing:border-box}
.staff-phone{width:100%;overflow-wrap:anywhere;padding:16px}
.staff-phone input,.staff-phone button{max-width:100%;min-width:0}
.staff-phone .staff-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 14px;min-height:36px}
.staff-phone .staff-person{font-size:17px;font-weight:650;min-width:0}
.staff-phone [data-language-slot]{display:flex;justify-content:flex-end;flex-shrink:0}
.staff-phone .opt-language-control{position:static;max-width:100%;min-height:30px;box-shadow:none;padding:2px 6px}
.staff-phone .opt-language-label{display:none}
.staff-phone .opt-language-control select{max-width:34vw;font-size:12px;min-height:26px}
.staff-phone .staff-location-status{font-size:12px;color:#555;margin:0 0 16px;line-height:1.4}
.staff-phone .staff-location-status summary{cursor:pointer;display:list-item}
.staff-phone .staff-location-status button{width:auto;font-size:13px;min-height:36px;padding:8px 12px;margin-top:8px}
.staff-phone .staff-timer{padding:16px;margin-bottom:10px}
.staff-phone .staff-timer h2{margin:8px 0}
.staff-phone .staff-timer strong{display:block;font-size:40px;line-height:1.2;margin-bottom:8px}
.staff-phone .staff-locations button{min-height:64px}
.staff-phone .staff-locations{gap:8px;margin-bottom:14px}
`}</style><div className="staff-top"><span className="staff-person">{shift?workers.find(w=>w.id===shift.worker_id)?.name:'Optimus Tasks'}</span><div data-language-slot data-language-slot-mobile/></div>{error&&<p role="alert" className="staff-error">{error}</p>}{!ready?<p>Laden…</p>:!allowed?<form onSubmit={login}><h2>Werktelefoon aanmelden</h2><p>Maak een koppelcode in Optimus Manager → Personeel → Beheer.</p><input required type="password" autoComplete="off" placeholder="Koppelcode" value={pairInput} onChange={e=>PairInput(e.target.value)}/><button disabled={busy}>Telefoon koppelen</button></form>:!shift?<><h2>Wie ben je vandaag?</h2><p>Start je werkdag door je naam te kiezen. Tijdens je werkdag kan je locatie zichtbaar zijn voor bevoegde beheerders nadat je toestemming geeft. GPS-deling stopt bij het beëindigen van je werkdag.</p>{workers.map(w=><button disabled={busy} key={w.id} onClick={()=>action('begin',w.id)}>{w.name} <span>›</span></button>)}</>:<><section className="staff-timer"><small>HUIDIGE TAAK</small><h2>{current?current.name+' · '+locations.find(l=>l.id===current.location_id)?.name:'Geen actieve taak'}</h2><strong>{fmt}</strong>{entry&&<button disabled={busy} onClick={()=>action('stop')}>Stop taak</button>}</section><details className="staff-location-status"><summary>{gps?('GPS · '+gpsStatus):'GPS · Uit'}</summary><button type="button" disabled={busy} onClick={async()=>{if(gps){G(false);H('Uit');await action('clear_position')}else if(navigator.geolocation){G(true);H('Toestemming gevraagd')}else H('Niet beschikbaar')}}>{gps?'Locatie delen stoppen':'Locatie delen starten'}</button></details>{contact?<><button onClick={()=>Q(false)}>← Terug</button><h2>Contact</h2>{contacts.map(c=><section key={c.id} className="staff-contact"><b>{c.name}</b>{c.phone?<><a href={'tel:'+c.phone}>Bellen</a><a href={'sms:'+c.phone}>Bericht</a></>:<small>Nummer nog niet ingesteld</small>}</section>)}</>:place!==null?<><button onClick={()=>P(null)}>← Locaties</button><h2>{locations.find(l=>l.id===place)?.name}</h2>{tasks.filter(t=>t.location_id===place).map(t=><button disabled={busy} key={t.id} onClick={()=>action('task',t.id)}>{t.name}<span>›</span></button>)}</>:<><h2>Taken per locatie</h2><div className="staff-locations">{locations.map(l=><button key={l.id} onClick={()=>P(l.id)}>{l.name}<span>›</span></button>)}</div><button onClick={()=>Q(true)}>Contact <span>›</span></button><button disabled={busy} onClick={()=>{if(confirm('Werkdag beëindigen?'))void action('end')}}>Werkdag beëindigen</button></>}</>}</main>
}
