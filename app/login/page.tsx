'use client'

import {useEffect,useState} from 'react'
import Image from 'next/image'
import {supabase} from '@/app/lib/supabaseClient'
import './login.css'

export default function Login(){
 const [email,setEmail]=useState('')
 const [password,setPassword]=useState('')
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 useEffect(()=>{
   let live=true
   void (async()=>{
     const {data:{user}}=await supabase.auth.getUser()
     if(!live||!user)return
     const {data:profile}=await supabase.rpc('optimus_task_my_profile')
     if(profile?.active&&profile.role==='admin')window.location.replace('/manager')
     else if(profile?.active&&['member','planner'].includes(profile.role))window.location.replace('/move')
   })()
   return()=>{live=false}
 },[])
 async function submit(e:React.FormEvent<HTMLFormElement>){
   e.preventDefault()
   if(busy)return
   setBusy(true);setError('')
   try{
     const {error:signInError}=await supabase.auth.signInWithPassword({email:email.trim(),password})
     if(signInError)throw signInError
     const {data:profile,error:profileError}=await supabase.rpc('optimus_task_my_profile')
     if(profileError||!profile?.active||!['admin','member','planner'].includes(profile.role)){
       await supabase.auth.signOut()
       throw new Error('Geen toegang: je account is niet actief voor Optimus.')
     }
     window.location.replace(profile.role==='admin'?'/manager':'/move')
   }catch(err){setError(err instanceof Error?err.message:'Aanmelden mislukt');setBusy(false)}
 }
 return <main className="opt-login">
   <section className="opt-login-card">
     <div className="opt-login-brand"><Image src="/optimus-logo-black.png" alt="Optimus" width={300} height={153} className="opt-login-logo" priority/></div>
     <h1>Welkom terug.</h1><p>Meld je aan om paarden en locaties te beheren.</p>
     <form onSubmit={e=>void submit(e)}>
       <label htmlFor="opt-email">E-mailadres</label><input id="opt-email" autoComplete="username" type="email" required value={email} onChange={e=>setEmail(e.target.value)}/>
       <label htmlFor="opt-password">Wachtwoord</label><input id="opt-password" autoComplete="current-password" type="password" required value={password} onChange={e=>setPassword(e.target.value)}/>
       {error?<p className="opt-login-error" role="alert">{error}</p>:null}
       <button type="submit" disabled={busy}>{busy?'Aanmelden…':'Aanmelden'}</button>
     </form>
     <small className="opt-login-note">Gebruik je bestaande Optimus-account. Er worden geen automatische e-mails verstuurd.</small>
   </section>
 </main>
}
