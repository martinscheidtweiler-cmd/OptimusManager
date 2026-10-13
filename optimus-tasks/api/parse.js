const json=(res,status,obj)=>res.status(status).json(obj);
export default async function handler(req,res){
 if(req.method!=='POST')return json(res,405,{error:'POST only'});
 const key=process.env.SUPABASE_PUBLISHABLE_KEY,url=process.env.SUPABASE_URL,openai=process.env.OPENAI_API_KEY;
 if(!url||!key)return json(res,503,{error:'Databaseconfiguratie ontbreekt'});
 if(!openai)return json(res,503,{error:'OpenAI API-key ontbreekt nog op Vercel. De gewone takenplanner werkt wel.'});
 const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');if(!token)return json(res,401,{error:'Login vereist'});
 const headers={'apikey':key,'Authorization':'Bearer '+token};
 try {
 const meRes=await fetch(url+'/auth/v1/user',{headers});if(!meRes.ok)return json(res,401,{error:'Sessie ongeldig'});const me=await meRes.json();
 const pRes=await fetch(url+'/rest/v1/optimus_task_people?select=id,name,role,active&user_id=eq.'+encodeURIComponent(me.id),{headers});if(!pRes.ok)return json(res,403,{error:'Profiel niet beschikbaar'});const mine=await pRes.json();if(!mine.some(p=>p.role==='admin'&&p.active))return json(res,403,{error:'Alleen beheerders kunnen AI gebruiken'});
 const listRes=await fetch(url+'/rest/v1/optimus_task_people?select=id,name,active&active=eq.true',{headers});if(!listRes.ok)return json(res,403,{error:'Medewerkers niet beschikbaar'});const members=await listRes.json();
 const input=String(req.body?.text||'').trim();if(!input||input.length>9000)return json(res,400,{error:'Tekst moet 1 tot 9000 tekens bevatten'});
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Brussels',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const prompt=`You create short, clear Dutch team task lists for a horse stable. Today in Belgium is ${today}. Timezone Europe/Brussels. Convert one natural-language or dictated message into separate atomic tasks. Extract person, date, time, and priority. Preserve all concrete work, do not add tasks. Keep title short and imperative. Assign person_id ONLY if the name unambiguously matches this roster: ${JSON.stringify(members.map(p=>({id:p.id,name:p.name})))}. If unknown, person_id must be null. When absent, dates default to today except a message-wide 'morgen' applies to all. Missing time = null. Return JSON object with tasks array of at most 25 task objects with title, person_id, due_date (YYYY-MM-DD), due_time (HH:MM or null), priority ('normal'|'high'). Output Dutch titles.`;
 const result=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+openai},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-4.1-mini',temperature:0.1,response_format:{type:'json_object'},messages:[{role:'system',content:prompt},{role:'user',content:input}]})});const body=await result.json();if(!result.ok)return json(res,502,{error:'AI-provider: '+(body?.error?.message||result.status)});
 const raw=JSON.parse(body.choices?.[0]?.message?.content||'{}');const allowed=new Set(members.map(x=>x.id));const tasks=Array.isArray(raw.tasks)?raw.tasks.slice(0,25).map(t=>({title:String(t.title||'').slice(0,300),person_id:allowed.has(t.person_id)?t.person_id:null,due_date:/^\d{4}-\d{2}-\d{2}$/.test(t.due_date)?t.due_date:today,due_time:/^([01]\d|2[0-3]):[0-5]\d$/.test(t.due_time)?t.due_time:null,priority:t.priority==='high'?'high':'normal'})).filter(t=>t.title):[];return json(res,200,{tasks});
 }catch(err){return json(res,500,{error:'Kon AI-taken niet verwerken'})}
}
