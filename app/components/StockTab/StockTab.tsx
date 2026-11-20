'use client'
import {useCallback,useEffect,useMemo,useState} from 'react'
import {supabase} from '@/app/lib/supabaseClient'
import './StockTab.css'

type Stock={id:string;name:string;lot_number:string|null;expires_on:string|null;quantity:number;unit:string;minimum_quantity:number;notes:string|null}
type Movement={id:string;stock_id:string;horse_id:string|null;delta:number;reason:string;authorized_by:string|null;created_at:string}
type Horse={id:string;name:string}
export default function StockTab(){
 const [items,setItems]=useState<Stock[]>([])
 const [movements,setMovements]=useState<Movement[]>([])
 const [horses,setHorses]=useState<Horse[]>([])
 const [name,setName]=useState(''),[lot,setLot]=useState(''),[expiry,setExpiry]=useState(''),[qty,setQty]=useState('0'),[unit,setUnit]=useState('stuks'),[minimum,setMinimum]=useState('0')
 const [stockId,setStockId]=useState(''),[direction,setDirection]=useState<'in'|'out'>('out'),[amount,setAmount]=useState('1'),[reason,setReason]=useState(''),[horseId,setHorseId]=useState(''),[authorizedBy,setAuthorizedBy]=useState('')
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[message,setMessage]=useState('')
 const load=useCallback(async()=>{
  const [a,b,c]=await Promise.all([
    supabase.from('optimus_medication_stock').select('id,name,lot_number,expires_on,quantity,unit,minimum_quantity,notes').order('name'),
    supabase.from('optimus_medication_movements').select('id,stock_id,horse_id,delta,reason,authorized_by,created_at').order('created_at',{ascending:false}).limit(60),
    supabase.from('horses').select('id,name').eq('active',true).order('name')
  ])
  if(a.error)throw a.error
  if(b.error)throw b.error
  if(c.error)throw c.error
  setItems((a.data||[]) as Stock[])
  setMovements((b.data||[]) as Movement[])
  setHorses((c.data||[]) as Horse[])
 },[])
 useEffect(()=>{let live=true;void load().catch(e=>{if(live)setError(e instanceof Error?e.message:String(e))}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[load])
 async function checkAdmin(){
  const {data:profile,error:profileError}=await supabase.rpc('optimus_task_my_profile')
  if(profileError||!profile?.active||profile.role!=='admin')throw new Error('Geen beheerdersrechten')
 }
 async function save(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return
  setBusy(true);setError('');setMessage('')
  try{
   await checkAdmin()
   if(!name.trim()||!unit.trim()||!Number.isFinite(Number(qty))||Number(qty)<0||Number(minimum)<0)throw new Error('Controleer de productgegevens.')
   const {error:insertError}=await supabase.from('optimus_medication_stock').insert({
    name:name.trim(),lot_number:lot.trim()||null,expires_on:expiry||null,
    quantity:Number(qty),unit:unit.trim(),minimum_quantity:Number(minimum)
   })
   if(insertError)throw insertError
   await load();setName('');setLot('');setExpiry('');setQty('0')
   setMessage('Product en beginvoorraad opgeslagen.')
  }catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
 }
 async function adjust(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy||!stockId)return
  setBusy(true);setError('');setMessage('')
  try{
   await checkAdmin()
   const quantity=Number(amount)
   if(!Number.isFinite(quantity)||quantity<=0||!reason.trim())throw new Error('Geef een geldig aantal en reden op.')
   const {data, error:rpcError}=await supabase.rpc('optimus_adjust_medication_stock',{
    p_stock_id:stockId,p_delta:direction==='out'?-quantity:quantity,
    p_reason:reason.trim(),p_horse_id:horseId||null,p_authorized_by:authorizedBy.trim()||null
   })
   if(rpcError)throw rpcError
   await load()
   setAmount('1');setReason('');setHorseId('');setAuthorizedBy('')
   setMessage(`Voorraad aangepast. Nieuw saldo: ${data}.`)
  }catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
 }
 const byHorse=useMemo(()=>new Map(horses.map(h=>[h.id,h.name])),[horses])
 const byStock=useMemo(()=>new Map(items.map(item=>[item.id,item.name])),[items])
 const today=new Date().toLocaleDateString('en-CA')
 return <section className="stock-page">
 <header><span>MEDICATIE</span><h1>Voorraad & gebruik</h1><p>Producten per lot bewaren, gebruik registreren en actuele voorraad opvolgen.</p></header>
 {error?<p role="alert" className="stock-error">{error}</p>:null}
 {message?<p role="status" className="stock-success">{message}</p>:null}
 <div className="stock-layout">
   <div className="stock-stack">
    <form className="stock-card" onSubmit={e=>void adjust(e)}>
     <h2>Voorraad aanpassen</h2>
     <label>Product<select required value={stockId} onChange={e=>setStockId(e.target.value)}><option value="">Kies een product</option>{items.map(x=><option key={x.id} value={x.id}>{x.name} ({x.quantity} {x.unit}) · {x.lot_number||'zonder lot'}</option>)}</select></label>
     <div className="stock-direction"><button type="button" className={direction==='out'?'active':''} onClick={()=>setDirection('out')}>Gebruik / afvoer</button><button type="button" className={direction==='in'?'active':''} onClick={()=>setDirection('in')}>Ontvangst</button></div>
     <label>Hoeveelheid<input required type="number" min="0.001" step="any" value={amount} onChange={e=>setAmount(e.target.value)}/></label>
     <label>Reden<input required value={reason} onChange={e=>setReason(e.target.value)} placeholder="Behandeling, aankoop, vervallen…"/></label>
     <label>Paard (optioneel)<select value={horseId} onChange={e=>setHorseId(e.target.value)}><option value="">Geen specifiek paard</option>{horses.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select></label>
     <label>Goedgekeurd door (optioneel)<input value={authorizedBy} onChange={e=>setAuthorizedBy(e.target.value)} placeholder="Dierenarts / verantwoordelijke"/></label>
     <button disabled={busy||!stockId||!reason.trim()} type="submit">{busy?'Opslaan…':'Registreer voorraadwijziging'}</button>
    </form>
    <form className="stock-card" onSubmit={e=>void save(e)}>
     <h2>Nieuw product</h2>
     <label>Naam<input required value={name} onChange={e=>setName(e.target.value)}/></label>
     <label>Lotnummer<input value={lot} onChange={e=>setLot(e.target.value)}/></label>
     <label>Vervaldatum<input type="date" value={expiry} onChange={e=>setExpiry(e.target.value)}/></label>
     <label>Beginvoorraad<input required type="number" min="0" step="any" value={qty} onChange={e=>setQty(e.target.value)}/></label>
     <label>Eenheid<input required value={unit} onChange={e=>setUnit(e.target.value)}/></label>
     <label>Minimumvoorraad<input required type="number" min="0" step="any" value={minimum} onChange={e=>setMinimum(e.target.value)}/></label>
     <button disabled={busy||!name.trim()} type="submit">{busy?'Opslaan…':'Product toevoegen'}</button>
    </form>
   </div>
   <div className="stock-stack">
    <section className="stock-card"><h2>Actuele voorraad</h2>{loading?<p>Laden…</p>:items.length===0?<p>Geen voorraadgegevens beschikbaar.</p>:<div className="stock-items">{items.map(item=><article key={item.id}>
     <div><strong>{item.name}</strong><span>{item.quantity} {item.unit}</span></div>
     <small>Lot: {item.lot_number||'—'} · Vervalt: {item.expires_on||'—'}</small>
     {item.quantity<=item.minimum_quantity?<p className="stock-warning">Minimumvoorraad bereikt</p>:null}
     {item.expires_on&&item.expires_on<today?<p className="stock-warning">Vervallen — niet gebruiken</p>:null}
    </article>)}</div>}</section>
    <section className="stock-card"><h2>Voorraadhistoriek</h2>{movements.length===0?<p>Er zijn nog geen afboekingen of ontvangsten.</p>:<div className="stock-items">{movements.map(m=><article key={m.id}>
      <div><strong>{byStock.get(m.stock_id)||'Product'}</strong><span>{m.delta>0?'+':''}{m.delta}</span></div>
      <small>{new Date(m.created_at).toLocaleString('nl-BE')} · {m.reason}</small>
      {m.horse_id?<small>Paard: {byHorse.get(m.horse_id)||m.horse_id}</small>:null}
      {m.authorized_by?<small>Goedgekeurd: {m.authorized_by}</small>:null}
    </article>)}</div>}</section>
   </div>
 </div>
 </section>
}
