
let week=null,roster=[],availability=[],ctx;
const days=['Ma','Di','Wo','Do','Vr','Za','Zo'];
const el=id=>document.getElementById(id);
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const add=(str,n)=>{const date=new Date(str+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+n);return date.toISOString().slice(0,10)};
const monday=str=>add(str,-((new Date(str+'T12:00:00Z').getUTCDay()+6)%7));
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Brussels',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
async function reload(){
 const [a,p]=await Promise.all([
  ctx.db.from('optimus_task_availability').select('*').gte('work_date',week).lt('work_date',add(week,7)),
  ctx.db.rpc('optimus_task_planner_roster')
 ]);
 if(a.error||p.error)throw Error(a.error?.message||p.error?.message);
 availability=a.data||[];roster=p.data||[];
 draw();
}
function draw(){
 const dates=days.map((_,i)=>add(week,i));
 let content='<section class="employee-app"><header class="employee-head"><div class="row" style="gap:9px"><div class="logo">O</div><div><strong>OPTIMUS</strong><div class="muted">PERSONEELSBEZETTING</div></div></div><button id="plannerLogout" class="btn light small">Uitloggen</button></header><main class="employee-main" style="max-width:1100px"><div class="eyebrow">Weekbeschikbaarheid · '+esc(ctx.me.name)+'</div><h1>Wie werkt wanneer?</h1><p class="muted">Vul vóór zondagavond in wie volgende week aanwezig is. De beheerder zal daarna de taken verdelen.</p>';
 content+='<div class="row wrap" style="margin:20px 0"><button class="btn light small" id="plannerPrev">←</button><input type="date" style="width:180px" id="plannerWeek" value="'+week+'"><button class="btn light small" id="plannerNext">→</button></div>';
 content+='<div class="card"><div class="week-scroll"><table class="wk-table"><thead><tr><th>Medewerker</th>'+dates.map((d,i)=>'<th>'+days[i]+' '+d.slice(8)+'</th>').join('')+'</tr></thead><tbody>'+roster.map(person=>'<tr><th>'+esc(person.name)+'</th>'+dates.map(d=>{const a=availability.find(x=>x.person_id===person.id&&x.work_date===d);return '<td><input type="checkbox" data-working="'+person.id+'|'+d+'" '+(a?.working?'checked':'')+'><span style="display:block;font-size:10px;margin-top:5px">'+(a?.working?'Aanwezig':'Vrij')+'</span></td>'}).join('')+'</tr>').join('')+'</tbody></table></div><button class="btn gold" id="plannerSave" style="margin-top:20px">Weekbezetting opslaan</button><p class="muted" style="margin-top:10px">Werkuren, vereiste vaardigheden en taakverdeling beheert de administrator.</p></div></main></section>';
 el('boot').hidden=true;el('root').hidden=false;el('root').innerHTML=content;
 el('plannerLogout').onclick=async()=>{await ctx.db.auth.signOut();location.reload()};
 el('plannerPrev').onclick=()=>change(-7);el('plannerNext').onclick=()=>change(7);
 el('plannerWeek').onchange=e=>{week=monday(e.target.value);reload().catch(e=>ctx.toast(e.message))};
 el('plannerSave').onclick=()=>save().catch(e=>ctx.toast(e.message));
}
function change(n){week=add(week,n);reload().catch(e=>ctx.toast(e.message))}
async function save(){
 const inputs=[...el('root').querySelectorAll('[data-working]')];
 const records=inputs.map(input=>{const [person_id,work_date]=input.dataset.working.split('|');const old=availability.find(x=>x.person_id===person_id&&x.work_date===work_date);return{person_id,work_date,working:input.checked,confirmed:true,start_time:old?.start_time||'08:00',end_time:old?.end_time||'17:00',break_minutes:old?.break_minutes??30}});
 const result=await ctx.db.from('optimus_task_availability').upsert(records,{onConflict:'person_id,work_date'});
 if(result.error)throw Error(result.error.message);
 await reload();ctx.toast('Beschikbaarheid opgeslagen');
}
export async function renderAvailabilityStaff(context){
 ctx=context;
 week=week||add(monday(today()),7);
 el('boot').hidden=true;el('root').hidden=false;
 el('root').innerHTML='<div class="employee-app"><div class="employee-main">Weekbeschikbaarheid laden…</div></div>';
 try{await reload()}catch(e){ctx.toast(e.message);el('root').innerHTML='<div class="error">'+esc(e.message)+'</div>'}
}
