// ══════════════════════════════════════════════════════════════
// CANVAS IMPORT — CSV + BOOKMARKLET
// ══════════════════════════════════════════════════════════════

let ciCsvRows = [];    // parsed CSV preview rows
let ciBmRows  = [];    // bookmarklet-received rows

// ── BOOKMARKLET CODE ─────────────────────────────────────────
// This is the actual JS that gets encoded into the bookmarklet href.
// It runs on the Canvas page, extracts grades from the DOM / API,
// and posts them back to the Gradintel origin via postMessage.
function ciGetBookmarkletCode() {
  // Bake the Supabase URL + anon key directly into the bookmarklet at generation time.
  // The anon key is safe to expose — it's a public key with RLS protecting data.
  const sbUrl  = SUPABASE_URL;
  const sbAnon = SUPABASE_ANON;
  const userId = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.id : 'anonymous';

  const fn = `(function(){
  var SBURL  = ${JSON.stringify(sbUrl)};
  var SBANON = ${JSON.stringify(sbAnon)};
  var UID    = ${JSON.stringify(userId)};

  function send(data) {
    // PRIMARY: POST directly to Supabase REST API — works from ANY domain, no CORS issues
    fetch(SBURL + '/rest/v1/canvas_sync', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        SBANON,
        'Authorization': 'Bearer ' + SBANON,
        'Prefer':        'return=minimal'
      },
      body: JSON.stringify({ user_id: UID, payload: data, created_at: new Date().toISOString() })
    }).catch(function(){});

    // FALLBACK: BroadcastChannel (works if same browser, same origin)
    try {
      var bc = new BroadcastChannel('gradintel_canvas');
      bc.postMessage({type:'GRADINTEL_CANVAS',data:data});
      bc.close();
    } catch(e){}

    // FALLBACK: postMessage to opener
    try { window.opener && window.opener.postMessage({type:'GRADINTEL_CANVAS',data:data},'*'); } catch(e){}
  }
  function toast(msg) {
    var d=document.createElement('div');
    d.style.cssText='position:fixed;bottom:24px;right:24px;background:#818cf8;color:#fff;padding:12px 20px;border-radius:12px;font-family:sans-serif;font-size:14px;font-weight:700;z-index:999999;box-shadow:0 4px 20px rgba(0,0,0,.4)';
    d.textContent=msg; document.body.appendChild(d); setTimeout(()=>d.remove(),3500);
  }
  toast('📊 Gradintel: reading grades…');

  // --- Attempt 1: Canvas Grades API (works on grades pages) ---
  var m = location.href.match(/courses\\/([0-9]+)/);
  var courseId = m ? m[1] : null;
  var canvasBase = location.origin;

  function extractFromDOM() {
    // Parse the grades table in the DOM
    var rows = [];
    document.querySelectorAll('#grades_summary tr.student_assignment').forEach(function(tr){
      var name = tr.querySelector('.title a,.title') ? (tr.querySelector('.title a')||tr.querySelector('.title')).textContent.trim() : null;
      var score = tr.querySelector('.score_value') ? tr.querySelector('.score_value').textContent.trim() : null;
      var possible = tr.querySelector('.points_possible') ? tr.querySelector('.points_possible').textContent.trim() : null;
      var pct = null;
      if (score && possible && parseFloat(possible) > 0) pct = (parseFloat(score)/parseFloat(possible)*100).toFixed(1);
      if (score === null || score === '--') score = null;
      if (name) rows.push({name:name, score:score, possible:possible, pct:pct});
    });
    return rows;
  }

  // Try to get course name from page
  var courseNameEl = document.querySelector('h1.course-title,.context_module_sub_header,.course-name,title');
  var courseName = courseNameEl ? courseNameEl.textContent.trim().replace(' Grades','') : (document.title||'Canvas Course');

  if (courseId) {
    fetch(canvasBase+'/api/v1/courses/'+courseId+'/assignment_groups?include[]=assignments&include[]=submission&per_page=100', {credentials:'include'})
      .then(r=>r.json()).then(function(groups){
        var rows = [];
        groups.forEach(function(g){
          var gw = g.group_weight||0;
          var scored=0,possible=0,hasScore=false;
          (g.assignments||[]).forEach(function(a){
            var sub=a.submission||{};
            if(sub.score!=null&&a.points_possible>0){
              scored+=sub.score; possible+=a.points_possible; hasScore=true;
            }
          });
          var pct=hasScore&&possible>0?(scored/possible*100):null;
          rows.push({
            name: g.name,
            group: g.name,
            weight: gw,
            score: hasScore?scored:null,
            possible: hasScore?possible:null,
            pct: pct!=null?parseFloat(pct.toFixed(2)):null,
            isGroupSummary: true
          });
        });
        send({source:'api', courseName:courseName, courseId:courseId, rows:rows});
        toast('✅ Gradintel: '+rows.length+' groups found! Switch back to Gradintel.');
      }).catch(function(){
        var domRows = extractFromDOM();
        if (domRows.length) { send({source:'dom', courseName:courseName, courseId:courseId, rows:domRows}); toast('✅ Gradintel: '+domRows.length+' grades found!'); }
        else toast('⚠️ Gradintel: no grades found on this page. Go to a course Grades page first.');
      });
  } else {
    var domRows = extractFromDOM();
    if (domRows.length) { send({source:'dom', courseName:courseName, courseId:null, rows:domRows}); toast('✅ Gradintel: '+domRows.length+' grades found! Switch back.'); }
    else toast('⚠️ Gradintel: navigate to a Canvas Grades page first, then click again.');
  }
})();`;
  return 'javascript:' + encodeURIComponent(fn);
}

// ── ALL-COURSES BOOKMARKLET ───────────────────────────────────
function ciGetAllCoursesBookmarkletCode() {
  const sbUrl  = SUPABASE_URL;
  const sbAnon = SUPABASE_ANON;
  const userId = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.id : 'anonymous';
  const fn = `(function(){
  var SBURL=${JSON.stringify(sbUrl)};var SBANON=${JSON.stringify(sbAnon)};var UID=${JSON.stringify(userId)};
  function send(data){
    fetch(SBURL+'/rest/v1/canvas_sync',{method:'POST',headers:{'Content-Type':'application/json','apikey':SBANON,'Authorization':'Bearer '+SBANON,'Prefer':'return=minimal'},body:JSON.stringify({user_id:UID,payload:data,created_at:new Date().toISOString()})}).catch(function(){});
    try{var bc=new BroadcastChannel('gradintel_canvas');bc.postMessage({type:'GRADINTEL_ALL_COURSES',data:data});bc.close();}catch(e){}
    try{window.opener&&window.opener.postMessage({type:'GRADINTEL_ALL_COURSES',data:data},'*');}catch(e){}
  }
  function toast(msg,dur){var d=document.createElement('div');d.style.cssText='position:fixed;bottom:24px;right:24px;background:#818cf8;color:#fff;padding:12px 20px;border-radius:12px;font-family:sans-serif;font-size:14px;font-weight:700;z-index:999999;box-shadow:0 4px 20px rgba(0,0,0,.4);max-width:320px';d.textContent=msg;document.body.appendChild(d);setTimeout(function(){d.remove();},dur||4000);}
  var canvasBase=location.origin;
  toast('Gradintel: fetching all courses...');
  fetch(canvasBase+'/api/v1/courses?enrollment_state=active&per_page=100',{credentials:'include',headers:{'Accept':'application/json','X-Requested-With':'XMLHttpRequest'}})
  .then(function(r){return r.json();})
  .then(function(courses){
    if(!courses||!Array.isArray(courses)||!courses.length){toast('No active courses found. Make sure you are logged into Canvas.');return;}
    var active=courses.filter(function(c){return c.id&&c.name&&!c.access_restricted_by_date;});
    toast('Found '+active.length+' courses - loading grades...',10000);
    var allRows=[],done=0,total=active.length;
    if(!total){toast('No accessible courses found.');return;}
    active.forEach(function(course){
      fetch(canvasBase+'/api/v1/courses/'+course.id+'/assignment_groups?include[]=assignments&include[]=submission&per_page=100',{credentials:'include',headers:{'Accept':'application/json','X-Requested-With':'XMLHttpRequest'}})
      .then(function(r){return r.json();})
      .then(function(groups){
        if(!Array.isArray(groups))return;
        groups.forEach(function(g){
          var gw=g.group_weight||0;
          // Send one summary row per group (not per assignment)
          // scored/possible = sum across all graded assignments in group
          var scored=0,possible=0,hasScore=false;
          (g.assignments||[]).forEach(function(a){
            var sub=a.submission||{};
            if(sub.score!=null&&a.points_possible>0){
              scored+=sub.score;
              possible+=a.points_possible;
              hasScore=true;
            }
          });
          var pct=hasScore&&possible>0?(scored/possible*100):null;
          allRows.push({
            courseName:course.name,
            courseId:course.id,
            name:g.name,           // group name, not assignment name
            group:g.name,
            weight:gw,
            score:hasScore?scored:null,
            possible:hasScore?possible:null,
            pct:pct!=null?parseFloat(pct.toFixed(2)):null,
            isGroupSummary:true
          });
        });
      })
      .catch(function(){})
      .finally(function(){
        done++;
        if(done===total){
          if(!allRows.length){toast('No assignment data found across your courses.');return;}
          var scored=allRows.filter(function(r){return r.pct!==null;});
          send({type:'GRADINTEL_ALL_COURSES',rows:allRows,totalCourses:total});
          toast('Synced '+scored.length+' graded assignments from '+total+' courses! Switch back to Gradintel.',5000);
        }
      });
    });
  })
  .catch(function(err){toast('Error: '+err.message);});
})();`;
  return 'javascript:' + encodeURIComponent(fn);
}

function ciCopyAllBm() {
  const code = ciGetAllCoursesBookmarkletCode();
  navigator.clipboard.writeText(code)
    .then(function(){ showToast('📋 "Sync All Courses" bookmarklet copied! Create a bookmark and paste it as the URL.'); })
    .catch(function(){ prompt('Copy this bookmarklet URL:', code); });
}

async function ciReceiveAllCoursesData(data) {
  if (!data || !data.rows) return;
  const rows = data.rows.filter(function(r){ return r.name && r.courseName; });
  if (!rows.length) { showToast('⚠️ No grade data received.'); return; }
  ciBmRows = rows.map(function(r){
    return {
      courseName: r.courseName,
      name: r.name,
      group: r.group || null,
      weight: r.weight || null,
      score: (r.score !== null && r.score !== undefined) ? parseFloat(r.score) : null,
      possible: (r.possible !== null && r.possible !== undefined) ? parseFloat(r.possible) : null,
      pct: (r.pct !== null && r.pct !== undefined) ? parseFloat(r.pct) : null,
      source: 'bookmarklet-all'
    };
  });
  const totalCourses = data.totalCourses || '?';
  const scored = ciBmRows.filter(function(r){ return r.pct !== null; }).length;
  showToast('📡 All-courses sync received — ' + scored + ' graded assignments from ' + totalCourses + ' courses. Syncing now…');
  // ciAutoImport handles multi-course rows by grouping on courseName
  await ciAutoImport(ciBmRows, null);
}

// ── INIT ─────────────────────────────────────────────────────
function ciInitTab() {
  // Set bookmarklet hrefs
  const link = document.getElementById('ci-bm-link');
  if (link) link.href = ciGetBookmarkletCode();
  const allLink = document.getElementById('ci-bm-all-link');
  if (allLink) allLink.href = ciGetAllCoursesBookmarkletCode();
  // Restore last used method
  const savedMethod = localStorage.getItem('gradintel_canvas_method') || 'csv';
  ciSwitchMethod(savedMethod);
  // Populate semester dropdowns
  ciPopulateSemSelects();
  // Start listening for bookmarklet postMessages / BroadcastChannel
  ciStartListener();
}

function ciPopulateSemSelects() {
  ['ci-sem-select', 'ci-bm-sem-select'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    // Keep the first "new" option, rebuild the rest
    while (sel.options.length > 1) sel.remove(1);
    (semesters || []).forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name || s.id;
      sel.appendChild(opt);
    });
  });
  // Show/hide new-name inputs
  ['ci-sem-select','ci-bm-sem-select'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const wrap = document.getElementById(id === 'ci-sem-select' ? 'ci-sem-name-wrap' : 'ci-bm-sem-name-wrap');
    sel.onchange = () => { if(wrap) wrap.style.display = sel.value === '__new__' ? '' : 'none'; };
    if (wrap) wrap.style.display = sel.value === '__new__' ? '' : 'none';
  });
}

// ── METHOD TOGGLE ─────────────────────────────────────────────
function ciSwitchMethod(m) {
  document.getElementById('ci-m-csv').classList.toggle('active', m === 'csv');
  document.getElementById('ci-m-bm').classList.toggle('active', m === 'bm');
  document.getElementById('ci-csv-panel').style.display = m === 'csv' ? '' : 'none';
  document.getElementById('ci-bm-panel').style.display  = m === 'bm'  ? '' : 'none';
  localStorage.setItem('gradintel_canvas_method', m);
}

// ── COPY BOOKMARKLET ──────────────────────────────────────────
function ciCopyBm() {
  const code = ciGetBookmarkletCode();
  navigator.clipboard.writeText(code)
    .then(() => showToast('📋 Bookmarklet code copied! Create a new bookmark and paste as the URL.'))
    .catch(() => {
      prompt('Copy this bookmarklet URL and save as a new bookmark:', code);
    });
}

// ── SUPABASE REALTIME LISTENER ────────────────────────────────
let ciBcListening = false;
let _ciRealtimeChannel = null;
function ciStartListener() {
  if (ciBcListening) return;
  ciBcListening = true;

  // 1) Supabase Realtime — listens for INSERT on canvas_sync table for this user.
  //    Fires the instant the bookmarklet POSTs from ANY domain. This is the primary path.
  if (sb && typeof currentUser !== 'undefined' && currentUser) {
    try {
      if (_ciRealtimeChannel) sb.removeChannel(_ciRealtimeChannel);
      _ciRealtimeChannel = sb
        .channel('canvas-sync-' + currentUser.id)
        .on('postgres_changes', {
          event:  'INSERT',
          schema: 'public',
          table:  'canvas_sync',
          filter: 'user_id=eq.' + currentUser.id
        }, function(payload) {
          if (payload.new && payload.new.payload) {
            const p = payload.new.payload;
            if (p.type === 'GRADINTEL_ALL_COURSES') ciReceiveAllCoursesData(p);
            else ciReceiveBmData(p);
            // Clean up the row immediately after receiving
            sb.from('canvas_sync').delete().eq('id', payload.new.id).then(function(){});
          }
        })
        .subscribe();
    } catch(e) { console.warn('Supabase realtime failed:', e); }
  }

  // 2) BroadcastChannel fallback (same-origin tabs)
  try {
    const bc = new BroadcastChannel('gradintel_canvas');
    bc.onmessage = e => {
      if (e.data && e.data.type === 'GRADINTEL_CANVAS') ciReceiveBmData(e.data.data);
      if (e.data && e.data.type === 'GRADINTEL_ALL_COURSES') ciReceiveAllCoursesData(e.data.data);
    };
  } catch(e) {}

  // 3) postMessage fallback
  window.addEventListener('message', e => {
    if (e.data && e.data.type === 'GRADINTEL_CANVAS') ciReceiveBmData(e.data.data);
    if (e.data && e.data.type === 'GRADINTEL_ALL_COURSES') ciReceiveAllCoursesData(e.data.data);
  });
}

// ── CSV DROP ZONE ─────────────────────────────────────────────
function ciHandleDrop(ev) {
  ev.preventDefault();
  document.getElementById('ci-dropzone').classList.remove('drag');
  ciHandleFiles(ev.dataTransfer.files);
}

async function ciHandleFiles(files) {
  if (!files || !files.length) return;
  const statusEl = document.getElementById('ci-parse-status');
  statusEl.style.display = '';
  statusEl.innerHTML = `<div class="infobox">⏳ Parsing ${files.length} file(s)…</div>`;

  ciCsvRows = [];
  const errors = [];

  for (const file of files) {
    try {
      const text = await file.text();
      const parsed = ciParseCanvasCsv(text, file.name);
      ciCsvRows.push(...parsed);
    } catch(e) {
      errors.push(file.name + ': ' + e.message);
    }
  }

  if (errors.length) {
    statusEl.innerHTML = `<div class="infobox yellow">⚠️ ${errors.join('<br>')}</div>`;
  }
  if (!ciCsvRows.length) {
    statusEl.innerHTML = `<div class="infobox yellow">⚠️ No grade data found in the uploaded file(s). Make sure you're uploading a Canvas Grades CSV export.</div>`;
    return;
  }
  statusEl.style.display = 'none';
  ciShowPreview(ciCsvRows, 'csv');
}

// ── CSV PARSER ────────────────────────────────────────────────
// Canvas CSV format: rows of student assignments with columns like
// "Student","ID","SIS User ID","SIS Login ID","Section","Assignment Name","Assignment ID","Submission Type","Score","Possible",...
// OR the simpler "Grades" export: student row with all assignments as columns.
// We handle both formats.
function ciParseCanvasCsv(text, filename) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error('File appears empty');

  const headers = ciCsvSplit(lines[0]).map(h => h.trim().toLowerCase().replace(/[^a-z0-9 _]/g,''));

  // Detect format
  // Format A: individual assignment rows — has "title" or "name" and "score" columns
  const titleIdx   = headers.findIndex(h => h === 'title' || h === 'assignment name' || h === 'name');
  const scoreIdx   = headers.findIndex(h => h === 'score' || h === 'final score' || h === 'current score');
  const possIdx    = headers.findIndex(h => h === 'possible' || h === 'points possible' || h === 'max score');
  const groupIdx   = headers.findIndex(h => h === 'group' || h === 'assignment group' || h === 'category');
  const weightIdx  = headers.findIndex(h => h === 'weight' || h === 'group weight');

  // Guess course name from filename
  const courseName = filename.replace(/\.csv$/i,'').replace(/_/g,' ').replace(/-/g,' ').trim() || 'Imported Course';

  const rows = [];

  if (titleIdx >= 0 && scoreIdx >= 0) {
    // Format A: one assignment per row
    for (let i = 1; i < lines.length; i++) {
      const cols = ciCsvSplit(lines[i]);
      if (cols.length < 2) continue;
      const name   = (cols[titleIdx]  || '').trim();
      const score  = (cols[scoreIdx]  || '').trim();
      const poss   = possIdx >= 0 ? (cols[possIdx] || '').trim() : null;
      const group  = groupIdx >= 0 ? (cols[groupIdx] || '').trim() : null;
      const weight = weightIdx >= 0 ? parseFloat(cols[weightIdx]) : null;
      if (!name || name === 'Points Possible') continue;
      const scoreNum = parseFloat(score);
      const possNum  = parseFloat(poss);
      const pct = (!isNaN(scoreNum) && !isNaN(possNum) && possNum > 0) ? (scoreNum / possNum * 100) : (!isNaN(scoreNum) && scoreNum <= 100 ? scoreNum : null);
      rows.push({ courseName, name, group, weight, score: isNaN(scoreNum) ? null : scoreNum, possible: isNaN(possNum) ? null : possNum, pct: pct != null ? parseFloat(pct.toFixed(1)) : null, source: 'csv' });
    }
  } else {
    // Format B: wide/pivot format — first row has assignment names as headers
    // Row 2 is "Points Possible", remaining rows are students
    // For a single-student export, row index 2 (or 1 if no points row) is the data row
    // We look for a "current user" row or just take the first data row
    const pointsRow = lines.findIndex((l,i) => i > 0 && l.toLowerCase().includes('points possible'));
    const studentRows = lines.slice(Math.max(2, pointsRow + 1)).filter(l => !l.toLowerCase().startsWith('points'));
    if (!studentRows.length) throw new Error('Could not detect grade rows');

    // Take first student row (the logged-in user's row)
    const dataRow = ciCsvSplit(studentRows[0]);
    const headerRow = ciCsvSplit(lines[0]);
    const possRowParsed = pointsRow >= 0 ? ciCsvSplit(lines[pointsRow]) : null;

    // Skip non-assignment columns: Student,ID,SIS User ID,SIS Login ID,Section,<assignments...>,Current Score,Final Score,...
    const skipCols = new Set(['student','id','sis user id','sis login id','section','integration id','current score','final score','current grade','final grade','unposted current score','unposted final score','unposted current grade','unposted final grade']);
    for (let ci = 0; ci < headerRow.length; ci++) {
      const h = headerRow[ci].trim();
      if (skipCols.has(h.toLowerCase())) continue;
      if (!h || ci >= dataRow.length) continue;
      const score = dataRow[ci].trim();
      const scoreNum = parseFloat(score);
      if (isNaN(scoreNum)) continue;
      const poss = possRowParsed ? parseFloat(possRowParsed[ci]) : null;
      const pct = (!isNaN(poss) && poss > 0) ? scoreNum / poss * 100 : (scoreNum <= 100 ? scoreNum : null);
      rows.push({ courseName, name: h, group: null, weight: null, score: scoreNum, possible: isNaN(poss) ? null : poss, pct: pct != null ? parseFloat(pct.toFixed(1)) : null, source: 'csv' });
    }
  }

  if (!rows.length) throw new Error('No scoreable rows found — check this is a Canvas Grades CSV');
  return rows;
}

function ciCsvSplit(line) {
  const result = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; continue; }
    if (c === ',' && !inQ) { result.push(cur); cur = ''; continue; }
    cur += c;
  }
  result.push(cur);
  return result;
}

// ── PREVIEW RENDERER ─────────────────────────────────────────
function ciShowPreview(rows, mode) {
  const isCSV = mode === 'csv';
  const cardId    = isCSV ? 'ci-preview-card'   : 'ci-bm-preview';
  const waitId    = isCSV ? null                 : 'ci-bm-waiting';
  const tableId   = isCSV ? 'ci-preview-table'  : 'ci-bm-preview-table';
  const summaryId = isCSV ? 'ci-preview-summary': 'ci-bm-preview-summary';
  const warnId    = isCSV ? 'ci-preview-warn'   : null;

  const card = document.getElementById(cardId);
  const table = document.getElementById(tableId);
  const summary = document.getElementById(summaryId);
  if (!card || !table) return;

  // Hide waiting state, show card
  if (waitId) document.getElementById(waitId).style.display = 'none';
  card.style.display = '';
  // Update sync badge timestamp for bookmarklet
  if (!isCSV) {
    const timeEl = document.getElementById('ci-bm-sync-time');
    if (timeEl) timeEl.textContent = 'Last synced: ' + new Date().toLocaleTimeString();
  }

  // Group by course name
  const byCourse = {};
  rows.forEach(r => {
    if (!byCourse[r.courseName]) byCourse[r.courseName] = [];
    byCourse[r.courseName].push(r);
  });

  const courseNames = Object.keys(byCourse);
  const scoredCount = rows.filter(r => r.pct !== null && r.pct !== undefined).length;
  const skippedCount = rows.filter(r => r.pct === null || r.pct === undefined).length;

  summary.innerHTML = `Found <strong>${rows.length}</strong> assignments across <strong>${courseNames.length}</strong> course(s) — <span style="color:var(--green)">${scoredCount} with scores</span>${skippedCount ? `, <span style="color:var(--muted)">${skippedCount} unscored (skipped)</span>` : ''}.`;

  if (warnId && skippedCount > 0) {
    const w = document.getElementById(warnId);
    w.style.display = '';
    w.textContent = `⚠️ ${skippedCount} assignment(s) have no score and will be skipped.`;
  }

  let html = '<table class="ci-preview-tbl"><thead><tr><th>Course</th><th>Assignment</th><th>Group</th><th>Score</th><th>%</th><th>Status</th></tr></thead><tbody>';
  courseNames.forEach(cn => {
    byCourse[cn].forEach((r, i) => {
      const hasScore = r.pct !== null && r.pct !== undefined;
      const pill = hasScore ? '<span class="ci-pill-new">New</span>' : '<span class="ci-pill-skip">No score</span>';
      const pctDisplay = r.pct !== null ? r.pct.toFixed(1) + '%' : '—';
      const scoreDisplay = r.score !== null ? (r.possible !== null ? `${r.score}/${r.possible}` : r.score) : '—';
      html += `<tr class="${hasScore ? '' : 'ci-skip'}">
        <td>${i === 0 ? `<strong>${cn}</strong>` : ''}</td>
        <td>${r.name}</td>
        <td style="color:var(--muted2)">${r.group || '—'}</td>
        <td>${scoreDisplay}</td>
        <td style="font-weight:700;color:${r.pct >= 90 ? 'var(--green)' : r.pct >= 70 ? 'var(--yellow)' : 'var(--red)'}">${pctDisplay}</td>
        <td>${pill}</td>
      </tr>`;
    });
  });
  html += '</tbody></table>';
  table.innerHTML = html;

  // Refresh semester dropdowns
  ciPopulateSemSelects();
}

// ── MANUAL PASTE FALLBACK ─────────────────────────────────────
function ciCheckManualPaste(val) {
  const el = document.getElementById('ci-bm-paste-status');
  if (!el) return;
  if (!val.trim()) { el.textContent = ''; return; }
  try {
    const p = JSON.parse(val.trim());
    const rows = (p.data && p.data.rows) ? p.data.rows.filter(r => r.name && r.pct !== null) : [];
    el.style.color = rows.length ? 'var(--green)' : 'var(--yellow)';
    el.textContent = rows.length
      ? `✅ Found ${rows.length} scored assignment(s) — click Import`
      : '⚠️ JSON parsed but no scored assignments found.';
  } catch(e) {
    el.style.color = 'var(--red)';
    el.textContent = '❌ Not valid JSON — make sure you copied the full output.';
  }
}
function ciDoManualPasteImport() {
  const ta = document.getElementById('ci-bm-manual-paste');
  if (!ta || !ta.value.trim()) { showToast('⚠️ Paste the JSON first.'); return; }
  try {
    const p = JSON.parse(ta.value.trim());
    if (!p || !p.data || !p.data.rows) throw new Error('Missing rows');
    ciReceiveBmData(p.data);
    ta.value = '';
    document.getElementById('ci-bm-paste-status').textContent = '';
  } catch(e) {
    showToast('❌ Invalid JSON: ' + e.message);
  }
}

// ── BOOKMARKLET RECEIVER ─────────────────────────────────────
async function ciReceiveBmData(data) {
  if (!data || !data.rows) return;
  ciBmRows = data.rows.filter(r => r.name).map(r => ({
    courseName: data.courseName || 'Canvas Import',
    name: r.name,
    group: r.group || null,
    weight: r.weight || null,
    score: (r.score !== null && r.score !== undefined) ? parseFloat(r.score) : null,
    possible: (r.possible !== null && r.possible !== undefined) ? parseFloat(r.possible) : null,
    pct: (r.pct !== null && r.pct !== undefined) ? parseFloat(r.pct) : null,
    source: 'bookmarklet'
  }));
  if (!ciBmRows.length) { showToast('\u26a0\ufe0f Bookmarklet sent no grade data.'); return; }
  showToast('\ud83d\udce1 Canvas grades received — syncing ' + ciBmRows.length + ' assignments\u2026');
  await ciAutoImport(ciBmRows, data.courseName || 'Canvas Import');
}

// ── EXAM GROUP DETECTION ──────────────────────────────────────
function ciIsExamGroup(groupName) {
  if (!groupName) return false;
  const g = groupName.toLowerCase().trim();
  // Match exam/exams, test/tests, quiz/quizzes, final/finals, midterm/midterms
  const isExamLike = /\bexams?\b|\bmidterms?\b|\bfinals?\b|\btests?\b|\bquizzes\b|\bquiz\b/.test(g);
  if (!isExamLike) return false;
  // Exception: "hw quizzes", "homework quiz", "practice quiz", "worksheet" — those are regular work
  const isRegularWork = /\bhw\b|\bhomework\b|\bpractice\b|\bworksheet\b/.test(g);
  return !isRegularWork;
}

// ── COURSE-MATCH PICKER ───────────────────────────────────────
// Shows a modal asking user which existing course to map the Canvas course to.
// Resolves with the chosen {sem, subject} or null to skip.
function ciPickCourseMatch(canvasCourseName) {
  return new Promise(function(resolve) {
    // Build list of all subjects across all semesters
    const options = [];
    semesters.forEach(function(sem) {
      (sem.subjects || []).forEach(function(s) {
        options.push({ sem, subject: s, label: s.name + ' — ' + (sem.name || sem.id) });
      });
    });

    // Build semester options for the "create new subject" form
    const semOpts = semesters.map(function(sem) {
      return '<option value="' + sem.id + '">' + (sem.name || sem.id) + '</option>';
    }).join('');
    const hasSems = semesters.length > 0;

    // Build modal HTML
    const modalId = 'ci-match-modal';
    let existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = modalId;
    modal.style.cssText = `
      position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;
      background:rgba(0,0,0,.7);backdrop-filter:blur(8px);padding:20px;
    `;

    const existingListHtml = options.length ? options.map(function(o, i) {
      return '<div class="ci-match-opt" data-idx="' + i + '" onclick="ciPickOpt(' + i + ')"' +
        ' style="padding:12px 16px;border-radius:10px;border:1px solid var(--border2);' +
        'background:var(--surface2);cursor:pointer;transition:all .15s;font-size:14px;font-weight:600">' +
        o.label + '</div>';
    }).join('') : '<div style="font-size:13px;color:var(--muted);text-align:center;padding:14px 0">No existing subjects yet.</div>';

    modal.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border2);border-radius:20px;
                  padding:32px;max-width:480px;width:100%;box-shadow:0 24px 80px rgba(0,0,0,.6)">
        <div style="font-family:'Clash Display',sans-serif;font-weight:700;font-size:18px;margin-bottom:8px">
          📡 Match Canvas Course
        </div>
        <div style="font-size:13px;color:var(--muted2);margin-bottom:20px;line-height:1.6">
          Canvas sent grades for <strong style="color:var(--accent)">${canvasCourseName}</strong>.<br>
          Pick an existing subject or create a new one below.
        </div>

        <!-- CREATE NEW SUBJECT — always at top -->
        <div id="ci-new-subj-toggle" onclick="ciToggleNewSubj()"
          style="padding:12px 16px;border-radius:10px;border:2px dashed rgba(129,140,248,.45);
                 background:rgba(129,140,248,.06);cursor:pointer;transition:all .15s;
                 font-size:14px;font-weight:700;color:var(--accent);margin-bottom:12px;
                 display:flex;align-items:center;gap:8px">
          <span style="font-size:18px">➕</span> Create new subject for this course
        </div>
        <div id="ci-new-subj-form" style="display:none;margin-bottom:16px;
          background:var(--surface2);border:1px solid rgba(129,140,248,.3);
          border-radius:12px;padding:16px">
          <div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:6px">Subject name</div>
          <input id="ci-new-subj-name" type="text" value="${canvasCourseName}"
            style="width:100%;padding:9px 12px;background:var(--surface3);border:1px solid var(--border2);
                   border-radius:8px;color:var(--text);font-family:'Cabinet Grotesk',sans-serif;
                   font-size:14px;outline:none;margin-bottom:10px"/>
          <div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:6px">Add to semester</div>
          ${hasSems
            ? '<select id="ci-new-subj-sem" style="width:100%;padding:9px 12px;background:var(--surface3);border:1px solid var(--border2);border-radius:8px;color:var(--text);font-family:\'Cabinet Grotesk\',sans-serif;font-size:14px;outline:none;margin-bottom:10px">' + semOpts + '</select>'
            : '<input id="ci-new-subj-sem-name" type="text" placeholder="New semester name (e.g. Fall 2025)" style="width:100%;padding:9px 12px;background:var(--surface3);border:1px solid var(--border2);border-radius:8px;color:var(--text);font-family:\'Cabinet Grotesk\',sans-serif;font-size:14px;outline:none;margin-bottom:10px"/>'
          }
          <button onclick="ciCreateAndPick()" style="width:100%;padding:10px;border-radius:8px;border:none;
            background:var(--accent);color:#fff;font-family:'Clash Display',sans-serif;
            font-weight:700;font-size:14px;cursor:pointer">
            ✅ Create &amp; Sync Here
          </button>
        </div>

        <!-- EXISTING SUBJECTS LIST -->
        ${options.length ? '<div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:8px">Or pick an existing subject</div>' : ''}
        <div style="display:flex;flex-direction:column;gap:8px;max-height:220px;overflow-y:auto;margin-bottom:20px" id="ci-match-list">
          ${existingListHtml}
        </div>

        <div style="display:flex;gap:10px">
          <button onclick="ciPickOpt(-1)" style="flex:1;padding:11px;border-radius:10px;border:1px solid var(--border2);
            background:transparent;color:var(--muted);cursor:pointer;font-family:'Cabinet Grotesk',sans-serif;font-size:13px">
            Skip this course
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    window.ciToggleNewSubj = function() {
      const form = document.getElementById('ci-new-subj-form');
      const toggle = document.getElementById('ci-new-subj-toggle');
      const open = form.style.display === 'none';
      form.style.display = open ? 'block' : 'none';
      toggle.style.background = open ? 'rgba(129,140,248,.12)' : 'rgba(129,140,248,.06)';
      toggle.style.borderColor = open ? 'var(--accent)' : 'rgba(129,140,248,.45)';
    };

    window.ciCreateAndPick = async function() {
      const nameEl = document.getElementById('ci-new-subj-name');
      const semSelEl = document.getElementById('ci-new-subj-sem');
      const semNameEl = document.getElementById('ci-new-subj-sem-name');
      const subjectName = (nameEl && nameEl.value.trim()) || canvasCourseName;

      let targetSem;
      if (semSelEl) {
        targetSem = semesters.find(function(s) { return s.id === semSelEl.value; });
      } else if (semNameEl) {
        const newSemName = (semNameEl.value.trim()) || ('Semester ' + (semesters.length + 1));
        targetSem = { id: (typeof uid === 'function' ? uid() : ('sem_' + Date.now())), name: newSemName, subjects: [], user_id: currentUser.id, _gpa: 0 };
        semesters.push(targetSem);
      }
      if (!targetSem) { showToast('⚠️ Please select a semester.'); return; }

      const newSubject = {
        id: (typeof uid === 'function' ? uid() : ('subj_' + Date.now())),
        name: subjectName,
        credits: 3,
        status: 'normal',
        other_pct: 100,
        exam_pct: 0,
        other_score: 0,
        exams: []
      };
      targetSem.subjects.push(newSubject);
      await saveSemesterToDB(targetSem);
      updateStats(); renderDashboard(); renderCourses();
      modal.remove();
      delete window.ciPickOpt;
      delete window.ciToggleNewSubj;
      delete window.ciCreateAndPick;
      resolve({ sem: targetSem, subject: newSubject });
    };

    window.ciPickOpt = function(idx) {
      modal.remove();
      delete window.ciPickOpt;
      delete window.ciToggleNewSubj;
      delete window.ciCreateAndPick;
      if (idx < 0) { resolve(null); return; }
      resolve(options[idx]);
    };

    // Style hover via JS since we can't add CSS dynamically easily
    modal.querySelectorAll('.ci-match-opt').forEach(function(el) {
      el.addEventListener('mouseenter', function() {
        el.style.borderColor = 'var(--accent)';
        el.style.background  = 'rgba(129,140,248,.1)';
      });
      el.addEventListener('mouseleave', function() {
        el.style.borderColor = 'var(--border2)';
        el.style.background  = 'var(--surface2)';
      });
    });
  });
}


// ── IMPORT ENGINE ─────────────────────────────────────────────
// ── BULK COURSE MAPPER ────────────────────────────────────────
// Shows one modal listing ALL unmatched Canvas courses at once.
// User maps each to an existing subject or picks "Create new".
// Returns a Map: canvasCourseName → { sem, subject } or null (skip).
function ciBulkMapCourses(unmatchedNames) {
  return new Promise(function(resolve) {
    const modalId = 'ci-bulk-map-modal';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    // Build flat options list for dropdowns
    const subjOptions = [];
    semesters.forEach(function(sem) {
      (sem.subjects || []).forEach(function(s) {
        subjOptions.push({ sem, subject: s, label: s.name + ' (' + (sem.name || sem.id) + ')' });
      });
    });

    const semOpts = semesters.map(function(sem) {
      return '<option value="' + sem.id + '">' + (sem.name || sem.id) + '</option>';
    }).join('');
    const hasSems = semesters.length > 0;

    const rowsHtml = unmatchedNames.map(function(cn, i) {
      const optionsHtml = subjOptions.map(function(o, j) {
        // Auto-select if fuzzy match
        const autoSel = o.subject.name.toLowerCase().includes(cn.toLowerCase().slice(0,6)) ||
                        cn.toLowerCase().includes(o.subject.name.toLowerCase().slice(0,6));
        return '<option value="subj__' + j + '"' + (autoSel ? ' selected' : '') + '>' + o.label + '</option>';
      }).join('');
      return `
        <div style="background:var(--surface2);border:1px solid var(--border2);border-radius:12px;padding:14px 16px;margin-bottom:10px" id="bulk-row-${i}">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <div style="font-family:'Clash Display',sans-serif;font-weight:700;font-size:14px;flex:1;min-width:160px;color:var(--accent)">${cn}</div>
            <select id="bulk-sel-${i}" onchange="ciBulkSelChange(${i})"
              style="flex:2;min-width:200px;padding:8px 10px;background:var(--surface3);border:1px solid var(--border2);
                     border-radius:8px;color:var(--text);font-family:'Cabinet Grotesk',sans-serif;font-size:13px;outline:none">
              <option value="skip">— Skip this course —</option>
              <option value="new">➕ Create new subject</option>
              ${optionsHtml}
            </select>
          </div>
          <div id="bulk-new-${i}" style="display:none;margin-top:10px;display:none;gap:8px;flex-wrap:wrap;align-items:center">
            <input id="bulk-newname-${i}" type="text" value="${cn}" placeholder="Subject name"
              style="flex:2;min-width:160px;padding:7px 10px;background:var(--surface3);border:1px solid var(--border2);
                     border-radius:8px;color:var(--text);font-family:'Cabinet Grotesk',sans-serif;font-size:13px;outline:none"/>
            ${hasSems
              ? '<select id="bulk-newsem-' + i + '" style="flex:1;min-width:140px;padding:7px 10px;background:var(--surface3);border:1px solid var(--border2);border-radius:8px;color:var(--text);font-family:\'Cabinet Grotesk\',sans-serif;font-size:13px;outline:none">' + semOpts + '</select>'
              : '<input id="bulk-newsem-' + i + '" type="text" placeholder="New semester name" style="flex:1;min-width:140px;padding:7px 10px;background:var(--surface3);border:1px solid var(--border2);border-radius:8px;color:var(--text);font-family:\'Cabinet Grotesk\',sans-serif;font-size:13px;outline:none"/>'
            }
          </div>
        </div>`;
    }).join('');

    const modal = document.createElement('div');
    modal.id = modalId;
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.75);backdrop-filter:blur(8px);padding:20px;';
    modal.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border2);border-radius:20px;
                  padding:30px;max-width:600px;width:100%;box-shadow:0 24px 80px rgba(0,0,0,.6);
                  max-height:88vh;display:flex;flex-direction:column">
        <div style="font-family:'Clash Display',sans-serif;font-weight:700;font-size:20px;margin-bottom:6px">
          📡 Map Canvas Courses to Subjects
        </div>
        <div style="font-size:13px;color:var(--muted2);margin-bottom:20px;line-height:1.6">
          Gradintel found <strong style="color:var(--accent)">${unmatchedNames.length}</strong> Canvas course(s) that need mapping.
          Match each one to an existing subject, create a new one, or skip it.
        </div>
        <div style="overflow-y:auto;flex:1;padding-right:4px;margin-bottom:16px">
          ${rowsHtml}
        </div>
        <div style="display:flex;gap:10px;flex-shrink:0">
          <button onclick="ciBulkConfirm()" style="flex:1;padding:12px;border-radius:10px;border:none;
            background:var(--accent);color:#fff;font-family:'Clash Display',sans-serif;font-weight:700;font-size:15px;cursor:pointer">
            ✅ Confirm &amp; Sync All
          </button>
          <button onclick="ciBulkCancel()" style="padding:12px 20px;border-radius:10px;border:1px solid var(--border2);
            background:transparent;color:var(--muted);cursor:pointer;font-family:'Cabinet Grotesk',sans-serif;font-size:13px">
            Cancel
          </button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    window.ciBulkSelChange = function(i) {
      const sel = document.getElementById('bulk-sel-' + i);
      const newRow = document.getElementById('bulk-new-' + i);
      if (!sel || !newRow) return;
      newRow.style.display = sel.value === 'new' ? 'flex' : 'none';
    };

    window.ciBulkConfirm = async function() {
      const result = new Map();
      for (let i = 0; i < unmatchedNames.length; i++) {
        const cn = unmatchedNames[i];
        const sel = document.getElementById('bulk-sel-' + i);
        if (!sel) { result.set(cn, null); continue; }
        const val = sel.value;
        if (val === 'skip') { result.set(cn, null); continue; }
        if (val === 'new') {
          const nameEl = document.getElementById('bulk-newname-' + i);
          const semEl  = document.getElementById('bulk-newsem-' + i);
          const subjectName = (nameEl && nameEl.value.trim()) || cn;
          let targetSem;
          if (hasSems) {
            targetSem = semesters.find(function(s) { return s.id === semEl.value; });
          } else {
            const newSemName = (semEl && semEl.value.trim()) || ('Semester ' + (semesters.length + 1));
            targetSem = { id: uid(), name: newSemName, subjects: [], user_id: currentUser.id, _gpa: 0 };
            semesters.push(targetSem);
          }
          if (!targetSem) { result.set(cn, null); continue; }
          const newSubject = { id: uid(), name: subjectName, credits: 3, status: 'normal', other_pct: 100, exam_pct: 0, other_score: 0, exams: [] };
          targetSem.subjects.push(newSubject);
          await saveSemesterToDB(targetSem);
          result.set(cn, { sem: targetSem, subject: newSubject });
        } else if (val.startsWith('subj__')) {
          const idx = parseInt(val.replace('subj__', ''));
          result.set(cn, subjOptions[idx]);
        } else {
          result.set(cn, null);
        }
      }
      modal.remove();
      delete window.ciBulkSelChange;
      delete window.ciBulkConfirm;
      delete window.ciBulkCancel;
      updateStats(); renderDashboard(); renderCourses();
      resolve(result);
    };

    window.ciBulkCancel = function() {
      modal.remove();
      delete window.ciBulkSelChange;
      delete window.ciBulkConfirm;
      delete window.ciBulkCancel;
      resolve(null);
    };
  });
}

// ciAutoImport: called automatically when bookmarklet fires.
// - Filters out exam groups (user enters those manually)
// - Computes weighted other_score from points scored / points possible
// - Matches to existing course by name; if no match, asks user to pick
// - Updates other_score on the existing subject — never touches exams[]
// - Keeps the user's existing credits, never overwrites them
async function ciAutoImport(rows, courseNameHint) {
  // We work with ALL rows — filtering happens per-group inside the loop.
  const allValidRows = rows.filter(function(r) { return r.courseName; });
  if (!allValidRows.length) { showToast('⚠️ No grade rows received from Canvas.'); return; }

  // Group rows by Canvas course name
  const byCourse = {};
  allValidRows.forEach(function(r) {
    if (!byCourse[r.courseName]) byCourse[r.courseName] = [];
    byCourse[r.courseName].push(r);
  });

  // Build flat list of all subjects for the picker
  const allSubjects = [];
  semesters.forEach(function(sem) {
    (sem.subjects || []).forEach(function(s) {
      allSubjects.push({ sem, subject: s });
    });
  });

  let updatedCourses = 0;

  for (const [canvasCourseName, courseRows] of Object.entries(byCourse)) {

    // ── Step 1: Aggregate all rows into ONE entry per group ──────
    // Rows may be individual assignments (old bookmarklet) or group summaries (new).
    // Either way: sum scored/possible per group, use the group's weight (same for all rows in group).
    const groupMap = {};
    courseRows.forEach(function(r) {
      const gName = r.group || r.name || '?';
      if (!groupMap[gName]) {
        groupMap[gName] = { name: gName, weight: null, scored: 0, possible: 0, hasScore: false };
      }
      const g = groupMap[gName];
      // Take weight from any row that has it
      if (r.weight !== null && r.weight !== undefined && parseFloat(r.weight) > 0) {
        g.weight = parseFloat(r.weight);
      }
      // Accumulate raw points
      if (r.score !== null && r.score !== undefined && r.possible !== null && r.possible !== undefined && parseFloat(r.possible) > 0) {
        g.scored   += parseFloat(r.score);
        g.possible += parseFloat(r.possible);
        g.hasScore  = true;
      } else if (r.pct !== null && r.pct !== undefined && !r.isGroupSummary) {
        // individual assignment with only pct — treat as 1 point each
        g.scored   += parseFloat(r.pct) / 100;
        g.possible += 1;
        g.hasScore  = true;
      }
    });

    // Compute groupPct for each group
    const allGroups = Object.values(groupMap).map(function(g) {
      const groupPct = g.possible > 0 ? (g.scored / g.possible * 100) : null;
      return { name: g.name, groupPct, weight: g.weight, isExam: ciIsExamGroup(g.name) };
    });

    const eligibleGroups = allGroups.filter(function(g) {
      return !g.isExam && g.groupPct !== null;
    });

    // ── DEBUG popup removed ──

    if (eligibleGroups.length === 0) {
      showToast('⚠️ ' + canvasCourseName + ': no scored non-exam groups — skipping.');
      continue;
    }

    // Weighted average: sum(groupPct × weight) / sum(weights)
    let computedOtherScore;
    const totalWeight = eligibleGroups.reduce(function(a, g) { return a + (g.weight || 0); }, 0);
    if (totalWeight > 0) {
      const weightedSum = eligibleGroups.reduce(function(a, g) { return a + g.groupPct * g.weight; }, 0);
      computedOtherScore = parseFloat((weightedSum / totalWeight).toFixed(2));
    } else {
      const sum = eligibleGroups.reduce(function(a, g) { return a + g.groupPct; }, 0);
      computedOtherScore = parseFloat((sum / eligibleGroups.length).toFixed(2));
    }

    // ── Step 2: Show subject picker — auto-preselect best name match ────────
    // Find best match by name similarity
    const normalize = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cn = normalize(canvasCourseName);
    let bestIdx = -1, bestScore = 0;
    allSubjects.forEach(function(item, idx) {
      const sn = normalize(item.subject.name);
      // Score: exact contains > word overlap
      let sc = 0;
      if (cn.includes(sn) || sn.includes(cn)) sc = 2;
      else {
        const cnWords = cn.split('');
        let common = 0;
        sn.split('').forEach(c => { if (cn.includes(c)) common++; });
        sc = common / Math.max(cn.length, sn.length);
      }
      if (sc > bestScore) { bestScore = sc; bestIdx = idx; }
    });

    const groupSummary = eligibleGroups.map(function(g) {
      return '<span style="display:inline-block;background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.25);border-radius:6px;padding:2px 8px;margin:2px;font-size:11px">' + g.name + ': ' + g.groupPct.toFixed(1) + '%</span>';
    }).join('');

    const chosen = await new Promise(function(resolve) {
      let selectedIdx = bestIdx;

      function buildModal() {
        const existing = document.getElementById('_ci_sync_modal');
        if (existing) existing.remove();

        const optionsHtml = allSubjects.map(function(item, idx) {
          const isSel = idx === selectedIdx;
          return '<button id="_ciopt_' + idx + '" onclick="window._ciPick(' + idx + ')" style="width:100%;text-align:left;padding:10px 14px;margin-bottom:5px;background:' + (isSel ? 'rgba(129,140,248,.15)' : 'var(--surface2)') + ';border:' + (isSel ? '1.5px solid var(--accent)' : '1px solid var(--border2)') + ';border-radius:9px;cursor:pointer;font-family:\'Cabinet Grotesk\',sans-serif;font-size:13px;color:var(--text);display:flex;align-items:center;gap:8px;transition:border .15s,background .15s">' +
            (isSel ? '<span style="color:var(--accent);font-size:16px">●</span>' : '<span style="color:var(--muted);font-size:16px">○</span>') +
            '<span><strong>' + item.subject.name + '</strong> <span style="font-size:11px;color:var(--muted)">(' + (item.sem.name || 'Semester') + ')</span></span>' +
            (isSel ? '<span style="margin-left:auto;font-size:10px;color:var(--accent);font-weight:700">AUTO-MATCHED</span>' : '') +
            '</button>';
        }).join('');

        const modal = document.createElement('div');
        modal.id = '_ci_sync_modal';
        modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(8px)';
        // Stop clicks inside modal from falling through
        modal.addEventListener('mousedown', e => e.stopPropagation());
        modal.innerHTML =
          '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:20px;padding:28px;width:100%;max-width:480px;max-height:88vh;overflow-y:auto;box-shadow:0 32px 80px rgba(0,0,0,.7);position:relative">' +
            '<div style="font-family:\'Clash Display\',sans-serif;font-weight:700;font-size:19px;margin-bottom:4px">📡 Canvas Sync</div>' +
            '<div style="font-size:12px;color:var(--muted2);margin-bottom:10px">From Canvas: <strong style="color:var(--text)">' + canvasCourseName + '</strong></div>' +
            '<div style="margin-bottom:12px">' + groupSummary + '</div>' +
            '<div style="background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.3);border-radius:10px;padding:12px 16px;margin-bottom:18px;display:flex;align-items:center;justify-content:space-between">' +
              '<span style="font-size:13px;color:var(--muted2)">Calculated Other Stuff Score</span>' +
              '<strong style="font-family:\'Clash Display\',sans-serif;font-size:20px;color:var(--green)">' + computedOtherScore + '%</strong>' +
            '</div>' +
            '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:10px">Update which subject?</div>' +
            '<div id="_ci_opts">' + optionsHtml + '</div>' +
            '<button onclick="window._ciPick(\'new\')" style="width:100%;padding:11px;margin-top:4px;background:transparent;border:1.5px dashed var(--accent);border-radius:9px;color:var(--accent);cursor:pointer;font-family:\'Cabinet Grotesk\',sans-serif;font-size:13px;font-weight:600;transition:background .15s" onmouseover="this.style.background=\'rgba(129,140,248,.08)\'" onmouseout="this.style.background=\'transparent\'">+ Create new subject from this data</button>' +
            '<button onclick="window._ciPick(null)" style="width:100%;padding:9px;margin-top:6px;background:transparent;border:1px solid var(--border2);border-radius:9px;color:var(--muted);cursor:pointer;font-family:\'Cabinet Grotesk\',sans-serif;font-size:12px;transition:border .15s" onmouseover="this.style.borderColor=\'var(--muted)\'" onmouseout="this.style.borderColor=\'var(--border2)\'">Skip this course</button>' +
          '</div>';
        document.body.appendChild(modal);
      }

      buildModal();

      window._ciPick = function(idx) {
        const modal = document.getElementById('_ci_sync_modal');
        if (modal) modal.remove();
        delete window._ciPick;
        resolve(idx);
      };
    });

    if (chosen === null) continue; // skipped

    // ── Step 3: Apply or create ──────────────────────────────────
    if (chosen === 'new') {
      // Create a new subject in the most recent semester
      const targetSem = semesters[semesters.length - 1];
      if (!targetSem) { showToast('⚠️ No semester found — add a semester first.'); continue; }
      const newSubject = {
        id: uid(), name: canvasCourseName, credits: 3, status: 'normal',
        other_pct: 100, exam_pct: 0, other_score: computedOtherScore, exams: []
      };
      targetSem.subjects.push(newSubject);
      await saveSemesterToDB(targetSem);
      updatedCourses++;
      showToast('✅ Created "' + canvasCourseName + '" with score ' + computedOtherScore + '%');
    } else {
      const { sem: targetSem, subject } = allSubjects[chosen];
      subject.other_score = computedOtherScore;
      const cp = targetSem.subjects.reduce(function(a, s) { return a + s.credits * computeSubject(s).curG.p; }, 0);
      const cr = targetSem.subjects.reduce(function(a, s) { return a + s.credits; }, 0);
      targetSem._gpa = cr ? cp / cr : 0;
      await saveSemesterToDB(targetSem);
      updatedCourses++;
      // Remember mapping
      try {
        const memKey = 'gradintel_canvas_map_' + (currentUser?.id || '');
        const mem = JSON.parse(localStorage.getItem(memKey) || '{}');
        mem[canvasCourseName.trim().toLowerCase()] = subject.id;
        localStorage.setItem(memKey, JSON.stringify(mem));
      } catch(e) {}
    }
  }

  updateStats(); renderDashboard(); renderCourses(); renderHistory(); renderWIFull();
  const msg = '✅ Canvas synced! Updated other score for ' + updatedCourses + ' course' + (updatedCourses !== 1 ? 's' : '') + '.';
  showToast(msg);
  if (updatedCourses > 0) fireConfetti();
  const syncMsg = document.getElementById('ci-bm-sync-msg');
  if (syncMsg) syncMsg.textContent = msg.replace('✅ ', '');
  ciShowPreview(ciBmRows, 'bm');
}

// ciDoImport: used by CSV manual import button
async function ciDoImport(mode) {
  const rows = mode === 'csv' ? ciCsvRows : ciBmRows;
  const semSelId  = mode === 'csv' ? 'ci-sem-select'  : 'ci-bm-sem-select';
  const semNameId = mode === 'csv' ? 'ci-sem-name'    : 'ci-bm-sem-name';
  const btnId     = mode === 'csv' ? 'ci-import-btn'  : null;

  const scoredRows = rows.filter(r => r.pct !== null && r.pct !== undefined);
  if (!scoredRows.length) { showToast('\u26a0\ufe0f No scored assignments to import.'); return; }

  const semSel  = document.getElementById(semSelId);
  const semName = document.getElementById(semNameId);
  if (!semSel) return;

  if (btnId) { const b = document.getElementById(btnId); if (b) { b.disabled = true; b.textContent = 'Importing\u2026'; } }

  try {
    const byCourse = {};
    scoredRows.forEach(r => {
      if (!byCourse[r.courseName]) byCourse[r.courseName] = [];
      byCourse[r.courseName].push(r);
    });

    let targetSem;
    if (semSel.value === '__new__') {
      const name = (semName && semName.value.trim()) || ('Canvas Import ' + new Date().toLocaleDateString());
      targetSem = { id: uid(), name, subjects: [], user_id: currentUser.id, _gpa: 0 };
      semesters.push(targetSem);
    } else {
      targetSem = semesters.find(s => s.id === semSel.value);
      if (!targetSem) { showToast('\u274c Semester not found.'); return; }
    }

    let importedCourses = 0, importedExams = 0;

    for (const [courseName, courseRows] of Object.entries(byCourse)) {
      let subject = targetSem.subjects.find(s => s.name.toLowerCase() === courseName.toLowerCase());
      if (!subject) {
        const totalPossible = courseRows.reduce((a, r) => a + (r.possible || 1), 0);
        const exams = courseRows.map(r => ({
          id: uid(),
          name: r.name.length > 40 ? r.name.slice(0,40) + '\u2026' : r.name,
          weight: totalPossible > 0 ? ((r.possible || 1) / totalPossible * 100) : (100 / courseRows.length),
          taken: r.pct !== null,
          score: r.pct !== null ? parseFloat(r.pct.toFixed(1)) : null
        }));
        const wSum = exams.reduce((a, e) => a + e.weight, 0);
        if (wSum > 0) exams.forEach(e => e.weight = e.weight / wSum * 100);
        subject = { id: uid(), name: courseName, credits: 3, status: 'normal', exams };
        targetSem.subjects.push(subject);
        importedCourses++;
        importedExams += exams.filter(e => e.taken).length;
      } else {
        // Upsert into existing course
        courseRows.forEach(r => {
          if (r.pct === null) return;
          const existingIdx = subject.exams.findIndex(e => e.name.toLowerCase() === r.name.toLowerCase().slice(0,40));
          if (existingIdx >= 0) {
            subject.exams[existingIdx].score = parseFloat(r.pct.toFixed(1));
            subject.exams[existingIdx].taken = true;
          } else {
            subject.exams.push({ id: uid(), name: r.name.slice(0,40), weight: 100 / (subject.exams.length + 1), taken: true, score: parseFloat(r.pct.toFixed(1)) });
            importedExams++;
          }
        });
        const wS = subject.exams.reduce((a,e)=>a+e.weight,0);
        if (wS>0) subject.exams.forEach(e=>e.weight=e.weight/wS*100);
      }
    }

    const cp = targetSem.subjects.reduce((a, s) => a + s.credits * computeSubject(s).curG.p, 0);
    const cr = targetSem.subjects.reduce((a, s) => a + s.credits, 0);
    targetSem._gpa = cr ? cp / cr : 0;
    await saveSemesterToDB(targetSem);

    updateStats(); renderDashboard(); renderCourses(); renderHistory(); renderWIFull();
    showToast('\u2705 Imported ' + importedCourses + ' course(s) \u00b7 ' + importedExams + ' assignment(s) into "' + targetSem.name + '"!');
    fireConfetti();
    if (mode === 'csv') ciClearPreview();
    else ciClearBmPreview();

  } catch(e) {
    showToast('\u274c Import failed: ' + e.message);
    console.error(e);
  } finally {
    if (btnId) { const b = document.getElementById(btnId); if (b) { b.disabled = false; b.textContent = 'Import into Gradintel'; } }
  }
}

// ── CLEAR HELPERS ─────────────────────────────────────────────
function ciClearPreview() {
  ciCsvRows = [];
  document.getElementById('ci-preview-card').style.display = 'none';
  document.getElementById('ci-parse-status').style.display = 'none';
  const fi = document.getElementById('ci-csv-file'); if (fi) fi.value = '';
}
function ciClearBmPreview() {
  ciBmRows = [];
  const prev = document.getElementById('ci-bm-preview');
  const wait = document.getElementById('ci-bm-waiting');
  if (prev) prev.style.display = 'none';
  if (wait) wait.style.display = '';
}

// Start listeners immediately on page load
// so bookmarklet data is captured even if user isn't on canvas tab
(function() {
  // BroadcastChannel fallback (same-origin)
  try {
    const bc = new BroadcastChannel('gradintel_canvas');
    bc.onmessage = e => {
      if (e.data && e.data.type === 'GRADINTEL_CANVAS') ciReceiveBmData(e.data.data);
      if (e.data && e.data.type === 'GRADINTEL_ALL_COURSES') ciReceiveAllCoursesData(e.data.data);
    };
  } catch(e) {}
  // postMessage fallback (any origin)
  window.addEventListener('message', e => {
    if (e.data && e.data.type === 'GRADINTEL_CANVAS') ciReceiveBmData(e.data.data);
    if (e.data && e.data.type === 'GRADINTEL_ALL_COURSES') ciReceiveAllCoursesData(e.data.data);
  });
  // Supabase realtime + catch-up poll is handled in ciStartListener() when Canvas tab opens.
  // Also do a one-time catch-up poll after auth, in case bookmarklet fired before page load.
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
      try {
        if (sb && typeof currentUser !== 'undefined' && currentUser) {
          sb.from('canvas_sync')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .then(function(res) {
              if (res.data && res.data.length > 0) {
                var row = res.data[0];
                var age = Date.now() - new Date(row.created_at).getTime();
                if (age < 120000) {
                  if (row.payload && row.payload.type === 'GRADINTEL_ALL_COURSES') ciReceiveAllCoursesData(row.payload);
                  else ciReceiveBmData(row.payload);
                  sb.from('canvas_sync').delete().eq('id', row.id).then(function(){});
                }
              }
            });
        }
      } catch(e) {}
    }, 2500);
  });
})();

/* ─── CANVAS DEADLINE EXTENSION ─── */
// Patch the bookmarklet to also send assignment due dates
// This extends the existing ciGetBookmarkletCode — after grades are sent,
// also send deadlines payload separately so deadline tracker can pick them up.

const _origCiGetBookmarkletCode = ciGetBookmarkletCode;
function ciGetBookmarkletCode() {
  // We rebuild the full bookmarklet with deadline sending added
  const sbUrl  = SUPABASE_URL;
  const sbAnon = SUPABASE_ANON;
  const userId = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.id : 'anonymous';

  const fn = `(function(){
  var SBURL  = ${JSON.stringify(sbUrl)};
  var SBANON = ${JSON.stringify(sbAnon)};
  var UID    = ${JSON.stringify(userId)};

  function send(data) {
    fetch(SBURL + '/rest/v1/canvas_sync', {
      method: 'POST',
      headers: {'Content-Type':'application/json','apikey':SBANON,'Authorization':'Bearer '+SBANON,'Prefer':'return=minimal'},
      body: JSON.stringify({ user_id: UID, payload: data, created_at: new Date().toISOString() })
    }).catch(function(){});
    try { var bc=new BroadcastChannel('gradintel_canvas'); bc.postMessage({type:'GRADINTEL_CANVAS',data:data}); bc.close(); } catch(e){}
    try { window.opener && window.opener.postMessage({type:'GRADINTEL_CANVAS',data:data},'*'); } catch(e){}
  }

  function sendDeadlines(deadlines) {
    fetch(SBURL + '/rest/v1/canvas_sync', {
      method: 'POST',
      headers: {'Content-Type':'application/json','apikey':SBANON,'Authorization':'Bearer '+SBANON,'Prefer':'return=minimal'},
      body: JSON.stringify({ user_id: UID, payload: deadlines, created_at: new Date().toISOString() })
    }).catch(function(){});
    try { var bc=new BroadcastChannel('gradintel_canvas'); bc.postMessage({type:'GRADINTEL_DEADLINES',data:deadlines}); bc.close(); } catch(e){}
  }

  function toast(msg) {
    var d=document.createElement('div');
    d.style.cssText='position:fixed;bottom:24px;right:24px;background:#818cf8;color:#fff;padding:12px 20px;border-radius:12px;font-family:sans-serif;font-size:14px;font-weight:700;z-index:999999;box-shadow:0 4px 20px rgba(0,0,0,.4)';
    d.textContent=msg; document.body.appendChild(d); setTimeout(function(){d.remove()},3500);
  }
  toast('📊 Gradintel: reading grades & deadlines…');

  var m = location.href.match(/courses\\/([0-9]+)/);
  var courseId = m ? m[1] : null;
  var canvasBase = location.origin;

  function extractFromDOM() {
    var rows = [];
    document.querySelectorAll('#grades_summary tr.student_assignment').forEach(function(tr){
      var name = tr.querySelector('.title a,.title') ? (tr.querySelector('.title a')||tr.querySelector('.title')).textContent.trim() : null;
      var score = tr.querySelector('.score_value') ? tr.querySelector('.score_value').textContent.trim() : null;
      var possible = tr.querySelector('.points_possible') ? tr.querySelector('.points_possible').textContent.trim() : null;
      var pct = null;
      if (score && possible && parseFloat(possible) > 0) pct = (parseFloat(score)/parseFloat(possible)*100).toFixed(1);
      if (score === null || score === '--') score = null;
      if (name) rows.push({name:name, score:score, possible:possible, pct:pct});
    });
    return rows;
  }

  var courseNameEl = document.querySelector('h1.course-title,.context_module_sub_header,.course-name,title');
  var courseName = courseNameEl ? courseNameEl.textContent.trim().replace(' Grades','') : (document.title||'Canvas Course');

  if (courseId) {
    fetch(canvasBase+'/api/v1/courses/'+courseId+'/assignment_groups?include[]=assignments&include[]=submission&per_page=100', {credentials:'include'})
      .then(function(r){return r.json();}).then(function(groups){
        var rows = [];
        var deadlines = [];
        groups.forEach(function(g){
          var gw = g.group_weight||0;
          (g.assignments||[]).forEach(function(a){
            var sub = a.submission||{};
            var pct = null;
            if (sub.score!=null && a.points_possible>0) pct = (sub.score/a.points_possible*100).toFixed(1);
            rows.push({name:a.name,group:g.name,weight:gw,score:sub.score!=null?sub.score.toString():null,possible:a.points_possible?a.points_possible.toString():null,pct:pct,due:a.due_at?a.due_at.split('T')[0]:null});
            // Collect upcoming deadlines (not yet submitted, has due date)
            if(a.due_at && (!sub.submitted_at) && sub.workflow_state !== 'graded'){
              deadlines.push({name:a.name,course:courseName,due:a.due_at,group:g.name,points:a.points_possible||0});
            }
          });
        });
        send({source:'api', courseName:courseName, courseId:courseId, rows:rows});
        if(deadlines.length) sendDeadlines({type:'GRADINTEL_DEADLINES',courseName:courseName,courseId:courseId,deadlines:deadlines});
        toast('✅ Gradintel: '+rows.length+' grades + '+deadlines.length+' upcoming deadlines synced!');
      }).catch(function(){
        var domRows = extractFromDOM();
        if (domRows.length) { send({source:'dom', courseName:courseName, courseId:courseId, rows:domRows}); toast('✅ Gradintel: '+domRows.length+' grades found!'); }
        else toast('⚠️ Gradintel: no grades found on this page.');
      });
  } else {
    var domRows = extractFromDOM();
    if (domRows.length) { send({source:'dom', courseName:courseName, courseId:null, rows:domRows}); toast('✅ Gradintel: '+domRows.length+' grades found!'); }
    else toast('⚠️ Gradintel: navigate to a Canvas Grades page first, then click again.');
  }
})();`;
  return 'javascript:' + encodeURIComponent(fn);
}

// Listen for deadline data from bookmarklet and auto-import into deadline tracker
(function(){
  function handleDeadlineData(data){
    if(!data || !data.deadlines || !data.deadlines.length) return;
    var imported = 0;
    data.deadlines.forEach(function(dl){
      // Don't add if already exists (same name + course)
      var exists = (deadlines||[]).some(function(d){ return d.name===dl.name && d.course===dl.course; });
      if(exists) return;
      var newDl = {
        id: uid(),
        name: dl.name,
        course: dl.course || dl.courseName || 'Canvas',
        date: dl.due ? dl.due.split('T')[0] : null,
        type: dl.group || 'Assignment',
        done: false
      };
      if(!deadlines) window.deadlines = [];
      deadlines.push(newDl);
      imported++;
    });
    if(imported > 0){
      saveDeadlinesToDB && saveDeadlinesToDB();
      if(typeof renderDeadlines === 'function') renderDeadlines();
      showToast('📅 Imported ' + imported + ' deadline' + (imported!==1?'s':'') + ' from Canvas!');
    }
  }

  // BroadcastChannel for same-origin
  try {
    var bc2 = new BroadcastChannel('gradintel_canvas');
    var _orig = bc2.onmessage;
    bc2.onmessage = function(e){
      if(e.data && e.data.type==='GRADINTEL_DEADLINES') handleDeadlineData(e.data.data);
    };
  } catch(e){}

  // postMessage
  window.addEventListener('message', function(e){
    if(e.data && e.data.type==='GRADINTEL_DEADLINES') handleDeadlineData(e.data.data);
  });

  // Supabase realtime for deadlines (piggybacks on canvas_sync table)
  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(function(){
      if(sb && typeof currentUser !== 'undefined' && currentUser){
        sb.channel('canvas-deadlines-'+currentUser.id)
          .on('postgres_changes',{event:'INSERT',schema:'public',table:'canvas_sync',filter:'user_id=eq.'+currentUser.id},
          function(payload){
            if(payload.new && payload.new.payload && payload.new.payload.type==='GRADINTEL_DEADLINES'){
              handleDeadlineData(payload.new.payload);
              sb.from('canvas_sync').delete().eq('id',payload.new.id).then(function(){});
            }
          }).subscribe();
      }
    }, 3000);
  });
})();

/* ═══════════════════════════════════════════════════════════
   ASSIGNMENTS BOOKMARKLET — mirrors grades bookmarklet exactly
   Uses same Supabase canvas_sync table + Realtime listener
   type: 'GRADINTEL_ASSIGNMENTS' to distinguish from grades
═══════════════════════════════════════════════════════════ */

function abmGetCode() {
  var sbUrl  = SUPABASE_URL;
  var sbAnon = SUPABASE_ANON;
  var userId = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.id : 'anonymous';

  var fn = '(function(){'
    + 'var SBURL="' + sbUrl + '";'
    + 'var SBANON="' + sbAnon + '";'
    + 'var UID="' + userId + '";'

    + 'function sendToSupabase(payload){'
      + 'fetch(SBURL+"/rest/v1/canvas_sync",{'
        + 'method:"POST",'
        + 'headers:{"Content-Type":"application/json","apikey":SBANON,"Authorization":"Bearer "+SBANON,"Prefer":"return=minimal"},'
        + 'body:JSON.stringify({user_id:UID,payload:payload,created_at:new Date().toISOString()})'
      + '}).catch(function(){});'
      // BroadcastChannel fallback (same browser, same origin)
      + 'try{var bc=new BroadcastChannel("gradintel_canvas");bc.postMessage({type:"GRADINTEL_ASSIGNMENTS",data:payload});bc.close();}catch(e){}'
      // postMessage fallback
      + 'try{window.opener&&window.opener.postMessage({type:"GRADINTEL_ASSIGNMENTS",data:payload},"*");}catch(e){}'
    + '}'

    + 'function toast(msg){'
      + 'var d=document.createElement("div");'
      + 'd.style.cssText="position:fixed;bottom:24px;right:24px;background:#818cf8;color:#fff;padding:12px 20px;border-radius:12px;font-family:sans-serif;font-size:14px;font-weight:700;z-index:999999;box-shadow:0 4px 20px rgba(0,0,0,.4)";'
      + 'd.textContent=msg;document.body.appendChild(d);setTimeout(function(){d.remove();},3500);'
    + '}'

    + 'toast("📝 Gradintel: fetching assignments…");'

    + 'var canvasBase=location.origin;'

    // Try upcoming_events first (works anywhere on Canvas)
    + 'fetch(canvasBase+"/api/v1/users/self/upcoming_events?per_page=100",{credentials:"include",headers:{"Accept":"application/json","X-Requested-With":"XMLHttpRequest"}})'
    + '.then(function(r){return r.json();})'
    + '.then(function(events){'
      + 'var assigns=events.filter(function(e){return e.assignment||e.type==="assignment";});'
      + 'if(assigns.length>0){'
        + 'var dls=assigns.map(function(e){'
          + 'var a=e.assignment||e;'
          + 'return{name:a.name||e.title||"Assignment",course:e.context_name||"",courseName:e.context_name||"",due:a.due_at||e.end_at||null,type:"assignment",points:a.points_possible||null};'
        + '});'
        + 'sendToSupabase({type:"GRADINTEL_ASSIGNMENTS",deadlines:dls});'
        + 'toast("✅ Gradintel: "+dls.length+" upcoming assignment(s) synced! Switch back to Gradintel.");'
        + 'return;'
      + '}'
      // Fall through to per-course fetch if upcoming_events returns no assignments
      + 'return fetchAllCourses();'
    + '})'
    + '.catch(function(){return fetchAllCourses();});'

    // Per-course assignments fetch
    + 'function fetchAllCourses(){'
      + 'fetch(canvasBase+"/api/v1/courses?enrollment_state=active&per_page=50",{credentials:"include",headers:{"Accept":"application/json","X-Requested-With":"XMLHttpRequest"}})'
      + '.then(function(r){return r.json();})'
      + '.then(function(courses){'
        + 'if(!courses||!courses.length){toast("⚠️ No active courses found. Make sure you are logged into Canvas.");return;}'
        + 'var all=[],done=0,total=courses.length;'
        + 'courses.forEach(function(c){'
          + 'fetch(canvasBase+"/api/v1/courses/"+c.id+"/assignments?bucket=upcoming&per_page=50",{credentials:"include",headers:{"Accept":"application/json","X-Requested-With":"XMLHttpRequest"}})'
          + '.then(function(r){return r.json();})'
          + '.then(function(as){'
            + 'as.forEach(function(a){'
              + 'all.push({name:a.name,course:c.name,courseName:c.name,due:a.due_at||null,type:"assignment",points:a.points_possible||null,submissionTypes:a.submission_types||[]});'
            + '});'
          + '})'
          + '.catch(function(){})'
          + '.finally(function(){'
            + 'done++;'
            + 'if(done===total){'
              + 'if(!all.length){toast("⚠️ No upcoming assignments found. Try visiting a Canvas Assignments page first.");return;}'
              + 'sendToSupabase({type:"GRADINTEL_ASSIGNMENTS",deadlines:all});'
              + 'toast("✅ Gradintel: "+all.length+" assignment(s) synced! Switch back to Gradintel.");'
            + '}'
          + '});'
        + '});'
      + '})'
      + '.catch(function(err){toast("❌ Error: "+err.message+". Make sure you are logged into Canvas.");});'
    + '}'

  + '})();';

  return 'javascript:' + encodeURIComponent(fn);
}

function abmInitLink() {
  var link = document.getElementById('abm-bm-link');
  if (link) link.href = abmGetCode();
}

function openAssignBmPanel() {
  var panel = document.getElementById('dl-canvas-status');
  if (!panel) return;
  var isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    // Re-generate bookmarklet code (bakes in fresh userId)
    abmInitLink();
  }
}

// Supabase Realtime listener for assignments
// Piggybacks on canvas_sync table, filters by type === 'GRADINTEL_ASSIGNMENTS'
function abmStartListener() {
  if (typeof sb === 'undefined' || !sb || typeof currentUser === 'undefined' || !currentUser) return;
  try {
    sb.channel('canvas-assignments-' + currentUser.id)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'canvas_sync',
        filter: 'user_id=eq.' + currentUser.id
      }, function(payload) {
        if (payload.new && payload.new.payload && payload.new.payload.type === 'GRADINTEL_ASSIGNMENTS') {
          abmHandleData(payload.new.payload);
          sb.from('canvas_sync').delete().eq('id', payload.new.id).then(function(){});
        }
      })
      .subscribe();
  } catch(e) { console.warn('ABM realtime failed:', e); }

  // BroadcastChannel fallback
  try {
    var bc = new BroadcastChannel('gradintel_canvas');
    var _orig = bc.onmessage;
    bc.onmessage = function(e) {
      if (e.data && e.data.type === 'GRADINTEL_ASSIGNMENTS') abmHandleData(e.data.data);
      else if (_orig) _orig.call(bc, e);
    };
  } catch(e) {}

  // postMessage fallback
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'GRADINTEL_ASSIGNMENTS') abmHandleData(e.data.data);
  });
}

function abmHandleData(data) {
  if (!data || !data.deadlines || !data.deadlines.length) {
    showToast('⚠️ No assignment data received.');
    return;
  }

  var imported = 0;
  var skipped  = 0;
  var dls      = getDeadlines();
  var existingKeys = new Set(dls.map(function(d) { return (d.title||'').toLowerCase().trim() + '|' + (d.date||'').slice(0,10); }));

  data.deadlines.forEach(function(a) {
    var title  = (a.title || a.name || '').trim();
    if (!title) return;
    var dueRaw = a.due || a.due_at || null;
    var dateStr = '';
    if (dueRaw) { try { dateStr = new Date(dueRaw).toISOString().slice(0,16); } catch(e){} }
    var key = title.toLowerCase() + '|' + dateStr.slice(0,10);
    if (existingKeys.has(key)) { skipped++; return; }

    // Try to match canvas course name to a subject
    var subId = '';
    var courseName = a.course || a.courseName || '';
    if (courseName) {
      (semesters || []).forEach(function(sem) {
        (sem.subjects || []).forEach(function(s) {
          if (!s.name) return;
          var sn = s.name.toLowerCase();
          var cn = courseName.toLowerCase();
          if (cn.indexOf(sn.slice(0,5)) >= 0 || sn.indexOf(cn.slice(0,5)) >= 0) subId = s.id;
        });
      });
    }

    var types = (a.submissionTypes || []).join(',');
    var type  = types.indexOf('quiz') >= 0 ? 'quiz'
              : types.indexOf('discussion') >= 0 ? 'project'
              : 'assignment';

    dls.push({
      id:      'dl_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),
      title:   title,
      date:    dateStr,
      course:  subId,
      weight:  a.points ? Math.min(20, Math.round(a.points / 10)) : 0,
      type:    type,
      done:    false,
      created: new Date().toISOString()
    });
    imported++;
    existingKeys.add(key);
  });

  saveDeadlines(dls);
  if (typeof renderDeadlines === 'function') renderDeadlines();

  // Close the panel
  var panel = document.getElementById('dl-canvas-status');
  if (panel) panel.style.display = 'none';

  var msg = '📅 Imported ' + imported + ' assignment(s) from Canvas!';
  if (skipped > 0) msg += ' (' + skipped + ' already added)';
  showToast(msg);
}

// abmStartListener is called from launchApp() after auth

function abmCopyCode() {
  var code = abmGetCode();
  if (navigator.clipboard) {
    navigator.clipboard.writeText(code).then(function(){ showToast('Bookmarklet code copied!'); });
  } else {
    var ta = document.createElement('textarea');
    ta.value = code; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove();
    showToast('Bookmarklet code copied!');
  }
}


/* ═══════════════════════════════════════════════════════════
   NEW FEATURES: GPA Goal Sim, Finals Survival, Panic Mode, Share Card
═══════════════════════════════════════════════════════════ */

// ── GPA Goal Simulator ─────────────────────────────────────────
function runGoalSim() {
  var target  = parseFloat(document.getElementById('gs-target').value) || 0;
  var done    = parseFloat(document.getElementById('gs-done').value);
  var rem     = parseFloat(document.getElementById('gs-rem').value);
  var res     = document.getElementById('gs-result');

  // Update header
  var curGPA = computeAllGPA ? (computeAllGPA().cumGPA || 0) : 0;
  var el = document.getElementById('goal-cur-gpa');
  if (el) el.textContent = curGPA.toFixed(2);
  var td = document.getElementById('goal-target-disp');
  if (td) td.textContent = target ? target.toFixed(2) : '—';
  var gd = document.getElementById('goal-gap-disp');
  if (gd) {
    var gap = target - curGPA;
    gd.textContent = (gap >= 0 ? '+' : '') + gap.toFixed(2);
    gd.style.color = gap <= 0 ? 'var(--green)' : 'var(--yellow)';
  }

  if (!target || isNaN(done) || isNaN(rem) || rem <= 0) { res.style.display = 'none'; return; }
  res.style.display = '';

  // Required avg GPA in remaining credits
  // target = (curGPA * done + reqAvg * rem) / (done + rem)
  var reqAvg = (target * (done + rem) - curGPA * done) / rem;

  var scale = GPA[0] ? GPA : [{l:'A',p:4.0},{l:'B',p:3.0},{l:'C',p:2.0},{l:'F',p:0}];
  var maxP  = scale[0].p;

  var verdict = document.getElementById('gs-verdict');
  if (reqAvg > maxP) {
    verdict.style.background = 'rgba(239,68,68,.12)';
    verdict.style.color = 'var(--red)';
    verdict.innerHTML = '⚠️ Not achievable — you\'d need a <strong>' + reqAvg.toFixed(2) + '</strong> average, which exceeds the ' + maxP.toFixed(1) + ' scale. Consider adjusting your goal or timeframe.';
  } else if (reqAvg <= 0) {
    verdict.style.background = 'rgba(52,211,153,.12)';
    verdict.style.color = 'var(--green)';
    verdict.innerHTML = '🎉 Already on track! Your current GPA of <strong>' + curGPA.toFixed(2) + '</strong> already meets or exceeds your goal.';
  } else {
    var pct = reqAvg / maxP * 100;
    var diff = reqAvg - curGPA;
    var color = pct < 70 ? 'rgba(52,211,153,.12)' : pct < 85 ? 'rgba(251,191,36,.12)' : 'rgba(239,68,68,.12)';
    var tc = pct < 70 ? 'var(--green)' : pct < 85 ? 'var(--yellow)' : 'var(--red)';
    verdict.style.background = color;
    verdict.style.color = tc;
    verdict.innerHTML = 'You need an average GPA of <strong>' + reqAvg.toFixed(2) + '</strong> across your remaining ' + rem + ' credits. That\'s ' + (diff > 0 ? '<strong>+' + diff.toFixed(2) + '</strong> above' : '<strong>' + diff.toFixed(2) + '</strong> below') + ' your current average.';
  }

  // Scenarios table
  var scenarios = [
    { label: '🏆 All A\'s', gpa: maxP },
    { label: '📈 Mostly A\'s', gpa: maxP * 0.925 },
    { label: '📊 A/B Mix', gpa: maxP * 0.85 },
    { label: '📉 Mostly B\'s', gpa: maxP * 0.75 },
    { label: '😰 B/C Mix', gpa: maxP * 0.65 },
  ];
  var scEl = document.getElementById('gs-scenarios');
  scEl.innerHTML = scenarios.map(function(sc) {
    var finalGPA = (curGPA * done + sc.gpa * rem) / (done + rem);
    var hit = finalGPA >= target;
    return '<div style="background:var(--surface2);border:1px solid var(--border2);border-radius:10px;padding:12px;text-align:center">'
      + '<div style="font-size:12px;font-weight:700;margin-bottom:6px">' + sc.label + '</div>'
      + '<div style="font-family:\'Clash Display\',sans-serif;font-weight:700;font-size:22px;color:' + (hit ? 'var(--green)' : 'var(--red)') + '">' + finalGPA.toFixed(2) + '</div>'
      + '<div style="font-size:10px;margin-top:4px;color:' + (hit ? 'var(--green)' : 'var(--red)') + '">' + (hit ? '✓ Reaches goal' : '✗ Below goal') + '</div>'
      + '</div>';
  }).join('');
}

// ── Finals Survival Plan ─────────────────────────────────────
function runFinalsSurvival() {
  var el = document.getElementById('fsp-content');
  var courses = [];
  (semesters || []).forEach(function(sem) {
    (sem.subjects || []).forEach(function(s) {
      var r = computeSubject(s);
      if (!r.remExams.length) return;
      // Calculate what score is needed on remaining exams for each grade
      var targets = r.targets || [];
      var bTarget = targets.find(function(t) { return t.l === 'B'; });
      var aTarget = targets.find(function(t) { return t.l === 'A'; });
      courses.push({
        name:    s.name,
        cur:     r.cur,
        curG:    r.curG,
        remExams: r.remExams,
        remFrac: r.remFrac,
        needForB: bTarget ? bTarget.avg : null,
        needForA: aTarget ? aTarget.avg : null,
      });
    });
  });

  if (!courses.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:13px">No courses with remaining exams found. Add courses and mark upcoming exams as not yet taken.</div>';
    return;
  }

  // Sort by urgency: lowest current grade first
  courses.sort(function(a, b) { return a.cur - b.cur; });

  // Allocate study hours proportionally to how much grade improvement is possible
  var totalStudyHours = 20;
  var weights = courses.map(function(c) { return Math.max(1, 100 - c.cur); });
  var totalW  = weights.reduce(function(a,b){return a+b;}, 0);

  el.innerHTML = courses.map(function(c, i) {
    var hrs  = Math.round(weights[i] / totalW * totalStudyHours);
    var urgency = c.cur < 70 ? '🔴 Critical' : c.cur < 80 ? '🟡 At Risk' : '🟢 On Track';
    var urgColor = c.cur < 70 ? 'var(--red)' : c.cur < 80 ? 'var(--yellow)' : 'var(--green)';
    var needB = c.needForB !== null ? (c.needForB > 100 ? '⚠️ Not possible' : c.needForB < 0 ? '✅ Already secured' : Math.round(c.needForB) + '%') : '—';
    var needA = c.needForA !== null ? (c.needForA > 100 ? '⚠️ Not possible' : c.needForA < 0 ? '✅ Already secured' : Math.round(c.needForA) + '%') : '—';
    return '<div style="background:var(--surface2);border:1px solid var(--border2);border-radius:12px;padding:16px;margin-bottom:10px">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'
        + '<div style="font-weight:700;font-size:14px">' + c.name + '</div>'
        + '<div style="font-size:12px;font-weight:700;color:' + urgColor + '">' + urgency + '</div>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;font-size:12px">'
        + '<div style="text-align:center"><div style="color:var(--muted);margin-bottom:2px">Current</div><div style="font-weight:700">' + Math.round(c.cur) + '% (' + c.curG.l + ')</div></div>'
        + '<div style="text-align:center"><div style="color:var(--muted);margin-bottom:2px">Need for B</div><div style="font-weight:700">' + needB + '</div></div>'
        + '<div style="text-align:center"><div style="color:var(--muted);margin-bottom:2px">Need for A</div><div style="font-weight:700">' + needA + '</div></div>'
        + '<div style="text-align:center;background:rgba(129,140,248,.1);border-radius:8px;padding:4px"><div style="color:var(--accent);margin-bottom:2px;font-weight:700">Study</div><div style="font-weight:700;color:var(--accent)">' + hrs + 'h</div></div>'
      + '</div>'
      + (i === 0 ? '<div style="margin-top:8px;font-size:11px;color:var(--accent);font-weight:600">👆 Focus here first — most impact on your GPA</div>' : '')
    + '</div>';
  }).join('');
}

// ── Panic Mode ────────────────────────────────────────────────
var _panicActive = false;

function activatePanicMode() {
  _panicActive = true;

  // Apply red theme to body
  document.body.classList.add('panic-mode');

  // Shake animation
  document.body.style.animation = 'panicShake 0.5s ease both';
  setTimeout(function(){ document.body.style.animation = ''; }, 500);

  // Show modal — use flex so it actually appears
  var modal = document.getElementById('panic-modal');
  modal.style.display = 'flex';
  modal.style.animation = 'panicFadeIn 0.3s ease both';

  // Restore cursor inside modal area (body has cursor:none)
  document.body.style.cursor = 'auto';

  // Render content
  renderPanicModalContent();
}

function deactivatePanicMode() {
  _panicActive = false;
  document.body.classList.remove('panic-mode');
  document.body.style.cursor = '';  // restore custom cursor:none from CSS
  var modal = document.getElementById('panic-modal');
  modal.style.display = 'none';
}

function renderPanicModalContent() {
  var el = document.getElementById('panic-modal-content');
  var courses = [];

  (semesters || []).forEach(function(sem) {
    (sem.subjects || []).forEach(function(s) {
      var r = computeSubject(s);
      if (!r.remExams || !r.remExams.length) return; // skip fully-done courses

      // Collect all grade targets
      var gradeMap = {};
      (r.targets || []).forEach(function(t) { gradeMap[t.l] = t.avg; });

      courses.push({
        name:     s.name,
        cur:      r.cur,
        curG:     r.curG,
        remExams: r.remExams,
        grades:   gradeMap,
      });
    });
  });

  // Also add courses with no remaining exams as a "locked" row
  var lockedCourses = [];
  (semesters || []).forEach(function(sem) {
    (sem.subjects || []).forEach(function(s) {
      var r = computeSubject(s);
      if (!r.remExams || r.remExams.length === 0) {
        lockedCourses.push({ name: s.name, curG: r.curG, cur: r.cur });
      }
    });
  });

  if (!courses.length && !lockedCourses.length) {
    el.innerHTML = '<div style="color:#f87171;font-size:14px;text-align:center;padding:24px">No courses found. Add some courses and exams first!</div>';
    return;
  }

  var gradeOrder = ['A','A-','B+','B','B-','C+','C','C-','D+','D','D-'];
  var gradeColors = {
    'A':'#34d399','A-':'#6ee7b7',
    'B+':'#60a5fa','B':'#60a5fa','B-':'#93c5fd',
    'C+':'#fbbf24','C':'#fbbf24','C-':'#fde68a',
    'D+':'#f87171','D':'#f87171','D-':'#fca5a5'
  };

  function fmtScore(val) {
    if (val === undefined || val === null) return '<span style="color:#6b7280">—</span>';
    if (val < 0) return '<span style="color:#34d399;font-weight:700">✓ Already secured</span>';
    if (val > 100) return '<span style="color:#f87171;font-weight:700">✗ Impossible</span>';
    var col = val > 90 ? '#f87171' : val > 75 ? '#fbbf24' : '#34d399';
    return '<span style="color:' + col + ';font-weight:800;font-size:15px">' + Math.ceil(val) + '%</span>';
  }

  var html = '';

  if (courses.length) {
    html += '<div style="margin-bottom:20px">';
    html += '<div style="font-family:\'Space Mono\',monospace;font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:#f87171;margin-bottom:12px">Courses With Remaining Exams</div>';

    courses.forEach(function(c) {
      var relevantGrades = gradeOrder.filter(function(g) { return c.grades[g] !== undefined; });
      if (!relevantGrades.length) relevantGrades = gradeOrder;

      html += '<div style="background:#200808;border:1px solid rgba(239,68,68,0.35);border-radius:16px;padding:20px;margin-bottom:14px">';

      // Course header
      html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">';
      html += '<div style="font-family:\'Clash Display\',sans-serif;font-weight:700;font-size:17px;color:#fff">' + c.name + '</div>';
      html += '<div style="display:flex;align-items:center;gap:10px">';
      html += '<div style="font-size:12px;color:#9ca3af">Current: <strong style="color:#f1f0ff">' + Math.round(c.cur) + '% (' + c.curG.l + ')</strong></div>';
      html += '<div style="font-size:11px;color:#f87171;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);border-radius:100px;padding:3px 10px;">' + c.remExams.length + ' exam' + (c.remExams.length > 1 ? 's' : '') + ' left</div>';
      html += '</div></div>';

      // Grade grid
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:8px">';
      relevantGrades.forEach(function(g) {
        var val = c.grades[g];
        var col = gradeColors[g] || '#9ca3af';
        html += '<div style="background:rgba(0,0,0,0.4);border:1px solid rgba(239,68,68,0.2);border-radius:10px;padding:10px 6px;text-align:center">';
        html += '<div style="font-family:\'Clash Display\',sans-serif;font-weight:800;font-size:16px;color:' + col + ';margin-bottom:4px">' + g + '</div>';
        html += '<div style="font-size:11px;color:#9ca3af;margin-bottom:2px">avg needed</div>';
        html += '<div style="font-size:13px">' + fmtScore(val) + '</div>';
        html += '</div>';
      });
      html += '</div>'; // end grade grid

      // Show remaining exams
      if (c.remExams.length > 0) {
        html += '<div style="margin-top:12px;font-size:11px;color:#9ca3af">';
        html += '<span style="color:#f87171;font-weight:700">Upcoming: </span>';
        html += c.remExams.map(function(e) {
          return '<span style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);border-radius:6px;padding:2px 8px;margin-right:4px;display:inline-block">' + e.name + ' (' + e.weight + '%)</span>';
        }).join('');
        html += '</div>';
      }

      html += '</div>'; // end course card
    });

    html += '</div>';
  }

  if (lockedCourses.length) {
    html += '<div>';
    html += '<div style="font-family:\'Space Mono\',monospace;font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:#6b7280;margin-bottom:10px">Grade Locked (No Exams Remaining)</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px">';
    lockedCourses.forEach(function(c) {
      html += '<div style="background:#150303;border:1px solid rgba(239,68,68,0.15);border-radius:12px;padding:12px;display:flex;align-items:center;justify-content:space-between">';
      html += '<div style="font-size:13px;color:#9ca3af;font-weight:600">' + c.name + '</div>';
      html += '<div style="font-family:\'Clash Display\',sans-serif;font-weight:800;font-size:16px;color:#34d399">✓ ' + c.curG.l + '</div>';
      html += '</div>';
    });
    html += '</div></div>';
  }

  el.innerHTML = html;
}

// Legacy kept for compatibility
function runPanicMode() { activatePanicMode(); }

// ── Shareable GPA Card ─────────────────────────────────────────
function openShareCard() {
  var modal = document.getElementById('share-card-modal');
  if (!modal) return;
  modal.style.display = 'flex';

  var allGPA = computeAllGPA ? computeAllGPA() : null;
  var curSem = semesters && semesters.length ? semesters[semesters.length-1] : null;

  document.getElementById('sc-gpa').textContent = allGPA ? (allGPA.cumGPA||0).toFixed(2) : '—';
  document.getElementById('sc-semester').textContent = curSem ? (curSem.name || 'Current Semester') : 'Cumulative GPA';

  if (curSem) {
    var lines = (curSem.subjects || []).map(function(s) {
      var r = computeSubject(s);
      return '<div>' + r.curG.l + '&nbsp;&nbsp;' + s.name + '</div>';
    }).join('');
    document.getElementById('sc-courses').innerHTML = lines;
  }
}

function copyShareCard() {
  showToast('📸 Screenshot this card and share it!');
}

// ── Smart Study Plan ─────────────────────────────────────────
function generateSmartStudyPlan() {
  var btn = document.getElementById('ssp-btn');
  var out = document.getElementById('ssp-output');
  if (!btn || !out) return;

  btn.disabled = true;
  btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin 1s linear infinite"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Generating...';

  // Collect all subjects across semesters
  var courses = [];
  (semesters || []).forEach(function(sem) {
    (sem.subjects || []).forEach(function(s) {
      var r = computeSubject(s);
      var gradeMap = {};
      (r.targets || []).forEach(function(t) { gradeMap[t.l] = t.avg; });

      var status, urgency, color, emoji;
      var hasRem = r.remExams && r.remExams.length > 0;

      if (!hasRem) {
        status = 'locked';
        urgency = 0;
        emoji = '✅';
        color = '#34d399';
      } else {
        var needA = gradeMap['A'];
        var needB = gradeMap['B'];
        var needC = gradeMap['C'];
        var needD = gradeMap['D'];

        if (needD !== undefined && needD > 100) {
          status = 'critical'; urgency = 100; emoji = '🔴'; color = '#ef4444';
        } else if (needC !== undefined && needC > 100) {
          status = 'danger'; urgency = 85; emoji = '🟠'; color = '#f97316';
        } else if (needB !== undefined && needB > 100) {
          status = 'tough'; urgency = 60; emoji = '🟡'; color = '#fbbf24';
        } else if (needA !== undefined && needA > 100) {
          status = 'recoverable'; urgency = 35; emoji = '🔵'; color = '#60a5fa';
        } else {
          status = 'good'; urgency = 10; emoji = '🟢'; color = '#34d399';
        }
      }

      courses.push({
        name: s.name,
        credits: s.credits || 3,
        cur: r.cur,
        curG: r.curG,
        remExams: r.remExams || [],
        grades: gradeMap,
        status: status,
        urgency: urgency,
        emoji: emoji,
        color: color,
        hasRem: hasRem,
        semName: sem.name,
      });
    });
  });

  if (!courses.length) {
    out.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:16px;text-align:center">No courses found. Add some subjects first!</div>';
    btn.disabled = false;
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Generate My Study Plan';
    return;
  }

  // Sort by urgency desc
  courses.sort(function(a, b) { return b.urgency - a.urgency; });

  var activeCourses = courses.filter(function(c) { return c.hasRem; });
  var lockedCourses = courses.filter(function(c) { return !c.hasRem; });

  function fmtNeeded(val, grade) {
    if (val === undefined || val === null) return null;
    if (val <= 0) return '<span style="color:#34d399;font-weight:700">✓ Already secured</span>';
    if (val > 100) return '<span style="color:#f87171;font-weight:700">✗ Not achievable</span>';
    var col = val >= 90 ? '#f87171' : val >= 75 ? '#fbbf24' : '#34d399';
    return 'need <strong style="color:' + col + '">' + Math.ceil(val) + '%</strong> for ' + grade;
  }

  var html = '';

  // Header summary
  var critCount = activeCourses.filter(function(c){ return c.status==='critical'||c.status==='danger'; }).length;
  var goodCount = activeCourses.filter(function(c){ return c.status==='good'; }).length;

  html += '<div style="background:rgba(129,140,248,0.06);border:1px solid rgba(129,140,248,0.2);border-radius:14px;padding:16px 20px;margin-bottom:20px">';
  html += '<div style="font-family:\'Clash Display\',sans-serif;font-weight:700;font-size:15px;margin-bottom:8px;color:var(--text)">📋 Your Study Situation</div>';
  html += '<div style="font-size:13px;color:var(--muted2);line-height:1.8">';
  html += 'You have <strong style="color:var(--text)">' + activeCourses.length + ' course' + (activeCourses.length!==1?'s':'') + '</strong> with upcoming exams. ';
  if (critCount > 0) {
    html += '<strong style="color:#ef4444">' + critCount + ' need urgent attention.</strong> ';
  }
  if (goodCount > 0) {
    html += goodCount + ' are in good shape — focus your energy elsewhere.';
  }
  html += '</div></div>';

  // Priority list
  if (activeCourses.length > 0) {
    html += '<div style="font-family:\'Space Mono\',monospace;font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);margin-bottom:12px">Study Priority Order</div>';

    activeCourses.forEach(function(c, i) {
      var needA = fmtNeeded(c.grades['A'], 'A');
      var needB = fmtNeeded(c.grades['B'], 'B');
      var needC = fmtNeeded(c.grades['C'], 'C');
      var needD = fmtNeeded(c.grades['D'], 'D (pass)');

      // Verdict sentence
      var verdict = '';
      if (c.status === 'critical') {
        verdict = 'Passing this course is at risk — every point counts right now.';
      } else if (c.status === 'danger') {
        verdict = 'A C is in jeopardy. Push hard on upcoming exams.';
      } else if (c.status === 'tough') {
        verdict = 'Still recoverable — a strong exam performance can pull this up.';
      } else if (c.status === 'recoverable') {
        verdict = 'Solid standing — an A is out of reach but B or higher is very achievable.';
      } else {
        verdict = 'You\'re in great shape here. Maintain momentum.';
      }

      html += '<div style="background:var(--surface2);border:1px solid var(--border2);border-radius:14px;padding:18px;margin-bottom:10px;border-left:3px solid ' + c.color + '">';
      html += '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px">';
      html += '<div>';
      html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">';
      html += '<span style="font-size:16px">' + c.emoji + '</span>';
      html += '<span style="font-family:\'Clash Display\',sans-serif;font-weight:700;font-size:16px">' + c.name + '</span>';
      html += '<span style="background:rgba(0,0,0,0.2);border-radius:100px;padding:2px 8px;font-size:10px;font-weight:700;color:' + c.color + '">' + c.status.toUpperCase() + '</span>';
      html += '</div>';
      html += '<div style="font-size:12px;color:var(--muted2)">' + verdict + '</div>';
      html += '</div>';
      html += '<div style="text-align:right;flex-shrink:0">';
      html += '<div style="font-size:10px;color:var(--muted);margin-bottom:2px">Current</div>';
      html += '<div style="font-family:\'Clash Display\',sans-serif;font-weight:800;font-size:20px;color:' + c.color + '">' + Math.round(c.cur) + '%</div>';
      html += '<div style="font-size:11px;color:var(--muted)">' + c.curG.l + ' grade</div>';
      html += '</div>';
      html += '</div>';

      // Grade targets row
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:10px">';
      [['A','#34d399'],['B','#60a5fa'],['C','#fbbf24'],['D','#f87171']].forEach(function(pair) {
        var g = pair[0], col = pair[1];
        var val = c.grades[g];
        if (val === undefined) return;
        var display;
        if (val <= 0) display = '<span style="color:#34d399;font-size:12px;font-weight:700">✓ Already secured</span>';
        else if (val > 100) display = '<span style="color:#f87171;font-size:12px;font-weight:700">✗ Not achievable</span>';
        else display = '<span style="color:' + (val>=90?'#f87171':val>=75?'#fbbf24':'#34d399') + ';font-size:14px;font-weight:800">' + Math.ceil(val) + '%</span><span style="font-size:11px;color:var(--muted)"> avg needed</span>';
        html += '<div style="background:var(--surface3);border-radius:10px;padding:8px 10px;text-align:center">';
        html += '<div style="font-family:\'Clash Display\',sans-serif;font-weight:800;font-size:14px;color:' + col + ';margin-bottom:3px">' + g + '</div>';
        html += '<div>' + display + '</div>';
        html += '</div>';
      });
      html += '</div>';

      // Upcoming exams
      if (c.remExams.length > 0) {
        html += '<div style="font-size:11px;color:var(--muted);margin-top:4px"><span style="color:var(--accent);font-weight:600">Upcoming: </span>';
        html += c.remExams.map(function(e){
          return '<span style="background:rgba(129,140,248,0.1);border:1px solid rgba(129,140,248,0.2);border-radius:6px;padding:2px 8px;margin-right:4px;display:inline-block">' + e.name + ' (' + e.weight + '%)</span>';
        }).join('');
        html += '</div>';
      }

      // Focus tip for #1 priority
      if (i === 0 && c.status !== 'good') {
        html += '<div style="margin-top:10px;padding:8px 12px;background:rgba(129,140,248,0.08);border-radius:8px;font-size:12px;color:var(--accent);font-weight:600">👆 Start here — this is your highest priority right now.</div>';
      }

      html += '</div>';
    });
  }

  // Locked / done courses
  if (lockedCourses.length > 0) {
    html += '<div style="font-family:\'Space Mono\',monospace;font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);margin-bottom:10px;margin-top:8px">Grade Locked — No Action Needed</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px">';
    lockedCourses.forEach(function(c) {
      html += '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between">';
      html += '<div style="font-size:13px;font-weight:600;color:var(--muted2)">' + c.name + '</div>';
      html += '<div style="font-family:\'Clash Display\',sans-serif;font-weight:800;font-size:16px;color:#34d399">✓ ' + c.curG.l + '</div>';
      html += '</div>';
    });
    html += '</div>';
  }

  out.innerHTML = html;
  btn.disabled = false;
  btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Regenerate Plan';
}

// goal sim inits via showTab and updateStats hooks

// ══════════════════════════════════════════════════════════════