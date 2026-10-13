const api=async(name,args)=>{let r=await fetch(process.env.SUPABASE_URL+'/rest/v1/rpc/'+name,{method:'POST',headers:{'Content-Type':'application/json','apikey':process.env.SUPABASE_PUBLISHABLE_KEY},body:JSON.stringify(args)});const x=await r.json().catch(()=>null);if(!r.ok)throw Error(JSON.stringify(x));return x};
export default async function handler(req,res){
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 const secret=process.env.CRON_SECRET;
 if(!secret||req.headers.authorization!==`Bearer ${secret}`)return res.status(401).json({error:'Unauthorized'});
 const hh=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Brussels',hour:'2-digit',hourCycle:'h23'}).format(new Date());
 if(hh!=='07'&&req.query?.force!=='1')return res.status(200).json({status:'outside local 07:00'});
 const tok=process.env.WHATSAPP_ACCESS_TOKEN,pid=process.env.WHATSAPP_PHONE_NUMBER_ID,template=process.env.WHATSAPP_TEMPLATE_NAME,lang=process.env.WHATSAPP_TEMPLATE_LANGUAGE||'nl';
 if(!tok||!pid||!template)return res.status(503).json({status:'WhatsApp not configured',message:'Add Meta credentials and approved template in Vercel'});
 if(!process.env.SUPABASE_URL||!process.env.SUPABASE_PUBLISHABLE_KEY)return res.status(503).json({error:'Supabase not configured'});
 try{
 const digests=await api('optimus_task_digests',{secret});let sent=0,failed=0;
 for(const p of (digests||[]).slice(0,100)){
  const text=(p.task_lines||[]).map((t,i)=>`${i+1}. ${t.time?t.time+' — ':''}${t.title}`).join('\n').slice(0,880);
  try{
   const send=await fetch(`https://graph.facebook.com/v23.0/${pid}/messages`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tok},body:JSON.stringify({messaging_product:'whatsapp',to:p.phone.replace('+',''),type:'template',template:{name:template,language:{code:lang},components:[{type:'body',parameters:[{type:'text',text:p.name.slice(0,80)},{type:'text',text:text||'Geen openstaande taken'}]}]}})});
   const result=await send.json();if(!send.ok)throw Error(result?.error?.message||'Meta '+send.status);
   await api('optimus_task_delivery_log',{secret,person:p.person_id,day:p.for_date,provider:result.messages?.[0]?.id||'',ok:true,details:null});sent++;
  }catch(e){failed++;await api('optimus_task_delivery_log',{secret,person:p.person_id,day:p.for_date,provider:'',ok:false,details:String(e.message).slice(0,300)}).catch(()=>{})}
 }
 return res.status(200).json({status:'completed',sent,failed});
 }catch(e){return res.status(500).json({error:'Daily delivery failed'})}
}
