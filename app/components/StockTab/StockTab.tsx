'use client'
import {useCallback,useEffect,useState} from 'react'
import {supabase} from '@/app/lib/supabaseClient'
import './StockTab.css'
type Stock={id:string;name:string;lot_number:string|null;expires_on:string|null;quantity:number;unit:string;minimum_quantity:number;notes:string|null}
export default function StockTab(){
 const [items,setItems]=useState<Stock[]>([]),[name,setName]=useState(''),[lot,setLot]=useState(''),[expiry,setExpiry]=useState(''),[qty,setQty]=useState('0'),[unit,setUnit]=useState('stuks'),[minimum,setMinimum]=useState('0')
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('')
 const load=useCallback(async()=>{const {data,error}=await supabase.from('optimus_medication_stock').select('id,name,lot_number,expires_on,quantity,unit,minimum_quantity,notes').order('name');if(error)throw error;setItems((data||[]) as Stock[])},[])
 useEffect(()=>{void load().catch(e=>setError(e instanceof Error?e.message:String(e)))},[load])
 async function save(e:React.FormEvent<HTMLFormElement>){e.preventDefault();if(busy)return;setBusy(true);setError('');setMessage('')
  try{
   const {data:profile,error:profileError}=await supabase.rpc('optimus_task_my_profile')
   if(profileError||!profile?.active||profile.role!=='admin')throw new Error('Geen beheerdersrechten')
   const {error}=await supabase.from('optimus_medication_stock').insert({name:name.trim(),lot_number:lot.trim()||null,expires_on:expiry||null,quantity:Number(qty),unit:unit.trim(),minimum_quantity:Number(minimum)})
   if(error)throw error
   await load();setName('');setLot('');setExpiry('');setQty('0');setMessage('Voorraad opgeslagen.')
  }catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
 }
 const today=new Date().toLocaleDateString('en-CA')
 return <section className="stock-page"><header><span>MEDICATIE</span><h1>Voorraad</h1><p>Lotnummers, vervaldatums en minimumvoorraad overzichtelijk beheren.</p></header>
 {error?<p role="alert" className="stock-error">{error}</p>:null}{message?<p role="status" className="stock-success">{message}</p>:null}
 <div className="stock-layout"><form className="stock-card" onSubmit={e=>void save(e)}><h2>Product toevoegen</h2>
 <label>Naam<input required value={name} onChange={e=>setName(e.target.value)}/></label>
 <label>Lotnummer<input value={lot} onChange={e=>setLot(e.target.value)}/></label>
 <label>Vervaldatum<input type="date" value={expiry} onChange={e=>setExpiry(e.target.value)}/></label>
 <label>Aantal<input required type="number" min="0" step="any" value={qty} onChange={e=>setQty(e.target.value)}/></label>
 <label>Eenheid<input required value={unit} onChange={e=>setUnit(e.target.value)}/></label>
 <label>Minimumvoorraad<input required type="number" min="0" step="any" value={minimum} onChange={e=>setMinimum(e.target.value)}/></label>
 <button disabled={busy||!name.trim()}>{busy?'Opslaan…':'Product opslaan'}</button></form>
 <div className="stock-card"><h2>Huidige voorraad</h2>{items.length===0?<p>Geen voorraadgegevens beschikbaar.</p>:<div className="stock-items">{items.map(item=><article key={item.id}><div><strong>{item.name}</strong><span>{item.quantity} {item.unit}</span></div><small>Lot: {item.lot_number||'—'} · Vervalt: {item.expires_on||'—'}</small>{item.quantity<=item.minimum_quantity?<p className="stock-warning">Minimumvoorraad bereikt</p>:null}{item.expires_on&&item.expires_on<today?<p className="stock-warning">Vervallen — niet gebruiken</p>:null}</article>)}</div>}</div></div>
 </section>
}
