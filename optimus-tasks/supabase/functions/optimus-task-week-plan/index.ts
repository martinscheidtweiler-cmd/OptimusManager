
const URLBASE=Deno.env.get('SUPABASE_URL')||'https://rqcjcikemgcqcgxltjfe.supabase.co';
const KEY=Deno.env.get('SUPABASE_ANON_KEY')||'';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
const respond=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const day=(d,n)=>{const a=new Date(d+'T12:00:00Z');a.setUTCDate(a.getUTCDate()+n);return a.toISOString().slice(0,10)};
const cap=x=>Math.max(0,(Number(x.end_time.slice(0,2))*60+Number(x.end_time.slice(3,5)))-(Number(x.start_time.slice(0,2))*60+Number(x.start_time.slice(3,5)))-(x.break_minutes||0));
const min=t=>t?Number(t.slice(0,2))*60+Number(t.slice(3,5)):null;
const hh=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
const slot=(w,len,preferred)=>{if(!w?.start||!w?.end)return null;const blocks=[...w.busy].sort((a,b)=>a.start-b.start);if(preferred!==null){if(preferred<w.start||preferred+len>w.end||blocks.some(b=>preferred<b.end&&preferred+len>b.start))return null;return preferred}let pos=w.start;for(const block of blocks){if(pos+len<=block.start)return pos;pos=Math.max(pos,block.end)}return pos+len<=w.end?pos:null};
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 if(req.method!=='POST')return respond({error:'POST required'},405);
 try{
 const bearer=req.headers.get('authorization')||'';
 if(!bearer.startsWith('Bearer ')||!KEY)return respond({error:'Admin login required'},401);
 const headers={apikey:KEY,Authorization:bearer};
 const auth=await fetch(URLBASE+'/auth/v1/user',{headers});
 if(!auth.ok)return respond({error:'Invalid session'},401);
 const u=await auth.json();
 const own=await fetch(URLBASE+'/rest/v1/optimus_task_people?select=id,role,active&user_id=eq.'+encodeURIComponent(u.id),{headers});
 if(!own.ok||!(await own.json()).some(p=>p.role==='admin'&&p.active))return respond({error:'Beheerder vereist'},403);
 const request=await req.json();
 const week=String(request.week_monday||'');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(week)||new Date(week+'T12:00:00Z').getUTCDay()!==1)return respond({error:'Startweek moet een maandag zijn'},400);
 const until=day(week,7);
 const read=async(path)=>{let x=await fetch(URLBASE+'/rest/v1/'+path,{headers});if(!x.ok)throw Error('Could not load scheduling inputs');return x.json()};
 const [people,availability,templates,existing,rides]=await Promise.all([
 read('optimus_task_people?select=id,name,skills,departments,active&active=eq.true'),
 read('optimus_task_availability?select=person_id,work_date,working,start_time,end_time,break_minutes,confirmed&work_date=gte.'+week+'&work_date=lt.'+until),
 read('optimus_task_templates?select=id,title,minutes,weekdays,required_skills,department,priority,notes,preferred_time,active&active=eq.true'),
 read('optimus_task_items?select=person_id,due_date,planned_minutes,source_key,due_time&due_date=gte.'+week+'&due_date=lt.'+until),
 (async()=>{const r=await fetch(URLBASE+'/rest/v1/rpc/optimus_task_riderboard_snapshot',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({week_monday:week})});if(!r.ok)throw Error('Riderboard unavailable');return r.json()})()
 ]);
 const roster=people.filter(p=>p.active);
 const workloads={};
 const dateList=Array.from({length:7},(_,i)=>day(week,i));
 for(const p of roster)for(const date of dateList){
  const key=p.id+'|'+date;
  const a=availability.find(x=>x.person_id===p.id&&x.work_date===date&&x.working&&x.confirmed);
  const already=existing.filter(t=>t.person_id===p.id&&t.due_date===date).reduce((n,x)=>n+(x.planned_minutes||30),0);
  const rider=(rides||[]).filter(r=>r.person_id===p.id&&r.date===date&&!existing.some(t=>t.source_key===r.key)).reduce((n,x)=>n+(x.minutes||40),0);
  const busy=[...existing.filter(t=>t.person_id===p.id&&t.due_date===date&&t.due_time).map(t=>({start:min(t.due_time),end:min(t.due_time)+(t.planned_minutes||30)})),...(rides||[]).filter(r=>r.person_id===p.id&&r.date===date&&r.time&&!existing.some(t=>t.source_key===r.key)).map(r=>({start:min(r.time),end:min(r.time)+(r.minutes||40)}))];
 workloads[key]={cap:a?cap(a):0,used:already+rider,loaded:already+rider,start:a?min(a.start_time):null,end:a?min(a.end_time):null,busy};
 }
 const all=[];
 templates.forEach(t=>{(t.weekdays||[]).forEach(d=>{
  if(d<1||d>7)return;
  const date=day(week,d-1),key='fixed:'+t.id+':'+date;
  if(!existing.some(x=>x.source_key===key))all.push({key,date,title:t.title,minutes:t.minutes||30,priority:t.priority||'normal',department:t.department||'Stal',notes:t.notes||'',required_skills:t.required_skills||[],preferred_time:t.preferred_time||null,person_id:null,time:null});
 })});
 const ranking={high:0,normal:1,low:2};
 all.sort((a,b)=>ranking[a.priority]-ranking[b.priority]||b.required_skills.length-a.required_skills.length||b.minutes-a.minutes);
 const warnings=[];
 for(const task of all){
  let candidates=roster.filter(p=>(task.required_skills||[]).every(skill=>(p.skills||[]).some(s=>s.toLowerCase()===skill.toLowerCase()))).map(p=>{const work=workloads[p.id+'|'+task.date];return {person:p,work,slot:slot(work,task.minutes,min(task.preferred_time))}}).filter(x=>x.work.cap>0&&x.work.used+task.minutes<=x.work.cap&&x.slot!==null);
  candidates.sort((a,b)=>{
   // Fill a smaller pool of qualified people first to free entire work blocks.
   const aBusy=a.work.loaded>0?0:1,bBusy=b.work.loaded>0?0:1;
   return aBusy-bBusy||b.work.loaded-a.work.loaded||b.work.cap-a.work.cap||a.person.name.localeCompare(b.person.name);
  });
  if(candidates.length){const winner=candidates[0];task.person_id=winner.person.id;task.time=hh(winner.slot);winner.work.busy.push({start:winner.slot,end:winner.slot+task.minutes});winner.work.used+=task.minutes;winner.work.loaded+=task.minutes}
  else warnings.push('Geen geschikte beschikbare medewerker voor '+task.title+' op '+task.date);
 }
 const suggestions=[...warnings];
 const overdue=await read('optimus_task_items?select=title,person_id,due_date,planned_minutes,department&status=eq.todo&due_date=gte.'+day(week,-7)+'&due_date=lt.'+week+'&limit=30');
 for(const prev of overdue.slice(0,8)){
  const options=roster.flatMap(p=>dateList.map(date=>({p,date,w:workloads[p.id+'|'+date]}))).filter(o=>o.w.cap>0&&o.w.used+(prev.planned_minutes||30)<=o.w.cap).sort((a,b)=>b.w.cap-b.w.used-(a.w.cap-a.w.used));
  if(options.length)suggestions.push('Niet afgewerkt vorige week: '+prev.title+'. Mogelijke ruimte bij '+options[0].p.name+' op '+options[0].date+' (controleer vaardigheden).');
  else suggestions.push('Achterstallig: '+prev.title+'. Er is geen vrije capaciteit gevonden.');
 }

 for(const date of dateList){
  const free=roster.filter(p=>{const w=workloads[p.id+'|'+date];return w.cap>0&&w.used===0});
  if(free.length)suggestions.push(date+': '+free.map(p=>p.name).join(', ')+' hebben voorlopig geen toegewezen taken.');
 }
 let mode='capacity',summary='Voorstel op basis van beschikbare uren, vaardigheden en bestaande opdrachten.';
 const api=Deno.env.get('OPENAI_API_KEY');
 if(api){
  const brief={week,staff:roster.map(p=>({name:p.name,skills:p.skills})),tasks:all.map(t=>({title:t.title,date:t.date,person:roster.find(p=>p.id===t.person_id)?.name||null,minutes:t.minutes})),alerts:warnings};
  try{
   const llm=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+api,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-4.1-mini',temperature:0.2,response_format:{type:'json_object'},messages:[{role:'system',content:'You are a Dutch staffing assistant for a horse stable. Explain in 1-2 Dutch sentences tradeoffs in the proposed schedule. Never claim an employee is truly free based solely on unentered tasks. Do not change assignments. Return JSON {"summary":"...","suggestion":"..."}'},{role:'user',content:JSON.stringify(brief).slice(0,12000)}]})});
   if(llm.ok){const data=await llm.json();const parsed=JSON.parse(data.choices?.[0]?.message?.content||'{}');if(parsed.summary)summary=String(parsed.summary).slice(0,550);if(parsed.suggestion)suggestions.unshift(String(parsed.suggestion).slice(0,500));mode='ai'}
  }catch(e){console.error('AI review unavailable')}
 }
 return respond({proposals:all,summary,suggestions:suggestions.slice(0,15),mode,riderboard_count:(rides||[]).length});
 }catch(e){console.error('Weekly planner error',e instanceof Error?e.message:'unknown');return respond({error:'Weekplanning kon niet worden opgesteld'},500)}
});
