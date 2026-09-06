export const STATUSES = ['nuevo','activo','esperando','requiere revisión','bloqueado','terminado','archivado'];
export const TYPES = ['chat','project','work','task','file','decision','deliverable','other'];

export function uid(prefix='itm') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
}

export function normalizeText(value='') {
  return String(value)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/https?:\/\/\S+/g,' ')
    .replace(/[^a-z0-9áéíóúüñ]+/gi,' ')
    .replace(/\s+/g,' ')
    .trim();
}

export function tokenize(value='') {
  const stop = new Set(['para','por','con','una','uno','unos','unas','del','las','los','que','como','desde','hasta','sobre','este','esta','estos','estas','the','and','for','with','from','into','chatgpt']);
  return [...new Set(normalizeText(value).split(' ').filter(x => x.length > 2 && !stop.has(x)))];
}

export function jaccard(a='', b='') {
  const A = new Set(tokenize(a));
  const B = new Set(tokenize(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

export function suggestRelations(items, threshold=0.34) {
  const suggestions = [];
  for (let i=0;i<items.length;i++) {
    for (let j=i+1;j<items.length;j++) {
      const a=items[i], b=items[j];
      if (a.status==='archivado' && b.status==='archivado') continue;
      const textA = `${a.title||''} ${a.summary||''} ${(a.tags||[]).join(' ')}`;
      const textB = `${b.title||''} ${b.summary||''} ${(b.tags||[]).join(' ')}`;
      const score = jaccard(textA, textB);
      const sameProject = a.projectId && b.projectId && a.projectId === b.projectId;
      const sameUrl = a.url && b.url && a.url === b.url;
      if (sameUrl || score >= threshold || (sameProject && score >= threshold-0.1)) {
        suggestions.push({
          id:`rel_${a.id}_${b.id}`,
          aId:a.id,bId:b.id,
          score: sameUrl ? 1 : Math.round(score*100)/100,
          reason: sameUrl ? 'Mismo enlace de origen' : sameProject ? 'Mismo proyecto y contenido similar' : 'Título/resumen similares',
          kind: sameUrl || score >= 0.7 ? 'posible duplicado' : 'relacionado'
        });
      }
    }
  }
  return suggestions.sort((x,y)=>y.score-x.score);
}

export function dashboardStats(items) {
  const now = Date.now();
  const sevenDays = 7*86400000;
  const activeStatuses = new Set(['nuevo','activo','esperando','requiere revisión','bloqueado']);
  return {
    total: items.length,
    active: items.filter(x=>activeStatuses.has(x.status)).length,
    workReview: items.filter(x=>x.type==='work' && ['esperando','requiere revisión','bloqueado'].includes(x.status)).length,
    blocked: items.filter(x=>x.status==='bloqueado').length,
    unclassified: items.filter(x=>!x.projectId && x.type!=='project').length,
    noNextAction: items.filter(x=>activeStatuses.has(x.status) && !String(x.nextAction||'').trim()).length,
    recent: items.filter(x=>x.updatedAt && now - new Date(x.updatedAt).getTime() <= sevenDays).length,
    dueSoon: items.filter(x=>x.dueDate && activeStatuses.has(x.status) && new Date(x.dueDate).getTime() <= now+sevenDays).length
  };
}

export function parseFlexibleJson(raw) {
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const imported = [];
  const arr = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : Array.isArray(data.conversations) ? data.conversations : null;
  if (!arr) throw new Error('JSON no reconocido: se esperaba un array, items[] o conversations[].');

  for (const row of arr) {
    if (!row || typeof row !== 'object') continue;
    const title = row.title || row.name || row.subject || 'Sin título';
    const created = toIso(row.createdAt || row.create_time || row.created_at || row.created);
    const updated = toIso(row.updatedAt || row.update_time || row.updated_at || row.modified || row.modifiedAt) || created;
    const url = row.url || row.link || row.share_url || '';
    const inferredType = inferType(row, url);
    imported.push({
      id: row.id || row.conversation_id || uid('imp'),
      title,
      type: inferredType,
      area: row.area || row.category || '',
      projectId: row.projectId || row.project_id || '',
      tags: Array.isArray(row.tags) ? row.tags : splitTags(row.tags),
      createdAt: created || new Date().toISOString(),
      updatedAt: updated || new Date().toISOString(),
      status: STATUSES.includes(row.status) ? row.status : 'nuevo',
      priority: Number(row.priority || 3),
      summary: row.summary || row.description || '',
      nextAction: row.nextAction || row.next_action || '',
      dueDate: row.dueDate || row.due_date || '',
      owner: row.owner || row.responsible || '',
      url,
      source: row.source || (row.mapping ? 'chatgpt-export-best-effort' : 'json-import'),
      sourceId: row.conversation_id || row.id || '',
      notes: row.notes || ''
    });
  }
  return imported;
}

export function parseCsv(text) {
  const lines = text.replace(/\r/g,'').split('\n').filter(Boolean);
  if (!lines.length) return [];
  const headers = csvLine(lines.shift()).map(x=>x.trim());
  return lines.map(line => {
    const vals = csvLine(line);
    const row = Object.fromEntries(headers.map((h,i)=>[h,vals[i]??'']));
    return parseFlexibleJson([row])[0];
  });
}

function csvLine(line) {
  const out=[]; let cur=''; let q=false;
  for (let i=0;i<line.length;i++) {
    const c=line[i];
    if (c==='"' && line[i+1]==='"') {cur+='"'; i++; continue;}
    if (c==='"') {q=!q; continue;}
    if (c===',' && !q) {out.push(cur); cur=''; continue;}
    cur+=c;
  }
  out.push(cur); return out;
}

function splitTags(v) {
  if (!v) return [];
  return String(v).split(/[;,]/).map(x=>x.trim()).filter(Boolean);
}

function inferType(row,url='') {
  const explicit = String(row.type || row.kind || '').toLowerCase();
  if (TYPES.includes(explicit)) return explicit;
  if (row.mapping || row.conversation_id || /chatgpt\.com\/(c|share)\//.test(url)) return 'chat';
  if (/project/i.test(explicit)) return 'project';
  return 'other';
}

function toIso(value) {
  if (!value) return '';
  if (typeof value === 'number') {
    const ms = value < 1e12 ? value*1000 : value;
    const d = new Date(ms); return isNaN(d) ? '' : d.toISOString();
  }
  const d = new Date(value); return isNaN(d) ? '' : d.toISOString();
}
