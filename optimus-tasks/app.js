import {createClient} from '@supabase/supabase-js';
import {renderWeeklyPlanner} from './weekly.js';
import {renderAvailabilityStaff} from './availability.js';
const el=id=>document.getElementById(id), html=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let db,user,me,people=[],tasks=[],page='home',chosenDay=localToday(),filter='today',mode='login',recording=null,parsed=[],activeModal='',waPerson='',clockToday=null,dayAvailability=[],captureDraft='',captureBusy=false;

let installPrompt=null;
function isStandalone(){return window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone===true}
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event});
window.addEventListener('appinstalled',()=>{installPrompt=null;toast('Optimus Tasks is geïnstalleerd!')});
document.addEventListener('click',async(event)=>{
 const button=event.target.closest('[data-install]');if(!button)return;
 if(isStandalone()){toast('Optimus Tasks is al geïnstalleerd');return}
 if(installPrompt){const prompt=installPrompt;installPrompt=null;await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome!=='accepted')toast('Je kunt later alsnog installeren');return}
 const apple=/iPhone|iPad|iPod/i.test(navigator.userAgent);
 showModal('Optimus Tasks installeren',apple?
 '<p>Open deze website in <strong>Safari</strong>, tik op <strong>Delen</strong> en kies <strong>Zet op beginscherm</strong>. Tik daarna op <strong>Voeg toe</strong>.</p>':
 '<p>Open deze website in <strong>Chrome</strong>, tik op het menu (⋮) en kies <strong>App installeren</strong> of <strong>Toevoegen aan startscherm</strong>.</p>');
});
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/tasks/sw.js',{scope:'/tasks/'}).catch(()=>{}));

function localToday(days=0){const x=new Date(Date.now()+days*86400000);return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Brussels',year:'numeric',month:'2-digit',day:'2-digit'}).format(x)}
function fmtDate(s){if(!s)return '';return new Intl.DateTimeFormat('nl-BE',{weekday:'long',day:'numeric',month:'long'},{timeZone:'Europe/Brussels'}).format(new Date(s+'T12:00:00Z'))}
function toast(msg){let b=el('toast');if(b)b.remove();b=document.createElement('div');b.className='toast';b.id='toast';b.textContent=msg;document.body.appendChild(b);setTimeout(()=>b.remove(),4200)}
function showModal(title,inner){el('overlay').innerHTML=`<div class="modal-cover" id="modalCover"><div class="modal"><div class="row between" style="margin-bottom:22px"><h2 class="no-margin">${html(title)}</h2><button class="btn light small" id="closeModal">✕</button></div>${inner}</div></div>`;el('closeModal').onclick=closeModal;el('modalCover').onclick=e=>{if(e.target===el('modalCover'))closeModal()}}
function closeModal(){el('overlay').innerHTML='';activeModal=''}
function currentDayTasks(){
 const day=hasAdmin()?chosenDay:localToday();
 const owned=hasAdmin()?tasks:tasks.filter(t=>t.person_id===me?.id);
 return owned.filter(t=>t.due_date===day).sort((a,b)=>(a.due_time||'99').localeCompare(b.due_time||'99')||a.created_at.localeCompare(b.created_at));
}
function nameFor(id){return people.find(p=>p.id===id)?.name||'Onbekend'}
function hasAdmin(){return me?.role==='admin'}
function taskCard(t){return `<div class="task"><button aria-label="${t.status==='done'?'Opnieuw openen':'Voltooien'}" class="check ${t.status==='done'?'done':''}" data-done="${t.id}">${t.status==='done'?'✓':''}</button><div class="task-main"><strong class="${t.status==='done'?'done':''}">${html(t.title)}</strong><div class="task-meta">${t.due_time?'🕒 '+html(t.due_time.slice(0,5))+' · ':''}${t.planned_minutes?html(t.planned_minutes)+' min · ':''}${t.department?html(t.department)+' · ':''}${hasAdmin()?html(nameFor(t.person_id))+' · ':''}${html(t.due_date)}${t.priority==='high'?'<span class="chip high">Dringend</span>':''}${t.status==='done'?'<span class="chip">Afgewerkt</span>':''}</div>${t.notes?`<div class="muted small" style="margin-top:7px">${html(t.notes)}</div>`:''}</div>${hasAdmin()?`<button class="btn light small" data-edit="${t.id}">Bewerk</button>`:''}</div>`}
function renderLogin(message=''){el('root').hidden=false;el('boot').hidden=true;el('root').innerHTML=`<div class="login"><div class="loginbox"><div class="row" style="gap:15px;margin-bottom:27px"><div class="logo">O</div><div><div class="brand">OPTIMUS</div><div class="muted" style="letter-spacing:2px;font-size:10px">TASKS</div></div></div><h1 style="font-size:24px">${mode==='login'?'Welkom terug':'Maak je account aan'}</h1><p class="muted">De dagelijkse takenplanning van Stal Optimus.</p><div class="auth-modes"><button class="${mode==='login'?'active':''}" id="modeLogin">Inloggen</button><button class="${mode==='signup'?'active':''}" id="modeSignup">Registreren</button></div>${message?`<div class="error">${html(message)}</div>`:''}<form id="authForm"><div class="field-group"><label>E-mailadres</label><input type="email" id="email" required autocomplete="email" placeholder="naam@bedrijf.be"></div><div class="field-group"><label>Wachtwoord</label><input type="password" id="pass" minlength="6" required autocomplete="${mode==='login'?'current-password':'new-password'}"></div><button type="submit" class="btn gold" style="width:100%">${mode==='login'?'Inloggen':'Account aanmaken'}</button></form>${isStandalone()?'':`<button type="button" class="btn light" data-install style="width:100%;margin-top:12px">📲 Installeer als app</button>`}<p class="muted" style="margin-top:16px">${mode==='login'?'Wachtwoord vergeten?':'Gebruik het e-mailadres dat je beheerder aan je toekent.'} <a href="#" id="resetLink">${mode==='login'?'Reset via e-mail':'Hoe werkt dit?'}</a></p></div></div>`;
el('modeLogin').onclick=()=>{mode='login';renderLogin()};el('modeSignup').onclick=()=>{mode='signup';renderLogin()};el('resetLink').onclick=async e=>{e.preventDefault();if(mode==='signup'){toast('Je beheerder moet hetzelfde e-mailadres invullen bij jouw medewerkerprofiel.');return}const email=el('email').value.trim();if(!email){toast('Vul eerst je e-mailadres in');return}const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:location.origin});toast(error?error.message:'Controleer je e-mail voor de resetlink')};el('authForm').onsubmit=async e=>{e.preventDefault();let email=el('email').value.trim(),password=el('pass').value;el('authForm').querySelector('button').disabled=true;const r=mode==='signup'?await db.auth.signUp({email,password,options:{emailRedirectTo:location.origin}}):await db.auth.signInWithPassword({email,password});if(r.error){renderLogin(r.error.message);return}if(mode==='signup'&&!r.data.session){renderLogin('Account aangemaakt. Bevestig eerst je e-mailadres via de ontvangen mail.');return}await initSession()}}
async function initSession(){
 const session=(await db.auth.getSession()).data.session;
 if(!session){user=null;me=null;renderLogin();return}
 user=session.user;
 const result=await db.rpc('optimus_task_my_profile');
 if(result.error){renderLogin('Profiel laden mislukt: '+result.error.message);return}
 me=result.data;
 if(!me){renderActivation();return}
 if(!me.active){renderLogin('Je account is gedeactiveerd. Neem contact op met je beheerder.');return}
 await refresh(true);
}
function renderActivation(){
 el('root').hidden=false;el('boot').hidden=true;
 el('root').innerHTML=`<div class="login"><div class="loginbox"><div class="logo" style="margin-bottom:18px">O</div><h1 style="font-size:23px">Nog geen toegang</h1><p class="muted">Je bent aangemeld, maar je e-mailadres is nog niet gekoppeld aan een actief Optimus Tasks-medewerkerprofiel. Vraag de beheerder om dit na te kijken.</p><button id="retry" class="btn gold" style="width:100%">Opnieuw controleren</button><button id="signout" class="btn light" style="width:100%;margin-top:12px">Uitloggen</button></div></div>`;
 el('retry').onclick=initSession;
 el('signout').onclick=async()=>{await db.auth.signOut();me=null;renderLogin()};
}

async function refresh(resetPage=false){
 if(!me)return;
 if(me.role==='planner'){people=[me];tasks=[];page='availability';render();return}
 const admin=hasAdmin();
 if(admin){
  const rp=await db.from('optimus_task_people').select('*').order('name');
  if(rp.error){toast(rp.error.message);return}
  people=rp.data||[];
 }else{people=[me];chosenDay=localToday()}
 let q=db.from('optimus_task_items').select('*').order('due_date',{ascending:false}).limit(1000);
 if(!admin)q=q.eq('person_id',me.id).eq('due_date',localToday());
 const rt=await q;
 if(rt.error){toast(rt.error.message);return}
 tasks=rt.data||[];
 if(admin){const a=await db.from('optimus_task_availability').select('*').eq('work_date',chosenDay);dayAvailability=a.data||[]}
 if(!admin){const record=await db.from('optimus_task_clock_entries').select('*').eq('person_id',me.id).eq('work_date',localToday()).maybeSingle();clockToday=record.data||null}
 if(resetPage)page=admin?'home':'mine';
 render();
}
function setPage(p){if(!hasAdmin())return;if(p==='week'&&window.matchMedia('(max-width: 720px)').matches)return;page=p;render();scrollTo({top:0,behavior:'smooth'})}
function renderEmployee(){
 const day=localToday(),arr=currentDayTasks(),open=arr.filter(t=>t.status!=='done'),done=arr.filter(t=>t.status==='done');
 el('boot').hidden=true;el('root').hidden=false;
 const status=clockToday?.clock_out?'Afgeklokt':clockToday?'Aan het werk':'Nog niet gestart';
 const time=clockToday?new Date(clockToday.clock_in).toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Brussels'}):'';
 el('root').innerHTML=`<section class="employee-app">
 <header class="employee-head"><div class="row" style="gap:10px"><div class="logo" style="height:35px;width:35px;font-size:22px">O</div><div><strong>OPTIMUS</strong><div class="muted" style="letter-spacing:1.6px">MIJN TAKEN</div></div></div><button class="btn light small" id="signout">Uitloggen</button></header>
 <main class="employee-main"><div class="eyebrow">Dagplanning · ${html(me.name)}</div><h1>Mijn taken</h1><p class="muted">${html(fmtDate(day))}</p>
 <div class="employee-clock"><div><span class="eyebrow">Mijn werktijd</span><strong id="workTimer" style="font-size:28px;display:block;margin:4px 0">${clockToday?clockElapsed(): '00:00:00'}</strong><span class="muted">${status}${time?' · gestart '+time:''}</span></div>${!clockToday&&arr.length?'<button class="btn gold" id="clockStart">▶ Start werkdag</button>':''}</div>
 <div class="employee-progress"><strong>${done.length} van ${arr.length} afgewerkt</strong><div class="employee-progress-bg"><div style="height:100%;width:${arr.length?Math.round(done.length/arr.length*100):0}%;background:#b39b66;border-radius:100px"></div></div></div>
 <div class="card"><h2 style="margin-bottom:12px">Nog te doen (${open.length})</h2>${open.length?open.map(taskCard).join(''):'<div class="empty">Alles afgewerkt voor vandaag! ✓</div>'}</div>
 ${done.length?`<div class="card" style="margin-top:16px"><h2 style="margin-bottom:12px">Afgewerkt (${done.length})</h2>${done.map(taskCard).join('')}</div>`:''}
 <p class="muted small" style="margin-top:20px">De klok stopt automatisch wanneer je laatste taak is afgevinkt. Laat je leidinggevende weten als je langer werkt of geen taken toegewezen krijgt.</p>
 </main></section>`;
 el('signout').onclick=async()=>{await db.auth.signOut();me=null;renderLogin()};
 if(el('clockStart'))el('clockStart').onclick=async()=>{const {error}=await db.rpc('optimus_task_clock_start');if(error)return toast(error.message);await refresh()};
 document.querySelectorAll('[data-done]').forEach(b=>b.onclick=()=>markTask(b.dataset.done));
}
function clockElapsed(){if(!clockToday)return '00:00:00';const end=clockToday.clock_out?new Date(clockToday.clock_out):new Date();const secs=Math.max(0,Math.floor((end-new Date(clockToday.clock_in))/1000));return String(Math.floor(secs/3600)).padStart(2,'0')+':'+String(Math.floor(secs%3600/60)).padStart(2,'0')+':'+String(secs%60).padStart(2,'0')}
function render(){
 if(!me)return;
 const smallScreen=window.matchMedia('(max-width: 720px)').matches;
 if(me.role==='planner'){
  if(smallScreen){
   el('boot').hidden=true;el('root').hidden=false;
   el('root').innerHTML=`<section class="employee-app"><header class="employee-head"><div class="row"><div class="logo">O</div><strong>OPTIMUS</strong></div><button id="signout" class="btn light small">Uitloggen</button></header><main class="employee-main"><h1>Weekbezetting</h1><div class="card"><p>De uitgebreide personeelsplanning gebruik je op een computer. Open Optimus Tasks op desktop om de bezetting in te vullen.</p></div></main></section>`;
   el('signout').onclick=async()=>{await db.auth.signOut();me=null;renderLogin()};
  }else renderAvailabilityStaff({db,me,toast});
  return;
 }
 if(!hasAdmin()){renderEmployee();return}
 if(smallScreen&&page==='week')page='home';
 const nav=[['home','▦','Dashboard'],['week','▦','Weekplanner'],['tasks','☑','Taken'],['team','♧','Medewerkers'],['manager','◫','Manager']];
 const mobileNav=nav.filter(([p])=>p!=='week'&&p!=='manager');
 const navButtons=nav.map(([p,ic,t])=>`<button data-nav="${p}" class="${page===p?'active':''}"><span>${ic}</span>${t}</button>`).join('');
 el('boot').hidden=true;el('root').hidden=false;
 el('root').innerHTML=`<div class="app"><aside class="sidebar"><div class="brandline"><div class="logo" style="height:38px;width:38px;font-size:25px">O</div><div><div class="brand">OPTIMUS</div><small>TASKS</small></div></div><div class="nav">${navButtons}</div><div class="sidefoot"><div style="font-weight:700">${html(me.name)}</div><p class="muted" style="margin-top:5px">Beheerder</p><button class="btn light small" id="signout">Uitloggen</button></div></aside><section class="shell"><div class="topbar"><div class="muted">OPTIMUS / ${html(page==='home'?'Dashboard':page==='week'?'Weekplanner':page==='tasks'?'Taken':'Medewerkers')}</div><div class="row">${isStandalone()?'':`<button type="button" class="btn light small" data-install>📲 App</button>`}<span class="muted">${html(me.name)}</span><span class="avatar" style="width:34px;height:34px">${html(me.name.slice(0,2).toUpperCase())}</span></div></div><main class="container" id="mainContent"></main></section></div><nav class="mobile-nav">${mobileNav.map(([p,ic,t])=>`<button data-nav="${p}" class="${page===p?'active':''}"><span>${ic}</span>${t}</button>`).join('')}</nav>`;
 document.querySelectorAll('[data-nav]').forEach(x=>x.onclick=()=>x.dataset.nav==='manager'?window.location.assign('/manager'):setPage(x.dataset.nav));
 el('signout').onclick=async()=>{await db.auth.signOut();me=null;renderLogin()};
 if(page==='team')renderTeam();else if(page==='tasks')renderTaskList();else if(page==='week')renderWeeklyPlanner({db,people,tasks,user,refresh,showModal,closeModal,toast});else renderHome();
 document.querySelectorAll('[data-done]').forEach(x=>x.onclick=()=>markTask(x.dataset.done));
 document.querySelectorAll('[data-edit]').forEach(x=>x.onclick=()=>openTask(tasks.find(t=>t.id===x.dataset.edit)));
}

function dayControl(){return `<div class="row wrap"><button class="btn light small" id="prevDay">←</button><input id="dayPicker" aria-label="Dag kiezen" type="date" style="width:155px" value="${html(chosenDay)}"><button class="btn light small" id="nextDay">→</button></div>`}
function attachDateControls(){el('dayPicker').onchange=e=>{chosenDay=e.target.value;refresh()};el('prevDay').onclick=()=>{let d=new Date(chosenDay+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-1);chosenDay=d.toISOString().slice(0,10);refresh()};el('nextDay').onclick=()=>{let d=new Date(chosenDay+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);chosenDay=d.toISOString().slice(0,10);refresh()}}

function renderHome(){
 const arr=currentDayTasks();
 el('mainContent').innerHTML=`<div class="simple-home">
   <div class="simple-day"><span class="eyebrow" style="margin:0">Datum</span>${dayControl()}</div>
   <div class="card composer-card"><div class="section-top"><h2>Nieuwe taak</h2></div>${captureBox()}</div>
   <div class="card simple-task-list"><div class="section-top"><h2>Taken</h2><span class="muted">${arr.length?arr.length+' gepland':''}</span></div>
    ${arr.length?arr.map(taskCard).join(''):'<div class="empty">Geen taken op deze datum.</div>'}
   </div>
  </div>`;
 attachDateControls();
 el('quickTask').onclick=()=>openTask(null,(el('spoken')?.value||'').trim().slice(0,300));
 attachCapture();
}
function captureBox(){
 return `<div class="capture">
   <textarea id="spoken" aria-label="Opdracht" placeholder="Typ een taak of spreek je opdrachten in…">${html(captureDraft)}</textarea>
   <div class="row wrap composer-buttons">
     <button id="quickTask" class="btn gold" type="button">＋ Nieuwe taak</button>
     <button id="analyze" class="btn light" type="button">✦ Maak met AI</button>
     <button id="mic" class="btn light" type="button">🎙 Inspreken</button>
   </div>
   <p id="voiceStatus" class="voice-status" role="status" aria-live="polite" hidden></p>
  </div>`;
}
async function sessionToken(){
 const s=(await db.auth.getSession()).data.session;
 if(!s?.access_token)throw Error('Je sessie is verlopen. Log opnieuw in.');
 return s.access_token;
}
function voiceMessage(message,isError=false){
 const p=el('voiceStatus');if(!p)return;
 p.hidden=!message;p.textContent=message||'';p.classList.toggle('voice-error',isError);
}
function micText(label,disabled=false){
 const b=el('mic');if(b){b.textContent=label;b.disabled=disabled}
}
function attachCapture(){
 const input=el('spoken'),mic=el('mic'),analyze=el('analyze');
 input.oninput=()=>{captureDraft=input.value};
 async function transcribe(chunks,type){
  captureBusy=true;micText('⏳ Verwerken…',true);voiceMessage('Opname wordt uitgeschreven…');
  try{
   const mime=(type||chunks[0]?.type||'').split(';')[0].toLowerCase();
   if(!['audio/webm','audio/mp4','audio/ogg','audio/wav','audio/mpeg','audio/x-m4a'].includes(mime))throw Error('Dit audioformaat wordt niet ondersteund op je toestel.');
   const file=new Blob(chunks,{type:mime});
   if(file.size<150)throw Error('Geen geluid opgenomen. Probeer nog eens.');
   if(file.size>8000000)throw Error('De opname is te lang. Neem kortere opdrachten op.');
   const token=await sessionToken();
   const response=await fetch(db.supabaseUrl+'/functions/v1/optimus-tasks/api/transcribe',{
    method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':mime},body:file
   });
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(data.error||'Opname kon niet worden uitgeschreven ('+response.status+').');
   const text=String(data.text||'').trim();
   if(!text)throw Error('Ik heb geen woorden herkend. Probeer opnieuw.');
   captureDraft=(captureDraft.trim()?captureDraft.trim()+' ':'')+text;
   const area=el('spoken');if(area){area.value=captureDraft;area.focus()}
   voiceMessage('✓ Opname uitgeschreven. Klik op Maak met AI om taken te verdelen.');
  }catch(e){
   voiceMessage('Inspreken mislukt: '+(e instanceof TypeError?'Verbinding met spraakservice mislukt. Controleer je internetverbinding.':e.message),true);
  }finally{captureBusy=false;micText('🎙 Inspreken')}
 }
 function speechFallback(){
  const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!Speech){voiceMessage('Deze browser kan geen audio opnemen. Geef microfoontoegang of probeer Safari/Chrome.',true);return}
  const r=new Speech();r.lang='nl-BE';r.continuous=true;r.interimResults=false;
  recording=r;micText('⏹ Stop opname');voiceMessage('Luisteren… klik op Stop opname als je klaar bent.');
  r.onresult=e=>{for(let i=e.resultIndex;i<e.results.length;i++){if(e.results[i].isFinal){captureDraft+=(captureDraft.trim()?' ':'')+e.results[i][0].transcript;const box=el('spoken');if(box)box.value=captureDraft}}};
  r.onerror=e=>voiceMessage('Spraakherkenning mislukt ('+e.error+'). Controleer de microfoontoegang.',true);
  r.onend=()=>{if(recording===r)recording=null;micText('🎙 Inspreken');if(captureDraft.trim()&&!el('voiceStatus')?.classList.contains('voice-error'))voiceMessage('✓ Tekst klaar. Klik op Maak met AI.')};
  try{r.start()}catch(e){recording=null;micText('🎙 Inspreken');voiceMessage('Microfoon kon niet starten: '+e.message,true)}
 }
 mic.onclick=async()=>{
  if(captureBusy)return;
  if(recording){
   try{if(typeof recording.stop==='function')recording.stop()}catch(e){recording=null;voiceMessage('Opname kon niet worden gestopt: '+e.message,true)}
   return;
  }
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){speechFallback();return}
  let stream;
  try{
   voiceMessage('Microfoon wordt gestart…');
   stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
   const formats=['audio/mp4','audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus'];
   const preferred=formats.find(x=>MediaRecorder.isTypeSupported(x));
   const rec=new MediaRecorder(stream,preferred?{mimeType:preferred}:{});
   const chunks=[];
   recording=rec;
   rec.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};
   rec.onerror=()=>{stream.getTracks().forEach(t=>t.stop());recording=null;micText('🎙 Inspreken');voiceMessage('Opname mislukt. Probeer opnieuw.',true)};
   rec.onstop=()=>{
    stream.getTracks().forEach(t=>t.stop());
    if(recording===rec)recording=null;
    void transcribe(chunks,rec.mimeType||preferred);
   };
   rec.start();
   micText('⏹ Stop opname');
   voiceMessage('● Opname loopt… klik opnieuw om te stoppen.');
   setTimeout(()=>{if(recording===rec&&rec.state==='recording'){rec.stop();voiceMessage('Maximale opnametijd bereikt. Opname wordt uitgeschreven…')}},100000);
  }catch(e){
   if(stream)stream.getTracks().forEach(t=>t.stop());
   recording=null;micText('🎙 Inspreken');
   voiceMessage(e.name==='NotAllowedError'?'Microfoon geweigerd. Sta microfoontoegang toe in je browserinstellingen.':e.name==='NotFoundError'?'Geen microfoon gevonden op dit toestel.':'Microfoon kon niet starten: '+e.message,true);
  }
 };
 analyze.onclick=async()=>{
  const text=(el('spoken')?.value||'').trim();if(!text)return voiceMessage('Typ of spreek eerst een opdracht in.',true);
  if(recording||captureBusy)return voiceMessage('Stop eerst de opname en wacht op de tekst.',true);
  captureDraft=text;analyze.disabled=true;analyze.textContent='⏳ Bezig…';voiceMessage('AI maakt een voorstel…');
  try{
   const token=await sessionToken();
   const result=await fetch('/api/parse',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({text})});
   const data=await result.json().catch(()=>({}));
   if(!result.ok)throw Error(data.error||'AI-analyse mislukt.');
   voiceMessage('');
   reviewTasks(data.tasks||[]);
  }catch(e){voiceMessage('AI mislukt: '+e.message,true)}
  finally{if(analyze.isConnected){analyze.disabled=false;analyze.textContent='✦ Maak met AI'}}
 };
}
function renderTaskList(){const scoped=currentDayTasks();el('mainContent').innerHTML=`<div class="head"><div><div class="eyebrow">Planning</div><h1>${hasAdmin()?'Alle taken':'Mijn taken'}</h1><p class="muted">${html(fmtDate(chosenDay))}</p></div>${hasAdmin()?'<button class="btn gold" id="addTask">＋ Nieuwe taak</button>':''}</div><div class="row between wrap" style="margin-bottom:19px">${dayControl()}<div class="filterbar"><button class="pill ${filter==='all'?'active':''}" data-filter="all">Alles</button><button class="pill ${filter==='todo'?'active':''}" data-filter="todo">Open</button><button class="pill ${filter==='done'?'active':''}" data-filter="done">Afgewerkt</button></div></div><div class="card">${scoped.filter(x=>filter==='all'||(filter==='today'?true:x.status===filter)).length?scoped.filter(x=>filter==='all'||filter==='today'||x.status===filter).map(taskCard).join(''):'<div class="empty">Geen taken in deze selectie.</div>'}</div>`;attachDateControls();document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;render()});if(hasAdmin())el('addTask').onclick=()=>openTask()}

function renderTeam(){
 el('mainContent').innerHTML=`<div class="head"><div><div class="eyebrow">Organisatie</div><h1>Medewerkers</h1><p class="muted">Koppel een e-mailadres zodat iedere medewerker uitsluitend zijn eigen taken kan bekijken.</p></div><button class="btn gold" id="newPerson">＋ Medewerker</button></div>
 <div class="card"><div class="notice" style="margin-bottom:14px">Iedere medewerker gebruikt zijn eigen geverifieerde e-mailadres. Zonder gekoppeld account is er geen toegang tot taken.</div>
 ${people.map(p=>`<div class="person"><div class="avatar">${html(p.name.slice(0,2).toUpperCase())}</div><div class="person-name"><strong>${html(p.name)} ${!p.active?'(inactief)':''}</strong><span>${html(p.email||'Nog geen e-mail')} · ${p.user_id?'Account gekoppeld':'Niet gekoppeld'} · ${p.skills?.length||0} vaardigheden</span></div><button class="btn light small" data-person="${p.id}">Bewerken</button></div>`).join('')}</div>`;
 el('newPerson').onclick=()=>openPerson();
 document.querySelectorAll('[data-person]').forEach(b=>b.onclick=()=>openPerson(people.find(p=>p.id===b.dataset.person)));
}

function personOptions(id){return people.filter(p=>p.active||p.id===id).map(p=>`<option value="${p.id}" ${p.id===id?'selected':''}>${html(p.name)}</option>`).join('')}
function openTask(t,prefill=''){if(!hasAdmin())return;const edit=!!t;const today=chosenDay;showModal(edit?'Taak bewerken':'Nieuwe taak',`<form id="taskForm"><div class="field-group"><label>Taak</label><input required maxlength="300" id="title" value="${html(t?.title||prefill)}" placeholder="Wat moet gebeuren?"></div><div class="field-group"><label>Details (optioneel)</label><textarea id="notes">${html(t?.notes||'')}</textarea></div><div class="formgrid"><div class="field-group"><label>Wie?</label><select id="person" required>${personOptions(t?.person_id||people[0]?.id)}</select></div><div class="field-group"><label>Datum</label><input type="date" required id="date" value="${html(t?.due_date||today)}"></div><div class="field-group"><label>Uur (optioneel)</label><input type="time" id="time" value="${html(t?.due_time?.slice(0,5)||'')}"></div><div class="field-group"><label>Prioriteit</label><select id="priority"><option value="normal" ${t?.priority!=='high'&&t?.priority!=='low'?'selected':''}>Normaal</option><option value="low" ${t?.priority==='low'?'selected':''}>Niet dringend</option><option value="high" ${t?.priority==='high'?'selected':''}>Dringend</option></select></div><div class="field-group"><label>Geschatte tijd (min)</label><input type="number" min="1" max="720" id="taskMinutes" value="${t?.planned_minutes||30}" required></div><div class="field-group"><label>Afdeling / locatie</label><input id="taskDepartment" value="${html(t?.department||'Stal')}"></div></div><div class="modal-footer">${edit?'<button type="button" class="btn red" id="deleteTask">Verwijderen</button>':'<span></span>'}<button type="submit" class="btn gold">${edit?'Opslaan':'Taak aanmaken'}</button></div></form>`);el('taskForm').onsubmit=async e=>{e.preventDefault();const payload={title:el('title').value.trim(),notes:el('notes').value.trim(),person_id:el('person').value,due_date:el('date').value,due_time:el('time').value||null,priority:el('priority').value,planned_minutes:Number(el('taskMinutes').value),department:el('taskDepartment').value.trim()||'Stal'};if(!payload.person_id)return toast('Voeg eerst een medewerker toe');let q=edit?db.from('optimus_task_items').update({...payload,updated_at:new Date().toISOString()}).eq('id',t.id):db.from('optimus_task_items').insert({...payload,created_by:user.id});const {error}=await q;if(error)return toast(error.message);closeModal();await refresh();toast('Taak opgeslagen')};if(edit)el('deleteTask').onclick=async()=>{if(!confirm('Taak definitief verwijderen?'))return;let {error}=await db.from('optimus_task_items').delete().eq('id',t.id);if(error)return toast(error.message);closeModal();await refresh()}}

function openPerson(p){
 if(!hasAdmin())return;
 const edit=!!p;
 showModal(edit?'Medewerker bewerken':'Medewerker toevoegen',`<form id="personForm">
  <div class="field-group"><label>Naam</label><input id="pName" required maxlength="120" value="${html(p?.name||'')}"></div>
  <div class="field-group"><label>E-mailadres voor eigen login</label><input type="email" id="pEmail" value="${html(p?.email||'')}" placeholder="naam@voorbeeld.be"></div><div class="field-group"><label>Rechten</label><select id="pRole"><option value="member" ${!p||p.role==='member'?'selected':''}>Medewerker (enkel eigen taken)</option><option value="planner" ${p?.role==='planner'?'selected':''}>Weekbeschikbaarheid invullen</option><option value="admin" ${p?.role==='admin'?'selected':''}>Beheerder</option></select></div><div class="field-group"><label>Vaardigheden (gescheiden door komma's)</label><textarea id="pSkills" placeholder="Auto rijden, Hengsten buitenzetten, Paarden rijden">${html((p?.skills||[]).join(', '))}</textarea></div><div class="field-group"><label>Afdelingen (komma's)</label><input id="pDepartments" value="${html((p?.departments||[]).join(', '))}" placeholder="Ruiterbord, Stal, Weide"></div><div class="field-group"><label>Contracturen per week</label><input type="number" id="pHours" min="0" max="168" value="${Math.round((p?.contract_week_minutes??2400)/60)}"></div>
  <div class="field-group"><label class="row" style="font-size:12px"><input type="checkbox" id="pActive" style="width:auto" ${p?.active!==false?'checked':''}> Actieve medewerker</label></div>
  <div class="modal-footer"><span class="muted">${edit&&p.user_id?'Login gekoppeld':'Koppel via eigen registratie'}</span><button type="submit" class="btn gold">Opslaan</button></div></form>`);
 el('personForm').onsubmit=async e=>{
  e.preventDefault();
  const parseSkills=s=>[...new Set(s.split(',').map(x=>x.trim()).filter(Boolean))];const payload={name:el('pName').value.trim(),email:el('pEmail').value.trim().toLowerCase()||null,active:el('pActive').checked,role:el('pRole').value,skills:parseSkills(el('pSkills').value),departments:parseSkills(el('pDepartments').value),contract_week_minutes:Math.round(Number(el('pHours').value)*60)};
  const q=edit?db.from('optimus_task_people').update(payload).eq('id',p.id):db.from('optimus_task_people').insert(payload);
  const {error}=await q;if(error)return toast(error.message);
  closeModal();await refresh();toast('Medewerker opgeslagen');
 };
}

async function markTask(id){const t=tasks.find(x=>x.id===id);if(!t)return;const {error}=await db.rpc('optimus_task_mark',{task_id:id,mark_done:t.status!=='done'});if(error)return toast(error.message);await refresh()}
function reviewTasks(items){if(!items.length)return toast('Geen taken gevonden');parsed=items.slice(0,25);showModal('AI-taken controleren',`<div class="notice" style="margin-bottom:15px">Controleer namen, datums en omschrijvingen. Er wordt nog niets opgeslagen.</div><form id="reviewForm">${parsed.map((t,i)=>`<div style="border-bottom:1px solid #ecf0eb;padding:9px 0 17px;margin-bottom:13px"><div class="eyebrow">Taak ${i+1}</div><div class="field-group"><input id="rTitle${i}" required maxlength="300" value="${html(t.title||'')}"></div><div class="formgrid"><div class="field-group"><label>Medewerker</label><select id="rPerson${i}" required><option value="">Selecteer iemand</option>${personOptions(t.person_id)}</select></div><div class="field-group"><label>Datum</label><input id="rDate${i}" type="date" required value="${html(t.due_date||chosenDay)}"></div><div class="field-group"><label>Uur</label><input id="rTime${i}" type="time" value="${html(t.due_time||'')}"></div><div class="field-group"><label>Geschatte duur (min)</label><input id="rMinutes${i}" type="number" min="1" max="720" value="${t.planned_minutes||30}" required></div><div class="field-group"><label>Prioriteit</label><select id="rPriority${i}"><option value="normal" ${t.priority!=='high'&&t.priority!=='low'?'selected':''}>Normaal</option><option value="low" ${t.priority==='low'?'selected':''}>Niet dringend</option><option value="high" ${t.priority==='high'?'selected':''}>Dringend</option></select></div></div></div>`).join('')}<button class="btn gold" style="width:100%" type="submit">${parsed.length} taken opslaan</button></form>`);el('reviewForm').onsubmit=async e=>{e.preventDefault();const entries=parsed.map((_,i)=>({title:el('rTitle'+i).value.trim(),person_id:el('rPerson'+i).value,due_date:el('rDate'+i).value,due_time:el('rTime'+i).value||null,priority:el('rPriority'+i).value,planned_minutes:Number(el('rMinutes'+i).value),notes:'',created_by:user.id}));if(entries.some(x=>!x.person_id||!x.title))return toast('Vul alle medewerkers en taken in');const {error}=await db.from('optimus_task_items').insert(entries);if(error)return toast(error.message);closeModal();await refresh();toast(`${entries.length} taken toegevoegd`)}}
window.matchMedia('(max-width: 720px)').addEventListener('change',()=>{if(me&&(page==='week'||me.role==='planner'))render()});
async function start(){try{const res=await fetch('/api/config');if(!res.ok)throw Error('Configuratie ontbreekt');const c=await res.json();db=createClient(c.url,c.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});db.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'){me=null;renderLogin()}});await initSession();setInterval(()=>{if(me&&document.visibilityState==='visible'&&page!=='week'&&page!=='availability'&&!(page==='home'&&(recording||captureBusy||captureDraft.trim())))refresh()},45000);setInterval(()=>{if(me&&!hasAdmin()&&el('workTimer'))el('workTimer').textContent=clockElapsed()},1000)}catch(e){el('boot').textContent='Kan de app niet openen: '+e.message}}
start();
