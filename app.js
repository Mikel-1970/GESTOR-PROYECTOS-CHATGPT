import {STATUSES,TYPES,uid,suggestRelations,dashboardStats,parseFlexibleJson,parseCsv} from './core.mjs';

const KEY='gpt-activity-manager-v1';
const state={items:[],view:'dashboard',query:'',filters:{type:'',status:'',projectId:''}};
const $=s=>document.querySelector(s);

const views=[['dashboard','Dashboard'],['all','Todos'],['projects','Proyectos'],['chats','Chats'],['work','Work'],['actions','Pendientes'],['archived','Archivados'],['relations','Relaciones']];

function demoData(){
  const now=Date.now(), d=n=>new Date(now-n*86400000).toISOString();
  const p1=uid('prj'), p2=uid('prj');
  return [
    {id:p1,title:'Plataforma de pedidos',type:'project',area:'IA / producto',projectId:'',tags:['MVP','web'],createdAt:d(18),updatedAt:d(0),status:'activo',priority:1,summary:'Definir y validar una plataforma de pedidos para pequeño comercio.',nextAction:'Validar flujo del MVP',dueDate:'',owner:'',url:'',source:'demo',sourceId:'',notes:''},
    {id:p2,title:'Agenda IA',type:'project',area:'IA / automatización',projectId:'',tags:['agente'],createdAt:d(12),updatedAt:d(2),status:'activo',priority:2,summary:'Comparativa de dos motores de agente sobre una app común.',nextAction:'Cerrar métricas de evaluación',dueDate:'',owner:'',url:'',source:'demo',sourceId:'',notes:''},
    {id:uid(),title:'Definición del MVP de pedidos',type:'chat',area:'IA / producto',projectId:p1,tags:['MVP'],createdAt:d(10),updatedAt:d(0),status:'requiere revisión',priority:1,summary:'Alcance funcional y roles del MVP.',nextAction:'Revisar criterios de aceptación',dueDate:'',owner:'',url:'https://chatgpt.com/',source:'demo',sourceId:'',notes:''},
    {id:uid(),title:'Integración de avisos automáticos',type:'work',area:'IA / automatización',projectId:p2,tags:['notificaciones'],createdAt:d(5),updatedAt:d(1),status:'esperando',priority:2,summary:'Trabajo de integración y validación de notificaciones.',nextAction:'Probar ejecución real',dueDate:'',owner:'',url:'https://chatgpt.com/',source:'demo',sourceId:'',notes:''},
    {id:uid(),title:'Comparar motores de agente',type:'chat',area:'IA / automatización',projectId:p2,tags:['agente','evaluación'],createdAt:d(4),updatedAt:d(2),status:'activo',priority:2,summary:'Diseño de pruebas equivalentes entre proveedores.',nextAction:'Preparar dataset de pruebas',dueDate:'',owner:'',url:'https://chatgpt.com/',source:'demo',sourceId:'',notes:''},
    {id:uid(),title:'Idea sin clasificar',type:'chat',area:'',projectId:'',tags:[],createdAt:d(21),updatedAt:d(21),status:'nuevo',priority:3,summary:'',nextAction:'',dueDate:'',owner:'',url:'',source:'demo',sourceId:'',notes:''}
  ];
}

function load(){
  try{const saved=JSON.parse(localStorage.getItem(KEY));state.items=Array.isArray(saved)?saved:demoData()}catch{state.items=demoData()}
}
function save(){localStorage.setItem(KEY,JSON.stringify(state.items))}
function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function slug(v=''){return v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'-')}
function fmtDate(v){if(!v)return '—';const d=new Date(v);return isNaN(d)?'—':d.toLocaleDateString('es-ES',{day:'2-digit',month:'short'})}
function projects(){return state.items.filter(x=>x.type==='project')}
function projectName(id){return projects().find(x=>x.id===id)?.title||'Sin proyecto'}
function openUrl(url){if(url) window.open(url,'_blank','noopener,noreferrer')}

function renderNav(){
  $('#nav').innerHTML=views.map(([id,label])=>`<button class="navbtn ${state.view===id?'active':''}" data-view="${id}">${label}</button>`).join('');
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{state.view=b.dataset.view;render()});
}

function filtered(){
  let arr=[...state.items];
  if(state.view==='projects')arr=arr.filter(x=>x.type==='project');
  if(state.view==='chats')arr=arr.filter(x=>x.type==='chat');
  if(state.view==='work')arr=arr.filter(x=>x.type==='work');
  if(state.view==='actions')arr=arr.filter(x=>!['terminado','archivado'].includes(x.status));
  if(state.view==='archived')arr=arr.filter(x=>x.status==='archivado');
  if(state.view==='all')arr=arr.filter(x=>x.status!=='archivado');
  if(state.query){const q=state.query.toLowerCase();arr=arr.filter(x=>`${x.title} ${x.summary} ${x.nextAction} ${(x.tags||[]).join(' ')} ${x.area}`.toLowerCase().includes(q))}
  if(state.filters.type)arr=arr.filter(x=>x.type===state.filters.type);
  if(state.filters.status)arr=arr.filter(x=>x.status===state.filters.status);
  if(state.filters.projectId)arr=arr.filter(x=>x.projectId===state.filters.projectId);
  return arr.sort((a,b)=>(a.priority||3)-(b.priority||3)||new Date(b.updatedAt)-new Date(a.updatedAt));
}

function render(){renderNav();
  const titles={dashboard:'Dashboard',all:'Todos los elementos',projects:'Proyectos',chats:'Chats',work:'Work',actions:'Pendientes / siguientes acciones',archived:'Archivados',relations:'Relaciones sugeridas'};
  $('#viewTitle').textContent=titles[state.view];
  if(state.view==='dashboard')renderDashboard();else if(state.view==='projects')renderProjects();else if(state.view==='relations')renderRelations();else renderList();
}

function renderDashboard(){
  const s=dashboardStats(state.items);const active=state.items.filter(x=>['nuevo','activo','esperando','requiere revisión','bloqueado'].includes(x.status)).sort((a,b)=>(a.priority||3)-(b.priority||3)).slice(0,7);
  const rel=suggestRelations(state.items).slice(0,4);
  const projectLoad=projects().map(p=>({p,count:state.items.filter(x=>x.projectId===p.id&&!['terminado','archivado'].includes(x.status)).length})).sort((a,b)=>b.count-a.count).slice(0,5);
  $('#content').innerHTML=`
    <div class="stats">
      ${stat('Activos',s.active)}${stat('Proyectos activos',projects().filter(x=>!['terminado','archivado'].includes(x.status)).length)}${stat('Work a revisar',s.workReview)}${stat('Bloqueados',s.blocked)}${stat('Sin clasificar',s.unclassified)}${stat('Sin siguiente acción',s.noNextAction)}${stat('Vencen ≤7d',s.dueSoon)}${stat('Actividad ≤7d',s.recent)}
    </div>
    <div class="grid2">
      <div class="panel"><div class="panel-head"><h2>Siguientes acciones prioritarias</h2><button class="secondary" data-go="actions">Ver todo</button></div><div class="list">${active.length?active.map(rowHtml).join(''):'<div class="empty">No hay elementos activos.</div>'}</div></div>
      <div class="panel"><div class="panel-head"><h2>Carga por proyecto</h2></div><div class="list">${projectLoad.length?projectLoad.map(({p,count})=>`<div class="relation"><strong>${esc(p.title)}</strong><small>${count} elementos activos</small></div>`).join(''):'<div class="empty">Sin proyectos.</div>'}</div></div>
    </div>
    <div class="grid2">
      <div class="panel"><div class="panel-head"><h2>Relaciones / duplicidades</h2><button class="secondary" data-go="relations">Revisar</button></div>${rel.length?rel.map(relHtml).join(''):'<div class="empty">No se detectan relaciones fuertes.</div>'}</div>
      <div class="panel"><div class="panel-head"><h2>Actividad reciente</h2></div><div class="list">${state.items.slice().sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt)).slice(0,5).map(rowCompact).join('')}</div></div>
    </div>`;
  document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{state.view=b.dataset.go;render()});bindRows();
}
function stat(label,n){return `<div class="stat"><div class="num">${n}</div><div class="lbl">${label}</div></div>`}
function rowHtml(x){return `<div class="row" data-id="${x.id}"><div><div class="title">${esc(x.title)}</div><div class="sub">${esc(x.nextAction||x.summary||projectName(x.projectId))}</div></div><div class="type">${esc(x.type)}</div><div class="hide-sm"><span class="pill ${slug(x.status)}">${esc(x.status)}</span></div><div class="hide-md priority p${x.priority||3}">P${x.priority||3}</div><button class="iconbtn" data-open="${x.id}">›</button></div>`}
function rowCompact(x){return `<div class="relation" data-id="${x.id}"><strong>${esc(x.title)}</strong><small>${fmtDate(x.updatedAt)} · ${esc(x.type)} · ${esc(x.status)}</small></div>`}

function renderList(){
  const arr=filtered();
  $('#content').innerHTML=`${filtersHtml()}<div class="panel"><div class="list">${arr.length?arr.map(rowHtml).join(''):'<div class="empty">No hay resultados.</div>'}</div></div>`;bindFilters();bindRows();
}
function filtersHtml(){return `<div class="filters"><select id="fType"><option value="">Todos los tipos</option>${TYPES.map(x=>`<option ${state.filters.type===x?'selected':''}>${x}</option>`).join('')}</select><select id="fStatus"><option value="">Todos los estados</option>${STATUSES.map(x=>`<option ${state.filters.status===x?'selected':''}>${x}</option>`).join('')}</select><select id="fProject"><option value="">Todos los proyectos</option>${projects().map(x=>`<option value="${x.id}" ${state.filters.projectId===x.id?'selected':''}>${esc(x.title)}</option>`).join('')}</select></div>`}
function bindFilters(){['Type','Status','Project'].forEach(k=>{$(`#f${k}`).onchange=e=>{state.filters[k==='Type'?'type':k==='Status'?'status':'projectId']=e.target.value;render()}})}
function bindRows(){document.querySelectorAll('[data-open]').forEach(b=>b.onclick=e=>{e.stopPropagation();editItem(b.dataset.open)});document.querySelectorAll('.row[data-id],.relation[data-id]').forEach(r=>r.onclick=()=>editItem(r.dataset.id))}

function renderProjects(){
  const arr=filtered();
  $('#content').innerHTML=`<div class="cards">${arr.length?arr.map(p=>{const children=state.items.filter(x=>x.projectId===p.id);const done=children.filter(x=>['terminado','archivado'].includes(x.status)).length;const pct=children.length?Math.round(done/children.length*100):0;return `<div class="project-card" data-id="${p.id}"><span class="pill ${slug(p.status)}">${esc(p.status)}</span><h3>${esc(p.title)}</h3><div class="sub">${esc(p.summary||'Sin descripción')}</div><div class="progress"><span style="width:${pct}%"></span></div><div class="sub">${children.length} elementos · ${done} cerrados · P${p.priority||3}</div></div>`}).join(''):'<div class="empty">No hay proyectos.</div>'}</div>`;
  document.querySelectorAll('.project-card').forEach(c=>c.onclick=()=>showProject(c.dataset.id));
}
function showProject(id){const p=state.items.find(x=>x.id===id);if(!p)return;const children=state.items.filter(x=>x.projectId===id);const files=children.filter(x=>x.type==='file'||x.type==='deliverable');const decisions=children.filter(x=>x.type==='decision');const pending=children.filter(x=>!['terminado','archivado'].includes(x.status));const timeline=children.slice().sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt)).slice(0,8);showModal(`<h2>${esc(p.title)}</h2><p>${esc(p.summary||'Sin descripción')}</p><div class="hint"><strong>Siguiente acción:</strong> ${esc(p.nextAction||'No definida')}</div><div class="stats" style="margin-top:12px">${stat('Pendientes',pending.length)}${stat('Archivos/entregables',files.length)}${stat('Decisiones',decisions.length)}${stat('Total vinculados',children.length)}</div><h3>Elementos vinculados</h3><div class="panel">${children.length?children.map(rowCompact).join(''):'<div class="empty">Aún no hay elementos vinculados.</div>'}</div><h3>Cronología reciente</h3><div class="panel">${timeline.length?timeline.map(rowCompact).join(''):'<div class="empty">Sin actividad registrada.</div>'}</div><div class="actions"><button class="secondary" id="editProject">Editar proyecto</button>${p.url?'<button class="primary" id="openOriginal">Abrir original</button>':''}</div>`);$('#editProject').onclick=()=>editItem(id);if(p.url)$('#openOriginal').onclick=()=>openUrl(p.url);bindRows()}

function renderRelations(){const rel=suggestRelations(state.items);$('#content').innerHTML=`<div class="panel">${rel.length?rel.map(relHtml).join(''):'<div class="empty">No se detectan coincidencias por encima del umbral actual.</div>'}</div>`;document.querySelectorAll('[data-rel]').forEach(b=>b.onclick=()=>{const [a,bid]=b.dataset.rel.split('|');showRelation(a,bid)})}
function relHtml(r){const a=state.items.find(x=>x.id===r.aId),b=state.items.find(x=>x.id===r.bId);if(!a||!b)return'';return `<div class="relation"><strong>${esc(a.title)} ↔ ${esc(b.title)}</strong><small>${esc(r.kind)} · similitud ${(r.score*100).toFixed(0)}% · ${esc(r.reason)}</small><div><button class="secondary" data-rel="${a.id}|${b.id}">Revisar</button></div></div>`}
function showRelation(aId,bId){const a=state.items.find(x=>x.id===aId),b=state.items.find(x=>x.id===bId);showModal(`<h2>Revisar relación</h2><div class="grid2"><div class="panel" style="padding:12px"><strong>${esc(a.title)}</strong><p>${esc(a.summary||'')}</p><small>${esc(projectName(a.projectId))}</small></div><div class="panel" style="padding:12px"><strong>${esc(b.title)}</strong><p>${esc(b.summary||'')}</p><small>${esc(projectName(b.projectId))}</small></div></div><p class="hint">El MVP solo propone relaciones. No fusiona, archiva ni modifica elementos automáticamente.</p>`)}

function itemForm(item={}){const isNew=!item.id;return `<h2>${isNew?'Nuevo elemento':'Editar elemento'}</h2><form id="itemForm" class="formgrid"><input type="hidden" name="id" value="${esc(item.id||'')}"><div class="field full"><label>Título</label><input name="title" required value="${esc(item.title||'')}"></div><div class="field"><label>Tipo</label><select name="type">${TYPES.map(x=>`<option ${item.type===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Estado</label><select name="status">${STATUSES.map(x=>`<option ${item.status===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Proyecto principal</label><select name="projectId"><option value="">Sin proyecto</option>${projects().filter(p=>p.id!==item.id).map(p=>`<option value="${p.id}" ${item.projectId===p.id?'selected':''}>${esc(p.title)}</option>`).join('')}</select></div><div class="field"><label>Prioridad</label><select name="priority">${[1,2,3,4,5].map(n=>`<option value="${n}" ${Number(item.priority||3)===n?'selected':''}>P${n}</option>`).join('')}</select></div><div class="field"><label>Área / categoría</label><input name="area" value="${esc(item.area||'')}"></div><div class="field"><label>Etiquetas (coma)</label><input name="tags" value="${esc((item.tags||[]).join(', '))}"></div><div class="field full"><label>Resumen</label><textarea name="summary">${esc(item.summary||'')}</textarea></div><div class="field full"><label>Siguiente acción</label><input name="nextAction" value="${esc(item.nextAction||'')}"></div><div class="field"><label>Fecha límite</label><input name="dueDate" type="date" value="${esc(item.dueDate||'')}"></div><div class="field"><label>Responsable</label><input name="owner" value="${esc(item.owner||'')}"></div><div class="field full"><label>Enlace original</label><input name="url" type="url" placeholder="https://chatgpt.com/..." value="${esc(item.url||'')}"></div><div class="actions field full">${!isNew&&item.url?'<button type="button" class="secondary" id="openItemBtn">Abrir original</button>':''}${!isNew?'<button type="button" class="secondary" id="duplicateBtn">Duplicar</button>':''}${!isNew&&item.status!=='archivado'?'<button type="button" class="secondary" id="archiveBtn">Archivar</button>':''}<button type="submit" class="primary">Guardar</button></div></form>`}
function addItem(){showModal(itemForm({type:'chat',status:'nuevo',priority:3,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}));bindForm()}
function editItem(id){const x=state.items.find(i=>i.id===id);if(!x)return;showModal(itemForm(x));bindForm(x)}
function bindForm(original){const form=$('#itemForm');if(original?.url){const o=$('#openItemBtn');if(o)o.onclick=()=>openUrl(original.url)}form.onsubmit=e=>{e.preventDefault();const fd=new FormData(form);const obj=Object.fromEntries(fd.entries());obj.priority=Number(obj.priority);obj.tags=obj.tags.split(',').map(x=>x.trim()).filter(Boolean);obj.updatedAt=new Date().toISOString();obj.createdAt=original?.createdAt||new Date().toISOString();obj.id=obj.id||uid(obj.type==='project'?'prj':'itm');obj.source=original?.source||'manual';obj.sourceId=original?.sourceId||'';obj.notes=original?.notes||'';const idx=state.items.findIndex(x=>x.id===obj.id);if(idx>=0)state.items[idx]=obj;else state.items.push(obj);save();hideModal();render()};if(original){const a=$('#archiveBtn');if(a)a.onclick=()=>{original.status='archivado';original.updatedAt=new Date().toISOString();save();hideModal();render()};const d=$('#duplicateBtn');if(d)d.onclick=()=>{const copy={...original,id:uid('itm'),title:`${original.title} (copia)`,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),source:'manual-copy'};state.items.push(copy);save();hideModal();render()}}}

function showModal(html){$('#modalBody').innerHTML=html;$('#modal').classList.remove('hidden')}
function hideModal(){$('#modal').classList.add('hidden')}

function importDialog(){showModal(`<h2>Importar elementos</h2><p>Admite JSON o CSV. Para una exportación de ChatGPT, extrae el ZIP y selecciona el JSON de conversaciones. La estructura del export de ChatGPT no está documentada como API estable, por lo que el parser es deliberadamente tolerante y de mejor esfuerzo.</p><div class="hint">También puedes importar un JSON propio con campos como title, type, status, projectId, summary, nextAction, url, createdAt y updatedAt.</div><div class="actions"><button class="primary" id="pickFile">Seleccionar archivo</button></div>`);$('#pickFile').onclick=()=>$('#fileInput').click()}
async function handleFile(file){try{const text=await file.text();const imported=file.name.toLowerCase().endsWith('.csv')?parseCsv(text):parseFlexibleJson(text);const existing=new Set(state.items.map(x=>x.id));let added=0,updated=0;for(const x of imported){if(existing.has(x.id)){const i=state.items.findIndex(y=>y.id===x.id);state.items[i]={...state.items[i],...x};updated++}else{state.items.push(x);existing.add(x.id);added++}}save();hideModal();render();alert(`Importación completada: ${added} nuevos, ${updated} actualizados.`)}catch(err){alert(`No se pudo importar: ${err.message}`)}}
function exportData(){const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),items:state.items},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`gpt-activity-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href)}

$('#addBtn').onclick=addItem;$('#importBtn').onclick=importDialog;$('#closeModal').onclick=hideModal;$('#modal').onclick=e=>{if(e.target.id==='modal')hideModal()};$('#fileInput').onchange=e=>{const f=e.target.files?.[0];if(f)handleFile(f);e.target.value=''};$('#exportBtn').onclick=exportData;$('#resetBtn').onclick=()=>{if(confirm('¿Vaciar todos los datos locales del MVP?')){localStorage.removeItem(KEY);state.items=[];render()}};$('#searchInput').oninput=e=>{state.query=e.target.value; if(state.view==='dashboard')state.view='all'; render()};

if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
load();render();
