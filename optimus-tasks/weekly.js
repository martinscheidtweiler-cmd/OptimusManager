
let ctx,week=null,roster=[],templates=[],avail=[],riders=[],clocks=[],proposal=[],notes=[];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const days=['Ma','Di','Wo','Do','Vr','Za','Zo'];
const add=(s,n)=>{const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const monday=s=>add(s,-((new Date(s+'T12:00:00Z').getUTCDay()+6)%7));
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Brussels',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const av=(p,d)=>avail.find(a=>a.person_id===p&&a.work_date===d);
const hr=n=>Math.floor(Math.abs(n)/60)+'u'+String(Math.abs(n)%60).padStart(2,'0');
const capacity=a=>a?.working?(Number(a.end_time.slice(0,2))*60+Number(a.end_time.slice(3,5)))-(Number(a.start_time.slice(0,2))*60+Number(a.start_time.slice(3,5)))-a.break_minutes:0;
const list=s=>[...new Set(String(s).split(',').map(t=>t.trim()).filter(Boolean))];
const el=id=>document.getElementById(id);
async function load(){
 const end=add(week,7),db=ctx.db;
 const [a,t,r,c]=await Promise.all([
 db.from('optimus_task_availability').select('*').gte('work_date',week).lt('work_date',end),
 db.from('optimus_task_templates').select('*').order('title'),
 db.rpc('optimus_task_riderboard_snapshot',{week_monday:week}),
 db.from('optimus_task_clock_entries').select('*').gte('work_date',week).lt('work_date',end)
 ]);
 for(const result of [a,t,r,c])if(result.error)throw Error(result.error.message);
 avail=a.data;templates=t.data;riders=r.data;clocks=c.data;roster=ctx.people.filter(p=>p.active);show();
}
function row(p){
 return '<tr><th>'+esc(p.name)+'</th>'+days.map((_,i)=>{const date=add(week,i),a=av(p.id,date);return '<td><label><input type="checkbox" data-av="'+p.id+'|'+date+'" '+(a?.working?'checked':'')+'></label><button class="wkmini" data-shift="'+p.id+'|'+date+'">'+(a?.working?esc(a.start_time.slice(0,5)):'Uren')+'</button></td>'}).join('')+'</tr>';
}
function timeline(p,d){
 const a=av(p.id,d),cap=capacity(a);
 if(!cap)return '<td><span class="chip">Vrij</span></td>';
 const used=ctx.tasks.filter(t=>t.person_id===p.id&&t.due_date===d).reduce((n,t)=>n+(t.planned_minutes||30),0)+riders.filter(t=>t.person_id===p.id&&t.date===d&&!ctx.tasks.some(x=>x.source_key===t.key)).reduce((n,t)=>n+(t.minutes||40),0)+proposal.filter(t=>t.person_id===p.id&&t.date===d).reduce((n,t)=>n+t.minutes,0);
 const rest=cap-used;
 return '<td><strong style="color:'+(rest<0?'#b63e3e':rest<100?'#a7803d':'#337d50')+'">'+(rest<0?'-':'')+hr(rest)+'</strong><small style="display:block;color:#989f97">'+hr(used)+' taken</small></td>';
}
function show(){
 const dates=days.map((_,i)=>add(week,i));
 let s='<div class="head"><div><div class="eyebrow">Personeelsplanning</div><h1>Weekplanner</h1><p class="muted">Beschikbaarheid invullen, vaste taken verdelen en pas na controle publiceren.</p></div></div>';
 s+='<div class="row wrap" style="margin-bottom:20px"><button class="btn light small" id="wkPrev">←</button><input type="date" style="width:180px" id="wkDate" value="'+week+'"><button class="btn light small" id="wkNext">→</button></div>';
 s+='<div class="card"><div class="section-top"><h2>Wie werkt wanneer?</h2><span class="muted">Veronique · vóór zondagavond</span></div><div class="week-scroll"><table class="wk-table"><thead><tr><th>Medewerker</th>'+days.map((d,i)=>'<th>'+d+' '+dates[i].slice(8)+'</th>').join('')+'</tr></thead><tbody>'+roster.map(row).join('')+'</tbody></table></div><div class="row wrap" style="margin-top:16px"><button id="wkSave" class="btn gold">Week opslaan</button><button id="wkCopy" class="btn light">Vorige week kopiëren</button></div><p class="muted" style="margin-top:9px">Klik op een uur om de werkuren aan te passen. Niet ingepland betekent niet beschikbaar voor de AI.</p></div>';
 s+='<div class="card" style="margin-top:16px"><div class="section-top"><h2>Vaste taken ('+templates.length+')</h2><button id="wkNewTpl" class="btn light small">＋ Vaste taak</button></div>';
 s+=templates.length?templates.map(t=>'<div class="person"><div class="person-name"><strong>'+esc(t.title)+'</strong><span>'+t.minutes+' min · '+esc(t.department)+' · '+t.weekdays.map(d=>days[d-1]).join(', ')+'</span></div><button data-template="'+t.id+'" class="btn light small">Bewerken</button></div>').join(''):'<div class="notice">Er staan nog geen vaste taken in de nieuwe planner. Voeg de bestaande routinetaken eerst toe met hun echte tijdsduur.</div>';
 s+='</div>';
 s+='<div class="card" style="margin-top:16px"><div class="section-top"><h2>Ruiterbord</h2><span class="muted">Live gekoppeld uit Optimus Manager</span></div><p class="muted">'+riders.length+' opdrachten in deze week. Ook hun tijd telt mee in de beschikbaarheid.</p>'+(riders.some(x=>x.person_id)?'<button class="btn light small" id="wkRiderSync" style="margin-bottom:10px">Ruiterbordtaken publiceren</button>':'')+riders.slice(0,9).map(r=>'<div class="person"><div class="person-name"><strong>'+esc(r.title)+'</strong><span>'+r.date+' · '+esc(r.rider)+' · '+r.minutes+' min</span></div><span class="chip">'+(r.person_id?'Gekoppeld':'Naam onbekend')+'</span></div>').join('')+'</div>';
 s+='<div class="card" style="margin-top:16px"><div class="section-top"><h2>AI-weekvoorstel</h2><button id="wkGenerate" class="btn gold">✦ Genereer voorstel</button></div><p class="muted">AI beoordeelt taakverdeling, capaciteiten, ruiterbord en momenten waarop medewerkers vrij kunnen blijven. Taken worden pas zichtbaar na goedkeuring.</p>';
 if(proposal.length){s+='<p><strong>'+proposal.length+' vaste taken voorgesteld</strong></p>'+proposal.map((t,i)=>'<div class="person"><div class="person-name"><strong>'+esc(t.title)+'</strong><span>'+t.date+' · '+t.minutes+' min · '+esc(t.department)+'</span></div><select data-assign="'+i+'" style="max-width:155px"><option value="">Niet toegewezen</option>'+roster.map(p=>'<option value="'+p.id+'" '+(t.person_id===p.id?'selected':'')+'>'+esc(p.name)+'</option>').join('')+'</select></div>').join('')+'<button id="wkPublish" class="btn gold" style="margin-top:15px">✓ Planning publiceren</button>'}
 if(notes.length)s+='<div class="notice" style="margin-top:15px">'+notes.map(esc).join(' · ')+'</div>';
 s+='</div>';
 s+='<div class="card" style="margin-top:16px"><h2>Vrije capaciteit per persoon</h2><div class="week-scroll"><table class="wk-table"><thead><tr><th>Persoon</th>'+days.map(d=>'<th>'+d+'</th>').join('')+'</tr></thead><tbody>'+roster.map(p=>'<tr><th>'+esc(p.name)+'</th>'+dates.map(d=>timeline(p,d)).join('')+'</tr>').join('')+'</tbody></table></div><p class="muted" style="margin-top:10px">Dit zijn schattingen. Een volledige vrije dag betekent voorlopig geen toegewezen werk, niet automatisch verlof.</p></div>';
 s+='<div class="card" style="margin-top:16px"><h2>Geregistreerde werkuren</h2>'+roster.map(p=>{const rec=clocks.filter(c=>c.person_id===p.id),n=rec.reduce((x,c)=>x+Math.max(0,Math.round((new Date(c.clock_out||Date.now())-new Date(c.clock_in))/60000)),0);return '<div class="person"><div class="person-name"><strong>'+esc(p.name)+'</strong><span>'+hr(n)+' geklokt deze week · contract '+hr(p.contract_week_minutes||2400)+'/week'+(n>(p.contract_week_minutes||2400)?' · indicatie meeruren: +'+hr(n-(p.contract_week_minutes||2400)):'')+'</span></div><span class="chip">'+(rec.some(c=>!c.clock_out)?'Aanwezig':'Niet ingeklokt')+'</span></div>'}).join('')+'<p class="muted">Meeruren zijn een indicatie op basis van kloktijd. Pauzes, afwezigheid en contractregels moeten nog nagekeken worden.</p></div>';
 el('mainContent').innerHTML=s;
 el('wkPrev').onclick=()=>change(-7);el('wkNext').onclick=()=>change(7);el('wkDate').onchange=e=>{week=monday(e.target.value);proposal=[];load().catch(e=>ctx.toast(e.message))};
 el('wkSave').onclick=()=>save().catch(e=>ctx.toast(e.message));el('wkCopy').onclick=()=>copy().catch(e=>ctx.toast(e.message));
 el('wkNewTpl').onclick=()=>template();if(el('wkRiderSync'))el('wkRiderSync').onclick=()=>publish().catch(e=>ctx.toast(e.message));document.querySelectorAll('[data-template]').forEach(e=>e.onclick=()=>template(templates.find(t=>t.id===e.dataset.template)));
 document.querySelectorAll('[data-shift]').forEach(e=>e.onclick=()=>shiftEdit(...e.dataset.shift.split('|')));
 el('wkGenerate').onclick=()=>generate().catch(e=>ctx.toast(e.message));
 document.querySelectorAll('[data-assign]').forEach(e=>e.onchange=()=>{proposal[Number(e.dataset.assign)].person_id=e.value||null;show()});
 if(el('wkPublish'))el('wkPublish').onclick=()=>publish().catch(e=>ctx.toast(e.message));
}
function change(n){week=add(week,n);proposal=[];load().catch(e=>ctx.toast(e.message))}
async function save(){
 const rec=[...el('mainContent').querySelectorAll('[data-av]')].map(e=>{const [person_id,work_date]=e.dataset.av.split('|'),a=av(person_id,work_date);return {person_id,work_date,working:e.checked,start_time:a?.start_time||'08:00',end_time:a?.end_time||'17:00',break_minutes:a?.break_minutes??30,confirmed:true}});
 const {error}=await ctx.db.from('optimus_task_availability').upsert(rec,{onConflict:'person_id,work_date'});
 if(error)throw Error(error.message);proposal=[];await load();ctx.toast('Beschikbaarheid opgeslagen');
}
async function copy(){
 const {data,error}=await ctx.db.from('optimus_task_availability').select('*').gte('work_date',add(week,-7)).lt('work_date',week);
 if(error)throw Error(error.message);if(!data.length)return ctx.toast('Vorige week is nog niet ingevuld');
 if(!confirm('Vorige week kopiëren en bestaande beschikbaarheid vervangen?'))return;
 const records=data.map(x=>({person_id:x.person_id,work_date:add(x.work_date,7),working:x.working,start_time:x.start_time,end_time:x.end_time,break_minutes:x.break_minutes,confirmed:false}));
 const r=await ctx.db.from('optimus_task_availability').upsert(records,{onConflict:'person_id,work_date'});
 if(r.error)throw Error(r.error.message);proposal=[];await load();ctx.toast('Vorige week gekopieerd, controleer de medewerkers.');
}
function shiftEdit(id,date){
 const a=av(id,date)||{start_time:'08:00',end_time:'17:00',break_minutes:30};
 ctx.showModal('Werkuren '+date,'<form id="wkShiftForm"><label>Start<input required id="wkStart" type="time" value="'+a.start_time.slice(0,5)+'"></label><label>Einde<input required id="wkEnd" type="time" value="'+a.end_time.slice(0,5)+'"></label><label>Pauze in minuten<input id="wkBreak" type="number" min="0" max="240" value="'+a.break_minutes+'"></label><button class="btn gold">Opslaan</button></form>');
 el('wkShiftForm').onsubmit=async e=>{e.preventDefault();const start_time=el('wkStart').value,end_time=el('wkEnd').value;if(end_time<=start_time)return ctx.toast('Eindtijd moet na begintijd liggen');const {error}=await ctx.db.from('optimus_task_availability').upsert({person_id:id,work_date:date,start_time,end_time,break_minutes:Number(el('wkBreak').value),working:true},{onConflict:'person_id,work_date'});if(error)return ctx.toast(error.message);ctx.closeModal();proposal=[];load()};
}
function template(t){
 t=t||{title:'',minutes:30,department:'Stal',weekdays:[1,2,3,4,5],required_skills:[],priority:'normal',preferred_time:null};
 ctx.showModal('Vaste taak','<form id="wkTplForm"><label>Taak<input id="wkTitle" required value="'+esc(t.title)+'"></label><div class="formgrid"><label>Minuten<input id="wkMinutes" required type="number" min="1" max="720" value="'+t.minutes+'"></label><label>Afdeling<input id="wkDept" value="'+esc(t.department)+'"></label></div><label>Vaardigheden (komma’s)<input id="wkSkills" value="'+esc(t.required_skills.join(', '))+'"></label><label>Prioriteit<select id="wkPriority">'+[['low','Niet dringend'],['normal','Normaal'],['high','Dringend']].map(([v,l])=>'<option value="'+v+'" '+(t.priority===v?'selected':'')+'>'+l+'</option>').join('')+'</select></label><div class="row wrap">'+days.map((d,i)=>'<label class="row"><input type="checkbox" style="width:auto" data-wday="'+(i+1)+'" '+(t.weekdays.includes(i+1)?'checked':'')+'>'+d+'</label>').join('')+'</div><button class="btn gold" style="margin-top:15px">Opslaan</button></form>');
 el('wkTplForm').onsubmit=async e=>{e.preventDefault();const weekdays=[...document.querySelectorAll('[data-wday]:checked')].map(e=>Number(e.dataset.wday));if(!weekdays.length)return ctx.toast('Kies minstens één dag');const data={title:el('wkTitle').value.trim(),minutes:Number(el('wkMinutes').value),department:el('wkDept').value||'Stal',required_skills:list(el('wkSkills').value),priority:el('wkPriority').value,preferred_time:el('wkPreferred').value||null,weekdays};const r=await (t.id?ctx.db.from('optimus_task_templates').update(data).eq('id',t.id):ctx.db.from('optimus_task_templates').insert(data));if(r.error)return ctx.toast(r.error.message);ctx.closeModal();proposal=[];await load();ctx.toast('Vaste taak opgeslagen')};
}
async function generate(){
 const btn=el('wkGenerate');btn.disabled=true;btn.textContent='⏳ AI plant de week…';
 try{const session=(await ctx.db.auth.getSession()).data.session;if(!session)throw Error('Login vereist');const r=await fetch(ctx.db.supabaseUrl+'/functions/v1/optimus-task-week-plan',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({week_monday:week})});const result=await r.json();if(!r.ok)throw Error(result.error||'AI-weekplanner niet beschikbaar');proposal=result.proposals||[];notes=[result.summary,...(result.suggestions||[])].filter(Boolean);if(result.mode!=='ai')notes.unshift('Automatische capaciteitsplanning; OpenAI-advies is niet actief.');show()}finally{if(btn.isConnected){btn.disabled=false;btn.textContent='✦ Genereer voorstel'}}
}
async function publish(){
 if(proposal.some(t=>!t.person_id))return ctx.toast('Geef alle vaste taken eerst een medewerker');
 if(!confirm('Planning publiceren voor de medewerkers?'))return;
 const all=[...proposal.map(t=>({title:t.title,person_id:t.person_id,due_date:t.date,due_time:t.time||null,priority:t.priority,planned_minutes:t.minutes,department:t.department,source:'fixed',source_key:t.key,created_by:ctx.user.id})),...riders.filter(t=>t.person_id).map(t=>({title:t.title,person_id:t.person_id,due_date:t.date,due_time:t.time||null,priority:'normal',planned_minutes:t.minutes,department:t.department||'Ruiterbord',source:t.key?.startsWith('board:')?'board':'riding',source_key:t.key,created_by:ctx.user.id}))].filter(t=>!ctx.tasks.some(x=>x.source_key===t.source_key));
 if(!all.length)return ctx.toast('Alle taken staan al in de planning');
 const {error}=await ctx.db.from('optimus_task_items').upsert(all,{onConflict:'source_key',ignoreDuplicates:true});if(error)throw Error(error.message);
 proposal=[];await ctx.refresh();await load();ctx.toast(all.length+' taken gepubliceerd');
}
export async function renderWeeklyPlanner(context){
 ctx=context;week=week||add(monday(today()),7);
 el('mainContent').innerHTML='<div class="card">Weekplanning laden…</div>';
 try{await load()}catch(e){ctx.toast(e.message);el('mainContent').innerHTML='<div class="error">'+esc(e.message)+'</div>'}
}
