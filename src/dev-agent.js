const DEV_CHAT_KEY = "borjai:developer:messages:v1";
const DEV_NAV_ID = "borjai-developer-nav";
const DEV_VIEW_ID = "borjai-developer-view";

function devToken(){
  try{const s=JSON.parse(localStorage.getItem("borjai:supabase:session:v1")||"null");if(s?.access_token)return s.access_token}catch(_){}
  if(window.BORJAI_SESSION_TOKEN)return window.BORJAI_SESSION_TOKEN;
  for(let i=0;i<localStorage.length;i+=1){const k=localStorage.key(i)||"";if(!k.startsWith("sb-")||!k.endsWith("-auth-token"))continue;try{const r=JSON.parse(localStorage.getItem(k)||"null");const t=r?.access_token||r?.currentSession?.access_token||r?.session?.access_token;if(t)return t}catch(_){} }
  return "";
}
function loadDevMessages(){try{const m=JSON.parse(localStorage.getItem(DEV_CHAT_KEY)||"[]");return Array.isArray(m)?m.slice(-30):[]}catch(_){return []}}
function saveDevMessages(m){try{localStorage.setItem(DEV_CHAT_KEY,JSON.stringify(m.slice(-30)))}catch(_) {}}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function markdown(v){return esc(v).replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/`([^`]+)`/g,"<code>$1</code>").replace(/^###\s+(.+)$/gm,"<strong>$1</strong>").replace(/^[-•]\s+/gm,"• ").replace(/\n/g,"<br>")}
function injectStyles(){
  if(document.getElementById("borjai-dev-styles"))return;
  const style=document.createElement("style");style.id="borjai-dev-styles";style.textContent=`
    #${DEV_VIEW_ID}{max-width:1120px;margin:0 auto;padding-bottom:40px}
    .dev-hero{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:18px}
    .dev-hero h1{margin:4px 0 8px;font-size:32px;letter-spacing:-.02em}.dev-hero p{margin:0;color:#8f96a3;max-width:760px;line-height:1.55}
    .dev-badge{display:inline-flex;align-items:center;gap:7px;padding:7px 10px;border:1px solid rgba(243,45,58,.3);border-radius:999px;background:rgba(243,45,58,.08);color:#ff6670;font-size:12px;font-weight:700}
    .dev-card{border:1px solid #2b2f37;background:#111318;border-radius:18px;overflow:hidden;box-shadow:0 18px 55px rgba(0,0,0,.18)}
    .dev-messages{min-height:390px;max-height:58vh;overflow:auto;padding:24px}.dev-empty{display:flex;align-items:center;justify-content:center;min-height:340px;text-align:center;color:#7f8693}
    .dev-msg{display:flex;gap:11px;margin:0 0 18px;max-width:88%}.dev-msg.user{margin-left:auto;flex-direction:row-reverse}.dev-avatar{width:32px;height:32px;flex:0 0 32px;border-radius:10px;background:#f32d3a;color:#fff;display:grid;place-items:center;font-weight:800}.dev-msg.user .dev-avatar{background:#292d35;color:#dce0e7}
    .dev-bubble{padding:12px 15px;border-radius:14px;background:#1b1e24;color:#e9ebef;line-height:1.55;border:1px solid #2b2f37}.dev-msg.user .dev-bubble{background:#26161a;border-color:rgba(243,45,58,.22)}
    .dev-bubble code{padding:2px 5px;border-radius:5px;background:#0b0d10;color:#ff7780}.dev-meta{margin-top:8px;font-size:11px;color:#737b88}
    .dev-result{margin-top:10px;padding-top:10px;border-top:1px solid #30343c}.dev-result a{color:#ff6570;text-decoration:none;font-weight:700}.dev-result a:hover{text-decoration:underline}
    .dev-composer{display:flex;gap:10px;padding:16px;border-top:1px solid #292d35;background:#0f1115}.dev-composer textarea{flex:1;min-height:52px;max-height:180px;resize:vertical;box-sizing:border-box;border:1px solid #343943;border-radius:12px;background:#090a0d;color:#fff;padding:13px 14px;font:inherit;outline:none}.dev-composer textarea:focus{border-color:#f32d3a;box-shadow:0 0 0 2px rgba(243,45,58,.12)}.dev-send{align-self:flex-end;border:0;border-radius:11px;background:#f32d3a;color:#fff;padding:13px 18px;font-weight:750;cursor:pointer}.dev-send:disabled{opacity:.55;cursor:wait}
    .dev-tools{display:flex;justify-content:space-between;align-items:center;padding:10px 16px;border-top:1px solid #292d35;color:#777f8c;font-size:12px}.dev-clear{border:0;background:transparent;color:#9ca3ae;cursor:pointer}.dev-clear:hover{color:#ff6570}
    .dev-working{display:inline-flex;align-items:center;gap:8px}.dev-dot{width:7px;height:7px;border-radius:50%;background:#f32d3a;animation:borjaiDevPulse 1s infinite}.dev-dot:nth-child(2){animation-delay:.15s}.dev-dot:nth-child(3){animation-delay:.3s}@keyframes borjaiDevPulse{50%{opacity:.25;transform:translateY(2px)}}
    @media(max-width:720px){#${DEV_VIEW_ID}{padding:0 12px 28px}.dev-hero h1{font-size:27px}.dev-messages{padding:16px;min-height:360px}.dev-msg{max-width:96%}.dev-composer{flex-direction:column}.dev-send{width:100%}}
  `;document.head.appendChild(style);
}
function addNav(){
  const nav=document.querySelector(".side-nav");if(!nav||document.getElementById(DEV_NAV_ID))return;
  const coach=nav.querySelector('[data-view="coach"]');const button=document.createElement("button");button.type="button";button.id=DEV_NAV_ID;button.className="nav-link";button.dataset.view="developer";button.innerHTML='<span aria-hidden="true" style="font-size:15px;line-height:1">🛠️</span>Desarrollador';
  if(coach?.nextSibling)nav.insertBefore(button,coach.nextSibling);else nav.appendChild(button);
}
function setActiveNav(){document.querySelectorAll(".side-nav .nav-link").forEach(n=>n.classList.toggle("is-active",n.id===DEV_NAV_ID));document.querySelectorAll(".mobile-nav-item").forEach(n=>n.classList.remove("is-active"));}
function resultHtml(message){
  if(!message.result)return "";
  const r=message.result;let html='<div class="dev-result">';
  if(r.summary)html+='<div>'+markdown(r.summary)+'</div>';
  if(Array.isArray(r.changedFiles)&&r.changedFiles.length)html+='<div class="dev-meta">Archivos: '+esc(r.changedFiles.join(", "))+'</div>';
  if(r.branch)html+='<div class="dev-meta">Rama: <code>'+esc(r.branch)+'</code></div>';
  if(r.prUrl)html+='<div style="margin-top:8px"><a href="'+esc(r.prUrl)+'" target="_blank" rel="noopener">Abrir Pull Request →</a></div>';
  if(r.noChanges)html+='<div class="dev-meta">No se han aplicado cambios.</div>';
  html+='</div>';return html;
}
function renderMessages(){
  const box=document.querySelector(`#${DEV_VIEW_ID} .dev-messages`);if(!box)return;const messages=loadDevMessages();
  if(!messages.length){box.innerHTML='<div class="dev-empty"><div><div style="font-size:30px;margin-bottom:12px">🛠️</div><strong style="display:block;color:#dfe2e8;margin-bottom:7px">Soy el desarrollador de BorjaAI</strong><span>Cuéntame qué quieres cambiar, revisar o mejorar y trabajaré sobre el repositorio.</span></div></div>';return}
  box.innerHTML=messages.map(m=>'<div class="dev-msg '+(m.role==="user"?"user":"")+'"><div class="dev-avatar">'+(m.role==="user"?"B":"AI")+'</div><div class="dev-bubble">'+markdown(m.text)+(m.meta?'<div class="dev-meta">'+esc(m.meta)+'</div>':"")+resultHtml(m)+'</div></div>').join("");box.scrollTop=box.scrollHeight;
}
function developerView(){
  injectStyles();setActiveNav();
  return `<section class="view" id="${DEV_VIEW_ID}"><div class="dev-hero"><div><div class="section-kicker">DESARROLLO DE BORJAI</div><h1>Desarrollador</h1><p>Habla conmigo para modificar la aplicación. Analizaré el repositorio, prepararé los cambios y crearé una rama y un Pull Request para que puedas revisarlos antes de producción.</p></div><span class="dev-badge">● CONECTADO A GITHUB</span></div><section class="dev-card"><div class="dev-messages"></div><form class="dev-composer" id="borjai-dev-form"><textarea name="task" placeholder="¿Qué quieres cambiar en BorjaAI?" aria-label="Qué quieres cambiar en BorjaAI"></textarea><button class="dev-send" type="submit">Enviar</button></form><div class="dev-tools"><span>Los cambios se hacen sobre una rama. <strong>main no se modifica directamente.</strong></span><button type="button" class="dev-clear" data-dev-clear>Limpiar conversación</button></div></section></section>`;
}
async function sendTask(task){
  const value=String(task||"").trim();if(!value)return;
  const messages=loadDevMessages();messages.push({role:"user",text:value});saveDevMessages(messages);renderMessages();
  const button=document.querySelector(".dev-send"),input=document.querySelector('#borjai-dev-form textarea[name="task"]');if(button)button.disabled=true;if(input)input.disabled=true;
  const loading={role:"assistant",text:"Estoy revisando el repositorio y preparando los cambios…",meta:"Analizando GitHub y comprobando la implementación."};messages.push(loading);saveDevMessages(messages);renderMessages();
  try{
    const token=devToken();if(!token)throw new Error("No encuentro tu sesión de BorjaAI. Recarga la aplicación e inténtalo de nuevo.");
    const history=messages.filter(m=>m!==loading).slice(-8).map(m=>`${m.role==="user"?"USUARIO":"DESARROLLADOR"}: ${m.text}`).join("\n");
    const response=await fetch("/api/dev-agent",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({task:`CONTEXTO DE LA CONVERSACIÓN:\n${history}\n\nNUEVA PETICIÓN DEL USUARIO:\n${value}`})});
    const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload?.error||`No se pudo completar la petición (${response.status}).`);
    loading.text=payload.summary||"He terminado el análisis.";loading.meta=payload.changedFiles?.length?"Cambios preparados correctamente.":payload.noChanges?"Revisión completada sin cambios seguros.":"Proceso completado.";loading.result=payload;
  }catch(error){loading.text=`No pude completar la petición: ${error.message}`;loading.meta="No se ha creado ninguna rama incompleta ni se ha modificado main."}
  const fresh=loadDevMessages().filter(m=>m!==loading);fresh.push(loading);saveDevMessages(fresh);renderMessages();
  if(button)button.disabled=false;if(input){input.disabled=false;input.focus()}
}
function showDeveloper(){
  addNav();const app=document.getElementById("app-view");if(!app)return;
  app.innerHTML=developerView();renderMessages();const input=app.querySelector('textarea[name="task"]');input?.focus();
  document.querySelector("#topbar-title")?.replaceChildren(document.createTextNode("Desarrollador BorjaAI"));
}
function bind(){
  addNav();
  document.addEventListener("click",event=>{const nav=event.target.closest?.(`#${DEV_NAV_ID}`);if(nav){event.preventDefault();event.stopImmediatePropagation();showDeveloper();}},true);
  document.addEventListener("submit",event=>{if(event.target?.id!=="borjai-dev-form")return;event.preventDefault();event.stopImmediatePropagation();const input=event.target.elements.task;const value=input?.value||"";if(input)input.value="";sendTask(value)},true);
  document.addEventListener("click",event=>{if(event.target.closest?.("[data-dev-clear]")){localStorage.removeItem(DEV_CHAT_KEY);renderMessages()}},true);
  const observer=new MutationObserver(()=>addNav());observer.observe(document.body,{childList:true,subtree:true});
}
bind();
