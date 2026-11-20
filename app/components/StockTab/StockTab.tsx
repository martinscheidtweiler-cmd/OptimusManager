'use client'
import {useCallback,useEffect,useMemo,useState} from 'react'
import {supabase} from '@/app/lib/supabaseClient'
import './StockTab.css'

type Medicine={id:string;name:string;active_substance:string|null;category:string|null;form:string|null}
type Stock={id:string;name:string;current_stock:number;next_expiry_date:string|null}
type Batch={id:string;medicine_id:string;medicine_name:string;lot_number:string|null;expiry_date:string|null;remaining_quantity:number;stock_source:string|null}
type Entry={id:string;entry_type:'issuance'|'usage';medicine_name:string;entry_date:string;quantity:number;lot_number:string|null;notes:string|null}
type Threshold={medicine_id:string;minimum_quantity:number}
type Horse={id:string;name:string}
const today=()=>new Date().toLocaleDateString('en-CA')
export default function StockTab(){
 const [medicines,setMedicines]=useState<Medicine[]>([])
 const [stock,setStock]=useState<Stock[]>([])
 const [batches,setBatches]=useState<Batch[]>([])
 const [entries,setEntries]=useState<Entry[]>([])
 const [thresholds,setThresholds]=useState<Threshold[]>([])
 const [horses,setHorses]=useState<Horse[]>([])
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('')
 const [newName,setNewName]=useState(''),[newSubstance,setNewSubstance]=useState(''),[newCategory,setNewCategory]=useState('')
 const [receivedId,setReceivedId]=useState(''),[receivedQty,setReceivedQty]=useState('1'),[lot,setLot]=useState(''),[expiry,setExpiry]=useState(''),[storage,setStorage]=useState(''),[receivedNotes,setReceivedNotes]=useState('')
 const [batchId,setBatchId]=useState(''),[usedQty,setUsedQty]=useState('1'),[reason,setReason]=useState(''),[horseId,setHorseId]=useState(''),[authorizedBy,setAuthorizedBy]=useState(''),[action,setAction]=useState<'use'|'dispose'>('use')
 const [thresholdId,setThresholdId]=useState(''),[minimum,setMinimum]=useState('0')
 const load=useCallback(async()=>{
  const [m,s,b,e,t,h]=await Promise.all([
   supabase.from('medicines').select('id,name,active_substance,category,form').order('name'),
   supabase.from('medicine_stock_view').select('id,name,current_stock,next_expiry_date').order('name'),
   supabase.from('medicine_batch_stock_view').select('id,medicine_id,medicine_name,lot_number,expiry_date,remaining_quantity,stock_source').order('expiry_date',{ascending:true}),
   supabase.from('medicine_register_view').select('id,entry_type,medicine_name,entry_date,quantity,lot_number,notes').order('entry_date',{ascending:false}).limit(100),
   supabase.from('optimus_medicine_thresholds').select('medicine_id,minimum_quantity'),
   supabase.from('horses').select('id,name').eq('active',true).order('name')
  ])
  if(m.error)throw m.error
  if(s.error)throw s.error
  if(b.error)throw b.error
  if(e.error)throw e.error
  if(h.error)throw h.error
  setMedicines((m.data||[]) as Medicine[])
  setStock((s.data||[]) as Stock[])
  setBatches((b.data||[]) as Batch[])
  setEntries((e.data||[]) as Entry[])
  setThresholds(t.error?[]:(t.data||[]) as Threshold[])
  setHorses((h.data||[]) as Horse[])
 },[])
 useEffect(()=>{let live=true;void load().catch(e=>{if(live)setError(e instanceof Error?e.message:String(e))}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[load])
 async function admin(){
  const {data:profile,error:profileError}=await supabase.rpc('optimus_task_my_profile')
  if(profileError||!profile?.active||profile.role!=='admin')throw new Error('Een actief beheerdersaccount is vereist.')
 }
 async function attempt(work:()=>Promise<void>){
  if(busy)return
  setBusy(true);setError('');setMessage('')
  try{await admin();await work();await load()}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
 }
 function validQuantity(value:string){
  const n=Number(value)
  if(!Number.isInteger(n)||n<1||n>100000)throw new Error('Aantal moet een geheel getal tussen 1 en 100.000 zijn.')
  return n
 }
 function createProduct(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault()
  void attempt(async()=>{
   if(!newName.trim())throw new Error('Productnaam ontbreekt.')
   const {error:insertError}=await supabase.from('medicines').insert({
    name:newName.trim(),active_substance:newSubstance.trim()||null,category:newCategory.trim()||null
   })
   if(insertError)throw insertError
   setNewName('');setNewSubstance('');setNewCategory('');setMessage('Product toegevoegd aan het bestaande medicatieregister.')
  })
 }
 function receive(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault()
  void attempt(async()=>{
   if(!receivedId)throw new Error('Kies eerst een product.')
   const {error:insertError}=await supabase.from('medicine_issuances').insert({
    medicine_id:receivedId,issue_date:today(),quantity:validQuantity(receivedQty),
    stock_source:'issuance',lot_number:lot.trim()||null,expiry_date:expiry||null,
    storage_location:storage.trim()||null,notes:receivedNotes.trim()||null,
    horse_scope:'all',horse_ids:[],horse_names:[]
   })
   if(insertError)throw insertError
   setReceivedQty('1');setLot('');setExpiry('');setStorage('');setReceivedNotes('')
   setMessage('Ontvangst opgeslagen in het bestaande medicatieregister.')
  })
 }
 function consume(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault()
  void attempt(async()=>{
   if(!batchId||!reason.trim())throw new Error('Kies een lot en geef een reden op.')
   const {data,rpcError}=await (async()=>{
    const {data,error}=await supabase.rpc('optimus_use_medicine_batch',{
      p_issuance_id:batchId,p_quantity:validQuantity(usedQty),p_reason:reason.trim(),
      p_horse_id:horseId||null,p_authorized_by:authorizedBy.trim()||null,
      p_action:action,p_request_id:crypto.randomUUID()
    })
    return {data,rpcError:error}
   })()
   if(rpcError)throw rpcError
   setUsedQty('1');setReason('');setHorseId('');setAuthorizedBy('')
   setMessage(`Gebruik/afvoer geregistreerd. Nog ${data} in dit lot.`)
  })
 }
 function saveThreshold(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault()
  void attempt(async()=>{
   if(!thresholdId||!Number.isInteger(Number(minimum))||Number(minimum)<0)throw new Error('Vul een geldig minimum in.')
   const {error:saveError}=await supabase.from('optimus_medicine_thresholds').upsert({
    medicine_id:thresholdId,minimum_quantity:Number(minimum),updated_at:new Date().toISOString()
   },{onConflict:'medicine_id'})
   if(saveError)throw saveError
   setMessage('Minimumvoorraad opgeslagen.')
  })
 }
 const limits=useMemo(()=>new Map(thresholds.map(x=>[x.medicine_id,Number(x.minimum_quantity)])),[thresholds])
 const availableBatches=batches.filter(x=>Number(x.remaining_quantity)>0)
 const low=stock.filter(s=>limits.has(s.id)&&Number(s.current_stock)<=Number(limits.get(s.id)))
 return <section className="stock-page">
  <header><span>BESTAAND MEDICATIEREGISTER</span><h1>Medicatie & voorraad</h1><p>Één voorraad, één historiek. Bestaande lotnummers en eerder geregistreerd gebruik blijven behouden.</p></header>
  {error?<p role="alert" className="stock-error">{error}</p>:null}{message?<p role="status" className="stock-success">{message}</p>:null}
  <div className="stock-kpis"><article><strong>{medicines.length}</strong><span>Producten</span></article><article><strong>{availableBatches.length}</strong><span>Beschikbare loten</span></article><article><strong>{low.length}</strong><span>Onder minimum</span></article></div>
  <div className="stock-layout">
   <div className="stock-stack">
    <form className="stock-card" onSubmit={e=>consume(e)}><h2>Gebruik of afvoer</h2>
     <div className="stock-direction"><button type="button" className={action==='use'?'active':''} onClick={()=>setAction('use')}>Gebruikt</button><button type="button" className={action==='dispose'?'active':''} onClick={()=>setAction('dispose')}>Afgevoerd</button></div>
     <label>Lot<select required value={batchId} onChange={e=>setBatchId(e.target.value)}><option value="">Kies een beschikbaar lot</option>{availableBatches.map(b=><option key={b.id} value={b.id}>{b.medicine_name} · {b.lot_number||'geen lotnummer'} · {b.remaining_quantity} beschikbaar</option>)}</select></label>
     <label>Aantal<input type="number" required min="1" step="1" value={usedQty} onChange={e=>setUsedQty(e.target.value)}/></label>
     <label>Reden<input required value={reason} onChange={e=>setReason(e.target.value)} placeholder="Behandeling of reden voor afvoer"/></label>
     <label>Paard (optioneel)<select value={horseId} onChange={e=>setHorseId(e.target.value)}><option value="">Geen specifiek paard</option>{horses.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select></label>
     <label>Goedgekeurd door<input value={authorizedBy} onChange={e=>setAuthorizedBy(e.target.value)} placeholder="Dierenarts of verantwoordelijke"/></label>
     <button disabled={busy||!batchId||!reason.trim()}>Registreer {action==='use'?'gebruik':'afvoer'}</button>
    </form>
    <form className="stock-card" onSubmit={e=>receive(e)}><h2>Nieuwe levering</h2>
     <label>Product<select required value={receivedId} onChange={e=>setReceivedId(e.target.value)}><option value="">Kies een product</option>{medicines.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
     <label>Aantal<input required type="number" min="1" step="1" value={receivedQty} onChange={e=>setReceivedQty(e.target.value)}/></label>
     <label>Lotnummer<input value={lot} onChange={e=>setLot(e.target.value)}/></label>
     <label>Vervaldatum<input type="date" value={expiry} onChange={e=>setExpiry(e.target.value)}/></label>
     <label>Bewaarplaats<input value={storage} onChange={e=>setStorage(e.target.value)}/></label>
     <label>Notities<input value={receivedNotes} onChange={e=>setReceivedNotes(e.target.value)}/></label>
     <button disabled={busy||!receivedId}>Registreer ontvangst</button>
    </form>
    <form className="stock-card" onSubmit={e=>saveThreshold(e)}><h2>Minimumvoorraad</h2>
     <label>Product<select required value={thresholdId} onChange={e=>{setThresholdId(e.target.value);setMinimum(String(limits.get(e.target.value)??0))}}><option value="">Kies een product</option>{medicines.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
     <label>Waarschuw vanaf<input required type="number" min="0" step="1" value={minimum} onChange={e=>setMinimum(e.target.value)}/></label>
     <button disabled={busy||!thresholdId}>Bewaar grens</button>
    </form>
    <form className="stock-card" onSubmit={e=>createProduct(e)}><h2>Nieuw product</h2>
     <label>Naam<input required value={newName} onChange={e=>setNewName(e.target.value)}/></label>
     <label>Werkzame stof<input value={newSubstance} onChange={e=>setNewSubstance(e.target.value)}/></label>
     <label>Categorie<input value={newCategory} onChange={e=>setNewCategory(e.target.value)}/></label>
     <button disabled={busy||!newName.trim()}>Product toevoegen</button>
    </form>
   </div>
   <div className="stock-stack">
    <section className="stock-card"><h2>Actuele voorraad</h2>{loading?<p>Laden…</p>:stock.length===0?<p>Geen producten in de voorraad.</p>:<div className="stock-items">{stock.map(item=><article key={item.id}><div><strong>{item.name}</strong><span>{item.current_stock} stuks</span></div>
     {item.next_expiry_date?<small>Eerstvolgende vervaldatum: {item.next_expiry_date}</small>:null}
     {limits.has(item.id)&&Number(item.current_stock)<=Number(limits.get(item.id))?<p className="stock-warning">Minimumvoorraad bereikt</p>:null}
    </article>)}</div>}</section>
    <section className="stock-card"><h2>Vervallende loten</h2><div className="stock-items">{batches.filter(b=>b.expiry_date&&b.expiry_date<=today()&&b.remaining_quantity>0).map(b=><article key={b.id}><strong>{b.medicine_name}</strong><small>Lot {b.lot_number||'—'} · {b.remaining_quantity} resterend · Vervallen op {b.expiry_date}</small><p className="stock-warning">Niet meer gebruiken</p></article>)}</div></section>
    <section className="stock-card"><h2>Historiek</h2><div className="stock-items">{entries.map(e=><article key={e.entry_type+'-'+e.id}><div><strong>{e.medicine_name}</strong><span>{e.entry_type==='usage'?'-':'+'}{e.quantity}</span></div><small>{e.entry_date} · {e.lot_number||'lot niet ingevuld'}</small>{e.notes?<small>{e.notes}</small>:null}</article>)}</div></section>
   </div>
  </div>
 </section>
}
