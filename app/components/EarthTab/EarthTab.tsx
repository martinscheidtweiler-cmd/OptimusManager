'use client'
import {useEffect,useMemo,useRef,useState} from 'react'
import type {PointerEvent as ReactPointerEvent} from 'react'
import {supabase} from '@/app/lib/supabaseClient'
import './EarthTab.css'
type Point=[number,number]
type Site={id:string;name:string;slug:string;city:string|null}
type Unit={id:string;site_id:string;name:string;unit_type:string;capacity:number;sort_order:number;map_points:unknown}
type Horse={horse_id:string;horse_name:string;site_id:string;unit_id:string|null;horse_active:boolean|null}
type Geometry={type:'Polygon';coordinates:Point[][]}
const R=20037508.342789244
const initial:Point=[492000,6650000]
const centers:Record<string,Point>={'vremde':[4.525,51.175],'sint-katelijne-waver':[4.535,51.066],'bevel':[4.683,51.137],'broechem':[4.602,51.181]}
function project(p:Point):Point{return [p[0]*R/180,Math.log(Math.tan(Math.PI/4+Math.max(-85,Math.min(85,p[1]))*Math.PI/360))*R/Math.PI]}
function unproject(p:Point):Point{return [p[0]*180/R,(2*Math.atan(Math.exp(p[1]*Math.PI/R))-Math.PI/2)*180/Math.PI]}
function ring(u:Unit):Point[]{const g=u.map_points as Geometry|null;return g?.type==='Polygon'&&Array.isArray(g.coordinates?.[0])?g.coordinates[0].filter(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)):[]}
function middle(p:Point[]):Point{return [p.reduce((n,v)=>n+v[0],0)/p.length,p.reduce((n,v)=>n+v[1],0)/p.length]}
export default function EarthTab(){
 const [sites,setSites]=useState<Site[]>([]),[units,setUnits]=useState<Unit[]>([]),[horses,setHorses]=useState<Horse[]>([])
 const [center,setCenter]=useState<Point>(initial),[zoom,setZoom]=useState(13),[size,setSize]=useState({w:900,h:650})
 const [query,setQuery]=useState(''),[siteId,setSiteId]=useState(''),[unitId,setUnitId]=useState('')
 const [selected,setSelected]=useState<string[]>([]),[destination,setDestination]=useState('')
 const [drawing,setDrawing]=useState(false),[draft,setDraft]=useState<Point[]>([]),[busy,setBusy]=useState(false)
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[loading,setLoading]=useState(true)
 const [photo,setPhoto]=useState(true),[expanded,setExpanded]=useState(false),[newName,setNewName]=useState(''),[newType,setNewType]=useState('pasture')
 const viewport=useRef<HTMLDivElement>(null),drag=useRef<{x:number;y:number;center:Point;moved:boolean}|null>(null)
 const scale=2*R/(256*2**zoom)
 const toScreen=(p:Point):Point=>[(p[0]-center[0])/scale+size.w/2,(center[1]-p[1])/scale+size.h/2]
 const fromScreen=(x:number,y:number):Point=>[center[0]+(x-size.w/2)*scale,center[1]-(y-size.h/2)*scale]
 async function refresh(){
  const [s,u,h]=await Promise.all([supabase.from('sites').select('id,name,slug,city').eq('active',true).order('name'),supabase.from('place_units').select('id,site_id,name,unit_type,capacity,sort_order,map_points').eq('active',true).order('sort_order'),supabase.from('horse_current_places_v2').select('horse_id,horse_name,site_id,unit_id,horse_active')])
  if(s.error||u.error||h.error)throw new Error(s.error?.message||u.error?.message||h.error?.message)
  setSites(s.data||[]);setUnits(u.data||[]);setHorses((h.data||[]).filter(x=>x.horse_active!==false))
 }
 useEffect(()=>{void refresh().catch(e=>setError(e.message)).finally(()=>setLoading(false));const ch=supabase.channel('earth-live').on('postgres_changes',{event:'*',schema:'public',table:'horse_place_assignments'},()=>void refresh().catch(e=>setError(e.message))).on('postgres_changes',{event:'*',schema:'public',table:'place_units'},()=>void refresh().catch(e=>setError(e.message))).subscribe();return()=>{void supabase.removeChannel(ch)}},[])
 useEffect(()=>{const el=viewport.current;if(!el)return;const ro=new ResizeObserver(()=>setSize({w:Math.max(1,el.clientWidth),h:Math.max(1,el.clientHeight)}));ro.observe(el);return()=>ro.disconnect()},[])
 useEffect(()=>{const el=viewport.current;if(!el)return;const wheel=(e:WheelEvent)=>{e.preventDefault();setZoom(z=>Math.max(8,Math.min(21,z+(e.deltaY<0?1:-1))))};el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel)},[])
 const mapped=useMemo(()=>units.filter(u=>ring(u).length>=3),[units])
 const current=units.find(u=>u.id===unitId)
 const filtered=units.filter(u=>u.site_id===siteId)
 const matching=horses.filter(h=>query.trim()&&h.horse_name.toLowerCase().includes(query.trim().toLowerCase())).slice(0,30)
 const counts=(id:string)=>horses.filter(h=>h.unit_id===id)
 function focusSite(s:Site){setSiteId(s.id);setUnitId('');const points=mapped.filter(u=>u.site_id===s.id).flatMap(ring);if(points.length){setCenter(project(middle(points)));setZoom(17)}else if(centers[s.slug]){setCenter(project(centers[s.slug]));setZoom(15);setNotice('Gemeentecentrum bij benadering; teken de werkelijke terreinen in.')}else setNotice('Deze locatie heeft nog geen geografische positie. Zoek het terrein op de kaart en teken het in.')}
 function focusUnit(u:Unit){setSiteId(u.site_id);setUnitId(u.id);const p=ring(u);if(p.length){setCenter(project(middle(p)));setZoom(19)}}
 function focusHorse(h:Horse){const u=units.find(u=>u.id===h.unit_id);if(u)focusUnit(u);else{const s=sites.find(s=>s.id===h.site_id);if(s)focusSite(s)}setSelected([h.horse_id]);setQuery('')}
 function down(e:ReactPointerEvent<HTMLDivElement>){if(e.button!==0)return;drag.current={x:e.clientX,y:e.clientY,center,moved:false};e.currentTarget.setPointerCapture(e.pointerId)}
 function move(e:ReactPointerEvent<HTMLDivElement>){const d=drag.current;if(!d)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.abs(dx)+Math.abs(dy)>5)d.moved=true;if(d.moved)setCenter([d.center[0]-dx*scale,d.center[1]+dy*scale])}
 function up(e:ReactPointerEvent<HTMLDivElement>){const d=drag.current;drag.current=null;if(!d||d.moved||!drawing)return;const rect=e.currentTarget.getBoundingClientRect();setDraft(p=>[...p,unproject(fromScreen(e.clientX-rect.left,e.clientY-rect.top))])}
 async function saveGeometry(){if(!current||draft.length<3)return;setBusy(true);setError('');try{const geometry={type:'Polygon',coordinates:[[...draft,draft[0]]]};const {data,error}=await supabase.from('place_units').update({map_points:geometry}).eq('id',current.id).select('id').single();if(error||!data)throw new Error(error?.message||'Geen schrijfrechten');setDrawing(false);setDraft([]);await refresh();setNotice('Terrein opgeslagen.')}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
 async function addUnit(){if(!siteId||!newName.trim())return;setBusy(true);setError('');try{const {data,error}=await supabase.from('place_units').insert({site_id:siteId,name:newName.trim(),unit_type:newType,capacity:0,active:true,sort_order:filtered.length+1}).select('id').single();if(error||!data)throw new Error(error?.message||'Geen schrijfrechten');await refresh();setUnitId(data.id);setNewName('');setDrawing(true);setDraft([])}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
 async function transfer(){const u=units.find(u=>u.id===destination);if(!u||!selected.length||busy)return;setBusy(true);setError('');try{const {data,error}=await supabase.rpc('optimus_move_group',{p_horse_ids:selected,p_destination_unit:u.id,p_request_id:crypto.randomUUID()});if(error)throw new Error(error.message);setSelected([]);setDestination('');await refresh();setNotice(String(data??0)+' paard(en) verplaatst.')}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
 const tiles=useMemo(()=>{const span=256*scale;const left=center[0]-size.w*scale/2,top=center[1]+size.h*scale/2;const minX=Math.floor((left+R)/span),maxX=Math.floor((left+size.w*scale+R)/span),minY=Math.floor((R-top)/span),maxY=Math.floor((R-top+size.h*scale)/span);const out=[];for(let x=minX;x<=maxX;x++)for(let y=minY;y<=maxY;y++){if(x<0||y<0||x>=2**zoom||y>=2**zoom)continue;const a=x*span-R,b=R-(y+1)*span;const url=photo?'https://geo.api.vlaanderen.be/OMWRGBMRVL/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=Ortho&STYLES=&SRS=EPSG:3857&FORMAT=image/jpeg&WIDTH=256&HEIGHT=256&BBOX='+[a,b,a+span,b+span].join(','):'https://tile.openstreetmap.org/'+zoom+'/'+x+'/'+y+'.png';out.push({key:zoom+'/'+x+'/'+y,url,x:(a-left)/scale,y:(top-(b+span))/scale})}return out},[center,size,zoom,scale,photo])
 return <section className={'earth-shell'+(expanded?' earth-expanded':'')}>
 <header className="earth-head"><div><small>STAL OPTIMUS / GEOGRAPHIC MANAGEMENT</small><h1>Optimus Earth</h1></div><div className="earth-actions"><button onClick={()=>{setCenter(initial);setZoom(13)}}>Regio</button><button onClick={()=>setPhoto(p=>!p)}>{photo?'Stratenkaart':'Luchtfoto'}</button><button onClick={()=>setExpanded(p=>!p)}>{expanded?'Sluiten':'Volledig scherm'}</button></div></header>
 {error&&<p role="alert" className="earth-error">{error}</p>}{notice&&<p role="status" className="earth-note">{notice}<button onClick={()=>setNotice('')}>×</button></p>}
 <div className="earth-grid"><div className="earth-map" ref={viewport} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{drag.current=null}}>
 {tiles.map(t=><img key={t.key+(photo?'p':'s')} src={t.url} alt="" draggable={false} style={{left:t.x,top:t.y}}/>)}
 <svg width={size.w} height={size.h} className="earth-overlay">
 {mapped.map(u=>{const p=ring(u).map(v=>toScreen(project(v)));const m=middle(p);return <g key={u.id}><polygon points={p.map(v=>v.join(',')).join(' ')} className={u.id===unitId?'earth-poly active':'earth-poly'} onPointerDown={e=>{if(!drawing)e.stopPropagation()}} onClick={()=>{if(!drawing){setSiteId(u.site_id);setUnitId(u.id);if(selected.length)setDestination(u.id)}}}/>{zoom>=16&&<text x={m[0]} y={m[1]} textAnchor="middle">{u.name} · {counts(u.id).length}</text>}</g>})}
 {drawing&&draft.length>0&&<g><polyline points={draft.map(p=>toScreen(project(p)).join(',')).join(' ')} fill="none" stroke="#ffd666" strokeWidth="3"/>{draft.map((p,i)=>{const v=toScreen(project(p));return <circle key={i} cx={v[0]} cy={v[1]} r="5" fill="#ffd666"/>})}</g>}
 </svg>
 {zoom<17&&sites.map(s=>{const points=mapped.filter(u=>u.site_id===s.id).flatMap(ring);const p=points.length?middle(points):centers[s.slug];if(!p)return null;const v=toScreen(project(p));return <button key={s.id} className="earth-pin" style={{left:v[0],top:v[1]}} onPointerDown={e=>e.stopPropagation()} onClick={()=>focusSite(s)}>{s.name} · {horses.filter(h=>h.site_id===s.id).length}{!points.length&&' ≈'}</button>})}
 <div className="earth-zoom" onPointerDown={e=>e.stopPropagation()}><button aria-label="Inzoomen" onClick={()=>setZoom(z=>Math.min(21,z+1))}>+</button><button aria-label="Uitzoomen" onClick={()=>setZoom(z=>Math.max(8,z-1))}>−</button></div>
 <div className="earth-credit">{photo?'© Digitaal Vlaanderen – orthofotomozaïek':'© OpenStreetMap contributors'} · Zoom {zoom}</div></div>
 <aside className="earth-side"><label>Zoek een paard<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Naam of nummer"/></label>
 {matching.map(h=><button className="earth-item" key={h.horse_id} onClick={()=>focusHorse(h)}>{h.horse_name}</button>)}
 <h3>Locaties <small>{sites.length}</small></h3>{loading&&<p>Laden…</p>}{sites.map(s=><button className={'earth-item'+(siteId===s.id?' active':'')} key={s.id} onClick={()=>focusSite(s)}><span>{s.name}</span><b>{horses.filter(h=>h.site_id===s.id).length}</b></button>)}
 {siteId&&<><h3>Terreinen / boxen</h3><select value={unitId} onChange={e=>{const u=units.find(x=>x.id===e.target.value);if(u)focusUnit(u);else setUnitId('')}}><option value="">Kies plaats</option>{filtered.map(u=><option key={u.id} value={u.id}>{u.name} · {counts(u.id).length} {ring(u).length?'✓':'(niet ingetekend)'}</option>)}</select><div className="earth-add"><input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Nieuwe plaats"/><select value={newType} onChange={e=>setNewType(e.target.value)}><option value="pasture">Weide</option><option value="stable">Stal / box</option></select><button disabled={busy||!newName.trim()} onClick={()=>void addUnit()}>Toevoegen</button></div></>}
 {current&&<><h3>{current.name}</h3><button onClick={()=>{setDraft([]);setDrawing(true)}}>Grenzen intekenen</button>{drawing&&<div className="earth-draw"><p>Klik de hoekpunten aan op de kaart. Sleep om te navigeren.</p><button onClick={()=>setDraft(p=>p.slice(0,-1))}>Punt terug</button><button disabled={busy||draft.length<3} onClick={()=>void saveGeometry()}>Opslaan</button><button onClick={()=>{setDrawing(false);setDraft([])}}>Annuleren</button></div>}{counts(current.id).map(h=><label className="earth-check" key={h.horse_id}><input type="checkbox" checked={selected.includes(h.horse_id)} onChange={()=>setSelected(p=>p.includes(h.horse_id)?p.filter(x=>x!==h.horse_id):[...p,h.horse_id])}/>{h.horse_name}<a href={'/horses/'+h.horse_id+'/edit'}>Fiche</a></label>)}</>}
 {selected.length>0&&<div className="earth-transfer"><h3>{selected.length} geselecteerd</h3><select value={destination} onChange={e=>setDestination(e.target.value)}><option value="">Kies bestemming</option>{sites.map(s=><optgroup key={s.id} label={s.name}>{units.filter(u=>u.site_id===s.id).map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</optgroup>)}</select><button disabled={!destination||busy} onClick={()=>{if(window.confirm('Verplaats '+selected.length+' paard(en)?'))void transfer()}}>Verplaats paarden</button><button onClick={()=>setSelected([])}>Selectie wissen</button></div>}
 </aside></div></section>
}
