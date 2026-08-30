const KEY='meditrack_mvp';
let data=JSON.parse(localStorage.getItem(KEY)||'null')||{patient:null,medications:[],history:[]};
let chart=null;

function save(){localStorage.setItem(KEY,JSON.stringify(data));render();}
function id(prefix){return prefix+'-'+Date.now()+'-'+Math.floor(Math.random()*10000);}
function esc(v){return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');}

document.getElementById('roleSelect').addEventListener('change',e=>{
  const doctor=e.target.value==='doctor';
  document.getElementById('doctorView').classList.toggle('hidden',!doctor);
  document.getElementById('patientView').classList.toggle('hidden',doctor);
  if(doctor) renderDoctor();
});

document.getElementById('patientForm').addEventListener('submit',e=>{
  e.preventDefault();
  data.patient={
    name:patientName.value.trim(),
    id:patientId.value.trim(),
    birth:patientBirth.value,
    contact:patientContact.value.trim()
  };
  save();
});

document.getElementById('medicationForm').addEventListener('submit',e=>{
  e.preventDefault();
  data.medications.push({
    id:id('MED'),
    name:medName.value.trim(),
    dose:medDose.value.trim(),
    frequency:medFrequency.value,
    time:medTime.value,
    instructions:medInstructions.value.trim(),
    active:true
  });
  e.target.reset();
  save();
});

function logDose(medId,status){
  const med=data.medications.find(x=>x.id===medId);
  if(!med)return;
  const observation=prompt('Observación opcional:')||'';
  data.history.unshift({
    id:id('LOG'),
    medicationId:med.id,
    medicationName:med.name,
    dose:med.dose,
    status,
    observation,
    timestamp:new Date().toISOString()
  });
  save();
}

function finishMedication(medId){
  const med=data.medications.find(x=>x.id===medId);
  if(med){med.active=false;save();}
}

function renderPatient(){
  if(data.patient){
    patientName.value=data.patient.name||'';
    patientId.value=data.patient.id||'';
    patientBirth.value=data.patient.birth||'';
    patientContact.value=data.patient.contact||'';
  }
  const meds=data.medications.filter(x=>x.active);
  medicationsList.innerHTML=meds.length?meds.map(m=>`
    <div class="med">
      <div>
        <strong>${esc(m.name)} · ${esc(m.dose)}</strong>
        <p>${esc(m.frequency)} · ${esc(m.time)}</p>
        <p>${esc(m.instructions||'Sin indicaciones adicionales')}</p>
      </div>
      <div class="actions">
        <button class="taken" onclick="logDose('${m.id}','Tomada')">Tomada</button>
        <button class="missed" onclick="logDose('${m.id}','Omitida')">Omitida</button>
        <button class="secondary" onclick="finishMedication('${m.id}')">Finalizar</button>
      </div>
    </div>`).join(''):'<p>No hay medicamentos activos.</p>';
}

function renderDoctor(){
  doctorPatientInfo.innerHTML=data.patient?`
    <p><strong>Nombre:</strong> ${esc(data.patient.name)}</p>
    <p><strong>ID:</strong> ${esc(data.patient.id)}</p>
    <p><strong>Nacimiento:</strong> ${esc(data.patient.birth||'No registrado')}</p>
    <p><strong>Contacto:</strong> ${esc(data.patient.contact||'No registrado')}</p>`:'<p>No hay paciente registrado.</p>';

  historyBody.innerHTML=data.history.length?data.history.map(x=>`
    <tr>
      <td>${new Date(x.timestamp).toLocaleString('es-MX')}</td>
      <td>${esc(x.medicationName)}</td>
      <td>${esc(x.dose)}</td>
      <td>${esc(x.status)}</td>
      <td>${esc(x.observation||'-')}</td>
    </tr>`).join(''):'<tr><td colspan="5">Sin historial.</td></tr>';

  const taken=data.history.filter(x=>x.status==='Tomada').length;
  const missed=data.history.filter(x=>x.status==='Omitida').length;
  if(chart)chart.destroy();
  if(typeof Chart!=='undefined'){
    chart=new Chart(document.getElementById('adherenceChart'),{
      type:'doughnut',
      data:{labels:['Tomadas','Omitidas'],datasets:[{data:[taken,missed]}]},
      options:{plugins:{legend:{position:'bottom'}}}
    });
  }
}

function renderSummary(){
  const active=data.medications.filter(x=>x.active).length;
  const taken=data.history.filter(x=>x.status==='Tomada').length;
  const total=data.history.length;
  activeCount.textContent=active;
  takenCount.textContent=taken;
  adherenceRate.textContent=(total?Math.round(taken/total*100):0)+'%';
}

csvBtn.addEventListener('click',()=>{
  if(typeof Papa==='undefined')return alert('No se cargó Papa Parse.');
  const csv=Papa.unparse(data.history);
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download='historial_medicamentos.csv';a.click();
  URL.revokeObjectURL(url);
});

excelBtn.addEventListener('click',()=>{
  if(typeof XLSX==='undefined')return alert('No se cargó SheetJS.');
  const ws=XLSX.utils.json_to_sheet(data.history);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Historial');
  XLSX.writeFile(wb,'historial_medicamentos.xlsx');
});

function render(){
  renderPatient();
  renderSummary();
  if(roleSelect.value==='doctor')renderDoctor();
}

render();
