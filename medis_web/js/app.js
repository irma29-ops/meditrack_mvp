const USERS_KEY="medis_users_v1";
const SESSION_KEY="medis_session_v1";
const SHARE_KEY="medis_shares_v1";
let currentUser=null;
let recordsCache=[];
let calendar=null;
let adherenceChart=null;
let qrInstance=null;

const $=id=>document.getElementById(id);
const qsa=s=>[...document.querySelectorAll(s)];
const uid=(p="ID")=>`${p}-${Date.now()}-${Math.floor(Math.random()*100000)}`;

function todayISO(){
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function esc(v){
  return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function fmtDate(v,opts={day:"2-digit",month:"short",year:"numeric"}){
  if(!v)return"—";
  const d=v.length===10?new Date(v+"T12:00:00"):new Date(v);
  return d.toLocaleDateString("es-MX",opts);
}
function fmtDT(v){return v?new Date(v).toLocaleString("es-MX",{dateStyle:"medium",timeStyle:"short"}):"—";}
function users(){return JSON.parse(localStorage.getItem(USERS_KEY)||"[]");}
function saveUsers(arr){localStorage.setItem(USERS_KEY,JSON.stringify(arr));}
function shares(){return JSON.parse(localStorage.getItem(SHARE_KEY)||"[]");}
function saveShares(arr){localStorage.setItem(SHARE_KEY,JSON.stringify(arr));}
function ensureUser(u){
  u.profile ||= {birth:"",phone:"",blood:"",allergies:"",notes:"",emergencyName:"",emergencyPhone:""};
  u.medications ||= [];
  u.medicationLogs ||= [];
  u.medicationChanges ||= [];
  u.appointments ||= [];
  u.audit ||= [];
  u.lastConsultDate ||= "";
  return u;
}
function saveCurrent(){
  const arr=users();
  const i=arr.findIndex(u=>u.email===currentUser.email);
  if(i>=0){arr[i]=currentUser;saveUsers(arr);}
}
async function hashPassword(p){
  const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(p));
  return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
function toast(title,icon="success"){
  if(window.Swal) Swal.fire({toast:true,position:"top-end",showConfirmButton:false,timer:2200,timerProgressBar:true,icon,title});
  else alert(title);
}
async function ask(title,text=""){
  if(!window.Swal)return confirm(title);
  const r=await Swal.fire({title,text,icon:"question",showCancelButton:true,confirmButtonText:"Sí",cancelButtonText:"Cancelar",confirmButtonColor:"#933657"});
  return r.isConfirmed;
}

/* ---------- Shared-view bootstrap ---------- */
(async function sharedBootstrap(){
  const params=new URLSearchParams(location.search);
  const token=params.get("share");
  if(!token)return;

  const share=shares().find(s=>s.token===token);
  $("authScreen").classList.add("hidden");
  $("appShell").classList.add("hidden");
  $("sharedView").classList.remove("hidden");

  if(!share){
    $("sharedContent").innerHTML="<h1>Acceso no disponible</h1><p>El enlace no existe en este navegador.</p>";
    return;
  }
  if(Date.now()>share.expiresAt){
    $("sharedContent").innerHTML="<h1>Acceso expirado</h1><p>El permiso temporal ya terminó.</p>";
    return;
  }

  const u=ensureUser(users().find(x=>x.email===share.userEmail)||{});
  if(!u.email){
    $("sharedContent").innerHTML="<h1>Información no disponible</h1><p>No se encontraron los datos locales asociados.</p>";
    return;
  }

  u.audit.push({id:uid("AUD"),type:"share",date:new Date().toISOString(),detail:"Se abrió un acceso temporal mediante enlace/QR.",token});
  currentUser=u;saveCurrent();currentUser=null;

  let html=`<h1>Resumen compartido</h1><p><strong>Paciente:</strong> ${esc(u.name)}</p><p><strong>Acceso válido hasta:</strong> ${fmtDT(share.expiresAt)}</p>`;
  if(share.permissions.allergies){
    html+=`<h3>Alergias y datos esenciales</h3><p><strong>Tipo de sangre:</strong> ${esc(u.profile.blood||"No registrado")}<br><strong>Alergias:</strong> ${esc(u.profile.allergies||"No registradas")}</p>`;
  }
  if(share.permissions.meds){
    html+=`<h3>Medicamentos actuales</h3><ul>${u.medications.filter(m=>m.active).map(m=>`<li>${esc(m.name)} · ${esc(m.dose)} · ${esc(m.frequency)}</li>`).join("")||"<li>Sin medicamentos activos</li>"}</ul>`;
  }
  if(share.permissions.records){
    html+=`<h3>Documentos</h3><p>En este MVP los archivos privados no se transmiten por red. La versión productiva mostraría aquí los documentos autorizados.</p>`;
  }
  if(share.permissions.history){
    html+=`<h3>Historial reciente</h3><ul>${buildTimeline(u,[]).slice(0,12).map(i=>`<li>${fmtDT(i.date)} · ${esc(i.title)}</li>`).join("")}</ul>`;
  }
  $("sharedContent").innerHTML=html;
})();

/* ---------- Auth ---------- */
qsa(".auth-tab").forEach(b=>b.addEventListener("click",()=>{
  qsa(".auth-tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");
  const login=b.dataset.tab==="login";
  $("loginForm").classList.toggle("hidden",!login);
  $("registerForm").classList.toggle("hidden",login);
}));

$("registerForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const name=$("registerName").value.trim(),email=$("registerEmail").value.trim().toLowerCase();
  const arr=users();
  if(arr.some(u=>u.email===email))return toast("Ya existe una cuenta con ese correo","warning");
  const u=ensureUser({id:uid("USR"),name,email,passwordHash:await hashPassword($("registerPassword").value),createdAt:new Date().toISOString()});
  arr.push(u);saveUsers(arr);currentUser=u;sessionStorage.setItem(SESSION_KEY,email);e.target.reset();launchApp();toast("Cuenta creada");
});

$("loginForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const email=$("loginEmail").value.trim().toLowerCase(),hash=await hashPassword($("loginPassword").value);
  const u=users().find(x=>x.email===email&&x.passwordHash===hash);
  if(!u)return toast("Correo o contraseña incorrectos","error");
  currentUser=ensureUser(u);sessionStorage.setItem(SESSION_KEY,email);e.target.reset();launchApp();
});

$("demoBtn").addEventListener("click",async()=>{
  const email="demo@medis.local";let arr=users(),u=arr.find(x=>x.email===email);
  if(!u){
    u=ensureUser({
      id:uid("USR"),name:"Irma",email,passwordHash:await hashPassword("demo123"),createdAt:new Date().toISOString(),
      profile:{birth:"1992-05-18",phone:"7710000000",blood:"O+",allergies:"Penicilina",notes:"Ejemplo de demostración",emergencyName:"Contacto de confianza",emergencyPhone:"7711111111"},
      lastConsultDate:new Date(Date.now()-30*86400000).toISOString(),
      medications:[
        {id:"MED-DEMO1",name:"Metformina",dose:"500 mg",frequency:"Cada 12 horas",times:["08:00","20:00"],start:"2026-07-15",doctor:"Dra. García",reason:"Seguimiento metabólico",instructions:"Después de alimentos",recordId:"",active:true,createdAt:new Date(Date.now()-45*86400000).toISOString()},
        {id:"MED-DEMO2",name:"Losartán",dose:"50 mg",frequency:"Cada 24 horas",times:["09:00"],start:"2026-08-02",doctor:"Dr. Ramírez",reason:"Control de presión",instructions:"",recordId:"",active:true,createdAt:new Date(Date.now()-25*86400000).toISOString()}
      ],
      medicationChanges:[
        {id:"CHG-DEMO",medicationId:"MED-DEMO1",medicationName:"Metformina",oldDose:"850 mg",newDose:"500 mg",oldFrequency:"Cada 12 horas",newFrequency:"Cada 12 horas",oldTimes:["08:00","20:00"],newTimes:["08:00","20:00"],doctor:"Dra. García",note:"Ajuste indicado en consulta",date:"2026-08-05",timestamp:new Date("2026-08-05T10:00:00").toISOString(),recordId:""}
      ],
      medicationLogs:[],
      appointments:[
        {id:"APT-DEMO",type:"Consulta médica",specialty:"Medicina interna",date:new Date(Date.now()+10*86400000).toISOString().slice(0,10),time:"10:30",doctor:"Dra. García",location:"Consultorio",notes:"Seguimiento",createdAt:new Date().toISOString()}
      ],
      audit:[]
    });
    arr.push(u);saveUsers(arr);
  }
  currentUser=ensureUser(u);sessionStorage.setItem(SESSION_KEY,email);launchApp();toast("Modo demostración");
});

$("logoutBtn").addEventListener("click",async()=>{
  if(!(await ask("¿Cerrar sesión?")))return;
  sessionStorage.removeItem(SESSION_KEY);currentUser=null;$("appShell").classList.add("hidden");$("authScreen").classList.remove("hidden");
});

/* ---------- Navigation ---------- */
const meta={home:["MI SALUD","Inicio"],consult:["MODO CONSULTA","Preparar consulta"],medications:["TRATAMIENTOS","Medicamentos"],calendar:["AGENDA","Calendario"],records:["EXPEDIENTE","Expediente médico"],history:["LÍNEA DE TIEMPO","Historial"],share:["PRIVACIDAD","Compartir"],emergency:["ACCESO RÁPIDO","Emergencia"],profile:["DATOS PERSONALES","Mi perfil"]};
function showSection(name){
  qsa(".page-section").forEach(s=>s.classList.toggle("active",s.id===`section-${name}`));
  qsa(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.section===name));
  $("sectionEyebrow").textContent=meta[name][0];$("sectionTitle").textContent=meta[name][1];
  document.querySelector(".sidebar").classList.remove("open");
  if(name==="calendar")setTimeout(renderCalendar,50);
  if(name==="consult")renderConsult();
  if(name==="records")renderRecords();
  if(name==="history")renderHistory();
  if(name==="share")renderShare();
  if(name==="emergency")renderEmergency();
  if(name==="profile")renderProfile();
  window.scrollTo({top:0,behavior:"smooth"});
}
qsa(".nav-item").forEach(b=>b.addEventListener("click",()=>showSection(b.dataset.section)));
qsa("[data-go]").forEach(b=>b.addEventListener("click",()=>showSection(b.dataset.go)));
$("mobileMenu").addEventListener("click",()=>document.querySelector(".sidebar").classList.toggle("open"));

/* ---------- Modals ---------- */
function openModal(id){$("backdrop").classList.remove("hidden");$(id).classList.remove("hidden");}
function closeModal(id){$(id).classList.add("hidden");$("backdrop").classList.add("hidden");}
qsa("[data-close]").forEach(b=>b.addEventListener("click",()=>closeModal(b.dataset.close)));
$("backdrop").addEventListener("click",()=>{qsa(".modal").forEach(m=>m.classList.add("hidden"));$("backdrop").classList.add("hidden");});

$("newMedicationBtn").addEventListener("click",async()=>{
  $("medicationForm").reset();$("medEditId").value="";$("medStart").value=todayISO();$("medModalTitle").textContent="Nuevo medicamento";
  await fillRelationSelects();openModal("medicationModal");
});
$("newAppointmentBtn").addEventListener("click",()=>{$("appointmentForm").reset();$("appointmentDate").value=todayISO();openModal("appointmentModal");});
$("newRecordBtn").addEventListener("click",async()=>{$("recordForm").reset();$("recordDate").value=todayISO();$("ocrPanel").classList.add("hidden");await fillRelationSelects();openModal("recordModal");});

/* ---------- Medications ---------- */
$("medicationForm").addEventListener("submit",e=>{
  e.preventDefault();
  const id=$("medEditId").value;
  const data={name:$("medName").value.trim(),dose:$("medDose").value.trim(),frequency:$("medFrequency").value,times:$("medTimes").value.split(",").map(x=>x.trim()).filter(Boolean),start:$("medStart").value,doctor:$("medDoctor").value.trim(),reason:$("medReason").value.trim(),recordId:$("medRecordLink").value,instructions:$("medInstructions").value.trim()};
  if(id){
    const m=currentUser.medications.find(x=>x.id===id);
    Object.assign(m,data);
  }else{
    currentUser.medications.push({id:uid("MED"),...data,active:true,createdAt:new Date().toISOString()});
  }
  saveCurrent();closeModal("medicationModal");renderAll();toast(id?"Medicamento actualizado":"Medicamento registrado");
});

async function editMedication(id){
  const m=currentUser.medications.find(x=>x.id===id);if(!m)return;
  await fillRelationSelects();$("medEditId").value=m.id;$("medName").value=m.name;$("medDose").value=m.dose;$("medFrequency").value=m.frequency;$("medTimes").value=m.times.join(", ");$("medStart").value=m.start;$("medDoctor").value=m.doctor||"";$("medReason").value=m.reason||"";$("medRecordLink").value=m.recordId||"";$("medInstructions").value=m.instructions||"";$("medModalTitle").textContent="Editar medicamento";openModal("medicationModal");
}
async function openChange(id){
  const m=currentUser.medications.find(x=>x.id===id);if(!m)return;
  await fillRelationSelects();$("changeMedId").value=m.id;$("changeDose").value=m.dose;$("changeFrequency").value=m.frequency;$("changeTimes").value=m.times.join(", ");$("changeDate").value=todayISO();$("changeDoctor").value=m.doctor||"";$("changeRecordLink").value=m.recordId||"";$("changeNote").value="";openModal("changeModal");
}
$("changeForm").addEventListener("submit",e=>{
  e.preventDefault();
  const m=currentUser.medications.find(x=>x.id===$("changeMedId").value);if(!m)return;
  const change={id:uid("CHG"),medicationId:m.id,medicationName:m.name,oldDose:m.dose,newDose:$("changeDose").value.trim(),oldFrequency:m.frequency,newFrequency:$("changeFrequency").value,oldTimes:[...m.times],newTimes:$("changeTimes").value.split(",").map(x=>x.trim()).filter(Boolean),doctor:$("changeDoctor").value.trim(),note:$("changeNote").value.trim(),date:$("changeDate").value,recordId:$("changeRecordLink").value,timestamp:new Date().toISOString()};
  currentUser.medicationChanges.push(change);
  m.dose=change.newDose;m.frequency=change.newFrequency;m.times=change.newTimes;m.doctor=change.doctor||m.doctor;m.recordId=change.recordId||m.recordId;
  saveCurrent();closeModal("changeModal");renderAll();toast("Cambio de tratamiento registrado");
});
async function finishMedication(id){
  if(!(await ask("¿Finalizar tratamiento?","Permanecerá en tu historial.")))return;
  const m=currentUser.medications.find(x=>x.id===id);if(!m)return;m.active=false;m.finishedAt=new Date().toISOString();saveCurrent();renderAll();
}
function logDose(id,time,status="Tomada"){
  const m=currentUser.medications.find(x=>x.id===id);if(!m)return;
  const existing=currentUser.medicationLogs.find(l=>l.medicationId===id&&l.date===todayISO()&&l.time===time);
  if(existing){existing.status=status;existing.timestamp=new Date().toISOString();}
  else currentUser.medicationLogs.push({id:uid("LOG"),medicationId:id,medicationName:m.name,dose:m.dose,date:todayISO(),time,status,timestamp:new Date().toISOString()});
  saveCurrent();renderAll();toast(status==="Tomada"?"Toma registrada":"Toma actualizada");
}
window.editMedication=editMedication;window.openChange=openChange;window.finishMedication=finishMedication;window.logDose=logDose;

function taken(id,time,date=todayISO()){return currentUser.medicationLogs.some(l=>l.medicationId===id&&l.time===time&&l.date===date&&l.status==="Tomada");}
function linkedRecordName(id){return recordsCache.find(r=>r.id===id)?.fileName||"";}
function renderMedications(){
  const active=currentUser.medications.filter(m=>m.active);
  $("medicationCards").innerHTML=active.length?active.map(m=>`
    <article class="med-card">
      <span class="panel-kicker">${esc(m.frequency)}</span>
      <h3>${esc(m.name)}</h3>
      <p><b>Dosis:</b> ${esc(m.dose)}</p>
      <p><b>Inicio:</b> ${fmtDate(m.start)}</p>
      <p><b>Médico:</b> ${esc(m.doctor||"No registrado")}</p>
      <p><b>Motivo:</b> ${esc(m.reason||"No registrado")}</p>
      ${m.recordId?`<p><b>Documento:</b> ${esc(linkedRecordName(m.recordId)||"Relacionado")}</p>`:""}
      <div class="chips">${m.times.map(t=>`<span class="chip">${esc(t)}</span>`).join("")}</div>
      <div class="card-actions">
        ${m.times.map(t=>taken(m.id,t)?`<button class="small-btn good" onclick="logDose('${m.id}','${t}')">✓ ${t}</button>`:`<button class="small-btn good" onclick="logDose('${m.id}','${t}')">Tomé ${t}</button>`).join("")}
        <button class="small-btn soft" onclick="openChange('${m.id}')">Registrar cambio</button>
        <button class="small-btn soft" onclick="editMedication('${m.id}')">Editar</button>
        <button class="small-btn danger" onclick="finishMedication('${m.id}')">Finalizar</button>
      </div>
    </article>`).join(""):`<div class="empty" style="grid-column:1/-1">Aún no tienes medicamentos activos.</div>`;

  const rows=[];active.forEach(m=>m.times.forEach(t=>rows.push({m,t})));
  $("todayMedList").innerHTML=rows.length?rows.map(x=>`
    <div class="list-item"><div><strong>${esc(x.m.name)} · ${esc(x.m.dose)}</strong><div class="item-meta">${esc(x.t)} · ${esc(x.m.frequency)}</div></div>
    ${taken(x.m.id,x.t)?`<span class="status done">✓ Tomada</span>`:`<button class="small-btn good" onclick="logDose('${x.m.id}','${x.t}')">Registrar</button>`}</div>`).join(""):`<div class="empty">Sin medicamentos programados.</div>`;
}

/* ---------- Appointments ---------- */
$("appointmentForm").addEventListener("submit",e=>{
  e.preventDefault();
  currentUser.appointments.push({id:uid("APT"),type:$("appointmentType").value,specialty:$("appointmentSpecialty").value.trim(),date:$("appointmentDate").value,time:$("appointmentTime").value,doctor:$("appointmentDoctor").value.trim(),location:$("appointmentLocation").value.trim(),notes:$("appointmentNotes").value.trim(),createdAt:new Date().toISOString()});
  saveCurrent();e.target.reset();closeModal("appointmentModal");renderAll();showSection("calendar");toast("Cita guardada");
});
async function deleteAppointment(id){if(!(await ask("¿Eliminar cita?")))return;currentUser.appointments=currentUser.appointments.filter(a=>a.id!==id);saveCurrent();renderCalendar();renderAll();}
window.deleteAppointment=deleteAppointment;
function renderCalendar(){
  if(!window.FullCalendar)return;const el=$("calendar");if(calendar)calendar.destroy();
  calendar=new FullCalendar.Calendar(el,{initialView:"dayGridMonth",locale:"es",firstDay:1,height:"auto",headerToolbar:{left:"prev,next today",center:"title",right:"dayGridMonth,listMonth"},buttonText:{today:"Hoy",month:"Mes",list:"Lista"},events:currentUser.appointments.map(a=>({id:a.id,title:`${a.time} · ${a.type}${a.specialty?" · "+a.specialty:""}`,start:`${a.date}T${a.time}`,backgroundColor:"#b1496d",borderColor:"#b1496d",extendedProps:a})),eventClick(info){const a=info.event.extendedProps;if(window.Swal)Swal.fire({title:fmtDate(a.date),html:`<div style="text-align:left"><p><b>Tipo:</b> ${esc(a.type)}</p><p><b>Especialidad:</b> ${esc(a.specialty||"—")}</p><p><b>Médico:</b> ${esc(a.doctor||"—")}</p><p><b>Lugar:</b> ${esc(a.location||"—")}</p><p><b>Notas:</b> ${esc(a.notes||"—")}</p></div>`,showCancelButton:true,confirmButtonText:"Cerrar",cancelButtonText:"Eliminar cita",confirmButtonColor:"#933657",cancelButtonColor:"#ba4960"}).then(r=>{if(r.dismiss===Swal.DismissReason.cancel)deleteAppointment(a.id);});}});
  calendar.render();
}

/* ---------- Records & OCR ---------- */
$("recordFile").addEventListener("change",()=>{
  const f=$("recordFile").files[0];
  $("ocrPanel").classList.toggle("hidden",!(f&&f.type.startsWith("image/")&&$("recordCategory").value==="Receta"));
});
$("recordCategory").addEventListener("change",()=>$("recordFile").dispatchEvent(new Event("change")));
$("runOcrBtn").addEventListener("click",async()=>{
  const f=$("recordFile").files[0];if(!f||!f.type.startsWith("image/"))return toast("Selecciona una imagen","warning");
  if(!window.Tesseract)return toast("No se cargó Tesseract.js","error");
  $("runOcrBtn").disabled=true;$("runOcrBtn").textContent="Analizando...";
  try{
    const res=await Tesseract.recognize(f,"spa",{logger:m=>{if(m.status==="recognizing text")$("runOcrBtn").textContent=`Analizando ${Math.round(m.progress*100)}%`; }});
    $("ocrText").value=res.data.text.trim();
    toast("Texto detectado. Revísalo antes de guardar.");
  }catch(e){console.error(e);toast("No se pudo analizar la imagen","error");}
  finally{$("runOcrBtn").disabled=false;$("runOcrBtn").textContent="Analizar imagen";}
});
function fileData(f){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(f);});}
$("recordForm").addEventListener("submit",async e=>{
  e.preventDefault();const f=$("recordFile").files[0];if(!f)return;
  if(f.size>5*1024*1024)return toast("Para este MVP usa archivos menores de 5 MB","warning");
  const rec={id:uid("REC"),userEmail:currentUser.email,category:$("recordCategory").value,date:$("recordDate").value,appointmentId:$("recordAppointmentLink").value,medicationId:$("recordMedicationLink").value,notes:$("recordNotes").value.trim(),ocrText:$("ocrText").value.trim(),fileName:f.name,mimeType:f.type||"application/octet-stream",size:f.size,dataUrl:await fileData(f),createdAt:new Date().toISOString()};
  await MedisDB.put(rec);e.target.reset();$("ocrText").value="";closeModal("recordModal");await renderRecords();renderAll();toast("Documento guardado");
});
async function renderRecords(){
  recordsCache=await MedisDB.getAll(currentUser.email);recordsCache.sort((a,b)=>new Date(b.date)-new Date(a.date));
  const term=$("recordSearch").value.trim().toLowerCase(),cat=$("recordFilter").value;
  const rows=recordsCache.filter(r=>(!term||`${r.fileName} ${r.category} ${r.notes} ${r.ocrText}`.toLowerCase().includes(term))&&(cat==="all"||r.category===cat));
  $("recordCards").innerHTML=rows.length?rows.map(r=>{
    const relMed=currentUser.medications.find(m=>m.id===r.medicationId),relAp=currentUser.appointments.find(a=>a.id===r.appointmentId);
    return `<article class="record-card"><div class="record-preview">${r.mimeType.startsWith("image/")?`<img src="${r.dataUrl}" alt="${esc(r.fileName)}">`:`<div class="pdf-icon">PDF</div>`}</div><div class="record-body"><span class="panel-kicker">${esc(r.category)}</span><h4>${esc(r.fileName)}</h4><p>${fmtDate(r.date)}</p><p>${esc(r.notes||"Sin notas")}</p>${relMed||relAp?`<div class="relation-note">${relMed?`Medicamento: ${esc(relMed.name)}`:""}${relMed&&relAp?" · ":""}${relAp?`Cita: ${esc(relAp.type)} ${fmtDate(relAp.date)}`:""}</div>`:""}<div class="card-actions"><button class="small-btn good" onclick="openRecord('${r.id}')">Abrir</button><button class="small-btn danger" onclick="removeRecord('${r.id}')">Eliminar</button></div></div></article>`;
  }).join(""):`<div class="empty" style="grid-column:1/-1">No hay documentos para mostrar.</div>`;
  updateKPIs();
}
$("recordSearch").addEventListener("input",renderRecords);$("recordFilter").addEventListener("change",renderRecords);
function openRecord(id){const r=recordsCache.find(x=>x.id===id);if(!r)return;const w=window.open();if(!w)return toast("El navegador bloqueó la ventana","warning");if(r.mimeType.startsWith("image/"))w.document.write(`<body style="margin:0;background:#111;display:grid;place-items:center;min-height:100vh"><img src="${r.dataUrl}" style="max-width:95vw;max-height:95vh"></body>`);else w.location.href=r.dataUrl;}
async function removeRecord(id){if(!(await ask("¿Eliminar documento?","Esta acción no puede deshacerse.")))return;await MedisDB.remove(id);await renderRecords();renderHistory();}
window.openRecord=openRecord;window.removeRecord=removeRecord;
async function fillRelationSelects(){
  recordsCache=await MedisDB.getAll(currentUser.email);
  const recOptions=`<option value="">Sin documento</option>`+recordsCache.map(r=>`<option value="${r.id}">${esc(r.category)} · ${esc(r.fileName)}</option>`).join("");
  $("medRecordLink").innerHTML=recOptions;$("changeRecordLink").innerHTML=recOptions;
  $("recordMedicationLink").innerHTML=`<option value="">Sin medicamento relacionado</option>`+currentUser.medications.map(m=>`<option value="${m.id}">${esc(m.name)} · ${esc(m.dose)}</option>`).join("");
  $("recordAppointmentLink").innerHTML=`<option value="">Sin cita relacionada</option>`+currentUser.appointments.map(a=>`<option value="${a.id}">${fmtDate(a.date)} · ${esc(a.type)}</option>`).join("");
}

/* ---------- Consult mode ---------- */
function sinceLastConsult(arr,dateKey="timestamp"){if(!currentUser.lastConsultDate)return arr;return arr.filter(x=>new Date(x[dateKey]||x.createdAt||x.date)>new Date(currentUser.lastConsultDate));}
function changeStats(){
  const changes=sinceLastConsult(currentUser.medicationChanges);
  const newMeds=currentUser.medications.filter(m=>!currentUser.lastConsultDate||new Date(m.createdAt)>new Date(currentUser.lastConsultDate));
  const finished=currentUser.medications.filter(m=>m.finishedAt&&(!currentUser.lastConsultDate||new Date(m.finishedAt)>new Date(currentUser.lastConsultDate)));
  const newDocs=recordsCache.filter(r=>!currentUser.lastConsultDate||new Date(r.createdAt)>new Date(currentUser.lastConsultDate));
  return {changes,newMeds,finished,newDocs};
}
function renderChangeSummary(){
  const s=changeStats();
  $("changeSummary").innerHTML=`<div class="change-card"><strong>${s.newMeds.length}</strong><span>medicamento(s) nuevo(s)</span></div><div class="change-card"><strong>${s.changes.length}</strong><span>cambio(s) de tratamiento</span></div><div class="change-card"><strong>${s.finished.length}</strong><span>tratamiento(s) finalizado(s)</span></div><div class="change-card"><strong>${s.newDocs.length}</strong><span>documento(s) nuevo(s)</span></div>`;
}
function adherence30(){
  const cutoff=new Date(Date.now()-30*86400000);const logs=currentUser.medicationLogs.filter(l=>new Date(l.timestamp)>=cutoff);if(!logs.length)return"Sin datos";const takenCount=logs.filter(l=>l.status==="Tomada").length;return`${Math.round(takenCount/logs.length*100)}%`;
}
function renderConsult(){
  const active=currentUser.medications.filter(m=>m.active),s=changeStats(),recentDocs=[...recordsCache].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5),next=getNextAppointment();
  $("consultSummary").innerHTML=`
    <div class="consult-header"><div><span class="panel-kicker">RESUMEN PARA CONSULTA</span><h2>${esc(currentUser.name)}</h2><p class="muted">Generado ${fmtDT(new Date().toISOString())}</p></div><div><p><b>Última consulta marcada:</b><br>${currentUser.lastConsultDate?fmtDate(currentUser.lastConsultDate):"No registrada"}</p><p><b>Adherencia registrada (30 días):</b><br>${adherence30()}</p></div></div>
    <div class="consult-grid">
      <section class="consult-block"><span class="panel-kicker">TRATAMIENTO ACTUAL</span><h3>Medicamentos</h3><ul class="clean-list">${active.map(m=>`<li><b>${esc(m.name)}</b> · ${esc(m.dose)} · ${esc(m.frequency)} · ${esc(m.times.join(", "))}</li>`).join("")||"<li>Sin medicamentos activos</li>"}</ul></section>
      <section class="consult-block"><span class="panel-kicker">DATOS CLAVE</span><h3>Alergias y emergencia</h3><p><b>Alergias:</b> ${esc(currentUser.profile.allergies||"No registradas")}</p><p><b>Tipo sanguíneo:</b> ${esc(currentUser.profile.blood||"No registrado")}</p><p><b>Contacto:</b> ${esc(currentUser.profile.emergencyName||"No registrado")} ${esc(currentUser.profile.emergencyPhone||"")}</p></section>
      <section class="consult-block wide"><span class="panel-kicker">DESDE LA ÚLTIMA CONSULTA</span><h3>Qué cambió</h3>
        ${s.changes.length?s.changes.map(c=>`<div class="diff-row"><span class="diff-old">${esc(c.medicationName)} · ${esc(c.oldDose)} · ${esc(c.oldFrequency)}</span><span>→</span><span class="diff-new">${esc(c.medicationName)} · ${esc(c.newDose)} · ${esc(c.newFrequency)}</span></div>`).join(""):`<p class="muted">No hay cambios de dosis registrados.</p>`}
        ${s.newMeds.length?`<p><b>Nuevos:</b> ${s.newMeds.map(m=>esc(m.name)).join(", ")}</p>`:""}
        ${s.finished.length?`<p><b>Finalizados:</b> ${s.finished.map(m=>esc(m.name)).join(", ")}</p>`:""}
      </section>
      <section class="consult-block"><span class="panel-kicker">DOCUMENTOS</span><h3>Últimos archivos</h3><ul class="clean-list">${recentDocs.map(r=>`<li>${fmtDate(r.date)} · ${esc(r.category)} · ${esc(r.fileName)}</li>`).join("")||"<li>Sin documentos</li>"}</ul></section>
      <section class="consult-block"><span class="panel-kicker">AGENDA</span><h3>Próxima cita</h3>${next?`<p><b>${fmtDate(next.date)} · ${esc(next.time)}</b></p><p>${esc(next.type)}${next.specialty?" · "+esc(next.specialty):""}</p><p>${esc(next.doctor||"")}</p>`:`<p class="muted">No hay cita próxima.</p>`}</section>
    </div>`;
}
$("setLastConsultBtn").addEventListener("click",async()=>{if(!(await ask("¿Marcar hoy como última consulta?","A partir de aquí Medis calculará los cambios posteriores.")))return;currentUser.lastConsultDate=new Date().toISOString();saveCurrent();renderAll();renderConsult();toast("Última consulta actualizada");});
$("printConsultBtn").addEventListener("click",()=>{showSection("consult");setTimeout(()=>window.print(),200);});

/* ---------- Timeline ---------- */
function buildTimeline(u=currentUser,recs=recordsCache){
  const out=[];
  u.medications.forEach(m=>out.push({type:"medication",date:m.createdAt||m.start,title:`Medicamento registrado: ${m.name}`,detail:`${m.dose} · ${m.frequency}`}));
  u.medicationLogs.forEach(l=>out.push({type:"medication",date:l.timestamp,title:`${l.status}: ${l.medicationName}`,detail:`${l.dose} · ${l.time}`}));
  u.medicationChanges.forEach(c=>out.push({type:"change",date:c.timestamp||c.date,title:`Cambio: ${c.medicationName}`,detail:`${c.oldDose} → ${c.newDose} · ${c.note||"Sin nota"}`}));
  u.appointments.forEach(a=>out.push({type:"appointment",date:`${a.date}T${a.time}`,title:`${a.type}${a.specialty?" · "+a.specialty:""}`,detail:`${a.doctor||"Sin médico"}${a.location?" · "+a.location:""}`}));
  recs.forEach(r=>out.push({type:"record",date:r.createdAt||r.date,title:`Documento: ${r.category}`,detail:r.fileName}));
  (u.audit||[]).forEach(a=>out.push({type:"share",date:a.date,title:"Acceso temporal",detail:a.detail}));
  return out.sort((a,b)=>new Date(b.date)-new Date(a.date));
}
function renderHistory(){
  const filter=$("historyFilter").value,items=buildTimeline().filter(x=>filter==="all"||x.type===filter);
  $("timeline").innerHTML=items.length?items.map(i=>`<article class="timeline-item"><div class="timeline-dot"></div><p class="timeline-date">${fmtDT(i.date)}</p><h4>${esc(i.title)}</h4><p>${esc(i.detail)}</p></article>`).join(""):`<div class="empty">Sin eventos para mostrar.</div>`;
  const next=getNextAppointment(),active=currentUser.medications.filter(m=>m.active);
  $("healthSideSummary").innerHTML=`<div class="summary-row"><span>Paciente</span><strong>${esc(currentUser.name)}</strong></div><div class="summary-row"><span>Tipo de sangre</span><strong>${esc(currentUser.profile.blood||"No registrado")}</strong></div><div class="summary-row"><span>Alergias</span><strong>${esc(currentUser.profile.allergies||"No registradas")}</strong></div><div class="summary-row"><span>Medicamentos activos</span><strong>${active.length}</strong></div><div class="summary-row"><span>Próxima cita</span><strong>${next?fmtDate(next.date)+" · "+next.time:"Sin cita"}</strong></div><div class="summary-row"><span>Documentos</span><strong>${recordsCache.length}</strong></div>`;
}
$("historyFilter").addEventListener("change",renderHistory);
function historyRows(){return buildTimeline().map(i=>({Fecha:fmtDT(i.date),Tipo:i.type,Evento:i.title,Detalle:i.detail}));}
$("exportCsvBtn").addEventListener("click",()=>{if(!window.Papa)return toast("No se cargó Papa Parse","error");const blob=new Blob([Papa.unparse(historyRows())],{type:"text/csv;charset=utf-8"});download(blob,"medis_historial.csv");});
$("exportExcelBtn").addEventListener("click",()=>{if(!window.XLSX)return toast("No se cargó SheetJS","error");const ws=XLSX.utils.json_to_sheet(historyRows()),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Historial");XLSX.writeFile(wb,"medis_historial.xlsx");});
function download(blob,name){const u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),500);}

/* ---------- Share / QR / Audit ---------- */
$("shareForm").addEventListener("submit",e=>{
  e.preventDefault();
  const token=crypto.randomUUID?crypto.randomUUID():uid("SHARE");
  const minutes=Number($("shareDuration").value);
  const item={id:uid("SHR"),token,userEmail:currentUser.email,createdAt:Date.now(),expiresAt:Date.now()+minutes*60000,permissions:{meds:$("shareMeds").checked,allergies:$("shareAllergies").checked,records:$("shareRecords").checked,history:$("shareHistory").checked}};
  const arr=shares().filter(s=>s.expiresAt>Date.now());arr.push(item);saveShares(arr);
  currentUser.audit.push({id:uid("AUD"),type:"share",date:new Date().toISOString(),detail:`Se generó un acceso temporal por ${minutes} minutos.`,token});saveCurrent();
  const link=`${location.origin}${location.pathname}?share=${encodeURIComponent(token)}`;
  $("shareLink").value=link;$("shareStatus").textContent=`Válido hasta ${fmtDT(item.expiresAt)}`;$("qrCode").innerHTML="";
  if(window.QRCode){qrInstance=new QRCode($("qrCode"),{text:link,width:190,height:190,colorDark:"#561832",colorLight:"#ffffff"});}
  else $("qrCode").textContent="QR no disponible";
  renderAudit();
});
$("copyShareBtn").addEventListener("click",async()=>{const v=$("shareLink").value;if(!v)return toast("Primero genera un acceso","warning");await navigator.clipboard.writeText(v);toast("Enlace copiado");});
function renderAudit(){
  $("auditList").innerHTML=currentUser.audit.length?[...currentUser.audit].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(a=>`<div class="audit-item"><div><strong>${esc(a.detail)}</strong><div class="item-meta">${fmtDT(a.date)}</div></div><span class="status done">Registrado</span></div>`).join(""):`<div class="empty">Todavía no hay accesos registrados.</div>`;
}
function renderShare(){renderAudit();}

/* ---------- Emergency ---------- */
function renderEmergency(){
  const active=currentUser.medications.filter(m=>m.active);
  $("emergencyCard").innerHTML=`<div class="emergency-head"><div><span class="eyebrow">MEDIS · INFORMACIÓN DE EMERGENCIA</span><h2>${esc(currentUser.name)}</h2><p>Actualizado ${fmtDate(todayISO())}</p></div><div class="brand-mark">M</div></div><div class="emergency-grid"><div class="emergency-item"><span>Tipo de sangre</span><strong>${esc(currentUser.profile.blood||"No registrado")}</strong></div><div class="emergency-item"><span>Alergias</span><strong>${esc(currentUser.profile.allergies||"No registradas")}</strong></div><div class="emergency-item"><span>Contacto de emergencia</span><strong>${esc(currentUser.profile.emergencyName||"No registrado")}</strong><small>${esc(currentUser.profile.emergencyPhone||"")}</small></div></div><div class="emergency-meds"><h3>Medicamentos actuales</h3>${active.length?`<ul>${active.map(m=>`<li><b>${esc(m.name)}</b> · ${esc(m.dose)} · ${esc(m.frequency)}</li>`).join("")}</ul>`:"<p>Sin medicamentos activos.</p>"}</div>`;
}
$("printEmergencyBtn").addEventListener("click",()=>{showSection("emergency");setTimeout(()=>window.print(),200);});

/* ---------- Profile ---------- */
$("profileForm").addEventListener("submit",e=>{
  e.preventDefault();currentUser.name=$("profileName").value.trim()||currentUser.name;currentUser.profile={birth:$("profileBirth").value,phone:$("profilePhone").value.trim(),blood:$("profileBlood").value,allergies:$("profileAllergies").value.trim(),emergencyName:$("profileEmergencyName").value.trim(),emergencyPhone:$("profileEmergencyPhone").value.trim(),notes:$("profileNotes").value.trim()};saveCurrent();renderAll();toast("Perfil actualizado");
});
function renderProfile(){const p=currentUser.profile;$("profileName").value=currentUser.name;$("profileBirth").value=p.birth||"";$("profilePhone").value=p.phone||"";$("profileBlood").value=p.blood||"";$("profileAllergies").value=p.allergies||"";$("profileEmergencyName").value=p.emergencyName||"";$("profileEmergencyPhone").value=p.emergencyPhone||"";$("profileNotes").value=p.notes||"";$("profileNameView").textContent=currentUser.name;$("profileEmailView").textContent=currentUser.email;$("profileAvatar").textContent=(currentUser.name||"U")[0].toUpperCase();}

/* ---------- Dashboard ---------- */
function getNextAppointment(){const now=new Date();return currentUser.appointments.map(a=>({...a,dt:new Date(`${a.date}T${a.time}`)})).filter(a=>a.dt>=now).sort((a,b)=>a.dt-b.dt)[0]||null;}
function updateKPIs(){const active=currentUser.medications.filter(m=>m.active),schedule=[];active.forEach(m=>m.times.forEach(t=>schedule.push({m,t})));const done=schedule.filter(x=>taken(x.m.id,x.t)).length,next=getNextAppointment();$("kpiMeds").textContent=active.length;$("kpiToday").textContent=`${done}/${schedule.length}`;$("kpiTodayText").textContent=schedule.length===0?"Sin tomas programadas":done===schedule.length?"Todo registrado por hoy":`${schedule.length-done} pendiente(s)`;$("kpiNext").textContent=next?fmtDate(next.date,{day:"2-digit",month:"short"}):"—";$("kpiNextText").textContent=next?`${next.time} · ${next.type}`:"Sin cita próxima";$("kpiDocs").textContent=recordsCache.length;}
function renderChart(){const labels=[],values=[];for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const iso=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;labels.push(d.toLocaleDateString("es-MX",{weekday:"short"}));values.push(currentUser.medicationLogs.filter(l=>l.date===iso&&l.status==="Tomada").length);}if(adherenceChart)adherenceChart.destroy();if(!window.Chart)return;adherenceChart=new Chart($("adherenceChart"),{type:"bar",data:{labels,datasets:[{data:values,backgroundColor:"rgba(177,73,109,.68)",borderColor:"#933657",borderWidth:1,borderRadius:8}]},options:{maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{precision:0},grid:{color:"#f3e8ed"}},x:{grid:{display:false}}}}});}
async function renderAll(){if(!currentUser)return;$("sidebarName").textContent=currentUser.name;$("sidebarEmail").textContent=currentUser.email;$("sidebarAvatar").textContent=(currentUser.name||"U")[0].toUpperCase();$("welcomeName").textContent=currentUser.name.split(" ")[0];await renderRecords();renderMedications();updateKPIs();renderChart();renderChangeSummary();renderProfile();if($("section-consult").classList.contains("active"))renderConsult();if($("section-history").classList.contains("active"))renderHistory();if($("section-share").classList.contains("active"))renderShare();if($("section-emergency").classList.contains("active"))renderEmergency();}
async function launchApp(){$("authScreen").classList.add("hidden");$("sharedView").classList.add("hidden");$("appShell").classList.remove("hidden");const now=new Date();$("weekdayLabel").textContent=now.toLocaleDateString("es-MX",{weekday:"long"});$("dateLabel").textContent=now.toLocaleDateString("es-MX",{day:"2-digit",month:"long",year:"numeric"});await renderAll();showSection("home");}

/* ---------- Session ---------- */
(async()=>{if(new URLSearchParams(location.search).has("share"))return;const email=sessionStorage.getItem(SESSION_KEY);if(email){const u=users().find(x=>x.email===email);if(u){currentUser=ensureUser(u);await launchApp();}}})();