const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type","Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...cors}});
Deno.serve(async(req)=>{
 const u=new URL(req.url); const path=u.pathname.replace(/^.*\/optimus-tasks(?=\/|$)/,'')||'/';
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 if(req.method==='GET' && (path==='/'||path===''))return respond({service:'Optimus Tasks backend',status:'active',note:'Gebruik de Vercel-app voor de gebruikersinterface.'});
 
 const url=Deno.env.get('SUPABASE_URL')||'https://rqcjcikemgcqcgxltjfe.supabase.co';const key=Deno.env.get('SUPABASE_ANON_KEY')||'';
 if(req.method==='GET' && path==='/api/config')return key?respond({url,publishableKey:key}):respond({error:'Supabase API key missing'},503);

 // Real voice transcription and AI readiness, available to authorized Optimus admins only.
 if((req.method==='POST' && path==='/api/transcribe')||(req.method==='GET' && path==='/api/ai-status')){
  try{
   const token=(req.headers.get('authorization')||'').replace(/^Bearer\\s+/i,'');
   if(!token)return respond({error:'Login vereist'},401);
   const headers={apikey:key,authorization:'Bearer '+token};
   const a=await fetch(url+'/auth/v1/user',{headers});
   if(!a.ok)return respond({error:'Sessie verlopen'},401);
   const u=await a.json();
   const profile=await fetch(url+'/rest/v1/optimus_task_people?select=id,role,active&user_id=eq.'+encodeURIComponent(u.id),{headers});
   if(!profile.ok)return respond({error:'Profiel kon niet worden gecontroleerd'},403);
   const members=await profile.json();
   if(!members.some(x=>x.role==='admin'&&x.active))return respond({error:'Alleen voor beheerders'},403);
   const aiKey=Deno.env.get('OPENAI_API_KEY');
   if(path==='/api/ai-status')return respond({configured:Boolean(aiKey),status:aiKey?'ready':'missing_key'});
   if(!aiKey)return respond({error:'OpenAI is nog niet gekoppeld. Voeg OPENAI_API_KEY toe bij Supabase Edge Function Secrets.'},503);
   const type=(req.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
   const types={'audio/webm':'webm','audio/mp4':'mp4','audio/ogg':'ogg','audio/wav':'wav','audio/mpeg':'mp3','audio/x-m4a':'m4a'};
   if(!types[type])return respond({error:'Audioformaat wordt niet ondersteund'},415);
   const size=Number(req.headers.get('content-length')||0);
   if(size>8000000)return respond({error:'Maximaal 8 MB per opname'},413);
   const audio=await req.arrayBuffer();
   if(!audio.byteLength||audio.byteLength>8000000)return respond({error:'Lege of te grote opname'},413);
   const form=new FormData();
   form.append('model','gpt-4o-mini-transcribe');
   form.append('file',new Blob([audio],{type}),'opdracht.'+types[type]);
   form.append('prompt','Gesproken Nederlandse opdrachten voor personeel bij Stal Optimus. Neem namen en paardennamen zo precies mogelijk over.');
   const resp=await fetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:'Bearer '+aiKey},body:form});
   const result=await resp.json().catch(()=>({}));
   if(!resp.ok)return respond({error:result.error?.message||'Transcriptie mislukt'},502);
   return respond({text:String(result.text||'').trim().slice(0,9000)});
  }catch(e){console.error('Optimus speech service error',e instanceof Error?e.message:'unknown');return respond({error:'De spraakservice is tijdelijk niet bereikbaar'},502)}
 }
 if(req.method==='POST' && path==='/api/parse'){
   const openai=Deno.env.get('OPENAI_API_KEY');if(!openai)return respond({error:'OpenAI API-key is nog niet ingesteld. Manuele taken werken wel.'},503);
   const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');if(!token)return respond({error:'Login vereist'},401);
   try{
    const headers={apikey:key,authorization:'Bearer '+token};
    const ar=await fetch(url+'/auth/v1/user',{headers});if(!ar.ok)return respond({error:'Sessie ongeldig'},401);
    const who=await ar.json();
    const pr=await fetch(url+'/rest/v1/optimus_task_people?select=id,name,role,active&user_id=eq.'+encodeURIComponent(who.id),{headers});
    if(!pr.ok)return respond({error:'Profiel niet beschikbaar'},403);const mine=await pr.json();
    if(!mine.some(p=>p.role==='admin'&&p.active))return respond({error:'Alleen voor beheerders'},403);
    const list=await fetch(url+'/rest/v1/optimus_task_people?select=id,name,active&active=eq.true',{headers});
    if(!list.ok)return respond({error:'Medewerkers niet beschikbaar'},403);const people=await list.json();
    const body=await req.json();const input=String(body.text||'').trim();
    if(!input||input.length>9000)return respond({error:'Vul een opdracht in (max 9000 tekens)'},400);
    const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Brussels',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const prompt='Extract Dutch horse stable tasks with person_id, title, due_date, due_time, priority. Today in Europe/Brussels: '+today+'. People roster: '+JSON.stringify(people.map(p=>({id:p.id,name:p.name})))+'. Assign ONLY unambiguous person_id from roster, otherwise null. Split separate actions. Missing date today except overall tomorrow applies to all. Missing time null. Never invent tasks. Respond JSON object {"tasks":[{"title":"...","person_id":null,"due_date":"YYYY-MM-DD","due_time":null,"priority":"normal"}]}. Maximum 25.';
    const ai=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+openai},body:JSON.stringify({model:Deno.env.get('OPENAI_MODEL')||'gpt-4.1-mini',temperature:0.1,response_format:{type:'json_object'},messages:[{role:'system',content:prompt},{role:'user',content:input}]})});
    const result=await ai.json();if(!ai.ok)return respond({error:result.error?.message||'AI-provider error'},502);
    const decoded=JSON.parse(result.choices?.[0]?.message?.content||'{}');const ids=new Set(people.map(p=>p.id));const tasks=Array.isArray(decoded.tasks)?decoded.tasks.slice(0,25).map(t=>({title:String(t.title||'').slice(0,300),person_id:ids.has(t.person_id)?t.person_id:null,due_date:/^\d{4}-\d{2}-\d{2}$/.test(t.due_date)?t.due_date:today,due_time:/^([01]\d|2[0-3]):[0-5]\d$/.test(t.due_time)?t.due_time:null,priority:t.priority==='high'?'high':'normal'})).filter(t=>t.title):[];
    return respond({tasks});
   }catch(e){return respond({error:'AI-aanvraag mislukt'},500)}
 }
 return respond({error:'Niet gevonden'},404);
});