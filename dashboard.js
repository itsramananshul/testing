// ══════════════════════════════════════════════════════════════
// POLICIES
// ══════════════════════════════════════════════════════════════
function loadPolicies() {
  try {
    const stored = localStorage.getItem('gradintel-policies-'+currentUser.id);
    if (stored) policies = { ...policies, ...JSON.parse(stored) };
  } catch(e) {}
  GPA = GPA_SCALES[policies.scale] || GPA_SCALES['4.0'];
  renderPoliciesUI();
}
function savePolicy() {
  policies.scale = document.querySelector('.scale-pill.on')?.dataset.scale || '4.0';
  policies.replace = document.getElementById('pol-replace')?.checked || false;
  policies.pnp = document.getElementById('pol-pnp')?.checked || false;
  policies.withdraw = document.getElementById('pol-withdraw')?.checked !== false;
  policies.weighted = document.getElementById('pol-weighted')?.checked || false;
  policies.goalGpa = parseFloat(document.getElementById('goal-gpa')?.value) || 0;
  policies.goalCredits = parseFloat(document.getElementById('goal-credits')?.value) || 0;
  GPA = GPA_SCALES[policies.scale] || GPA_SCALES['4.0'];
  if (currentUser) localStorage.setItem('gradintel-policies-'+currentUser.id, JSON.stringify(policies));
  updateStats(); renderDashboard();
}
function renderPoliciesUI() {
  const sp = document.getElementById('scale-pills');
  if (!sp) return;
  sp.innerHTML = Object.keys(GPA_SCALES).map(k =>
    `<div class="scale-pill ${k===policies.scale?'on':''}" data-scale="${k}" onclick="selectScale('${k}')">${k} Scale</div>`
  ).join('');
  const setChk = (id, val) => { const el=document.getElementById(id); if(el) el.checked=val; };
  setChk('pol-replace', policies.replace);
  setChk('pol-pnp', policies.pnp);
  setChk('pol-withdraw', policies.withdraw);
  setChk('pol-weighted', policies.weighted);
  const setInp = (id, val) => { const el=document.getElementById(id); if(el&&val) el.value=val; };
  setInp('goal-gpa', policies.goalGpa || '');
  setInp('goal-credits', policies.goalCredits || '');
}
function selectScale(k) {
  document.querySelectorAll('.scale-pill').forEach(p => p.classList.toggle('on', p.dataset.scale===k));
  policies.scale = k;
  GPA = GPA_SCALES[k];
  savePolicy();
  showToast(`✅ Switched to ${k} GPA scale`);
}

// ══════════════════════════════════════════════════════════════
// ONBOARDING
// ══════════════════════════════════════════════════════════════
let obMode = null;
function selectObMode(m) {
  obMode = m;
  document.getElementById('mc-fresh').classList.toggle('sel', m==='fresh');
  document.getElementById('mc-existing').classList.toggle('sel', m==='existing');
  const btn = document.getElementById('ob1-next');
  btn.disabled = false; btn.style.opacity = '1';
}
function obNext() {
  document.getElementById('ob-1').classList.remove('show');
  document.getElementById('ob-2').classList.add('show');
  if (obMode === 'fresh') {
    document.getElementById('ob2-title').textContent = "You're all set!";
    document.getElementById('ob2-sub').textContent = 'Everything is ready. Start adding subjects when you\'re ready.';
    document.getElementById('ob2-fields').classList.add('hidden');
    document.getElementById('ob2-fresh').classList.remove('hidden');
  } else {
    document.getElementById('ob2-fields').classList.remove('hidden');
    document.getElementById('ob2-fresh').classList.add('hidden');
  }
}
function obBack() {
  document.getElementById('ob-2').classList.remove('show');
  document.getElementById('ob-1').classList.add('show');
}
async function obFinish() {
  const btn = document.getElementById('ob2-finish');
  btn.disabled = true; btn.textContent = '⏳ Saving...';
  const meta = currentUser.user_metadata || {};
  const profileData = {
    user_id: currentUser.id,
    full_name: meta.full_name || '',
    university: meta.university || '',
    mode: obMode,
    start_gpa: obMode === 'existing' ? (parseFloat(document.getElementById('ob-gpa').value)||0) : 0,
    start_credits: obMode === 'existing' ? (parseFloat(document.getElementById('ob-credits').value)||0) : 0,
    start_sems: obMode === 'existing' ? (parseInt(document.getElementById('ob-sems').value)||0) : 0,
  };
  const { data, error } = await sb.from('gpa_profiles').insert(profileData).select().single();
  if (error) { btn.disabled=false; btn.textContent='Start Tracking →'; showToast('Error: '+error.message); return; }
  profile = data;
  document.getElementById('ob-wrap').classList.add('hidden');
  loadPolicies();
  launchApp();
}

// ══════════════════════════════════════════════════════════════
// LAUNCH
// ══════════════════════════════════════════════════════════════
function launchApp() {
  document.getElementById('app').style.display = 'block';
  document.getElementById('gv3-sb').style.display = 'flex';
  document.getElementById('ai-bubble').style.display = 'flex';
  document.getElementById('gv3-mob-btn').style.display = '';
  document.getElementById('gv3-mob-overlay').style.display = '';
  setTimeout(function(){ if(typeof abmStartListener==='function') abmStartListener(); if(typeof abmInitLink==='function') abmInitLink(); }, 500);
  const name = (profile.full_name||'').split(' ')[0] || 'Student';
  document.getElementById('uav').textContent = (profile.full_name||'?')[0].toUpperCase();
  document.getElementById('uname-display').textContent = name;
  document.getElementById('hero-h').textContent = `Welcome back, ${name}! 👋`;
  document.getElementById('hero-p').textContent = profile.university
    ? `${profile.university} · GPA Dashboard`
    : 'Your GPA Dashboard · Works on any device';
  document.getElementById('anno-br').innerHTML = `GRADINTEL<br/>${name.toUpperCase()}_ONLINE`;
  examDates = JSON.parse(localStorage.getItem('gradintel-dates-'+(currentUser?.id||'')) || '{}');
  updateStats();
  renderDashboard();
  renderCourses();
  renderWIFull();
  renderStudy();
  renderROI();
  initAnimations();
  // Restore last active tab (default: dashboard)
  const lastTab = localStorage.getItem('gradintel_active_tab') || 'dashboard';
  showTab(lastTab);
  // Show exam reminders after a short delay so the UI settles first
  setTimeout(showExamReminders, 1800);
}

// ══════════════════════════════════════════════════════════════
// COMPUTE — only counts TAKEN exams for current score
// ══════════════════════════════════════════════════════════════
function computeSubject(s) {
  const op = s.other_pct / 100;
  const os = s.other_score / 100;
  // Each exam.weight is now an ABSOLUTE % of total course grade (not relative to exam_pct)
  let earned = op * os;
  let totalTakenWeight = 0; // as absolute fractions
  let remW = 0;
  (s.exams || []).forEach(e => {
    const wf = e.weight / 100; // absolute fraction of total course
    if (e.taken && e.score !== null) {
      earned += wf * (e.score / 100);
      totalTakenWeight += wf;
    } else {
      remW += wf;
    }
  });
  // cur = score based only on taken portions (not projecting untaken)
  const takenFrac = op + totalTakenWeight;
  const cur = takenFrac > 0 ? (earned / takenFrac) * 100 : 0;
  const curG = pctToG(cur);
  const remFrac = remW; // absolute fraction remaining
  const ep = s.exam_pct / 100; // kept for display but not used in core calc
  const remExams = (s.exams || []).filter(e => !e.taken).map(e => ({ name: e.name, weight: e.weight, gf: e.weight / 100, id: e.id }));
  const takenExams = (s.exams || []).filter(e => e.taken).map(e => ({ name: e.name, weight: e.weight, score: e.score, id: e.id }));

  // For targets: project what final score would be
  let e2 = op * os;
  (s.exams||[]).forEach(e => { if(e.taken && e.score!==null) e2 += (e.weight/100)*(e.score/100); });
  const curAbsolute = e2 * 100; // absolute score so far as fraction of 100%

  const targets = GPA.map(g => {
    const avg = remFrac < 0.001 ? null : (g.m - curAbsolute) / (remFrac * 100) * 100;
    const perExam = remExams.map(ex => {
      const of = remFrac - ex.gf;
      const assumed = avg === null || avg > 100 ? 75 : Math.max(0, Math.min(100, avg));
      const oc = of * (assumed / 100) * 100;
      const nd = ex.gf < 0.001 ? null : (g.m - curAbsolute - oc) / (ex.gf * 100) * 100;
      return { name: ex.name, gf: ex.gf, needed: nd, id: ex.id };
    });
    return { ...g, avg, perExam };
  });

  return { cur, curG, remFrac, remExams, takenExams, targets, curAbsolute };
}

function computeAllGPA() {
  let totalCP = 0, totalCR = 0, totalSubjs = 0, totalExams = 0;
  if (profile.mode === 'existing' && profile.start_gpa > 0) {
    totalCP += profile.start_gpa * profile.start_credits;
    totalCR += profile.start_credits;
  }
  semesters.forEach(sem => {
    let semCP = 0, semCR = 0;
    (sem.subjects || []).forEach(s => {
      if (s.status === 'W' && policies.withdraw) return; // skip withdrawals
      if (s.status === 'P' && policies.pnp) { totalCR += s.credits; return; } // P/NP
      const res = computeSubject(s);
      totalCP += s.credits * res.curG.p; totalCR += s.credits;
      semCP += s.credits * res.curG.p; semCR += s.credits;
      totalSubjs++;
      totalExams += (s.exams || []).filter(e => e.taken).length;
    });
    sem._gpa = semCR ? semCP / semCR : 0;
  });
  return { cumGPA: totalCR ? totalCP / totalCR : 0, totalCR, totalSubjs, totalExams };
}

function updateStats() {
  const { cumGPA, totalCR, totalSubjs } = computeAllGPA();
  const cl = closestL(cumGPA); const col = gCol(cl);
  const gpaEl = document.getElementById('ds-gpa');
  gpaEl.textContent = cumGPA > 0 ? cumGPA.toFixed(4) : '—';
  gpaEl.dataset.val = gpaEl.textContent;
  gpaEl.style.color = cumGPA > 0 ? col : 'var(--muted)';
  document.getElementById('ds-gpa-sub').textContent = cumGPA > 0 ? `${cl} · ${policies.scale} scale` : 'No data yet';
  const sem = semesters[semesters.length - 1];
  if (sem) {
    document.getElementById('ds-sem').textContent = (sem._gpa || 0).toFixed(4);
    document.getElementById('ds-sem').style.color = gCol(closestL(sem._gpa || 0));
    document.getElementById('ds-sem-sub').textContent = sem.name;
  }
  document.getElementById('ds-subjs').textContent = totalSubjs;
  document.getElementById('ds-credits').textContent = totalCR.toFixed(0);
  document.getElementById('ds-credits-sub').textContent = policies.goalCredits ? `of ${policies.goalCredits} target` : 'total';
  renderGoalRing(cumGPA, totalCR);
  renderRiskCenter();
  // Update goal sim header
  try {
    var gcEl = document.getElementById('goal-cur-gpa');
    if (gcEl) gcEl.textContent = cumGPA.toFixed(2);
  } catch(e){}
}

// ══════════════════════════════════════════════════════════════
// GOAL RING
// ══════════════════════════════════════════════════════════════
function renderGoalRing(cumGPA, totalCR) {
  const el = document.getElementById('goal-ring-section');
  if (!policies.goalGpa || policies.goalGpa <= 0) { el.innerHTML = ''; return; }
  const pct = Math.min(1, cumGPA / policies.goalGpa);
  const r = 36, cx = 44, cy = 44, stroke = 7;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;
  const col = cumGPA >= policies.goalGpa ? '#34d399' : cumGPA >= policies.goalGpa * 0.8 ? '#fbbf24' : '#f87171';
  const semNeeded = computeSemNeeded(cumGPA, totalCR);
  el.innerHTML = `<div class="goal-ring-wrap">
    <svg class="goal-ring-svg" width="88" height="88" viewBox="0 0 88 88">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="${stroke}"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${col}" stroke-width="${stroke}"
        stroke-dasharray="${dash} ${circ}" stroke-dashoffset="${circ/4}" stroke-linecap="round"
        style="transition:stroke-dasharray 1s ease"/>
      <text x="${cx}" y="${cy-4}" text-anchor="middle" fill="${col}" font-family="'Clash Display',sans-serif" font-weight="700" font-size="13">${(pct*100).toFixed(0)}%</text>
      <text x="${cx}" y="${cy+12}" text-anchor="middle" fill="#6b7280" font-size="9">of goal</text>
    </svg>
    <div class="goal-ring-info">
      <div class="goal-ring-title">GPA Goal: ${policies.goalGpa.toFixed(2)}</div>
      <div class="goal-ring-sub" style="margin-bottom:6px">Current: <strong style="color:${col}">${cumGPA.toFixed(4)}</strong>${cumGPA>=policies.goalGpa?' 🎉 Goal reached!':` · Need ${(policies.goalGpa-cumGPA).toFixed(4)} more`}</div>
      ${semNeeded ? `<div class="goal-ring-sub">Need <strong>${semNeeded}</strong> this semester to stay on track</div>` : ''}
    </div>
  </div>`;
}
function computeSemNeeded(cumGPA, totalCR) {
  if (!policies.goalGpa || !policies.goalCredits) return null;
  const remainCR = policies.goalCredits - totalCR;
  if (remainCR <= 0) return null;
  const needed = (policies.goalGpa * policies.goalCredits - cumGPA * totalCR) / remainCR;
  if (needed <= 0) return 'Any GPA';
  const maxGPA = Math.max(...GPA.map(g=>g.p));
  if (needed > maxGPA) return 'Not achievable';
  return `${needed.toFixed(2)} GPA`;
}

// ══════════════════════════════════════════════════════════════
// AT RISK CENTER
// ══════════════════════════════════════════════════════════════
function renderRiskCenter() {
  const el = document.getElementById('risk-center');
  const risks = [];
  semesters.forEach(sem => {
    (sem.subjects || []).forEach(s => {
      const res = computeSubject(s);
      if (res.remExams.length > 0) {
        const bTarget = res.targets.find(t => t.l === 'B') || res.targets[3];
        const allImpossible = bTarget && bTarget.perExam.every(e => e.needed !== null && e.needed > 100);
        const cTarget = res.targets.find(t => t.l === 'C');
        const cImpossible = cTarget && cTarget.perExam.every(e => e.needed !== null && e.needed > 100);
        if (cImpossible) {
          risks.push({ name: s.name, sem: sem.name, msg: 'Passing grade (C) is at risk — all remaining marks needed', level: 'critical' });
        } else if (allImpossible) {
          risks.push({ name: s.name, sem: sem.name, msg: 'B grade is no longer achievable — focus on locking in a C+', level: 'warn' });
        }
      }
    });
  });
  if (!risks.length) { el.innerHTML = ''; return; }
  el.innerHTML = risks.map(r => `
    <div class="risk-card">
      <div class="risk-ico">${r.level==='critical'?`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`:`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`}</div>
      <div>
        <div class="risk-name">${r.name} <span style="font-size:11px;font-weight:400;color:var(--muted)">· ${r.sem}</span></div>
        <div class="risk-msg">${r.msg}</div>
      </div>
    </div>`).join('');
}

// ══════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════
function renderDashboard() {
  const banner = document.getElementById('dash-banner');
  const list = document.getElementById('dash-list');
  banner.innerHTML = ''; list.innerHTML = '';
  if (!semesters.length) {
    list.innerHTML = `<div class="infobox" style="text-align:center;padding:24px">No subjects yet. Go to <strong>Add Subject</strong> to start! 🚀</div>`;
    document.getElementById('dash-chart-card').style.display = 'none'; return;
  }
  const sem = semesters[semesters.length - 1];
  banner.innerHTML = `<div class="infobox" style="margin-bottom:16px">
    📆 <strong>${sem.name}</strong> · ${(sem.subjects || []).length} subject${(sem.subjects || []).length !== 1 ? 's' : ''} ·
    <span style="color:var(--accent3)">${sem._gpa ? sem._gpa.toFixed(4) + ' GPA' : ''}</span>
    &nbsp;<span class="sync-badge" style="display:inline-flex"><span class="sync-dot"></span>Cloud Synced</span>
  </div>`;
  (sem.subjects || []).forEach(s => {
    const res = computeSubject(s); const col = gCol(res.curG.l);
    const rem = res.remExams.length;
    const card = document.createElement('div'); card.className = 'course-item';
    card.innerHTML = `<div class="ci-ico"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/><line x1="10" y1="7" x2="16" y2="7"/><line x1="10" y1="11" x2="14" y2="11"/></svg></div>
      <div class="ci-info">
        <div class="ci-name">${s.name}${s.status==='W'?' <span style="color:var(--muted);font-size:11px">[W]</span>':s.status==='P'?' <span style="color:var(--accent3);font-size:11px">[P/NP]</span>':''}</div>
        <div class="ci-meta">${s.credits} cr · ${rem > 0 ? `<span style="color:var(--yellow)">${rem} exam${rem !== 1 ? 's' : ''} remaining</span>` : '<span style="color:var(--green)">All done ✓</span>'}</div>
      </div>
      <div class="ci-grade" style="color:${col}">${res.curG.l}</div>
      <div class="ci-actions">
        ${rem > 0 ? `<button class="ca-btn" onclick="openAddScore('${sem.id}','${s.id}')" title="Add score"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>` : ''}
        <button class="ca-btn" onclick="openEditSubject('${sem.id}','${s.id}')" title="Edit subject"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="ca-btn" onclick="viewDetail('${sem.id}','${s.id}')" title="Details"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
      </div>`;
    list.appendChild(card);
  });
  buildTrendChart();
  document.getElementById('dash-chart-card').style.display = 'block';
}

// ══════════════════════════════════════════════════════════════
// COURSES TAB
// ══════════════════════════════════════════════════════════════
function renderCourses() {
  const sf = document.getElementById('sem-filter');
  const cl = document.getElementById('courses-list');
  sf.innerHTML = ''; cl.innerHTML = '';
  if (!semesters.length) { cl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">No courses yet.</div>'; return; }
  const row = document.createElement('div'); row.className = 'chip-row';
  semesters.forEach((sem, i) => {
    const chip = document.createElement('div');
    chip.className = 'chip' + (i === semesters.length - 1 ? ' on' : '');
    chip.textContent = sem.name;
    chip.onclick = () => { row.querySelectorAll('.chip').forEach(c => c.classList.remove('on')); chip.classList.add('on'); renderSemCourses(sem.id); };
    row.appendChild(chip);
  });
  sf.appendChild(row);
  renderSemCourses(semesters[semesters.length - 1].id);
}
function renderSemCourses(semId) {
  const sem = semesters.find(s => s.id === semId);
  const cl = document.getElementById('courses-list'); cl.innerHTML = '';
  if (!sem || (sem.subjects || []).length === 0) { cl.innerHTML = '<div style="text-align:center;padding:30px;color:var(--muted)">No subjects in this semester.</div>'; return; }
  sem.subjects.forEach(s => {
    const res = computeSubject(s); const col = gCol(res.curG.l);
    const card = document.createElement('div'); card.className = 'course-item';
    card.innerHTML = `<div class="ci-ico"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/><line x1="10" y1="7" x2="16" y2="7"/><line x1="10" y1="11" x2="14" y2="11"/></svg></div>
      <div class="ci-info">
        <div class="ci-name">${s.name}${s.status==='W'?' <span style="color:var(--muted);font-size:11px">[W]</span>':s.status==='P'?' <span style="color:var(--accent3);font-size:11px">[P/NP]</span>':''}</div>
        <div class="ci-meta">${s.credits} cr · ${res.cur.toFixed(1)}% (taken only) · ${res.remExams.length > 0 ? `${res.remExams.length} exams remaining` : 'All exams taken'}</div>
      </div>
      <div class="ci-grade" style="color:${col}">${res.curG.l}</div>
      <div class="ci-actions">
        ${res.remExams.length > 0 ? `<button class="ca-btn" onclick="openAddScore('${sem.id}','${s.id}')" title="Add score"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>` : ''}
        <button class="ca-btn" onclick="openEditSubject('${sem.id}','${s.id}')" title="Edit"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="ca-btn" onclick="viewDetail('${sem.id}','${s.id}')" title="Details"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
        <button class="ca-btn" onclick="deleteCourse('${sem.id}','${s.id}')" title="Delete" style="color:var(--red)">🗑</button>
      </div>`;
    cl.appendChild(card);
  });
}

// ══════════════════════════════════════════════════════════════
// EDIT SUBJECT (full edit modal)
// ══════════════════════════════════════════════════════════════
function openEditSubject(semId, subjectId) {
  const sem = semesters.find(s => s.id === semId);
  const s = sem.subjects.find(x => x.id === subjectId);
  editCtx = { semId, subjectId };
  document.getElementById('edit-modal-title').textContent = `Edit — ${s.name}`;
  const icos = ['<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>','<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>','<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>','<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/></svg>','<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>','<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>','<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>','<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18h8M3 22h18M14 22a7 7 0 007-7H7a7 7 0 007 7z"/><path d="M9 3l1 8"/><path d="M17 3l-1 8"/><line x1="9" y1="3" x2="17" y2="3"/></svg>'];
  document.getElementById('edit-modal-body').innerHTML = `
    <div class="field-row">
      <div class="field"><label>Subject Name</label><input type="text" id="ed-name" value="${s.name}"/></div>
      <div class="field"><label>Credits</label><input type="number" id="ed-cr" value="${s.credits}" min=".5" max="12" step=".5"/></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Other Stuff %</label><input type="number" id="ed-op" value="${s.other_pct}" min="0" max="100" oninput="edUpdEP()"/></div>
      <div class="field"><label>Exam % Total (live)</label><input type="number" id="ed-ep" value="${s.exam_pct}" readonly style="opacity:.4;cursor:not-allowed"/></div>
    </div>
    <div class="field"><label>Other Stuff Score (out of 100)</label><input type="number" id="ed-os" value="${s.other_score}" min="0" max="100"/></div>
    <div class="field"><label>Course Status</label>
      <select id="ed-status">
        <option value="normal" ${!s.status||s.status==='normal'?'selected':''}>Normal</option>
        <option value="W" ${s.status==='W'?'selected':''}>Withdrawal (W)</option>
        <option value="P" ${s.status==='P'?'selected':''}>Pass/No Pass (P/NP)</option>
      </select>
    </div>
    <div class="divider"></div>
    <div style="font-family:'Clash Display',sans-serif;font-weight:700;font-size:13px;color:var(--muted2);letter-spacing:.1em;text-transform:uppercase;margin-bottom:12px">Exams</div>
    <div id="ed-exams">
      ${(s.exams || []).map((e, i) => `
        <div class="exam-card" id="ed-exam-${i}">
          <div class="exam-card-hdr">
            <div class="exam-badge">${icos[i%icos.length]} Exam ${i+1}</div>
            <button onclick="removeEdExam(${i})" style="background:transparent;border:none;color:var(--red);cursor:pointer;font-size:13px">Remove</button>
          </div>
          <div class="field-row-3">
            <div class="field"><label>Name</label><input type="text" id="ed-en-${i}" value="${e.name}"/></div>
            <div class="field"><label>Weight (% of total course)</label><input type="number" id="ed-ew-${i}" value="${e.weight.toFixed(1)}" min="0" max="100" oninput="edUpdEP()"/></div>
            <div class="field"><label>Taken?</label>
              <select id="ed-et-${i}" onchange="edTogSc(${i})">
                <option value="no" ${!e.taken?'selected':''}>Not yet</option>
                <option value="yes" ${e.taken?'selected':''}>Yes</option>
              </select>
            </div>
          </div>
          <div class="field" id="ed-esf-${i}" style="${e.taken?'':'display:none'}">
            <label>Score (out of 100)</label>
            <input type="number" id="ed-es-${i}" value="${e.taken?e.score:''}" min="0" max="100"/>
          </div>
        </div>`).join('')}
    </div>
    <button class="btn btn-ghost" onclick="addEdExam()" style="width:100%;margin-top:6px">+ Add Exam</button>
  `;
  document.getElementById('edit-modal').classList.add('show');
}
function edUpdEP() {
  let total = 0;
  document.querySelectorAll('#ed-exams .exam-card').forEach((card, i) => {
    total += parseFloat(document.getElementById(`ed-ew-${i}`)?.value) || 0;
  });
  const epEl = document.getElementById('ed-ep');
  if (epEl) epEl.value = total.toFixed(1);
}
function edTogSc(i) { document.getElementById(`ed-esf-${i}`).style.display=document.getElementById(`ed-et-${i}`).value==='yes'?'block':'none'; }
function removeEdExam(i) { document.getElementById(`ed-exam-${i}`)?.remove(); }
function addEdExam() {
  const wrap = document.getElementById('ed-exams');
  const idx = wrap.querySelectorAll('.exam-card').length;
  const icos = ['<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>','<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>','<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>','<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/></svg>','<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>','<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>','<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>','<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18h8M3 22h18M14 22a7 7 0 007-7H7a7 7 0 007 7z"/><path d="M9 3l1 8"/><path d="M17 3l-1 8"/><line x1="9" y1="3" x2="17" y2="3"/></svg>'];
  const d = document.createElement('div'); d.className='exam-card'; d.id=`ed-exam-${idx}`;
  d.innerHTML=`<div class="exam-card-hdr"><div class="exam-badge">${icos[idx%icos.length]} Exam ${idx+1}</div>
    <button onclick="removeEdExam(${idx})" style="background:transparent;border:none;color:var(--red);cursor:pointer;font-size:13px">Remove</button></div>
    <div class="field-row-3">
      <div class="field"><label>Name</label><input type="text" id="ed-en-${idx}" placeholder="e.g. Final"/></div>
      <div class="field"><label>Weight (% of total course)</label><input type="number" id="ed-ew-${idx}" placeholder="e.g. 20" min="0" max="100" oninput="edUpdEP()"/></div>
      <div class="field"><label>Taken?</label><select id="ed-et-${idx}" onchange="edTogSc(${idx})">
        <option value="no">Not yet</option><option value="yes">Yes</option></select></div>
    </div>
    <div class="field" id="ed-esf-${idx}" style="display:none">
      <label>Score (out of 100)</label><input type="number" id="ed-es-${idx}" min="0" max="100"/></div>`;
  wrap.appendChild(d);
}
async function saveEditModal() {
  const sem = semesters.find(s => s.id === editCtx.semId);
  const s = sem.subjects.find(x => x.id === editCtx.subjectId);
  s.name = document.getElementById('ed-name').value.trim() || s.name;
  s.credits = parseFloat(document.getElementById('ed-cr').value) || s.credits;
  s.other_pct = parseFloat(document.getElementById('ed-op').value) || 0;
  s.other_score = parseFloat(document.getElementById('ed-os').value) || 0;
  s.status = document.getElementById('ed-status').value;
  const newExams = [];
  document.querySelectorAll('#ed-exams .exam-card').forEach((card, i) => {
    const nm = document.getElementById(`ed-en-${i}`)?.value || `Exam ${i+1}`;
    const wt = parseFloat(document.getElementById(`ed-ew-${i}`)?.value) || 0;
    const taken = document.getElementById(`ed-et-${i}`)?.value === 'yes';
    const score = taken ? (parseFloat(document.getElementById(`ed-es-${i}`)?.value) || 0) : null;
    const existingExam = s.exams?.[i];
    newExams.push({ id: existingExam?.id || uid(), name: nm, weight: wt, taken, score });
  });
  // Do NOT normalize — weights are absolute percentages of total course grade
  s.exam_pct = newExams.reduce((a, e) => a + e.weight, 0);
  s.exams = newExams;
  const btn = document.getElementById('edit-modal-save');
  btn.disabled = true; btn.textContent = 'Saving...';
  const semCP = sem.subjects.reduce((a, x) => a + x.credits * computeSubject(x).curG.p, 0);
  const semCR = sem.subjects.reduce((a, x) => a + x.credits, 0);
  sem._gpa = semCR ? semCP / semCR : 0;
  await saveSemesterToDB(sem);
  btn.disabled = false; btn.textContent = 'Save Changes';
  closeEditModal();
  updateStats(); renderDashboard(); renderCourses(); renderWIFull(); renderStudy(); renderROI();
  showToast(`✅ ${s.name} updated!`);
  if(typeof addXP==='function') addXP(20,'Grade logged');
  if(typeof logActivity==='function') logActivity();
  if(typeof checkBadges==='function') checkBadges();
}
function closeEditModal() { document.getElementById('edit-modal').classList.remove('show'); editCtx = null; }

// ══════════════════════════════════════════════════════════════
// COURSE DETAIL VIEW
// ══════════════════════════════════════════════════════════════
function viewDetail(semId, subjectId) {
  const sem = semesters.find(s => s.id === semId);
  const s = sem.subjects.find(x => x.id === subjectId);
  const res = computeSubject(s);
  const col = gCol(res.curG.l);
  const motiv = getMotiv(res.cur);
  const mBg = res.cur >= 87 ? 'rgba(52,211,153,.08)' : res.cur >= 73 ? 'rgba(251,191,36,.08)' : 'rgba(248,113,113,.08)';
  const mBd = res.cur >= 87 ? 'rgba(52,211,153,.25)' : res.cur >= 73 ? 'rgba(251,191,36,.25)' : 'rgba(248,113,113,.25)';
  document.getElementById('modal-title').textContent = s.name;
  document.getElementById('modal-save').style.display = 'none';
  document.getElementById('modal-body').innerHTML = `
    <div class="score-hero" style="padding:22px;margin-bottom:14px">
      <div class="sh-lbl">Current Score (taken exams only)</div>
      <div class="sh-num" data-val="${res.cur.toFixed(1)}%">${res.cur.toFixed(1)}<span style="font-size:.4em;opacity:.5">%</span></div>
      <div class="sh-sub">Grade: <span class="grade-pill" style="background:${col}22;color:${col};border:1px solid ${col}44">${res.curG.l}</span> &nbsp; ${res.curG.p.toFixed(4)} pts</div>
    </div>
    <div class="motiv" style="background:${mBg};border:1px solid ${mBd};margin-bottom:14px">
      <div class="motiv-ico">${motiv.ico}</div>
      <div><div class="motiv-title">${motiv.title}</div><div style="font-size:12px;color:var(--muted2)">${motiv.msg}</div></div>
    </div>
    <div style="font-family:'Clash Display',sans-serif;font-weight:700;font-size:12px;color:var(--muted2);letter-spacing:.1em;text-transform:uppercase;margin-bottom:10px">Exams</div>
    ${(s.exams || []).map(e => `
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-sm);padding:12px 14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
        <div><div style="font-family:'Clash Display',sans-serif;font-weight:700;font-size:13px">${e.name}</div>
          <div style="font-size:11px;color:var(--muted)">${e.weight.toFixed(0)}% of course grade</div></div>
        ${e.taken
          ? `<div style="display:flex;align-items:center;gap:8px">
              <span style="font-family:'Clash Display',sans-serif;font-weight:700;font-size:18px;color:${gCol(pctToG(e.score).l)}">${e.score}%</span>
              <button class="ca-btn" onclick="openEditScore('${semId}','${subjectId}','${e.id}');closeModal()" title="Edit"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
            </div>`
          : `<div style="display:flex;align-items:center;gap:8px">
              <span style="color:var(--muted);font-size:12px">Not taken</span>
              <button class="ca-btn" onclick="openEditScore('${semId}','${subjectId}','${e.id}');closeModal()" title="Add" style="color:var(--accent)"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
            </div>`}
      </div>`).join('')}
    ${res.remExams.length > 0 ? `
      <div class="divider"></div>
      <div style="font-family:'Clash Display',sans-serif;font-weight:700;font-size:12px;color:var(--muted2);letter-spacing:.1em;text-transform:uppercase;margin-bottom:10px">Scores needed</div>
      <div class="chip-row" id="det-chips"></div>
      <div id="det-ecards"></div>` : ''}`;
  if (res.remExams.length > 0) {
    const cc = document.getElementById('det-chips');
    GPA.slice(0, 7).forEach((g, i) => {
      const chip = document.createElement('div'); chip.className = 'chip' + (i === 0 ? ' on' : '');
      chip.textContent = `${g.l} (${g.p.toFixed(4)})`;
      chip.onclick = () => { cc.querySelectorAll('.chip').forEach((c, j) => c.classList.toggle('on', j === i)); renderDetCards(res, i); };
      cc.appendChild(chip);
    });
    renderDetCards(res, 0);
  }
  syncDataVal();
  document.getElementById('score-modal').classList.add('show');
}
function renderDetCards(res, ti) {
  const c = document.getElementById('det-ecards'); if (!c) return;
  const t = res.targets[ti]; c.innerHTML = '';
  const icos = ['<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>','<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>','<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>','<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/></svg>','<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>','<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>','<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>','<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18h8M3 22h18M14 22a7 7 0 007-7H7a7 7 0 007 7z"/><path d="M9 3l1 8"/><path d="M17 3l-1 8"/><line x1="9" y1="3" x2="17" y2="3"/></svg>'];
  t.perExam.forEach((ex, i) => {
    const nd = ex.needed; let sc, rng, col;
    if (nd === null) { sc = 'N/A'; rng = ''; col = 'var(--muted)'; }
    else if (nd > 100) { sc = 'Not possible'; rng = `Need ${nd.toFixed(1)}%`; col = 'var(--red)'; }
    else if (nd <= 0) { sc = 'Any score'; rng = 'Already on track'; col = 'var(--green)'; }
    else { const lo = Math.max(0, nd - 3).toFixed(1); const hi = Math.min(100, nd + 3).toFixed(1);
      sc = nd.toFixed(1) + '%'; rng = `Safe: ${lo}%–${hi}%`; col = nd < 60 ? 'var(--green)' : nd < 80 ? 'var(--yellow)' : 'var(--red)'; }
    const card = document.createElement('div'); card.className = 'eneed'; card.style.animationDelay = (i * .06) + 's';
    card.innerHTML = `<div class="eneed-ico">${icos[i % icos.length]}</div>
      <div class="eneed-info"><div class="eneed-name">${ex.name}</div><div class="eneed-meta">Worth ${(ex.gf * 100).toFixed(1)}% of total</div></div>
      <div><div class="eneed-score" style="color:${col}">${sc}</div><div class="eneed-range">${rng}</div></div>`;
    c.appendChild(card);
  });
}

// ══════════════════════════════════════════════════════════════
// ADD / EDIT SCORE
// ══════════════════════════════════════════════════════════════
function openAddScore(semId, subjectId) {
  const sem = semesters.find(s => s.id === semId);
  const s = sem.subjects.find(x => x.id === subjectId);
  const rem = s.exams.filter(e => !e.taken);
  if (!rem.length) { showToast('All exams already scored!'); return; }
  modalCtx = { semId, subjectId, examId: null };
  document.getElementById('modal-title').textContent = `Add Score — ${s.name}`;
  document.getElementById('modal-save').style.display = '';
  document.getElementById('modal-body').innerHTML = `
    <div class="infobox">Select the exam and enter your score. Cloud sync is automatic.</div>
    <div class="field"><label>Exam</label>
      <select id="modal-exam-sel">${rem.map(e => `<option value="${e.id}">${e.name} (${e.weight.toFixed(0)}% of course grade)</option>`).join('')}</select>
    </div>
    <div class="field"><label>Your Score (out of 100)</label>
      <input type="number" id="modal-score-inp" placeholder="e.g. 82" min="0" max="100"/>
    </div>`;
  document.getElementById('score-modal').classList.add('show');
}
function openEditScore(semId, subjectId, examId) {
  const sem = semesters.find(s => s.id === semId);
  const s = sem.subjects.find(x => x.id === subjectId);
  const e = s.exams.find(x => x.id === examId);
  modalCtx = { semId, subjectId, examId };
  document.getElementById('modal-title').textContent = `${e.taken ? 'Edit' : 'Add'} Score — ${e.name}`;
  document.getElementById('modal-save').style.display = '';
  document.getElementById('modal-body').innerHTML = `
    <div class="infobox">Enter your score for <strong>${e.name}</strong>.</div>
    <div class="field"><label>Your Score (out of 100)</label>
      <input type="number" id="modal-score-inp" value="${e.taken ? e.score : ''}" placeholder="e.g. 82" min="0" max="100"/>
    </div>`;
  document.getElementById('score-modal').classList.add('show');
}
async function saveModalScore() {
  const sem = semesters.find(s => s.id === modalCtx.semId);
  const s = sem.subjects.find(x => x.id === modalCtx.subjectId);
  let examId = modalCtx.examId;
  if (!examId) { const sel = document.getElementById('modal-exam-sel'); if (!sel) { showToast('Select an exam.'); return; } examId = sel.value; }
  const scoreRaw = document.getElementById('modal-score-inp').value;
  if (scoreRaw === '') { showToast('Enter a score.'); return; }
  const score = parseFloat(scoreRaw);
  if (isNaN(score) || score < 0 || score > 100) { showToast('Score must be 0–100.'); return; }
  document.getElementById('modal-save').disabled = true;
  document.getElementById('modal-save').textContent = 'Saving...';
  const exam = s.exams.find(e => e.id === examId);
  exam.taken = true; exam.score = score;
  const semCP = sem.subjects.reduce((a, x) => a + x.credits * computeSubject(x).curG.p, 0);
  const semCR = sem.subjects.reduce((a, x) => a + x.credits, 0);
  sem._gpa = semCR ? semCP / semCR : 0;
  await saveSemesterToDB(sem);
  document.getElementById('modal-save').disabled = false;
  document.getElementById('modal-save').textContent = 'Save Score';
  closeModal();
  const res = computeSubject(s);
  updateStats(); renderDashboard(); renderCourses(); renderWIFull(); renderStudy(); renderROI();
  showToast(`✅ Saved! ${s.name}: ${res.curG.l} (${res.cur.toFixed(1)}%)`);
  if (res.curG.l === 'A' || res.curG.l === 'A+') fireConfetti();
}
function closeModal() {
  document.getElementById('score-modal').classList.remove('show');
  document.getElementById('modal-save').style.display = '';
  document.getElementById('modal-save').disabled = false;
  document.getElementById('modal-save').textContent = 'Save Score';
  modalCtx = null;
}
async function deleteCourse(semId, subjectId) {
  if (!confirm('Delete this course and all its exam data?')) return;
  const sem = semesters.find(s => s.id === semId);
  sem.subjects = sem.subjects.filter(s => s.id !== subjectId);
  if (!sem.subjects.length) { await deleteSemesterFromDB(semId); }
  else { await saveSemesterToDB(sem); }
  updateStats(); renderDashboard(); renderCourses(); renderHistory();
  showToast('Course deleted.');
}

// ══════════════════════════════════════════════════════════════
// TRACKER FLOW
// ══════════════════════════════════════════════════════════════
function setMode(m) {
  appMode = m;
  document.getElementById('mode-s').classList.toggle('on', m === 'single');
  document.getElementById('mode-m').classList.toggle('on', m === 'multi');
  document.getElementById('n-subj-f').classList.toggle('hidden', m === 'single');
}
function setStep(n) {
  [1, 2, 3].forEach(i => {
    const el = document.getElementById('sw' + i); if (!el) return;
    el.classList.remove('active', 'done');
    if (i < n) el.classList.add('done');
    if (i === n) el.classList.add('active');
  });
}
function goStep1() {
  setStep(1);
  document.getElementById('pg-setup').classList.remove('hidden');
  document.getElementById('pg-subjects').classList.add('hidden');
  document.getElementById('pg-results').classList.add('hidden');
  // Populate degree selector
  const sel = document.getElementById('sem-degree-sel');
  if (sel) {
    const degrees = getDegrees();
    sel.innerHTML = '<option value="">— No degree link —</option>' +
      degrees.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
  }
}
function goStep2() {
  const n = appMode === 'single' ? 1 : parseInt(document.getElementById('n-subjs').value) || 2;
  setStep(2);
  document.getElementById('pg-setup').classList.add('hidden');
  document.getElementById('pg-subjects').classList.remove('hidden');
  buildForms(n);
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function buildForms(n) { const c = document.getElementById('subj-forms'); c.innerHTML = ''; for (let i = 0; i < n; i++) c.appendChild(makeForm(i, n)); }
function makeForm(idx, total) {
  const d = document.createElement('div'); d.className = 'card'; d.style.animationDelay = (idx * .08) + 's'; d.id = 'sf-' + idx;
  d.innerHTML = `<div class="card-title"><span class="ico"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/><line x1="10" y1="7" x2="16" y2="7"/><line x1="10" y1="11" x2="14" y2="11"/></svg></span>${total > 1 ? `Subject ${idx + 1} of ${total}` : 'Subject Details'}</div>
    <div class="field-row">
      <div class="field"><label>Subject Name</label><input type="text" id="s${idx}_nm" placeholder="e.g. Calculus"/></div>
      <div class="field"><label>Credits</label><input type="number" id="s${idx}_cr" placeholder="e.g. 3" min=".5" max="12" step=".5"/></div>
    </div>
    <div class="divider"></div>
    <div class="infobox">Enter <strong>Other Stuff %</strong> (assignments, attendance, quizzes). Then enter each exam's <strong>direct % of total course grade</strong> — e.g. if exams = 80% total and you have 4 exams, enter 16, 16, 16, 32. They should together equal the exam portion.<br/>GPA is calculated on <strong>taken exams only</strong> — untaken exams won't drag your score down.</div>
    <div class="field-row">
      <div class="field"><label>Other Stuff %</label><input type="number" id="s${idx}_op" value="40" min="0" max="100" oninput="updEP(${idx})"/></div>
      <div class="field"><label>Exam % Total (live)</label><input type="number" id="s${idx}_ep" value="60" readonly style="opacity:.4;cursor:not-allowed"/></div>
    </div>
    <div class="field"><label>Other Stuff Score (out of 100 · blank = assume 88)</label><input type="number" id="s${idx}_os" placeholder="e.g. 88" min="0" max="100"/></div>
    <div class="divider"></div>
    <div class="field" style="max-width:180px"><label>Number of Exams</label><input type="number" id="s${idx}_ne" value="2" min="1" max="15" oninput="rebuildEx(${idx})"/></div>
    <div id="s${idx}_ex"></div>`;
  setTimeout(() => rebuildEx(idx), 40);
  return d;
}
function updEP(i) {
  // Exam % = sum of all exam weight inputs
  let total = 0;
  const c = document.getElementById(`s${i}_ex`);
  if (c) {
    c.querySelectorAll('[data-f="wt"]').forEach(inp => {
      total += parseFloat(inp.value) || 0;
    });
  }
  const epEl = document.getElementById(`s${i}_ep`);
  if (epEl) epEl.value = total.toFixed(1);
}
function rebuildEx(idx) {
  const n = parseInt(document.getElementById(`s${idx}_ne`).value) || 1;
  const c = document.getElementById(`s${idx}_ex`);
  const prev = [];
  c.querySelectorAll('.exam-card').forEach(card => {
    prev.push({ nm: card.querySelector('[data-f="nm"]')?.value || '', wt: card.querySelector('[data-f="wt"]')?.value || '', tk: card.querySelector('[data-f="tk"]')?.value || 'no', sc: card.querySelector('[data-f="sc"]')?.value || '' });
  });
  c.innerHTML = '';
  const icos = ['<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>','<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>','<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>','<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/></svg>','<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>','<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>','<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>','<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18h8M3 22h18M14 22a7 7 0 007-7H7a7 7 0 007 7z"/><path d="M9 3l1 8"/><path d="M17 3l-1 8"/><line x1="9" y1="3" x2="17" y2="3"/></svg>'];
  for (let i = 0; i < n; i++) {
    const e = prev[i] || {};
    const card = document.createElement('div'); card.className = 'exam-card';
    card.innerHTML = `<div class="exam-card-hdr"><div class="exam-badge">${icos[i % icos.length]} Exam ${i + 1}</div></div>
      <div class="field-row-3">
        <div class="field"><label>Name</label><input data-f="nm" type="text" value="${e.nm || ''}" placeholder="e.g. Midterm"/></div>
        <div class="field"><label>Weight (% of total course)</label><input data-f="wt" type="number" value="${e.wt || ''}" placeholder="e.g. 20" min="0" max="100" oninput="updEP(${idx})"/></div>
        <div class="field"><label>Taken?</label><select data-f="tk" onchange="togSc(this,${idx},${i})">
          <option value="no" ${e.tk !== 'yes' ? 'selected' : ''}>Not yet</option>
          <option value="yes" ${e.tk === 'yes' ? 'selected' : ''}>Yes</option>
        </select></div>
      </div>
      <div class="field" id="s${idx}_e${i}_sf" style="${e.tk === 'yes' ? '' : 'display:none'}">
        <label>Score (out of 100)</label>
        <input data-f="sc" type="number" value="${e.sc || ''}" placeholder="e.g. 78" min="0" max="100"/>
      </div>`;
    c.appendChild(card);
  }
  // Update the live exam % total after rebuilding cards
  updEP(idx);
}
function togSc(sel, si, ei) { document.getElementById(`s${si}_e${ei}_sf`).style.display = sel.value === 'yes' ? 'block' : 'none'; }
function readSubjFromForm(idx) {
  const nm = document.getElementById(`s${idx}_nm`)?.value.trim() || `Subject ${idx + 1}`;
  const cr = parseFloat(document.getElementById(`s${idx}_cr`)?.value) || 0;
  const op = parseFloat(document.getElementById(`s${idx}_op`)?.value) || 40;
  const ep = 100 - op;
  const osRaw = document.getElementById(`s${idx}_os`)?.value;
  const os = osRaw === '' || osRaw == null ? 88 : parseFloat(osRaw);
  const cards = document.querySelectorAll(`#s${idx}_ex .exam-card`);
  const exams = [];
  cards.forEach((card, i) => {
    const ename = card.querySelector('[data-f="nm"]')?.value || `Exam ${i + 1}`;
    const wt = parseFloat(card.querySelector('[data-f="wt"]')?.value) || 0;
    const taken = card.querySelector('[data-f="tk"]')?.value === 'yes';
    const score = taken ? (parseFloat(card.querySelector('[data-f="sc"]')?.value) || 0) : null;
    exams.push({ id: uid(), name: ename, weight: wt, taken, score });
  });
  const tw = exams.reduce((a, e) => a + e.weight, 0);
  // Do NOT normalize — weights are absolute percentages of the total course grade
  const computedExamPct = tw; // exam_pct = sum of all exam weights
  return { id: uid(), name: nm, credits: cr, other_pct: op, other_score: os, exam_pct: computedExamPct, exams, status: 'normal' };
}
async function calcAndSave() {
  const btn = document.getElementById('calc-save-btn');
  btn.disabled = true; btn.textContent = '💾 Saving to cloud...';
  const semName = document.getElementById('sem-name-inp').value.trim() || `Semester ${semesters.length + 1}`;
  const degreeId = document.getElementById('sem-degree-sel')?.value || '';
  const forms = document.querySelectorAll('[id^="sf-"]');
  calcSubjs = []; calcRes = [];
  forms.forEach((_, i) => {
    const s = readSubjFromForm(i);
    calcSubjs.push(s); calcRes.push(computeSubject(s));
  });
  let sem = semesters.find(s => s.name === semName);
  if (sem) { calcSubjs.forEach(s => sem.subjects.push(s)); }
  else { sem = { id: uid(), name: semName, date: new Date().toLocaleDateString(), subjects: calcSubjs, degreeId: degreeId || undefined }; }
  if (degreeId) sem.degreeId = degreeId;
  const semCP = sem.subjects.reduce((a, s) => a + s.credits * computeSubject(s).curG.p, 0);
  const semCR = sem.subjects.reduce((a, s) => a + s.credits, 0);
  sem._gpa = semCR ? semCP / semCR : 0;
  await saveSemesterToDB(sem);
  btn.disabled = false; btn.textContent = '💾 Save & Calculate →';
  activeCalcIdx = 0;
  updateStats(); renderDashboard(); renderCourses(); renderHistory(); renderWIFull(); renderStudy(); renderROI();
  renderResults();
  const degreeLabel = degreeId ? (' → ' + (getDegrees().find(d=>d.id===degreeId)?.name||'')) : '';
  showToast(`✅ Saved! ${calcSubjs.length} subject${calcSubjs.length !== 1 ? 's' : ''}${degreeLabel}`);
}

// ══════════════════════════════════════════════════════════════
// RESULTS
// ══════════════════════════════════════════════════════════════
function renderResults() {
  setStep(3);
  document.getElementById('pg-subjects').classList.add('hidden');
  document.getElementById('pg-results').classList.remove('hidden');
  const wrap = document.getElementById('results-wrap'); wrap.innerHTML = '';
  if (calcSubjs.length > 1) {
    const tcp = calcSubjs.reduce((a, s, i) => a + s.credits * calcRes[i].curG.p, 0);
    const tcr = calcSubjs.reduce((a, s) => a + s.credits, 0);
    const cum = tcp / tcr; const cl = closestL(cum); const col = gCol(cl);
    const cd = document.createElement('div'); cd.className = 'cum-card';
    cd.innerHTML = `<div><div class="cum-lbl">Session GPA</div>
      <div class="cum-num" style="color:${col}">${cum.toFixed(4)}</div>
      <div class="cum-letter" style="color:${col}">${cl} — ${cum.toFixed(2)}/${Math.max(...GPA.map(g=>g.p)).toFixed(1)}</div></div>
      <div style="flex:1">${calcSubjs.map((s, i) => `
        <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);font-size:13px">
          <span>${s.name}</span>
          <span style="color:${gCol(calcRes[i].curG.l)}">${calcRes[i].curG.l} · ${calcRes[i].curG.p.toFixed(4)}</span>
        </div>`).join('')}</div>`;
    wrap.appendChild(cd);
  }
  if (calcSubjs.length > 1) {
    const tabs = document.createElement('div'); tabs.className = 'subj-tabs';
    calcSubjs.forEach((s, i) => { const t = document.createElement('div'); t.className = 'subj-tab' + (i === 0 ? ' on' : ''); t.textContent = s.name || `Subject ${i + 1}`; t.onclick = () => swCalcSubj(i); tabs.appendChild(t); });
    wrap.appendChild(tabs);
  }
  calcSubjs.forEach((s, i) => { const p = buildPanel(s, calcRes[i], i); p.id = `rp-${i}`; if (i > 0) p.style.display = 'none'; wrap.appendChild(p); });
  buildWISubjSel(); updateWI(); buildGradeChart(); buildShareCard();
}
function swCalcSubj(i) {
  activeCalcIdx = i;
  document.querySelectorAll('.subj-tab').forEach((t, j) => t.classList.toggle('on', j === i));
  document.querySelectorAll('[id^="rp-"]').forEach((p, j) => p.style.display = j === i ? 'block' : 'none');
  updateWI(); buildShareCard();
}
function buildPanel(s, res, idx) {
  const div = document.createElement('div');
  const g = res.curG; const col = gCol(g.l);
  const motiv = getMotiv(res.cur);
  const mBg = res.cur >= 87 ? 'rgba(52,211,153,.08)' : res.cur >= 73 ? 'rgba(251,191,36,.08)' : 'rgba(248,113,113,.08)';
  const mBd = res.cur >= 87 ? 'rgba(52,211,153,.25)' : res.cur >= 73 ? 'rgba(251,191,36,.25)' : 'rgba(248,113,113,.25)';
  div.innerHTML = `
    <div class="motiv" style="background:${mBg};border:1px solid ${mBd}">
      <div class="motiv-ico">${motiv.ico}</div>
      <div><div class="motiv-title">${motiv.title}</div><div style="font-size:12px;color:var(--muted2)">${motiv.msg}</div></div>
    </div>
    <div class="score-hero">
      <div class="sh-lbl">Current Score (taken exams only) — ${s.name}</div>
      <div class="sh-num" data-val="${res.cur.toFixed(1)}%">${res.cur.toFixed(1)}<span style="font-size:.4em;opacity:.5">%</span></div>
      <div class="sh-sub">Grade: <span class="grade-pill" style="background:${col}22;color:${col};border:1px solid ${col}44">${g.l}</span>&nbsp;<span style="color:var(--muted)">${g.p.toFixed(4)} quality pts</span></div>
    </div>
    <div class="card">
      <div class="card-title"><span class="ico"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg></span>Scores Needed in Remaining Exams</div>
      ${res.remFrac < 0.001
        ? `<div class="infobox green">✓ All exams done!</div>`
        : `<div class="infobox">Remaining exams worth <strong>${(res.remFrac * 100).toFixed(1)}%</strong> of your total.</div>
        <table class="gpa-tbl"><thead><tr><th>Grade</th><th>Quality Pts</th><th>Avg Needed</th><th>Feasibility</th></tr></thead>
        <tbody id="tbl-${idx}">${res.targets.map((t, ti) => {
          const avg = t.avg; let txt, bp, bc, rc = '';
          if (avg === null) { txt = 'N/A'; bp = 0; bc = 'var(--muted)'; }
          else if (avg > 100) { txt = `<span style="color:var(--red)">Not possible</span>`; bp = 100; bc = 'var(--red)'; }
          else if (avg <= 0) { txt = `<span style="color:var(--green)">Secured 🎉</span>`; bp = 100; bc = 'var(--green)'; rc = 'hl'; }
          else { bp = Math.min(100, avg); bc = avg < 60 ? 'var(--green)' : avg < 80 ? 'var(--yellow)' : 'var(--red)'; txt = `<strong>${avg.toFixed(1)}%</strong>`; }
          const gc = gCol(t.l);
          return `<tr class="gpa-row ${rc}" onclick="selTargRow(${idx},${ti})">
            <td><span class="gl-badge" style="background:${gc}22;color:${gc}">${t.l}</span></td>
            <td style="color:var(--muted)">${t.p.toFixed(4)}</td><td>${txt}</td>
            <td><div class="bar-bg"><div class="bar-fg" style="width:0%;background:${bc}" data-target="${bp}"></div></div></td>
          </tr>`;
        }).join('')}</tbody></table>`}
    </div>
    ${res.remExams.length > 0 ? `<div class="card">
      <div class="card-title"><span class="ico"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0"><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/></svg></span>Per-Exam Breakdown</div>
      <div class="chip-row" id="chips-${idx}">
        ${res.targets.slice(0, 9).map((t, ti) => `<div class="chip ${ti === 0 ? 'on' : ''}" onclick="selTarg(${idx},${ti})" id="chip-${idx}-${ti}">${t.l} (${t.p.toFixed(4)})</div>`).join('')}
      </div>
      <div id="ec-${idx}"></div>
    </div>` : ''}`;
  setTimeout(() => { div.querySelectorAll('.bar-fg[data-target]').forEach(b => b.style.width = b.dataset.target + '%'); if (res.remExams.length > 0) renderExamCards(idx, 0); syncDataVal(); }, 120);
  return div;
}
function selTargRow(si, ti) { document.querySelectorAll(`#tbl-${si} .gpa-row`).forEach((r, i) => r.classList.toggle('sel', i === ti)); selTarg(si, ti); }
function selTarg(si, ti) { document.querySelectorAll(`#chips-${si} .chip`).forEach((c, i) => c.classList.toggle('on', i === ti)); renderExamCards(si, ti); }
function renderExamCards(si, ti) {
  const c = document.getElementById(`ec-${si}`); if (!c) return;
  const t = calcRes[si].targets[ti]; c.innerHTML = '';
  const icos = ['<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>','<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>','<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>','<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/></svg>','<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>','<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>','<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>','<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18h8M3 22h18M14 22a7 7 0 007-7H7a7 7 0 007 7z"/><path d="M9 3l1 8"/><path d="M17 3l-1 8"/><line x1="9" y1="3" x2="17" y2="3"/></svg>'];
  t.perExam.forEach((ex, i) => {
    const nd = ex.needed; let sc, rng, col;
    if (nd === null) { sc = 'N/A'; rng = ''; col = 'var(--muted)'; }
    else if (nd > 100) { sc = 'Not possible'; rng = `Need ${nd.toFixed(1)}%`; col = 'var(--red)'; }
    else if (nd <= 0) { sc = 'Any score'; rng = 'Already on track'; col = 'var(--green)'; }
    else { const lo = Math.max(0, nd - 3).toFixed(1); const hi = Math.min(100, nd + 3).toFixed(1); sc = nd.toFixed(1) + '%'; rng = `Safe: ${lo}%–${hi}%`; col = nd < 60 ? 'var(--green)' : nd < 80 ? 'var(--yellow)' : 'var(--red)'; }
    const card = document.createElement('div'); card.className = 'eneed'; card.style.animationDelay = (i * .06) + 's';
    card.innerHTML = `<div class="eneed-ico">${icos[i % icos.length]}</div>
      <div class="eneed-info"><div class="eneed-name">${ex.name}</div><div class="eneed-meta">Worth ${(ex.gf * 100).toFixed(1)}% of total</div></div>
      <div><div class="eneed-score" style="color:${col}">${sc}</div><div class="eneed-range">${rng}</div></div>`;
    c.appendChild(card);
  });
  if (ti === 0 && t.perExam.every(e => e.needed !== null && e.needed <= 100 && e.needed >= 0)) fireConfetti();
}

// ══════════════════════════════════════════════════════════════
// WHAT-IF
// ══════════════════════════════════════════════════════════════
function buildWISubjSel() {
  const c = document.getElementById('wi-subj-sel'); if (!c) return;
  if (calcSubjs.length <= 1) { c.innerHTML = ''; return; }
  c.innerHTML = `<div class="chip-row">${calcSubjs.map((s, i) => `<div class="chip ${i === 0 ? 'on' : ''}" onclick="setWIS(${i},this)">${s.name}</div>`).join('')}</div>`;
}
function setWIS(i, el) { activeCalcIdx = i; el.closest('.chip-row').querySelectorAll('.chip').forEach((c, j) => c.classList.toggle('on', j === i)); updateWI(); }
function updateWI() {
  if (!calcRes.length) return;
  const res = calcRes[activeCalcIdx];
  const v = parseFloat(document.getElementById('wi-slider')?.value || 75);
  document.getElementById('wi-val').textContent = v.toFixed(0) + '%';
  if (res.remFrac < 0.001) { document.getElementById('wi-tot').textContent = res.cur.toFixed(1) + '%'; const g = res.curG; document.getElementById('wi-grade').textContent = g.l; document.getElementById('wi-grade').style.color = gCol(g.l); return; }
  const proj = Math.min(100, res.curAbsolute + res.remFrac * v); const g = pctToG(proj);
  document.getElementById('wi-tot').textContent = proj.toFixed(1) + '%';
  document.getElementById('wi-grade').textContent = g.l; document.getElementById('wi-grade').style.color = gCol(g.l);
  if ((g.l === 'A' || g.l === 'A+') && v >= 90) fireConfetti();
}
function renderWIFull() {
  const c = document.getElementById('wi-full'); c.innerHTML = '';
  const all = []; semesters.forEach(sem => sem.subjects.forEach(s => all.push({ s, sem })));
  if (!all.length) { c.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">Add subjects first.</div>'; return; }

  // Store the real baseline cumulative GPA for reference
  let realCumCP = 0, realCumCR = 0;
  semesters.forEach(sem => sem.subjects.forEach(s => {
    const res = computeSubject(s);
    realCumCP += s.credits * (res.curG?.p || 0); realCumCR += s.credits;
  }));
  const realCumGPA = realCumCR > 0 ? realCumCP / realCumCR : 0;

  // Init GPA cards with real GPA as starting point
  const cumGpaEl = document.getElementById('wi-cum-gpa');
  const semGpaEl = document.getElementById('wi-sem-gpa');
  if (cumGpaEl) cumGpaEl.textContent = realCumCR > 0 ? realCumGPA.toFixed(2) : '—';
  if (semGpaEl) {
    const latestSem = semesters[semesters.length - 1];
    if (latestSem && latestSem.subjects.length) {
      const cp = latestSem.subjects.reduce((a, s) => a + s.credits * computeSubject(s).curG.p, 0);
      const cr = latestSem.subjects.reduce((a, s) => a + s.credits, 0);
      semGpaEl.textContent = cr > 0 ? (cp / cr).toFixed(2) : '—';
    } else { semGpaEl.textContent = '—'; }
  }

  all.forEach(({ s, sem }, si) => {
    const res = computeSubject(s);
    const div = document.createElement('div'); div.style.marginBottom = '24px';
    div.innerHTML = `<div style="font-family:'Clash Display',sans-serif;font-weight:700;font-size:16px;margin-bottom:10px">${s.name} <span style="font-size:12px;color:var(--muted);font-weight:400">· ${sem.name}</span></div>
      <div class="infobox">Current: <strong>${res.cur.toFixed(1)}%</strong> (${res.curG.l}) · Remaining weight: <strong>${(res.remFrac * 100).toFixed(1)}%</strong></div>
      <input type="range" min="0" max="100" value="${Math.round(res.cur)}" style="width:100%" oninput="wiUpd(this,${si})"/>
      <div class="slider-labels"><span>0%</span><span>50%</span><span>100%</span></div>
      <div style="display:flex;gap:18px;margin-top:12px;flex-wrap:wrap">
        <div><div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;margin-bottom:3px">If I score</div>
          <div id="wi2v${si}" style="font-family:'Clash Display',sans-serif;font-weight:700;font-size:26px;color:var(--accent)">${Math.round(res.cur)}%</div></div>
        <div style="font-size:22px;color:var(--muted);display:flex;align-items:center">→</div>
        <div><div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;margin-bottom:3px">Final Total</div>
          <div id="wi2t${si}" style="font-family:'Clash Display',sans-serif;font-weight:700;font-size:26px;color:var(--accent3)">—</div></div>
        <div style="font-size:22px;color:var(--muted);display:flex;align-items:center">→</div>
        <div><div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;margin-bottom:3px">Grade</div>
          <div id="wi2g${si}" style="font-family:'Clash Display',sans-serif;font-weight:700;font-size:26px">—</div></div>
      </div><div class="divider"></div>`;
    c.appendChild(div);
    setTimeout(() => { const sl = div.querySelector('input[type=range]'); wiUpd(sl, si, res); }, 50);
  });
}

function wiUpd(sl, si, resOv) {
  const v = parseFloat(sl.value);
  const all = []; semesters.forEach(sem => sem.subjects.forEach(s => all.push(s)));
  const res = resOv || computeSubject(all[si]);

  // Update this subject's display
  document.getElementById(`wi2v${si}`).textContent = v.toFixed(0) + '%';
  const proj = Math.min(100, res.curAbsolute + (res.remFrac * v));
  const g = pctToG(proj);
  document.getElementById(`wi2t${si}`).textContent = proj.toFixed(1) + '%';
  document.getElementById(`wi2g${si}`).textContent = g.l;
  document.getElementById(`wi2g${si}`).style.color = gCol(g.l);

  // Recalculate projected cumulative and semester GPA from all sliders
  _wiRecalcGPAs();
}

function _wiRecalcGPAs() {
  // Collect current slider values per subject index
  const sliders = document.querySelectorAll('#wi-full input[type=range]');
  const allSubjects = []; semesters.forEach(sem => sem.subjects.forEach(s => allSubjects.push({ s, sem })));
  const latestSemName = semesters.length ? semesters[semesters.length - 1].name : null;

  let cumCP = 0, cumCR = 0, semCP = 0, semCR = 0;
  allSubjects.forEach(({ s, sem }, si) => {
    const sliderVal = sliders[si] ? parseFloat(sliders[si].value) : null;
    const res = computeSubject(s);
    let projPct;
    if (sliderVal !== null) {
      projPct = Math.min(100, res.curAbsolute + (res.remFrac * sliderVal));
    } else {
      projPct = res.cur;
    }
    const gp = pctToG(projPct).p;
    cumCP += s.credits * gp; cumCR += s.credits;
    if (sem.name === latestSemName) { semCP += s.credits * gp; semCR += s.credits; }
  });

  const cumEl = document.getElementById('wi-cum-gpa');
  const semEl = document.getElementById('wi-sem-gpa');
  if (cumEl) { const gpa = cumCR > 0 ? cumCP / cumCR : 0; cumEl.textContent = gpa.toFixed(2); cumEl.style.color = gpa >= 3.5 ? 'var(--green)' : gpa >= 2.5 ? 'var(--accent)' : 'var(--red)'; }
  if (semEl) { const gpa = semCR > 0 ? semCP / semCR : 0; semEl.textContent = gpa.toFixed(2); semEl.style.color = gpa >= 3.5 ? 'var(--green)' : gpa >= 2.5 ? 'var(--accent3)' : 'var(--red)'; }
}

// ══════════════════════════════════════════════════════════════
// STUDY PLANNER + ROI
// ══════════════════════════════════════════════════════════════
function renderStudy() {
  const c = document.getElementById('study-content'); c.innerHTML = '';
  const all = []; semesters.forEach(sem => sem.subjects.forEach(s => all.push({ s, sem })));
  const withRem = all.filter(({ s }) => (s.exams || []).some(e => !e.taken));
  if (!withRem.length) { c.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">No remaining exams to plan for.</div>'; renderCalendar(); return; }

  // Find highest ROI exam across all subjects
  let maxROI = 0, roiExam = null, roiSubj = null;
  withRem.forEach(({ s }) => {
    const res = computeSubject(s);
    res.remExams.forEach(ex => {
      if (ex.gf > maxROI) { maxROI = ex.gf; roiExam = ex; roiSubj = s; }
    });
  });

  withRem.forEach(({ s, sem }) => {
    const res = computeSubject(s);
    const bTarg = res.targets.find(t => t.l === 'B') || res.targets[3];
    const sec = document.createElement('div'); sec.style.marginBottom = '22px';
    sec.innerHTML = `<div style="font-family:'Clash Display',sans-serif;font-weight:700;font-size:15px;margin-bottom:10px">${s.name} <span style="font-size:12px;font-weight:400;color:var(--muted)">· ${sem.name}</span></div>`;
    res.remExams.forEach(ex => {
      const nd = bTarg.perExam.find(p => p.name === ex.name)?.needed || 75;
      let hrs;
      if (nd <= 0) hrs = 2; else if (nd > 100) hrs = 20;
      else if (nd < 60) hrs = Math.round(4 + nd * .05); else if (nd < 80) hrs = Math.round(8 + nd * .08); else hrs = Math.round(12 + nd * .12);
      const isROI = roiExam && ex.name === roiExam.name && roiSubj?.id === s.id;
      const card = document.createElement('div'); card.className = 'study-card';
      card.style.borderColor = isROI ? 'rgba(129,140,248,.5)' : '';
      card.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div><div style="font-family:'Clash Display',sans-serif;font-weight:700;font-size:14px;margin-bottom:3px">${ex.name} ${isROI ? '🎯 <span style="font-size:10px;background:rgba(129,140,248,.15);color:var(--accent);padding:2px 7px;border-radius:100px">Highest ROI</span>' : ''}</div>
          <div style="font-size:11px;color:var(--muted)">Target B: ${nd > 100 ? 'Not achievable' : nd <= 0 ? 'Secured' : nd.toFixed(1) + '%'} · Worth ${(ex.gf * 100).toFixed(1)}% of total</div></div>
        <div style="text-align:right"><div class="study-h">${hrs}h</div><div style="font-size:11px;color:var(--muted)">Recommended</div></div>
      </div>
      <div style="margin-top:10px;font-size:12px;color:var(--muted2)">${hrs <= 4 ? '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg> Light review — go over notes.' : hrs <= 8 ? '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/><line x1="10" y1="7" x2="16" y2="7"/><line x1="10" y1="11" x2="14" y2="11"/></svg> Medium prep — practice questions.' : hrs <= 14 ? '🔥 Heavy prep — daily sessions!' : '🔥🔥 Intensive prep — get a study group!'}</div>`;
      sec.appendChild(card);
    });
    c.appendChild(sec);
  });
  renderCalendar();
}

function renderROI() {
  const c = document.getElementById('roi-content'); if (!c) return;
  const all = []; semesters.forEach(sem => sem.subjects.forEach(s => all.push({ s, sem })));
  const withRem = all.filter(({ s }) => (s.exams || []).some(e => !e.taken));
  if (!withRem.length) { c.innerHTML = '<div style="color:var(--muted);font-size:13px">No remaining exams.</div>'; return; }
  const exams = [];
  withRem.forEach(({ s, sem }) => {
    const res = computeSubject(s);
    res.remExams.forEach(ex => {
      const gradeImpact = ex.gf * 100;
      const bTarget = res.targets.find(t => t.l === 'B');
      const needed = bTarget?.perExam.find(p => p.name === ex.name)?.needed || 75;
      const hrs = needed <= 0 ? 1 : needed > 100 ? 99 : needed < 60 ? Math.round(4 + needed * .05) : needed < 80 ? Math.round(8 + needed * .08) : Math.round(12 + needed * .12);
      const roi = gradeImpact / hrs;
      exams.push({ name: ex.name, subject: s.name, sem: sem.name, gradeImpact, hrs, roi, needed });
    });
  });
  exams.sort((a, b) => b.roi - a.roi);
  c.innerHTML = exams.slice(0, 5).map((ex, i) => `
    <div class="eneed" style="${i === 0 ? 'border-color:rgba(129,140,248,.4);background:rgba(129,140,248,.06)' : ''}">
      <div class="eneed-ico">${i === 0 ? `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig-gold)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0"><circle cx="12" cy="8" r="6"/><path d="M12 2v12"/><path d="M8.5 14.5L6 22l6-2 6 2-2.5-7.5"/><line x1="9" y1="8" x2="11" y2="8"/><line x1="13" y1="8" x2="15" y2="8"/></svg>` : i === 1 ? `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig-silver)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0"><circle cx="12" cy="8" r="6"/><path d="M8.5 14.5L6 22l6-2 6 2-2.5-7.5"/></svg>` : `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig-bronze)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0"><circle cx="12" cy="8" r="6"/><path d="M8.5 14.5L6 22l6-2 6 2-2.5-7.5"/></svg>`}</div>
      <div class="eneed-info">
        <div class="eneed-name">${ex.name} <span style="font-size:11px;font-weight:400;color:var(--muted)">· ${ex.subject}</span></div>
        <div class="eneed-meta">+${ex.gradeImpact.toFixed(1)}% impact · ~${ex.hrs}h study · Need ${ex.needed > 100 ? 'too high' : ex.needed <= 0 ? 'secured' : ex.needed.toFixed(0) + '%'}</div>
      </div>
      <div style="text-align:right">
        <div style="font-family:'Clash Display',sans-serif;font-weight:700;font-size:18px;color:var(--accent)">${ex.roi.toFixed(1)}</div>
        <div style="font-size:10px;color:var(--muted)">ROI/hr</div>
      </div>
    </div>`).join('');
}

function renderCalendar() {
  const c = document.getElementById('cal-content'); if (!c) return;
  const all = []; semesters.forEach(sem => sem.subjects.forEach(s => all.push({ s, sem })));
  const withRem = all.filter(({ s }) => (s.exams || []).some(e => !e.taken));
  if (!withRem.length) { c.innerHTML = '<div style="color:var(--muted);font-size:13px">No remaining exams.</div>'; return; }
  let html = '';
  withRem.forEach(({ s }) => {
    (s.exams || []).filter(e => !e.taken).forEach(e => {
      const key = e.id;
      const hasDate = !!examDates[key];
      html += `<div class="cal-exam-row">
        <div class="cal-date"><input type="date" value="${examDates[key]||''}" onchange="setExamDate('${key}',this.value)" style="padding:6px;font-size:11px;width:100%"/></div>
        <div style="flex:1">
          <div class="cal-name">${e.name}</div>
          <div class="cal-sub">${s.name} · ${e.weight.toFixed(0)}% of course grade</div>
          ${hasDate ? `<div class="cal-countdown" id="cd-${key}" data-date="${examDates[key]}">Loading…</div>` : ''}
        </div>
      </div>`;
    });
  });
  c.innerHTML = html;
  tickCountdowns();
}
function setExamDate(examId, date) {
  examDates[examId] = date;
  localStorage.setItem('gradintel-dates-' + (currentUser?.id || ''), JSON.stringify(examDates));
  showToast('📅 Exam date saved!');
  renderCalendar(); // re-render to show/update countdown
}
let _cdInterval = null;
function tickCountdowns() {
  clearInterval(_cdInterval);
  _cdInterval = setInterval(() => {
    document.querySelectorAll('.cal-countdown[data-date]').forEach(el => {
      const target = new Date(el.getAttribute('data-date') + 'T23:59:59');
      const now = new Date();
      const diff = target - now;
      if (diff <= 0) {
        el.textContent = 'Exam day! 🎯';
        el.classList.remove('urgent','soon'); el.classList.add('past');
        return;
      }
      const days = Math.floor(diff / 86400000);
      const hrs  = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      el.textContent = `${days}d ${String(hrs).padStart(2,'0')}h ${String(mins).padStart(2,'0')}m ${String(secs).padStart(2,'0')}s`;
      el.classList.remove('urgent','soon','past');
      if (days < 2) el.classList.add('urgent');
      else if (days < 7) el.classList.add('soon');
    });
  }, 1000);
}
function showExamReminders() {
  if (!examDates || !Object.keys(examDates).length) return;
  const now = new Date();
  const upcoming = [];
  semesters.forEach(sem => sem.subjects.forEach(s => {
    (s.exams || []).filter(e => !e.taken && examDates[e.id]).forEach(e => {
      const target = new Date(examDates[e.id] + 'T23:59:59');
      const diff = target - now;
      if (diff > 0) upcoming.push({ e, s, diff, target });
    });
  }));
  if (!upcoming.length) return;
  upcoming.sort((a, b) => a.diff - b.diff);
  const toShow = upcoming.slice(0, 3); // show up to 3 closest exams
  const stack = document.getElementById('exam-reminder-stack');
  if (!stack) return;
  stack.innerHTML = '';
  toShow.forEach((item, i) => {
    const days = Math.floor(item.diff / 86400000);
    const hrs  = Math.floor((item.diff % 86400000) / 3600000);
    const urgentClass = days < 2 ? 'urgent' : days < 7 ? 'soon' : '';
    const urgencyText = days === 0 ? 'Today!' : days === 1 ? 'Tomorrow' : `${days} days left`;
    const div = document.createElement('div');
    div.className = 'exam-reminder ' + urgentClass;
    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div style="flex:1;min-width:0">
          <div class="exam-reminder-title">📋 ${item.e.name}</div>
          <div class="exam-reminder-sub">${item.s.name} · ${item.e.weight.toFixed(0)}% weight</div>
          <div class="exam-reminder-countdown" id="er-cd-${item.e.id}" data-date="${examDates[item.e.id]}"
            style="color:${days<2?'var(--red)':days<7?'var(--yellow)':'var(--accent)'}">
            ${urgencyText}
          </div>
        </div>
        <button onclick="this.closest('.exam-reminder').remove()" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:14px;padding:0 0 0 8px;flex-shrink:0">✕</button>
      </div>`;
    stack.appendChild(div);
    // Stagger slide-in
    setTimeout(() => div.classList.add('show'), 300 + i * 180);
    // Auto-dismiss after 12s
    setTimeout(() => {
      div.style.opacity = '0'; div.style.transform = 'translateX(340px)';
      setTimeout(() => div.remove(), 400);
    }, 12000 + i * 1000);
  });
  // Live tick for reminder countdowns
  setInterval(() => {
    document.querySelectorAll('.exam-reminder-countdown[data-date]').forEach(el => {
      const target = new Date(el.getAttribute('data-date') + 'T23:59:59');
      const now = new Date();
      const diff = target - now;
      if (diff <= 0) { el.textContent = 'Exam day! 🎯'; return; }
      const days = Math.floor(diff / 86400000);
      const hrs  = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      el.textContent = `${days}d ${String(hrs).padStart(2,'0')}h ${String(mins).padStart(2,'0')}m ${String(secs).padStart(2,'0')}s`;
    });
  }, 1000);
}
function exportICS() {
  const all = []; semesters.forEach(sem => sem.subjects.forEach(s => all.push({ s, sem })));
  let ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Gradintel//EN\r\nCALSCALE:GREGORIAN\r\n`;
  let count = 0;
  all.forEach(({ s }) => {
    (s.exams || []).filter(e => !e.taken).forEach(e => {
      if (!examDates[e.id]) return;
      const d = examDates[e.id].replace(/-/g, '');
      ics += `BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:${d}\r\nDTEND;VALUE=DATE:${d}\r\n`;
      ics += `SUMMARY:${e.name} — ${s.name}\r\n`;
      ics += `DESCRIPTION:Weight: ${e.weight.toFixed(0)}% of course grade\r\n`;
      ics += `UID:${e.id}@gradintel\r\nEND:VEVENT\r\n`;
      count++;
    });
  });
  ics += `END:VCALENDAR`;
  if (!count) { showToast('⚠️ Add dates to exams first!'); return; }
  const blob = new Blob([ics], { type: 'text/calendar' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'gradintel_exams.ics'; a.click();
  showToast(`Exported ${count} exam${count !== 1 ? 's' : ''} to calendar!`);
}

// ══════════════════════════════════════════════════════════════
// AI KEY MANAGEMENT
// ══════════════════════════════════════════════════════════════
const AI_KEY_STORAGE  = 'gradintel_ai_key';
const AI_PROV_STORAGE = 'gradintel_ai_provider';
let selectedProvider  = null;

function getStoredAIKey()      { return localStorage.getItem(AI_KEY_STORAGE) || ''; }
function getStoredAIProvider() { return localStorage.getItem(AI_PROV_STORAGE) || ''; }

function renderAIKeyStatusBar() {
  const bar = document.getElementById('ai-key-status-bar');
  if (!bar) return;
  const key  = getStoredAIKey();
  const prov = getStoredAIProvider();
  const provLabels = { groq: '⚡ Groq', gemini: '✨ Gemini', claude: '🧠 Claude', openai: '🤖 ChatGPT' };
  if (key && prov) {
    const masked = key.slice(0,6) + '••••••••' + key.slice(-4);
    bar.innerHTML = `<div class="ai-key-bar configured">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="color:var(--green);font-weight:700">${provLabels[prov] || prov}</span>
        <span style="color:var(--muted)">${masked}</span>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary" style="font-size:11px;padding:5px 12px" onclick="openAIKeyModal()">Change</button>
        <button class="btn btn-red" style="font-size:11px;padding:5px 12px" onclick="deleteAIKey()">Remove</button>
      </div>
    </div>`;
  } else {
    bar.innerHTML = `<div class="ai-key-bar configured" style="border-color:rgba(52,211,153,.3);background:rgba(52,211,153,.05)">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="color:var(--green);font-weight:700">🟢 AI Ready</span>
        <span style="color:var(--muted);font-size:12px">Using free built-in AI — no setup needed</span>
      </div>
      <button class="btn btn-secondary" style="font-size:11px;padding:5px 12px" onclick="openAIKeyModal()">Use own key</button>
    </div>`;
  }
}

function openAIKeyModal() {
  selectedProvider = getStoredAIProvider() || null;
  ksGoStep1();
  if (selectedProvider) {
    document.querySelectorAll('.ai-prov-card').forEach(c => c.classList.remove('selected'));
    const el = document.getElementById('prov-' + selectedProvider);
    if (el) el.classList.add('selected');
    const btn = document.getElementById('ks-next-1');
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  }
  document.getElementById('ai-key-modal').classList.add('show');
}

function closeAIKeyModal() {
  document.getElementById('ai-key-modal').classList.remove('show');
}

function deleteAIKey() {
  if (!confirm('Remove your saved API key?')) return;
  localStorage.removeItem(AI_KEY_STORAGE);
  localStorage.removeItem(AI_PROV_STORAGE);
  renderAIKeyStatusBar();
  showToast('🗑️ API key removed.');
}

function selectProvider(prov) {
  selectedProvider = prov;
  document.querySelectorAll('.ai-prov-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('prov-' + prov).classList.add('selected');
  const btn = document.getElementById('ks-next-1');
  btn.disabled = false; btn.style.opacity = '1';
}

function ksSetStepUI(active) {
  [1,2,3].forEach(n => {
    const dot = document.getElementById('ks-s' + n + '-dot');
    const lbl = document.getElementById('ks-s' + n + '-lbl');
    if (!dot) return;
    if (n < active)       { dot.style.background='var(--accent)'; dot.style.color='#fff'; dot.textContent='✓'; }
    else if (n === active) { dot.style.background='var(--accent)'; dot.style.color='#fff'; dot.textContent=n; if(lbl) lbl.style.color='var(--accent)'; }
    else                   { dot.style.background='var(--surface3)'; dot.style.color='var(--muted)'; dot.textContent=n; if(lbl) lbl.style.color='var(--muted)'; }
  });
}

function ksGoStep1() {
  document.getElementById('ks-step-1').classList.remove('hidden');
  document.getElementById('ks-step-2').classList.add('hidden');
  document.getElementById('ks-step-3').classList.add('hidden');
  ksSetStepUI(1);
}

function ksGoStep2() {
  if (!selectedProvider) { showToast('Pick a provider first!'); return; }
  document.getElementById('ks-step-1').classList.add('hidden');
  document.getElementById('ks-step-2').classList.remove('hidden');
  document.getElementById('ks-step-3').classList.add('hidden');
  ksSetStepUI(2);
  const instructions = {
    groq: { title: '⚡ Getting your free Groq API key', badge: '100% FREE — No credit card ever', badgeColor: 'var(--green)',
      steps: [
        { text: 'Go to <a href="https://console.groq.com" target="_blank">console.groq.com</a>' },
        { text: 'Click <strong>"Sign Up"</strong> — use your Google or GitHub account (fastest)' },
        { text: 'Once logged in, click <strong>"API Keys"</strong> in the left sidebar' },
        { text: 'Click <strong>"Create API Key"</strong> → give it any name' },
        { text: 'Copy the key — it starts with: <code>gsk_...</code>' },
        { text: 'Paste it in the next step. Groq is <strong>completely free</strong> — runs Llama 3.3 (very smart) at lightning speed!' }
      ]
    },
    gemini: { title: '✨ Getting your free Gemini API key', badge: 'FREE — No credit card needed', badgeColor: 'var(--green)',
      steps: [
        { text: 'Go to <a href="https://aistudio.google.com/apikey" target="_blank">aistudio.google.com/apikey</a>' },
        { text: 'Sign in with your <strong>Google account</strong>' },
        { text: 'Click <strong>"Create API key"</strong> → then <strong>"Create API key in new project"</strong>' },
        { text: 'Copy the key — it looks like: <code>AIzaSy...</code>' },
        { text: 'Paste it in the next step. Free tier gives you plenty of daily requests!' }
      ]
    },
    claude: { title: '🧠 Getting your Claude API key', badge: 'Paid (best for syllabus PDF)', badgeColor: 'var(--accent)',
      steps: [
        { text: 'Go to <a href="https://console.anthropic.com" target="_blank">console.anthropic.com</a>' },
        { text: 'Click <strong>"Sign up"</strong> → create an account' },
        { text: '<strong>Add a payment method</strong> and purchase at least $5 in credits' },
        { text: 'Go to <strong>"API Keys"</strong> in the left sidebar → click <strong>"Create Key"</strong>' },
        { text: 'Copy the key — it starts with: <code>sk-ant-...</code>' },
        { text: '💡 Claude is the <strong>only option for syllabus PDF upload</strong> — worth it if you use that feature!' }
      ]
    },
    openai: { title: '🤖 Getting your OpenAI API key', badge: 'Paid', badgeColor: 'var(--yellow)',
      steps: [
        { text: 'Go to <a href="https://platform.openai.com/api-keys" target="_blank">platform.openai.com/api-keys</a>' },
        { text: 'Click <strong>"Sign up"</strong> if you don\'t have an account' },
        { text: '<strong>Add a payment method</strong> — requires a minimum top-up' },
        { text: 'Click <strong>"Create new secret key"</strong> → give it any name' },
        { text: 'Copy the key — it starts with: <code>sk-proj-...</code> or <code>sk-...</code>' },
        { text: 'Paste it in the next step.' }
      ]
    }
  };
  const instr = instructions[selectedProvider];
  document.getElementById('ks-instructions').innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
      <div style="font-family:'Clash Display',sans-serif;font-weight:700;font-size:16px">${instr.title}</div>
      <span style="padding:2px 10px;border-radius:100px;font-size:10px;font-weight:700;background:${instr.badgeColor}22;color:${instr.badgeColor}">${instr.badge}</span>
    </div>
    <div class="ks-instr-box">
      ${instr.steps.map((s,i) => `<div class="ks-instr-step"><div class="ks-step-num">${i+1}</div><div class="ks-step-text">${s.text}</div></div>`).join('')}
    </div>
    <div style="font-size:11px;color:var(--muted);margin-top:10px;line-height:1.7">
      💡 <strong>Tip:</strong> Keep this tab open and open the link in a new tab. Come back here once you have your key.
    </div>`;
}

function ksGoStep3() {
  document.getElementById('ks-step-2').classList.add('hidden');
  document.getElementById('ks-step-3').classList.remove('hidden');
  ksSetStepUI(3);
  const labels = { groq: 'Groq API Key (starts with gsk_...)', gemini: 'Gemini API Key (starts with AIzaSy...)', claude: 'Claude API Key (starts with sk-ant-...)', openai: 'OpenAI API Key (starts with sk-...)' };
  document.getElementById('ks-key-label').textContent = labels[selectedProvider] || 'API Key';
  const existing = getStoredAIKey();
  document.getElementById('ks-key-input').value = (existing && getStoredAIProvider() === selectedProvider) ? existing : '';
  document.getElementById('ks-err').style.display = 'none';
  setTimeout(() => document.getElementById('ks-key-input').focus(), 100);
}

function ksSaveKey() {
  const key = document.getElementById('ks-key-input').value.trim();
  const errEl = document.getElementById('ks-err');
  errEl.style.display = 'none';
  if (!key) { errEl.textContent = 'Please paste your API key first.'; errEl.style.display='block'; return; }
  const formats = { groq: { prefix:'gsk_', hint:'Groq keys start with "gsk_"' }, gemini: { prefix:'AIza', hint:'Gemini keys start with "AIzaSy"' }, claude: { prefix:'sk-ant', hint:'Claude keys start with "sk-ant-"' }, openai: { prefix:'sk-', hint:'OpenAI keys start with "sk-"' } };
  const fmt = formats[selectedProvider];
  if (fmt && !key.startsWith(fmt.prefix)) { errEl.textContent = '⚠️ That doesn\'t look right. ' + fmt.hint + '. Make sure you copied the full key.'; errEl.style.display='block'; return; }
  localStorage.setItem(AI_KEY_STORAGE, key);
  localStorage.setItem(AI_PROV_STORAGE, selectedProvider);
  closeAIKeyModal();
  renderAIKeyStatusBar();
  showToast('AI key saved! You can now use the assistant.');
}

// ══════════════════════════════════════════════════════════════
// SYLLABUS UPLOAD — AI EXTRACTION
// ══════════════════════════════════════════════════════════════
let syllabusExtracted = [];

async function handleSyllabusUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const key  = getStoredAIKey();
  const prov = getStoredAIProvider();
  const statusEl = document.getElementById('syllabus-status');
  const labelEl  = document.getElementById('syllabus-upload-label');

  const isPDF   = file.type === 'application/pdf';
  const isImage = file.type.startsWith('image/');
  const isText  = file.type === 'text/plain' || file.name.endsWith('.txt');

  labelEl.classList.add('loading');
  labelEl.textContent = '⏳ Reading syllabus...';
  statusEl.style.display = 'block';
  statusEl.innerHTML = `<div class="infobox" style="display:flex;align-items:center;gap:10px"><span style="animation:spin 1s linear infinite;display:inline-block;font-size:18px">⚙️</span><span>AI is reading your syllabus...</span></div>`;

  const systemPrompt = `You are an academic syllabus parser. Extract course/subject grading information.
Return ONLY valid JSON — no markdown, no explanation, no code fences. Just the raw JSON object.

Return this exact structure:
{"subjects":[{"name":"Subject Name","credits":null,"other_pct":80,"exam_pct":20,"exams":[{"name":"Midterm","weight":50},{"name":"Final","weight":50}],"missing":["credits"]}],"confidence":"high|medium|low","warnings":[]}

=== WHAT COUNTS AS AN EXAM (goes into exam_pct) ===
ONLY these words mean exam: test, tests, exam, exams, midterm, mid-term, final, finals, end-term.
"Test" and "Tests" ARE exams. Not quizzes. Not labs. Tests = exams.

=== WHAT COUNTS AS OTHER (goes into other_pct) ===
Everything else: quiz, quizzes, assignment, assignments, lab, labs, reading, homework, participation, attendance, project, projects.

=== WORKED EXAMPLE (this is how you must think) ===
Syllabus says:
  Reading Assignments 25%
  Quizzes 15%
  Tests 20%
  Labs 40%

Step 1: Find exam items → "Tests 20%" → exam_pct = 20
Step 2: other_pct = 100 - 20 = 80
Step 3: Exam names → the syllabus mentions "midterm" and "final" as the two tests → exams: [{name:"Midterm",weight:50},{name:"Final",weight:50}]
  (each is 50% of the exam portion because 10%+10% = 20% total, so each is 10/20*100 = 50%)
Step 4: credits → not mentioned → null, add "credits" to missing array

Result: {"subjects":[{"name":"Computer Science I","credits":null,"other_pct":80,"exam_pct":20,"exams":[{"name":"Midterm","weight":50},{"name":"Final","weight":50}],"missing":["credits"]}],"confidence":"high","warnings":[]}

=== RULES ===
- other_pct = 100 - exam_pct. ALWAYS. Never put exam items into other_pct.
- All exam weights must add up to 100 (they are % of the exam portion, not of total grade).
- If individual exam % not given but count is known, split equally (e.g. 2 exams → 50/50).
- Credits: only set if explicitly stated. Otherwise null.
- "missing": only list "credits" if not found, and "exam weights" if you had to guess them equally.
- NEVER list other_pct, exam_pct, or exams as missing — always calculate them.`;

  try {
    let rawText = '';

    if (isPDF) {
      // Extract text from PDF using PDF.js — completely free, runs in browser
      statusEl.innerHTML = `<div class="infobox" style="display:flex;align-items:center;gap:10px"><span style="animation:spin 1s linear infinite;display:inline-block;font-size:18px">⚙️</span><span>Extracting text from PDF...</span></div>`;
      const pdfText = await extractPDFText(file);
      if (!pdfText || pdfText.trim().length < 50) {
        // Scanned/image-based PDF — needs Claude vision
        if (key && prov === 'claude') {
          const base64 = await fileToBase64(file);
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
            body: JSON.stringify({ model: 'claude-opus-4-6', max_tokens: 2000, system: systemPrompt,
              messages: [{ role: 'user', content: [
                { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
                { type: 'text', text: 'Extract subject info. Return only JSON.' }
              ]}]
            })
          });
          const data = await response.json();
          if (data.error) throw new Error(data.error.message);
          rawText = data.content?.[0]?.text || '';
        } else {
          throw new Error('This PDF appears to be a scanned image and has no readable text. Please either: (1) use a text-based PDF, or (2) set up a Claude API key for image reading.');
        }
      } else {
        // Has text — send to free Pollinations AI
        statusEl.innerHTML = `<div class="infobox" style="display:flex;align-items:center;gap:10px"><span style="animation:spin 1s linear infinite;display:inline-block;font-size:18px">⚙️</span><span>Analysing syllabus content...</span></div>`;
        const res = await fetch('https://text.pollinations.ai/openai', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'openai', messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: 'Parse this syllabus:\n\n' + pdfText.slice(0, 8000) }
          ]})
        });
        const d = await res.json();
        rawText = d.choices?.[0]?.message?.content || '';
      }
    } else if (isImage) {
      if (key && prov === 'claude') {
        const base64 = await fileToBase64(file);
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
          body: JSON.stringify({ model: 'claude-opus-4-6', max_tokens: 2000, system: systemPrompt,
            messages: [{ role: 'user', content: [
              { type: 'image', source: { type: 'base64', media_type: file.type, data: base64 } },
              { type: 'text', text: 'Extract subject info. Return only JSON.' }
            ]}]
          })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        rawText = data.content?.[0]?.text || '';
      } else {
        throw new Error('Image syllabuses require a Claude API key. Please upload a PDF or .txt file instead — those work for free!');
      }
    } else {
      // Plain text file — free
      const fileText = await file.text();
      const res = await fetch('https://text.pollinations.ai/openai', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'openai', messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Parse this syllabus:\n\n' + fileText.slice(0, 8000) }
        ]})
      });
      const d = await res.json();
      rawText = d.choices?.[0]?.message?.content || '';
    }

    if (!rawText) throw new Error('No response from AI. Please try again.');
    let parsed;
    try { parsed = JSON.parse(rawText.replace(/```json|```/g, '').trim()); }
    catch(e) { throw new Error('Could not parse AI response. Please try again.'); }
    if (!parsed.subjects || !parsed.subjects.length) throw new Error('No subject info found in this file.');
    syllabusExtracted = parsed.subjects;
    showSyllabusPreview(parsed);
  } catch(e) {
    statusEl.innerHTML = `<div class="syl-no-key">❌ <strong>Could not read syllabus:</strong> ${e.message}</div>`;
  }
  labelEl.classList.remove('loading');
  labelEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Upload Syllabus<input type="file" id="syllabus-file-inp" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt" style="display:none" onchange="handleSyllabusUpload(this)"/>';
  input.value = '';
}

async function extractPDFText(file) {
  // Dynamically load PDF.js from CDN
  if (!window.pdfjsLib) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = resolve; script.onerror = reject;
      document.head.appendChild(script);
    });
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    fullText += content.items.map(item => item.str).join(' ') + '\n';
  }
  return fullText;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(r.result.split(',')[1]);
    r.onerror = () => reject(new Error('Could not read file'));
    r.readAsDataURL(file);
  });
}

function showSyllabusPreview(parsed) {
  const statusEl = document.getElementById('syllabus-status');
  const subjects = parsed.subjects;
  const hasWarnings = parsed.warnings && parsed.warnings.length;
  const isLow = parsed.confidence === 'low';
  let html = `<div class="syl-preview"><div class="syl-preview-hdr"><div class="syl-preview-title">✅ Found ${subjects.length} subject${subjects.length!==1?'s':''} — review & confirm</div><button class="btn btn-secondary" style="font-size:11px;padding:5px 12px" onclick="clearSyllabusUpload()">✕ Clear</button></div>`;
  if (hasWarnings || isLow) html += `<div class="syl-warning">⚠️ ${isLow?'Low confidence — ':''}${(parsed.warnings||[]).join(' · ')||'Some details may be inaccurate. Please review.'}</div>`;
  html += `<div style="font-size:12px;color:var(--muted2);margin-bottom:10px;margin-top:${hasWarnings?'10px':'0'}">Click subjects to select which ones to add. Then click <strong>"Fill Forms with Selected"</strong>.<br/>You'll still need to enter your <strong>Other Stuff score</strong> and mark <strong>which exams you've taken</strong>.</div><div id="syl-chips" style="margin-bottom:14px">`;
  subjects.forEach((s, i) => {
    const examSummary = (s.exams||[]).map(e => `${e.name} ${e.weight}%`).join(' · ');
    html += `<div class="syl-subj-chip sel" id="sylchip-${i}" onclick="toggleSylChip(${i})"><span id="sylchip-ico-${i}">✓</span><span><strong>${s.name}</strong><div class="syl-field-preview">${s.credits} cr · Exams ${s.exam_pct}% · Other ${s.other_pct}%${examSummary?'<br/>'+examSummary:''}</div></span></div>`;
  });
  html += `</div><div class="btn-row" style="margin-top:0"><button class="btn btn-ghost" onclick="selectAllSylChips()">Select All</button><button class="btn btn-primary" onclick="fillFormsFromSyllabus()"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0"><path d="M12 3v3M12 18v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M3 12h3M18 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg> Fill Forms with Selected →</button></div></div>`;
  statusEl.innerHTML = html;
}

function toggleSylChip(i) {
  const chip = document.getElementById('sylchip-' + i);
  const ico  = document.getElementById('sylchip-ico-' + i);
  ico.textContent = chip.classList.toggle('sel') ? '✓' : '○';
}

function selectAllSylChips() {
  syllabusExtracted.forEach((_, i) => {
    const chip = document.getElementById('sylchip-' + i);
    const ico  = document.getElementById('sylchip-ico-' + i);
    if (chip && !chip.classList.contains('sel')) { chip.classList.add('sel'); ico.textContent = '✓'; }
  });
}

function clearSyllabusUpload() {
  syllabusExtracted = [];
  const el = document.getElementById('syllabus-status');
  el.style.display = 'none'; el.innerHTML = '';
}

function fillFormsFromSyllabus() {
  const selected = syllabusExtracted.filter((_, i) => {
    const chip = document.getElementById('sylchip-' + i);
    return chip && chip.classList.contains('sel');
  });
  if (!selected.length) { showToast('Select at least one subject!'); return; }
  if (selected.length === 1) { setMode('single'); } else { setMode('multi'); document.getElementById('n-subjs').value = selected.length; }
  setStep(2);
  document.getElementById('pg-setup').classList.add('hidden');
  document.getElementById('pg-subjects').classList.remove('hidden');
  buildForms(selected.length);
  setTimeout(() => {
    // Track what's missing across all subjects
    const allMissing = new Set();

    selected.forEach((s, idx) => {
      // Name — always fill
      const nmEl = document.getElementById(`s${idx}_nm`); if (nmEl) nmEl.value = s.name || '';

      // Credits — only fill if found, otherwise leave blank for user
      const crEl = document.getElementById(`s${idx}_cr`);
      if (crEl) {
        if (s.credits != null) { crEl.value = s.credits; }
        else { crEl.value = ''; allMissing.add('Credits'); }
      }

      // Other % — only fill if found
      const opEl = document.getElementById(`s${idx}_op`);
      if (opEl) {
        if (s.other_pct != null) { opEl.value = s.other_pct; updEP(idx); }
        else if (s.exam_pct != null) { opEl.value = 100 - s.exam_pct; updEP(idx); }
        else { opEl.value = ''; allMissing.add('Other Stuff %'); }
      }

      // Exams
      const neEl = document.getElementById(`s${idx}_ne`);
      if (neEl && s.exams && s.exams.length) {
        neEl.value = s.exams.length; rebuildEx(idx);
        setTimeout(() => {
          document.querySelectorAll(`#s${idx}_ex .exam-card`).forEach((card, ei) => {
            const exam = s.exams[ei]; if (!exam) return;
            const nmInput = card.querySelector('[data-f="nm"]');
            const wtInput = card.querySelector('[data-f="wt"]');
            if (nmInput) nmInput.value = exam.name || '';
            if (wtInput) {
              if (exam.weight != null) { wtInput.value = exam.weight; }
              else { wtInput.value = ''; allMissing.add('Exam weights'); }
            }
          });
        }, 80);
      } else {
        allMissing.add('Exam names & weights');
      }

      // Collect any "missing" fields the AI flagged — filter out internal names already handled above
      const skipFields = new Set(['other_pct','exam_pct','exams']); // these are handled by the form itself
      if (s.missing && s.missing.length) {
        s.missing.filter(m => !skipFields.has(m)).forEach(m => allMissing.add(m));
      }
    });

    document.getElementById('pg-subjects').scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Build a specific banner telling the user exactly what to fill in
    const existingBanner = document.getElementById('syl-fill-banner');
    if (existingBanner) existingBanner.remove();
    const banner = document.createElement('div');
    banner.id = 'syl-fill-banner';
    banner.style.cssText = 'border-radius:var(--r);padding:16px 18px;margin-bottom:16px;border:1px solid rgba(129,140,248,.3);background:rgba(129,140,248,.06)';

    const alwaysNeeded = [
      '📊 Your <strong>Other Stuff score</strong> — your actual score out of 100 for assignments/attendance/quizzes',
      '✅ Mark which exams you\'ve <strong>already taken</strong> and enter your score'
    ];
    const fromMissing = [...allMissing].map(m => `⚠️ <strong>${m}</strong> — not found in the syllabus, please fill in manually`);
    const allItems = [...alwaysNeeded, ...fromMissing];

    banner.innerHTML = `<div style="font-family:'Clash Display',sans-serif;font-weight:700;font-size:14px;margin-bottom:10px;color:var(--accent)">✨ Pre-filled from syllabus! You still need to fill in:</div>
      <ul style="margin:0;padding-left:18px;font-size:13px;line-height:2">
        ${allItems.map(item => `<li>${item}</li>`).join('')}
      </ul>`;
    document.getElementById('subj-forms').prepend(banner);

    showToast(`✨ ${selected.length} subject${selected.length!==1?'s':''} pre-filled!`);
  }, 120);
}

// ══════════════════════════════════════════════════════════════
// AI ASSISTANT — MULTI PROVIDER
// ══════════════════════════════════════════════════════════════
async function runAI() {
  const inp = document.getElementById('ai-input').value.trim();
  if (!inp) { showToast('Type a question first!'); return; }
  const key  = getStoredAIKey();
  const prov = getStoredAIProvider();

  const btn = document.getElementById('ai-send-btn');
  btn.disabled = true; btn.textContent = 'Thinking...';
  const resp = document.getElementById('ai-resp');
  resp.className = 'ai-resp show ai-typing';
  resp.textContent = 'Analysing your situation...';

  const { cumGPA } = computeAllGPA();
  const subjectSummary = semesters.flatMap(sem => sem.subjects.map(s => {
    const res = computeSubject(s);
    return s.name + ': ' + res.cur.toFixed(1) + '% (' + res.curG.l + '), ' + res.remExams.length + ' exams left';
  })).join('; ');
  const systemPrompt = 'You are Gradintel, an AI academic advisor built into a GPA tracker app. Be concise and practical. GPA scale: ' + (policies?.scale || '4.0') + '. Cumulative GPA: ' + cumGPA.toFixed(4) + '. ' + (subjectSummary ? 'Current subjects: ' + subjectSummary + '.' : 'No subjects added yet.') + ' Answer in 3-5 sentences. Give specific numbers and actionable advice. Be direct and encouraging.';

  try {
    let text = '';

    if (!key || !prov) {
      // FREE built-in: Pollinations.AI — no key, no signup, always works
      const res = await fetch('https://text.pollinations.ai/openai', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'openai', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: inp }] })
      });
      const d = await res.json();
      text = d.choices?.[0]?.message?.content || '';
      if (!text) throw new Error('No response. Please try again in a moment.');
    } else if (prov === 'groq') {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({ model: 'llama-3.3-70b-versatile', max_tokens: 400, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: inp }] })
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error.message);
      text = d.choices?.[0]?.message?.content || '';
    } else if (prov === 'gemini') {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt + '\n\nStudent question: ' + inp }] }] })
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error.message);
      text = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else if (prov === 'claude') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 400, system: systemPrompt, messages: [{ role: 'user', content: inp }] })
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error.message);
      text = d.content?.[0]?.text || '';
    } else if (prov === 'openai') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 400, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: inp }] })
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error.message);
      text = d.choices?.[0]?.message?.content || '';
    }
    if (!text) throw new Error('Empty response. Please try again.');
    resp.className = 'ai-resp show';
    resp.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/\n/g, '<br/>');
  } catch(e) {
    const tips = { groq: 'Check your key at <a href="https://console.groq.com" target="_blank" style="color:var(--accent)">console.groq.com</a>', gemini: 'Check your key at <a href="https://aistudio.google.com/apikey" target="_blank" style="color:var(--accent)">aistudio.google.com/apikey</a>', claude: 'Check your key at <a href="https://console.anthropic.com" target="_blank" style="color:var(--accent)">console.anthropic.com</a>', openai: 'Check your key at <a href="https://platform.openai.com/api-keys" target="_blank" style="color:var(--accent)">platform.openai.com</a>' };
    resp.className = 'ai-resp show';
    if (key && prov) {
      resp.innerHTML = `<span style="color:var(--red)">❌ <strong>Error:</strong> ${e.message}</span><br/><br/><span style="color:var(--muted2);font-size:12px">${tips[prov]||'Check your API key and try again.'}</span><br/><br/><button class="btn btn-secondary" style="font-size:12px;padding:7px 14px" onclick="openAIKeyModal()">Update Key</button>`;
    } else {
      resp.innerHTML = `<span style="color:var(--red)">❌ ${e.message}</span><br/><br/><span style="color:var(--muted2);font-size:12px">The free AI is temporarily unavailable. Try again in a moment, or <button class="btn btn-secondary" style="font-size:11px;padding:4px 10px;margin-left:4px" onclick="openAIKeyModal()">use your own key</button></span>`;
    }
  }
  btn.disabled = false; btn.textContent = 'Ask AI →';
}

function genStudyPlan() {
  const hrs = parseInt(document.getElementById('plan-hrs').value) || 3;
  const days = parseInt(document.getElementById('plan-days').value) || 14;
  const out = document.getElementById('plan-output');
  const all = []; semesters.forEach(sem => sem.subjects.forEach(s => all.push(s)));
  const withRem = all.filter(s => (s.exams || []).some(e => !e.taken));
  if (!withRem.length) { out.innerHTML = '<div class="infobox">No remaining exams to plan for!</div>'; return; }

  const totalHrs = hrs * days;
  const examList = [];
  withRem.forEach(s => {
    const res = computeSubject(s);
    res.remExams.forEach(ex => {
      const bTarg = res.targets.find(t => t.l === 'B');
      const nd = bTarg?.perExam.find(p => p.name === ex.name)?.needed || 75;
      const urgency = nd > 100 ? 0.5 : nd > 80 ? 1.5 : nd > 60 ? 1.2 : 1.0;
      const weight = ex.gf * urgency;
      examList.push({ name: ex.name, subject: s.name, weight, gf: ex.gf });
    });
  });
  const totalWeight = examList.reduce((a, e) => a + e.weight, 0);
  const weeks = Math.ceil(days / 7);
  let html = `<div class="infobox">${totalHrs}h total · ${days} days · ${examList.length} exams to cover</div>`;
  for (let w = 0; w < weeks; w++) {
    const weekDays = Math.min(7, days - w * 7);
    const weekHrs = hrs * weekDays;
    html += `<div style="margin-bottom:16px"><div style="font-family:'Clash Display',sans-serif;font-weight:700;font-size:13px;color:var(--accent);margin-bottom:8px">Week ${w + 1} — ${weekHrs}h</div>`;
    examList.forEach(ex => {
      const allocated = Math.round((ex.weight / totalWeight) * weekHrs * 10) / 10;
      if (allocated < 0.5) return;
      html += `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);font-size:13px">
        <span>${ex.name} <span style="color:var(--muted);font-size:11px">· ${ex.subject}</span></span>
        <span style="color:var(--accent4);font-family:'Clash Display',sans-serif;font-weight:700">${allocated}h</span>
      </div>`;
    });
    html += '</div>';
  }
  out.innerHTML = html;
}

// ══════════════════════════════════════════════════════════════
// HISTORY
// ══════════════════════════════════════════════════════════════
function renderHistory() {
  const list = document.getElementById('history-list'); list.innerHTML = '';
  const tc = document.getElementById('sem-trend-card');
  if (!semesters.length) { list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">No semesters yet.</div>'; tc.style.display = 'none'; return; }
  semesters.forEach(sem => {
    const cl = closestL(sem._gpa || 0); const col = gCol(cl);
    const card = document.createElement('div'); card.className = 'sem-card';
    card.innerHTML = `<div class="sem-gpa" style="color:${col}">${(sem._gpa || 0).toFixed(2)}</div>
      <div class="sem-info"><div class="sem-name">${sem.name}</div>
        <div class="sem-meta">${sem.date || ''} · ${(sem.subjects || []).length} subject${(sem.subjects || []).length !== 1 ? 's' : ''} · Cloud Synced ☁️</div></div>
      <button style="background:transparent;border:none;color:var(--red);cursor:pointer;font-size:16px;opacity:.5;transition:opacity .2s;padding:4px" onclick="deleteSem('${sem.id}');event.stopPropagation()">🗑️</button>`;
    card.onclick = () => toggleSemDetail(card, sem);
    list.appendChild(card);
  });
  if (semesters.length > 1) { tc.style.display = 'block'; buildSemTrendChart(); } else tc.style.display = 'none';
}
function toggleSemDetail(card, sem) {
  const ex = card.nextElementSibling;
  if (ex && ex.classList.contains('semdet')) { ex.remove(); return; }
  const d = document.createElement('div'); d.className = 'semdet';
  d.style.cssText = 'background:var(--surface2);border:1px solid var(--border);border-radius:var(--r);padding:14px 18px;margin-bottom:8px';
  d.innerHTML = (sem.subjects || []).map(s => { const res = computeSubject(s); return `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);font-size:13px"><span>${s.name} (${s.credits} cr)</span><span style="color:${gCol(res.curG.l)}">${res.curG.l} · ${res.cur.toFixed(1)}%</span></div>`; }).join('');
  card.after(d);
}
async function deleteSem(id) {
  if (!confirm('Delete this semester?')) return;
  await deleteSemesterFromDB(id);
  updateStats(); renderDashboard(); renderCourses(); renderHistory(); renderWIFull(); renderStudy(); renderROI();
  showToast('Semester deleted.');
}

// ══════════════════════════════════════════════════════════════
// CHARTS
// ══════════════════════════════════════════════════════════════
function buildGradeChart() {
  if (chartInst) { chartInst.destroy(); chartInst = null; }
  const ctx = document.getElementById('gradeChart'); if (!ctx) return;
  chartInst = new Chart(ctx.getContext('2d'), { type: 'bar',
    data: { labels: calcSubjs.map(s => s.name), datasets: [{ label: 'Score (%)', data: calcRes.map(r => r.cur.toFixed(1)), backgroundColor: calcRes.map(r => gCol(r.curG.l) + '55'), borderColor: calcRes.map(r => gCol(r.curG.l)), borderWidth: 2, borderRadius: 8, borderSkipped: false }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${c.parsed.y}% — ${pctToG(c.parsed.y).l}` } } },
      scales: { y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,.05)' }, ticks: { color: '#6b7280', callback: v => v + '%' } }, x: { grid: { display: false }, ticks: { color: '#6b7280' } } } }
  });
}
function buildTrendChart() {
  if (trendInst) { trendInst.destroy(); trendInst = null; }
  const ctx = document.getElementById('trendChart'); if (!ctx) return;
  const pts = [];
  if (profile.mode === 'existing' && profile.start_gpa > 0) pts.push({ x: 'Before', y: profile.start_gpa });
  semesters.forEach(s => pts.push({ x: s.name, y: parseFloat((s._gpa || 0).toFixed(4)) }));
  if (pts.length < 2) { document.getElementById('dash-chart-card').style.display = 'none'; return; }
  trendInst = new Chart(ctx.getContext('2d'), { type: 'line',
    data: { labels: pts.map(p => p.x), datasets: [{ label: 'GPA', data: pts.map(p => p.y), borderColor: '#818cf8', backgroundColor: 'rgba(129,140,248,.1)', tension: .4, pointBackgroundColor: '#818cf8', pointRadius: 5, fill: true }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
      scales: { y: { min: 0, max: Math.max(...GPA.map(g=>g.p)), grid: { color: 'rgba(255,255,255,.05)' }, ticks: { color: '#6b7280' } }, x: { grid: { display: false }, ticks: { color: '#6b7280' } } } }
  });
}
function buildSemTrendChart() {
  if (semTrendInst) { semTrendInst.destroy(); semTrendInst = null; }
  const ctx = document.getElementById('semTrendChart'); if (!ctx) return;
  const pts = [];
  if (profile.mode === 'existing' && profile.start_gpa > 0) pts.push({ x: 'Before', y: profile.start_gpa });
  semesters.forEach(s => pts.push({ x: s.name, y: parseFloat((s._gpa || 0).toFixed(4)) }));
  semTrendInst = new Chart(ctx.getContext('2d'), { type: 'line',
    data: { labels: pts.map(p => p.x), datasets: [{ label: 'GPA', data: pts.map(p => p.y), borderColor: '#818cf8', backgroundColor: 'rgba(129,140,248,.1)', tension: .4, pointBackgroundColor: '#818cf8', pointRadius: 6, fill: true }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
      scales: { y: { min: 0, max: Math.max(...GPA.map(g=>g.p)), grid: { color: 'rgba(255,255,255,.05)' }, ticks: { color: '#6b7280' } }, x: { grid: { display: false }, ticks: { color: '#6b7280' } } } }
  });
}

// ══════════════════════════════════════════════════════════════
// EXPORT / IMPORT
// ══════════════════════════════════════════════════════════════
function exportJSON() {
  const data = { version: '4.0', exported: new Date().toISOString(), profile, semesters, policies };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `gradintel_backup_${new Date().toISOString().slice(0,10)}.json`; a.click();
  showToast('JSON backup downloaded!');
}
function exportCSV() {
  let csv = 'Semester,Subject,Credits,Status,Score (%),Grade,GPA Points,Exams Taken,Exams Remaining\n';
  semesters.forEach(sem => {
    (sem.subjects || []).forEach(s => {
      const res = computeSubject(s);
      csv += `"${sem.name}","${s.name}",${s.credits},${s.status||'normal'},${res.cur.toFixed(2)},${res.curG.l},${res.curG.p.toFixed(4)},${res.takenExams.length},${res.remExams.length}\n`;
    });
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `gradintel_courses_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  showToast('CSV exported!');
}
async function importJSON(input) {
  const file = input.files[0]; if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data.semesters) { showToast('❌ Invalid backup file.'); return; }
    let imported = 0;
    for (const sem of data.semesters) {
      const existing = semesters.find(s => s.id === sem.id);
      if (!existing) {
        await saveSemesterToDB({ ...sem, user_id: currentUser.id });
        imported++;
      }
    }
    updateStats(); renderDashboard(); renderCourses(); renderHistory(); renderWIFull(); renderStudy(); renderROI();
    showToast(`✅ Imported ${imported} new semester${imported !== 1 ? 's' : ''}!`);
  } catch(e) {
    showToast('❌ Import failed: invalid JSON.');
  }
  input.value = '';
}

// ══════════════════════════════════════════════════════════════
// SHARE + REPORT
// ══════════════════════════════════════════════════════════════
function buildShareCard() {
  const el = document.getElementById('share-el'); if (!el || !calcRes.length) return;
  const s = calcSubjs[activeCalcIdx]; const res = calcRes[activeCalcIdx];
  const g = res.curG; const col = gCol(g.l);
  const top = res.targets.filter(t => t.avg !== null && t.avg <= 100 && t.avg > 0).slice(0, 3);
  el.innerHTML = `<div class="sp-eye">Gradintel · ${new Date().toLocaleDateString()}</div>
    <div class="sp-subj">${s.name}</div>
    <div class="sp-score" style="color:${col}">${res.cur.toFixed(1)}%</div>
    <div style="color:${col};font-size:15px;margin-top:5px">${g.l} · ${g.p.toFixed(4)} quality pts</div>
    ${top.length ? `<div class="sp-targets">${top.map(t => `<div class="sp-ti"><div class="sp-tg" style="color:${gCol(t.l)}">${t.l}</div><div class="sp-ts">Need ${t.avg.toFixed(1)}%</div></div>`).join('')}</div>` : ''}`;
}
function copyShare() {
  if (!calcRes.length) { showToast('No results yet!'); return; }
  const s = calcSubjs[activeCalcIdx]; const res = calcRes[activeCalcIdx];
  let txt = `📊 Gradintel — ${s.name}\nScore: ${res.cur.toFixed(1)}% (${res.curG.l})\n\nNeeded:\n`;
  res.targets.filter(t => t.avg !== null && t.avg <= 100 && t.avg > 0).forEach(t => { txt += `  ${t.l}: ${t.avg.toFixed(1)}% avg\n`; });
  navigator.clipboard.writeText(txt).then(() => showToast('Copied!')).catch(() => showToast('Copy failed'));
}
function dlReport() {
  const now = new Date(); let txt = ''; const L = s => txt += s + '\n';
  L('='.repeat(65)); L('  GRADINTEL — ACADEMIC REPORT'); L(`  User: ${profile?.full_name || ''}${profile?.university ? ' | ' + profile.university : ''}`);
  L(`  GPA Scale: ${policies.scale} · Generated: ${now.toLocaleString()}`); L('='.repeat(65)); L('');
  const { cumGPA, totalCR } = computeAllGPA();
  L(`  CUMULATIVE GPA: ${cumGPA.toFixed(4)} (${closestL(cumGPA)}) · ${totalCR} credits`); L('');
  semesters.forEach(sem => {
    L(`  ── ${sem.name.toUpperCase()} (GPA: ${(sem._gpa||0).toFixed(4)}) ──`);
    (sem.subjects||[]).forEach(s => {
      const res = computeSubject(s); const g = res.curG;
      L(`  ${s.name} (${s.credits} cr) | ${res.cur.toFixed(2)}% | ${g.l} (${g.p.toFixed(4)} pts)`);
      if (res.remExams.length) {
        L('    Needed for:');
        res.targets.slice(0,5).forEach(t => { const a=t.avg; L(`      ${t.l}: ${a===null?'N/A':a>100?'Not possible':a<=0?'Secured':a.toFixed(1)+'%'}`); });
      }
    });
    L('');
  });
  L('-'.repeat(65));
  const blob = new Blob([txt], { type: 'text/plain' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'gradintel_report_' + now.toISOString().replace(/[:.]/g, '-').slice(0, 19) + '.txt'; a.click();
  showToast('📥 Report downloaded!');
}

// ══════════════════════════════════════════════════════════════
// USER MODAL
// ══════════════════════════════════════════════════════════════
function openUserModal() {
  const { cumGPA } = computeAllGPA(); const cl = closestL(cumGPA);
  document.getElementById('user-modal-body').innerHTML = `
    <div style="text-align:center;padding:14px 0 18px">
      <div style="width:56px;height:56px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-family:'Clash Display',sans-serif;font-weight:700;font-size:24px;color:#fff;margin:0 auto 12px">${(profile.full_name||'?')[0].toUpperCase()}</div>
      <div style="font-family:'Clash Display',sans-serif;font-weight:700;font-size:18px">${profile.full_name}</div>
      ${profile.university ? `<div style="font-size:12px;color:var(--muted);margin-top:4px">${profile.university}</div>` : ''}
      <div style="font-size:12px;color:var(--muted);margin-top:4px">${currentUser.email}</div>
      <div style="margin-top:14px;font-family:'Clash Display',sans-serif;font-weight:700;font-size:28px;color:${gCol(cl)}">${cumGPA > 0 ? cumGPA.toFixed(4) : '—'}</div>
      <div style="font-size:12px;color:var(--muted)">Cumulative GPA · ${cl} · ${policies.scale} scale</div>
      <div style="margin-top:10px;font-size:11px;color:var(--green)">☁️ Cloud Synced · ${semesters.length} semester${semesters.length !== 1 ? 's' : ''}</div>
    </div>
    <div class="divider"></div>
    <div style="font-size:12px;color:var(--muted)">Mode: ${profile.mode === 'fresh' ? 'Starting fresh' : 'Continuing student'}</div>
    ${profile.mode === 'existing' ? `<div style="font-size:12px;color:var(--muted);margin-top:4px">Started with: GPA ${profile.start_gpa} (${profile.start_credits} credits)</div>` : ''}

    <!-- EDIT PROFILE SECTION -->
    <div id="edit-profile-section" style="display:none;margin-top:16px;padding:14px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r)">
      <div style="font-family:'Clash Display',sans-serif;font-weight:700;font-size:13px;margin-bottom:12px">✏️ Edit Profile</div>
      <div class="field" style="margin-bottom:10px">
        <label style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.07em">Display Name</label>
        <input type="text" id="edit-name" value="${profile.full_name||''}" placeholder="Your name"
          style="width:100%;padding:9px 12px;background:var(--surface3);border:1px solid var(--border2);border-radius:8px;color:var(--text);font-family:'Cabinet Grotesk',sans-serif;font-size:13px;margin-top:4px"/>
      </div>
      <div class="field" style="margin-bottom:10px">
        <label style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.07em">University</label>
        <input type="text" id="edit-uni" value="${profile.university||''}" placeholder="Your university"
          style="width:100%;padding:9px 12px;background:var(--surface3);border:1px solid var(--border2);border-radius:8px;color:var(--text);font-family:'Cabinet Grotesk',sans-serif;font-size:13px;margin-top:4px"/>
      </div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn btn-primary" style="font-size:12px;padding:8px 14px" onclick="saveProfileEdits()">Save Changes</button>
        <button class="btn btn-ghost" style="font-size:12px;padding:8px 14px" onclick="document.getElementById('edit-profile-section').style.display='none'">Cancel</button>
      </div>
    </div>

    <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-secondary" style="font-size:12px;padding:8px 14px" onclick="document.getElementById('edit-profile-section').style.display=document.getElementById('edit-profile-section').style.display==='none'?'block':'none'">✏️ Edit Profile</button>
      <button class="btn btn-secondary" style="font-size:12px;padding:8px 14px" onclick="document.getElementById('change-pw-section').style.display=document.getElementById('change-pw-section').style.display==='none'?'block':'none'">🔑 Change Password</button>
      <button class="btn btn-secondary" style="font-size:12px;padding:8px 14px" onclick="exportJSON();document.getElementById('user-modal').classList.remove('show')"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg> Export Backup</button>
    </div>
    <div id="change-pw-section" style="display:none;margin-top:16px;padding:14px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r)">
      <div style="font-family:'Clash Display',sans-serif;font-weight:700;font-size:13px;margin-bottom:12px">🔑 Change Password</div>
      <div class="field" style="margin-bottom:10px">
        <label style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.07em">New Password</label>
        <input type="password" id="new-pw-inp" placeholder="At least 6 characters" style="width:100%;padding:9px 12px;background:var(--surface3);border:1px solid var(--border2);border-radius:8px;color:var(--text);font-family:'Cabinet Grotesk',sans-serif;font-size:13px;margin-top:4px"/>
      </div>
      <div class="field" style="margin-bottom:10px">
        <label style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.07em">Confirm New Password</label>
        <input type="password" id="new-pw-confirm" placeholder="Repeat password" style="width:100%;padding:9px 12px;background:var(--surface3);border:1px solid var(--border2);border-radius:8px;color:var(--text);font-family:'Cabinet Grotesk',sans-serif;font-size:13px;margin-top:4px"/>
      </div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn btn-primary" style="font-size:12px;padding:8px 14px" onclick="doChangePassword()">Update Password</button>
        <button class="btn btn-ghost" style="font-size:12px;padding:8px 14px" onclick="document.getElementById('change-pw-section').style.display='none'">Cancel</button>
      </div>
    </div>`;
  document.getElementById('user-modal').classList.add('show');
}

async function saveProfileEdits() {
  const newName = document.getElementById('edit-name')?.value.trim();
  const newUni  = document.getElementById('edit-uni')?.value.trim();
  if (!newName) { showToast('Name cannot be empty'); return; }
  profile.full_name   = newName;
  profile.university  = newUni;
  // Save to Supabase
  try {
    await sb.from('gpa_profiles').upsert({ ...profile, user_id: currentUser.id }, { onConflict: 'user_id' });
  } catch(e) {}
  // Update UI
  document.getElementById('uav').textContent = newName[0].toUpperCase();
  document.getElementById('uname-display').textContent = newName.split(' ')[0];
  document.getElementById('hero-h').textContent = `Welcome back, ${newName.split(' ')[0]}! 👋`;
  if (newUni) document.getElementById('hero-p').textContent = `${newUni} · GPA Dashboard`;
  document.getElementById('user-modal').classList.remove('show');
  showToast('✅ Profile updated!');
}

async function doChangePassword() {
  const pw  = document.getElementById('new-pw-inp')?.value || '';
  const pw2 = document.getElementById('new-pw-confirm')?.value || '';
  if (pw.length < 6) { showToast('⚠️ Password must be at least 6 characters'); return; }
  if (pw !== pw2)    { showToast('⚠️ Passwords do not match'); return; }
  try {
    const { error } = await sb.auth.updateUser({ password: pw });
    if (error) throw error;
    document.getElementById('user-modal').classList.remove('show');
    showToast('✅ Password updated successfully!');
  } catch(e) {
    showToast('❌ ' + (e.message || 'Could not update password'));
  }
}

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════
function getMotiv(score) {
  if (score >= 93) return { ico: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0"><path d="M6 9H4a2 2 0 000 4h2"/><path d="M18 9h2a2 2 0 010 4h-2"/><path d="M6 9V5h12v4"/><path d="M6 9c0 3.3 2.7 6 6 6s6-2.7 6-6"/><line x1="12" y1="15" x2="12" y2="19"/><rect x="8" y="19" width="8" height="2" rx="1"/></svg>`, title: 'Outstanding!', msg: "A level — keep this momentum!" };
  if (score >= 87) return { ico: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`, title: 'Great work!', msg: 'Solid B+. Small push gets you to A!' };
  if (score >= 80) return { ico: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0"><path d="M18 3a3 3 0 00-3 3v12a3 3 0 003 3 3 3 0 003-3 3 3 0 00-3-3H6a3 3 0 00-3 3 3 3 0 003 3 3 3 0 003-3V6a3 3 0 00-3-3 3 3 0 00-3 3 3 3 0 003 3h12a3 3 0 003-3 3 3 0 00-3-3z"/></svg>`, title: 'Doing well!', msg: 'B range. Focus on remaining exams.' };
  if (score >= 73) return { ico: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/><line x1="10" y1="7" x2="16" y2="7"/><line x1="10" y1="11" x2="14" y2="11"/></svg>`, title: 'On track.', msg: 'Consistent effort can push you to B.' };
  if (score >= 60) return { ico: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`, title: 'Needs work.', msg: 'Every point matters now.' };
  return { ico: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`, title: 'Critical zone.', msg: 'Make a study plan today.' };
}
function showTab(id) {
  document.querySelectorAll('[id^="tc-"]').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
  document.getElementById('tc-' + id).classList.remove('hidden');
  document.getElementById('tab-' + id) && document.getElementById('tab-' + id).classList.add('active');

  // Persist active tab
  localStorage.setItem('gradintel_active_tab', id);

  // Show/hide dashboard-only sections and compact topbar stats
  const isDash = id === 'dashboard';
  document.querySelectorAll('.dash-only').forEach(el => {
    el.classList.toggle('hidden-off', !isDash);
  });
  const tsBar = document.getElementById('topbar-stats');
  if (tsBar) {
    if (!isDash) {
      tsBar.classList.add('show');
      // Sync compact stats from main stat values
      const gpaEl = document.getElementById('ds-gpa');
      const semEl = document.getElementById('ds-sem');
      const subjsEl = document.getElementById('ds-subjs');
      const credEl = document.getElementById('ds-credits');
      if (gpaEl)   document.getElementById('ts-gpa').textContent    = gpaEl.textContent;
      if (semEl)   document.getElementById('ts-sem').textContent    = semEl.textContent;
      if (subjsEl) document.getElementById('ts-subjs').textContent  = subjsEl.textContent;
      if (credEl)  document.getElementById('ts-credits').textContent = credEl.textContent;
    } else {
      tsBar.classList.remove('show');
    }
  }

  if (id === 'history') { renderHistory(); buildSemTrendChart(); }
  if (id === 'whatif') { renderWIFull(); try { renderTimeMachine(); } catch(e){} }
  if (id === 'study') { renderStudy(); renderCalendar(); }
  if (id === 'courses') renderCourses();
  if (id === 'dashboard') { renderDashboard(); updateStats(); }
  if (id === 'ai') { renderROI(); renderAIKeyStatusBar(); }
  if (id === 'policies') renderPoliciesUI();
  if (id === 'simulator') renderSimulator();
  if (id === 'analytics') renderAnalytics();
  if (id === 'planner') {
    renderDeadlines(); renderStreakGrid(); renderPomoCoursePicker(); renderMoodChart(); renderNotesCourseList();
    const pill = document.getElementById('dl-float-btn');
    if(pill){ pill.style.display = 'flex'; }
    updateDeadlineBadge();
  } else {
    const pill = document.getElementById('dl-float-btn');
    if(pill){ pill.style.display = 'none'; }
    closeDeadlinePanel();
  }
  if (id === 'achievements') renderAchievements();
  if (id === 'degree') renderDegree();
  if (id === 'canvas') ciInitTab();
}
function toggleTheme() {
  const t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  document.getElementById('themeBtn').innerHTML = t === 'dark' ? `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>` : `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
  localStorage.setItem('gpa-theme', t);
}
function toggleMotion() {
  const reduced = document.documentElement.hasAttribute('data-reduce-motion');
  if (reduced) {
    document.documentElement.removeAttribute('data-reduce-motion');
    document.body.classList.remove('reduced-motion');
    document.getElementById('motionBtn').style.opacity = '1';
    localStorage.removeItem('gpa-reduce-motion');
    showToast('Animations on');
  } else {
    document.documentElement.setAttribute('data-reduce-motion', '');
    document.body.classList.add('reduced-motion');
    document.getElementById('motionBtn').style.opacity = '.4';
    localStorage.setItem('gpa-reduce-motion', '1');
    showToast('🔕 Reduced motion on');
  }
}
function syncDataVal() { document.querySelectorAll('.sh-num,.cum-num,[data-val]').forEach(el => el.dataset.val = el.textContent.trim()); }
let confettiRunning = false;
function fireConfetti() {
  if (confettiRunning || document.body.classList.contains('reduced-motion')) return;
  confettiRunning = true;
  const cols = ['#818cf8','#f472b6','#34d399','#fbbf24','#60a5fa','#f87171'];
  for (let i = 0; i < 80; i++) {
    const p = document.createElement('div'); p.className = 'confetti-piece';
    const sz = 6 + Math.random() * 8;
    p.style.cssText = `width:${sz}px;height:${sz}px;left:${Math.random() * 100}vw;background:${cols[Math.floor(Math.random() * cols.length)]};animation-duration:${1.5 + Math.random() * 2}s;animation-delay:${Math.random() * .5}s;border-radius:${Math.random() > .5 ? '50%' : '2px'}`;
    document.body.appendChild(p); setTimeout(() => p.remove(), (2.5 + Math.random() * 2) * 1000);
  }
  setTimeout(() => confettiRunning = false, 3000);
}
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ══════════════════════════════════════════════════════════════
// ANIMATIONS
// ══════════════════════════════════════════════════════════════
function initAnimations() {
  if (document.body.classList.contains('reduced-motion')) return;
  const cur = document.getElementById('cur'); const ring = document.getElementById('cur-ring');
  if (!cur || !ring) return;
  let mx = 0, my = 0, rx = 0, ry = 0;
  document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; }, { passive: true });

  const interactiveSelector = 'button,a,input,select,textarea,.tgl-btn,.course-item,.card,.mode-card,.auth-btn,.ci-match-opt,.icon-btn,.nav-tab,.chip,.modal-close,.btn';
  document.addEventListener('mouseover', e => {
    if (e.target.closest(interactiveSelector)) {
      cur.style.width = '14px'; cur.style.height = '14px';
      cur.style.background = 'var(--accent2)';
      ring.style.width = '48px'; ring.style.height = '48px';
      ring.style.borderColor = 'rgba(244,114,182,.6)';
    }
  }, { passive: true });
  document.addEventListener('mouseout', e => {
    if (e.target.closest(interactiveSelector)) {
      cur.style.width = '8px'; cur.style.height = '8px';
      cur.style.background = 'var(--accent)';
      ring.style.width = '32px'; ring.style.height = '32px';
      ring.style.borderColor = 'rgba(129,140,248,.45)';
    }
  }, { passive: true });

  // Cursor dot: instant. Ring: faster lerp (0.22 instead of 0.12) for less lag feeling
  (function animCursor() {
    cur.style.transform = 'translate(' + (mx - 4) + 'px,' + (my - 4) + 'px)';
    rx += (mx - rx) * .22; ry += (my - ry) * .22;
    ring.style.transform = 'translate(' + (rx - 16) + 'px,' + (ry - 16) + 'px)';
    requestAnimationFrame(animCursor);
  })();

  // Particle canvas — throttled to 30fps to save main thread
  const canvas = document.getElementById('bgCanvas'); if (!canvas) return;
  const ctx = canvas.getContext('2d'); let W, H, particles = [];
  function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
  resize(); window.addEventListener('resize', resize, { passive: true });
  class P { constructor() { this.reset(true); } reset(init) { this.x = Math.random() * W; this.y = init ? Math.random() * H : Math.random() * H; this.vx = (Math.random() - .5) * .25; this.vy = (Math.random() - .5) * .25; this.life = Math.random(); this.maxLife = .6 + Math.random() * .4; this.size = Math.random() * 1.2 + .3; this.color = Math.random() < .5 ? '129,140,248' : '244,114,182'; } update() { this.x += this.vx; this.y += this.vy; this.life += .002; if (this.life > this.maxLife || this.x < 0 || this.x > W || this.y < 0 || this.y > H) this.reset(false); } draw() { const a = Math.sin((this.life / this.maxLife) * Math.PI) * .45; ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fillStyle = `rgba(${this.color},${a})`; ctx.fill(); } }
  for (let i = 0; i < 40; i++) particles.push(new P());
  let lastFrame = 0;
  (function loop(ts) {
    requestAnimationFrame(loop);
    if (ts - lastFrame < 33) return; // cap at ~30fps
    lastFrame = ts;
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => { p.update(); p.draw(); });
  })();

  // Card tilt — only on hover, no MutationObserver
  function bindCardTilt() {
    document.querySelectorAll('.card,.stat-card').forEach(card => {
      if (card._tiltBound) return;
      card._tiltBound = true;
      card.addEventListener('mousemove', e => { const r = card.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - .5; const y = (e.clientY - r.top) / r.height - .5; card.style.transform = `perspective(800px) rotateY(${x * 5}deg) rotateX(${-y * 5}deg) translateZ(4px)`; }, { passive: true });
      card.addEventListener('mouseleave', () => { card.style.transform = ''; });
    });
  }
  bindCardTilt();
  // Re-bind only when new cards are added, debounced
  let tiltTimer;
  const obs = new MutationObserver(() => { clearTimeout(tiltTimer); tiltTimer = setTimeout(bindCardTilt, 300); });
  obs.observe(document.body, { childList: true, subtree: true });
  // syncDataVal separately if needed
  const obs2 = new MutationObserver(syncDataVal);
  obs2.observe(document.body, { childList: true, subtree: true, characterData: true });
}

// ══════════════════════════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════════════════════════
(async function boot() {
  const t = localStorage.getItem('gpa-theme');
  if (t) { document.documentElement.setAttribute('data-theme', t); const btn = document.getElementById('themeBtn'); if (btn) btn.innerHTML = t === 'dark' ? `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>` : `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="url(#site-ig)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`; }
  if (localStorage.getItem('gpa-reduce-motion')) {
    document.documentElement.setAttribute('data-reduce-motion', '');
    document.body.classList.add('reduced-motion');
    const btn = document.getElementById('motionBtn'); if (btn) btn.style.opacity = '.4';
  }
  if (!initSupabase()) { document.getElementById('auth-wrap').classList.add('ready'); document.body.classList.add('auth-visible'); return; }
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    // User is already logged in — don't show auth at all
    currentUser = session.user;
    await onAuthSuccess();
  } else {
    // No session — show the sign-in page
    document.getElementById('auth-wrap').classList.add('ready');
    document.body.classList.add('auth-visible');
  }
  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session && !currentUser) { currentUser = session.user; await onAuthSuccess(); }
  });
})();

// ══════════════════════════════════════════════════════════════
// ████  NEW FEATURES BLOCK  ████
// ══════════════════════════════════════════════════════════════

// ─── HELPERS ───────────────────────────────────────────────
function getNS(key, def=null){ try{const v=localStorage.getItem(key); return v!==null?JSON.parse(v):def;}catch{return def;} }
function setNS(key,val){ try{localStorage.setItem(key,JSON.stringify(val));}catch{} }
function todayStr(){ return new Date().toISOString().slice(0,10); }
function userKey(k){ return k+'_'+(currentUser?.id||'anon'); }
function showXPPopup(msg){ const el=document.createElement('div'); el.className='xp-popup'; el.textContent=msg; document.body.appendChild(el); setTimeout(()=>el.remove(),2200); }

// ─── XP & LEVELS ──────────────────────────────────────────
const XP_LEVELS=[
  {lvl:1,title:'Freshman',xp:0},
  {lvl:2,title:'Sophomore',xp:100},
  {lvl:3,title:'Junior',xp:250},
  {lvl:4,title:'Senior',xp:500},
  {lvl:5,title:'Honor Roll',xp:800},
  {lvl:6,title:'Dean\'s List',xp:1200},
  {lvl:7,title:'Scholar',xp:1800},
  {lvl:8,title:'Magna Cum Laude',xp:2600},
  {lvl:9,title:'Summa Cum Laude',xp:3500},
  {lvl:10,title:'Valedictorian',xp:5000}
];
function getXP(){ return getNS(userKey('gradintel_xp'),0); }
function addXP(pts, reason=''){
  const prev=getXP(); const next=prev+pts;
  setNS(userKey('gradintel_xp'),next);
  showXPPopup(`+${pts} XP — ${reason}`);
  const prevLvl=getLevel(prev); const nextLvl=getLevel(next);
  if(nextLvl.lvl>prevLvl.lvl){ setTimeout(()=>{ showXPPopup(`🎉 Level Up! ${nextLvl.title}`); fireConfetti(); },600); }
  checkBadges();
}
function getLevel(xp=null){
  if(xp===null) xp=getXP();
  let cur=XP_LEVELS[0];
  for(const l of XP_LEVELS){ if(xp>=l.xp) cur=l; else break; }
  return cur;
}

// ─── ACTIVITY STREAK ─────────────────────────────────────
function logActivity(){
  const k=userKey('gradintel_activity');
  const data=getNS(k,{});
  const today=todayStr();
  data[today]=(data[today]||0)+1;
  setNS(k,data);
}
function getStreak(){
  const data=getNS(userKey('gradintel_activity'),{});
  let streak=0; const d=new Date();
  for(let i=0;i<365;i++){
    const s=d.toISOString().slice(0,10);
    if(data[s]) streak++;
    else if(i>0) break;
    d.setDate(d.getDate()-1);
  }
  return streak;
}

// ─── BADGES ───────────────────────────────────────────────
const ALL_BADGES=[
  {id:'first_login',ico:'🎓',name:'First Step',desc:'Signed in for the first time',xp:10},
  {id:'first_grade',ico:'📝',name:'First Grade',desc:'Logged your first exam score',xp:20},
  {id:'gpa_3',ico:'⭐',name:'3.0 Club',desc:'Achieved a semester GPA ≥ 3.0',xp:50},
  {id:'gpa_35',ico:'🌟',name:'Honor Roll',desc:'Achieved a semester GPA ≥ 3.5',xp:100},
  {id:'gpa_4',ico:'🏆',name:'Perfect GPA',desc:'Achieved a semester GPA of 4.0',xp:200},
  {id:'streak_3',ico:'🔥',name:'On Fire',desc:'3-day activity streak',xp:30},
  {id:'streak_7',ico:'💥',name:'Unstoppable',desc:'7-day activity streak',xp:75},
  {id:'streak_30',ico:'⚡',name:'Legend',desc:'30-day activity streak',xp:300},
  {id:'courses_5',ico:'📚',name:'Bookworm',desc:'Tracked 5+ courses total',xp:40},
  {id:'courses_20',ico:'🧠',name:'Genius',desc:'Tracked 20+ courses total',xp:150},
  {id:'sems_3',ico:'🗓️',name:'Veteran',desc:'Completed 3 semesters',xp:80},
  {id:'sems_6',ico:'🎖️',name:'Senior',desc:'Completed 6 semesters',xp:160},
  {id:'pomodoro_1',ico:'🍅',name:'First Pomo',desc:'Completed your first Pomodoro',xp:15},
  {id:'pomodoro_10',ico:'⏰',name:'Focus Master',desc:'10 Pomodoro sessions completed',xp:60},
  {id:'pomodoro_50',ico:'🧘',name:'Deep Work',desc:'50 Pomodoro sessions',xp:200},
  {id:'deadlines_1',ico:'📌',name:'Planner',desc:'Added your first deadline',xp:10},
  {id:'deadlines_done_5',ico:'✅',name:'Task Crusher',desc:'Completed 5 deadlines',xp:50},
  {id:'mood_10',ico:'😊',name:'Self-Aware',desc:'Logged mood 10 times',xp:30},
  {id:'degree_setup',ico:'🎓',name:'Goal Setter',desc:'Set up your degree plan',xp:25},
  {id:'req_done_10',ico:'📋',name:'On Track',desc:'Completed 10 course requirements',xp:100},
  {id:'simulator',ico:'🎯',name:'Strategist',desc:'Used the grade simulator',xp:15},
  {id:'time_machine',ico:'⏮️',name:'Time Traveler',desc:'Used the GPA time machine',xp:15},
];
function getUnlockedBadges(){ return getNS(userKey('gradintel_badges'),{}); }
function unlockBadge(id){
  const badges=getUnlockedBadges();
  if(badges[id]) return;
  const b=ALL_BADGES.find(x=>x.id===id); if(!b) return;
  badges[id]=new Date().toISOString();
  setNS(userKey('gradintel_badges'),badges);
  setTimeout(()=>{ showXPPopup(`🏆 Badge: ${b.name}!`); addXP(b.xp, b.name); },800);
}
function checkBadges(){
  const badges=getUnlockedBadges();
  // activity streaks
  const streak=getStreak();
  if(streak>=3) unlockBadge('streak_3');
  if(streak>=7) unlockBadge('streak_7');
  if(streak>=30) unlockBadge('streak_30');
  // courses
  let totalCourses=0; semesters.forEach(s=>totalCourses+=s.subjects.length);
  if(totalCourses>=1) unlockBadge('first_grade');
  if(totalCourses>=5) unlockBadge('courses_5');
  if(totalCourses>=20) unlockBadge('courses_20');
  // semesters
  if(semesters.length>=3) unlockBadge('sems_3');
  if(semesters.length>=6) unlockBadge('sems_6');
  // GPA
  semesters.forEach(sem=>{
    const g=sem._gpa||0;
    if(g>=3.0) unlockBadge('gpa_3');
    if(g>=3.5) unlockBadge('gpa_35');
    if(g>=3.99) unlockBadge('gpa_4');
  });
  // pomodoro
  const pomoSessions=getNS(userKey('gradintel_pomo_total'),0);
  if(pomoSessions>=1) unlockBadge('pomodoro_1');
  if(pomoSessions>=10) unlockBadge('pomodoro_10');
  if(pomoSessions>=50) unlockBadge('pomodoro_50');
  // deadlines
  const dls=getNS(userKey('gradintel_deadlines'),[]);
  if(dls.length>=1) unlockBadge('deadlines_1');
  const doneDls=dls.filter(d=>d.done).length;
  if(doneDls>=5) unlockBadge('deadlines_done_5');
  // mood
  const moods=getNS(userKey('gradintel_mood'),[]);
  if(moods.length>=10) unlockBadge('mood_10');
  // degree
  const degrees = getDegrees();
  if(degrees.some(d => d.name && d.name !== 'My Degree' && d.name !== 'New Degree')) unlockBadge('degree_setup');
  const allReqs = degrees.flatMap(d => d.requirements || []);
  const doneReqs = allReqs.filter(r => r.status === 'completed').length;
  if(doneReqs>=10) unlockBadge('req_done_10');
}

// ─── RENDER ACHIEVEMENTS ─────────────────────────────────
function renderAchievements(){
  logActivity();
  unlockBadge('first_login');
  checkBadges();
  const xp=getXP();
  const level=getLevel(xp);
  const nextLevel=XP_LEVELS.find(l=>l.xp>xp)||XP_LEVELS[XP_LEVELS.length-1];
  const prevLvlXP=level.xp;
  const nextLvlXP=nextLevel.xp;
  const pct=nextLvlXP>prevLvlXP?Math.min(100,Math.round((xp-prevLvlXP)/(nextLvlXP-prevLvlXP)*100)):100;
  document.getElementById('xp-total').textContent=xp.toLocaleString();
  document.getElementById('xp-level').textContent=level.lvl;
  document.getElementById('xp-title-lbl').textContent=level.title;
  document.getElementById('xp-level-label').textContent=`Level ${level.lvl} — ${level.title}`;
  document.getElementById('xp-next-label').textContent=`${xp} / ${nextLvlXP} XP`;
  setTimeout(()=>{ document.getElementById('xp-bar-fill').style.width=pct+'%'; },100);
  const activities=[
    'Log a grade → +20 XP','Complete a Pomodoro → +15 XP','Log mood → +5 XP',
    'Complete a deadline → +10 XP','Unlock a badge → bonus XP','Add a course → +5 XP'
  ];
  document.getElementById('xp-activities').innerHTML='<strong>How to earn XP:</strong> '+activities.join(' &nbsp;·&nbsp; ');
  const unlocked=getUnlockedBadges();
  document.getElementById('badges-count').textContent=Object.keys(unlocked).length;
  document.getElementById('badges-total').textContent=ALL_BADGES.length;
  const grid=document.getElementById('badges-grid'); grid.innerHTML='';
  ALL_BADGES.forEach(b=>{
    const isUnlocked=!!unlocked[b.id];
    const div=document.createElement('div'); div.className='badge-card'+(isUnlocked?' unlocked':'');
    const dateStr=isUnlocked?new Date(unlocked[b.id]).toLocaleDateString():'Locked';
    div.innerHTML=`<span class="badge-ico">${isUnlocked?b.ico:'🔒'}</span><div class="badge-name">${b.name}</div><div class="badge-desc">${b.desc}</div><div class="badge-date">${isUnlocked?'Earned '+dateStr:'???'}</div>`;
    if(isUnlocked) div.style.cursor='pointer'; div.title=b.desc;
    grid.appendChild(div);
  });
  // GPA streak
  const gpaStreakSems=[];
  const goalGpa=policies.goalGpa||3.0;
  let streak=0; let max=0;
  semesters.forEach(sem=>{
    if((sem._gpa||0)>=goalGpa){ streak++; max=Math.max(max,streak); }
    else streak=0;
    gpaStreakSems.push({name:sem.name,gpa:sem._gpa||0,above:(sem._gpa||0)>=goalGpa});
  });
  const gsc=document.getElementById('gpa-streak-content');
  gsc.innerHTML=`<div style="font-size:13px;color:var(--muted2);margin-bottom:12px">Goal GPA: <strong>${goalGpa}</strong> · Current streak: <strong style="color:var(--accent)">${streak}</strong> semester${streak!==1?'s':''} · Best: <strong>${max}</strong></div>
  <div style="display:flex;gap:8px;flex-wrap:wrap">${gpaStreakSems.map(s=>`<div style="background:${s.above?'rgba(52,211,153,.12)':'rgba(248,113,113,.08)'};border:1px solid ${s.above?'rgba(52,211,153,.3)':'rgba(248,113,113,.25)'};border-radius:var(--r-sm);padding:8px 12px;font-size:12px"><div style="font-family:'Clash Display',sans-serif;font-weight:700;font-size:15px;color:${s.above?'var(--green)':'var(--red)'}">${(s.gpa||0).toFixed(2)}</div><div style="color:var(--muted)">${s.name||'Sem'}</div></div>`).join('')}</div>`;
}

// ─── GRADE SIMULATOR ─────────────────────────────────────
let simCharts={};
function getAllActiveCourses(){
  if(!semesters.length) return [];
  return semesters.flatMap(sem=>sem.subjects.map(s=>({...s,semId:sem.id,semName:sem.name})));
}
function getRemExams(course){
  return (course.exams||[]).filter(e=>!e.taken);
}
function simGPAWithScores(scoreMap){
  // scoreMap: { subjectId: { examId: score } }
  let totalCP=0, totalCR=0;
  semesters.forEach(sem=>{
    sem.subjects.forEach(s=>{
      const simExams=(s.exams||[]).map(e=>{
        if(!e.taken && scoreMap[s.id]?.[e.id]!=null){
          return {...e,taken:true,score:scoreMap[s.id][e.id]};
        }
        return e;
      });
      const simS={...s,exams:simExams};
      const res=computeSubject(simS);
      totalCP+=s.credits*(res.curG?.p||0);
      totalCR+=s.credits;
    });
  });
  return totalCR?totalCP/totalCR:0;
}
function buildScoreMap(defaultScore){
  const map={};
  getAllActiveCourses().forEach(s=>{
    getRemExams(s).forEach(e=>{
      if(!map[s.id]) map[s.id]={};
      map[s.id][e.id]=defaultScore;
    });
  });
  return map;
}
function renderSimulator(){
  unlockBadge('simulator');
  const courses=getAllActiveCourses();
  const hasRem=courses.some(c=>getRemExams(c).length>0);
  document.getElementById('sim-no-data').style.display=hasRem?'none':'block';
  document.getElementById('sim-content').style.display=hasRem?'block':'none';
  if(!hasRem) return;
  // Scenarios & sliders removed — render safe zone + target grade only
  renderSafeZone();
  renderMinCalc();
}
function updateSimScore(courseId, val){
  document.getElementById('sim-score-'+courseId).textContent=val+'%';
  updateCustomScenario();
}
function updateCustomScenario(){
  const map={};
  getAllActiveCourses().forEach(s=>{
    getRemExams(s).forEach(e=>{
      const slider=document.querySelector(`[oninput*="updateSimScore('${s.id}'"]`);
      const score=slider?parseInt(slider.value):75;
      if(!map[s.id]) map[s.id]={};
      map[s.id][e.id]=score;
    });
  });
  const gpa=simGPAWithScores(map);
  const el=document.getElementById('sim-s3-gpa');
  if(el){ el.textContent=gpa.toFixed(2); el.style.color=gpa>=3.5?'var(--green)':gpa>=2.5?'var(--accent)':'var(--red)'; }
}
function renderSafeZone(){
  const c=document.getElementById('sim-safezone'); if(!c) return;
  const courses=getAllActiveCourses().filter(x=>getRemExams(x).length>0);
  c.innerHTML=courses.map(s=>{
    const gpa=s.credits>0?((s._gpa||computeSubject(s).curG.p)):0;
    const isGreen=gpa>=3.5; const isYellow=gpa>=2.5&&gpa<3.5;
    const zone=isGreen?'🟢 Safe Zone':isYellow?'🟡 Caution Zone':'🔴 Danger Zone';
    const zc=isGreen?'var(--green)':isYellow?'var(--yellow)':'var(--red)';
    return `<div class="safe-zone-bar"><div class="sz-name">${s.name}</div><div class="sz-indicator" style="background:${zc}22;color:${zc};border:1px solid ${zc}44">${zone}</div></div>`;
  }).join('');
}
function renderMinCalc(){
  const c=document.getElementById('sim-minimum'); if(!c) return;
  const courses=getAllActiveCourses().filter(x=>getRemExams(x).length>0);
  if(!courses.length){ c.innerHTML='<div style="color:var(--muted);font-size:13px">No remaining exams found.</div>'; return; }

  const gradeOpts = ['A+','A','A-','B+','B','B-','C+','C','C-','D+','D','D-','F'];

  c.innerHTML = courses.map(s => {
    const remExams = getRemExams(s);
    const selId = 'tgt-grade-' + s.id;
    const resId = 'tgt-result-' + s.id;
    const res = computeSubject(s);
    return `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--r);padding:14px 16px;margin-bottom:10px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:10px">
        <div>
          <div style="font-family:'Clash Display',sans-serif;font-weight:700;font-size:14px">${s.name}</div>
          <div style="font-size:11px;color:var(--muted)">${remExams.length} exam${remExams.length!==1?'s':''} remaining · Currently ${res.cur.toFixed(1)}% (${res.curG.l})</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:12px;color:var(--muted2)">I want:</span>
          <select id="${selId}" onchange="calcTargetGrade('${s.id}')"
            style="padding:6px 10px;border-radius:8px;border:1px solid var(--border2);background:var(--surface3);color:var(--text);font-family:'Clash Display',sans-serif;font-weight:700;font-size:14px;cursor:pointer">
            ${gradeOpts.map(g => `<option value="${g}" ${g==='A'?'selected':''}>${g}</option>`).join('')}
          </select>
        </div>
      </div>
      <div id="${resId}"></div>
    </div>`;
  }).join('');

  // Compute initial results for all courses
  courses.forEach(s => calcTargetGrade(s.id));
}

function calcTargetGrade(courseId){
  const s = getAllActiveCourses().find(x => x.id === courseId); if(!s) return;
  const selEl = document.getElementById('tgt-grade-' + courseId);
  const resEl = document.getElementById('tgt-result-' + courseId);
  if(!selEl || !resEl) return;

  const targetGrade = selEl.value;
  const res = computeSubject(s);
  const remExams = getRemExams(s);

  // Find the target GPA point from pctToG mapping
  const tgt = res.targets.find(t => t.l === targetGrade) || res.targets[0];
  if(!tgt){ resEl.innerHTML = '<span style="color:var(--muted);font-size:12px">No data.</span>'; return; }

  const avg = tgt.avg;
  let html = '';
  let overallColor;

  if(avg === null){
    html = `<div style="color:var(--green);font-family:'Clash Display',sans-serif;font-weight:700;font-size:13px">✅ Already secured! You've got ${targetGrade}.</div>`;
    overallColor = 'var(--green)';
  } else if(avg > 100){
    html = `<div style="color:var(--red);font-family:'Clash Display',sans-serif;font-weight:700;font-size:13px">❌ Not achievable — would need ${avg.toFixed(1)}% on remaining exams.</div>`;
    overallColor = 'var(--red)';
  } else {
    overallColor = avg < 70 ? 'var(--green)' : avg < 85 ? 'var(--yellow)' : 'var(--red)';
    html = `<div style="margin-bottom:8px;font-family:'Clash Display',sans-serif;font-weight:700;font-size:13px;color:${overallColor}">Need avg <strong>${avg.toFixed(1)}%</strong> on remaining exams for ${targetGrade}</div>`;
    // Per-exam breakdown
    if(tgt.perExam && tgt.perExam.length > 1){
      html += `<div style="display:flex;flex-wrap:wrap;gap:6px">`;
      tgt.perExam.forEach(ex => {
        const nd = ex.needed;
        let col = 'var(--green)', txt;
        if(nd === null){ txt = 'N/A'; col = 'var(--muted)'; }
        else if(nd <= 0){ txt = 'Secured ✅'; col = 'var(--green)'; }
        else if(nd > 100){ txt = 'Too high ❌'; col = 'var(--red)'; }
        else { txt = nd.toFixed(1)+'%'; col = nd<70?'var(--green)':nd<85?'var(--yellow)':'var(--red)'; }
        html += `<div style="padding:4px 10px;border-radius:8px;background:var(--surface3);border:1px solid var(--border);font-size:11px">
          <span style="color:var(--muted2)">${ex.name}: </span><strong style="color:${col}">${txt}</strong>
        </div>`;
      });
      html += `</div>`;
    }
  }
  resEl.innerHTML = html;
}

// ─── TIME MACHINE ─────────────────────────────────────────
function renderTimeMachine(){
  const slider=document.getElementById('tm-slider');
  const val=parseInt(slider.value);
  document.getElementById('tm-val').textContent=(val>=0?'+':'')+val+'%';
  unlockBadge('time_machine');
  // compute actual GPA
  let totalCP=0, totalCR=0;
  semesters.forEach(sem=>sem.subjects.forEach(s=>{
    const res=computeSubject(s);
    totalCP+=s.credits*(res.curG?.p||0); totalCR+=s.credits;
  }));
  const actualGPA=totalCR?totalCP/totalCR:0;
  document.getElementById('tm-actual').textContent=actualGPA.toFixed(2);
  // compute hypothetical
  let hypCP=0, hypCR=0;
  semesters.forEach(sem=>sem.subjects.forEach(s=>{
    const hypExams=(s.exams||[]).map(e=>e.taken?{...e,score:Math.min(100,e.score+val)}:e);
    const hypS={...s,exams:hypExams};
    const res=computeSubject(hypS);
    hypCP+=s.credits*(res.curG?.p||0); hypCR+=s.credits;
  }));
  const hypGPA=hypCR?hypCP/hypCR:0;
  const el=document.getElementById('tm-hyp');
  el.textContent=hypGPA.toFixed(2);
  el.style.color=hypGPA>actualGPA?'var(--green)':hypGPA<actualGPA?'var(--red)':'var(--accent)';
}

// ─── ANALYTICS ─────────────────────────────────────────────
let dnaChartInst=null, distChartInst=null;
const SUBJECT_CATS={
  'math':['math','calculus','algebra','statistics','stat','linear','discrete'],
  'science':['physics','chemistry','biology','chem','bio','lab','engineering'],
  'cs':['computer','programming','algorithm','software','data','network','database','coding'],
  'humanities':['history','philosophy','english','writing','literature','art','music','language'],
  'business':['economics','finance','accounting','management','marketing','business'],
  'other':[]
};
function guessCategory(name){
  const n=name.toLowerCase();
  for(const [cat,kws] of Object.entries(SUBJECT_CATS)){
    if(cat==='other') continue;
    if(kws.some(k=>n.includes(k))) return cat;
  }
  return 'other';
}
function renderAnalytics(){
  const allSubjects=[];
  semesters.forEach(sem=>sem.subjects.forEach(s=>allSubjects.push({...s,semName:sem.name})));
  if(!allSubjects.length){ ['sem-delta-cards','heatmap-wrap','best-subjects-list','worst-subjects-list','danger-zone-content'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML='<div style="color:var(--muted);font-size:13px;padding:8px 0">No data yet.</div>';});return;}
  // Sem delta
  const deltaEl=document.getElementById('sem-delta-cards');
  if(deltaEl){
    let deltaHTML='';
    semesters.forEach((sem,i)=>{
      const g=sem._gpa||0;
      const prev=semesters[i-1]?._gpa||0;
      const delta=i>0?g-prev:null;
      const sign=delta===null?'':delta>=0?'+':'';
      const col=delta===null?'var(--muted)':delta>0?'var(--green)':delta<0?'var(--red)':'var(--muted)';
      deltaHTML+=`<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
        <div style="font-size:13px;font-weight:600">${sem.name||'Sem '+(i+1)}</div>
        <div style="display:flex;gap:12px;align-items:center">
          <div style="font-family:'Clash Display',sans-serif;font-weight:700;font-size:18px">${g.toFixed(2)}</div>
          ${delta!==null?`<div style="font-size:12px;font-weight:700;color:${col}">${sign}${delta.toFixed(2)}</div>`:''}
        </div>
      </div>`;
    });
    deltaEl.innerHTML=deltaHTML||'<div style="color:var(--muted)">Add semesters to see trends.</div>';
  }
  // DNA radar chart
  const catScores={math:[], science:[], cs:[], humanities:[], business:[], other:[]};
  allSubjects.forEach(s=>{
    const res=computeSubject(s); const cat=guessCategory(s.name);
    catScores[cat].push(res.cur);
  });
  const labels=['Math','Science','CS','Humanities','Business','Other'];
  const catKeys=['math','science','cs','humanities','business','other'];
  const data=catKeys.map(k=>catScores[k].length?Math.round(catScores[k].reduce((a,b)=>a+b,0)/catScores[k].length):null);
  const hasData=data.some(d=>d!==null);
  const dnaCtx=document.getElementById('dnaChart');
  if(dnaCtx){
    if(dnaChartInst){dnaChartInst.destroy();dnaChartInst=null;}
    if(hasData){
      dnaChartInst=new Chart(dnaCtx,{
        type:'radar',
        data:{labels,datasets:[{label:'Avg Score',data:data.map(d=>d||0),
          backgroundColor:'rgba(129,140,248,.15)',borderColor:'rgba(129,140,248,.8)',
          pointBackgroundColor:'rgba(244,114,182,.9)',pointRadius:4,borderWidth:2}]},
        options:{responsive:true,maintainAspectRatio:false,scales:{r:{beginAtZero:true,max:100,
          ticks:{color:'rgba(255,255,255,.3)',font:{size:9}},
          pointLabels:{color:'rgba(255,255,255,.7)',font:{size:10}},
          grid:{color:'rgba(255,255,255,.07)'},angleLines:{color:'rgba(255,255,255,.07)'}}},
          plugins:{legend:{display:false}}}
      });
    }
  }
  // Heatmap
  const hmWrap=document.getElementById('heatmap-wrap');
  if(hmWrap){
    let hmHTML='';
    semesters.forEach(sem=>{
      hmHTML+=`<div class="hm-row"><div class="hm-label">${(sem.name||'').slice(0,12)}</div><div>`;
      sem.subjects.forEach(s=>{
        const res=computeSubject(s); const sc=res.cur;
        const alpha=Math.max(0.15,sc/100);
        const col=sc>=87?`rgba(52,211,153,${alpha})`:sc>=73?`rgba(251,191,36,${alpha})`:sc>=60?`rgba(129,140,248,${alpha})`:`rgba(248,113,113,${alpha})`;
        hmHTML+=`<div class="hm-cell" style="background:${col};width:${Math.max(18,s.credits*10)}px" title="${s.name}: ${sc.toFixed(1)}%"></div>`;
      });
      hmHTML+='</div></div>';
    });
    hmWrap.innerHTML=hmHTML||'<div style="color:var(--muted);font-size:13px">No data.</div>';
  }
  // Best / worst
  const scored=allSubjects.map(s=>({...s,score:computeSubject(s).cur})).filter(s=>s.score>0);
  scored.sort((a,b)=>b.score-a.score);
  const bestEl=document.getElementById('best-subjects-list');
  if(bestEl) bestEl.innerHTML=scored.slice(0,5).map((s,i)=>`<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
    <div style="font-size:15px">${['🥇','🥈','🥉','4️⃣','5️⃣'][i]}</div>
    <div style="flex:1;font-size:13px;font-weight:600">${s.name}<div style="font-size:10px;color:var(--muted)">${s.semName}</div></div>
    <div style="font-family:'Clash Display',sans-serif;font-weight:700;font-size:16px;color:var(--green)">${s.score.toFixed(1)}%</div>
  </div>`).join('')||'<div style="color:var(--muted);font-size:13px">No data.</div>';
  const worstEl=document.getElementById('worst-subjects-list');
  // Only show subjects that genuinely need attention: below a B- (80%) threshold,
  // sorted worst-first, max 5. If everything is going well, show a positive message.
  const needsAttention=scored.filter(s=>s.score<80).sort((a,b)=>a.score-b.score).slice(0,5);
  if(worstEl) worstEl.innerHTML=needsAttention.length
    ? needsAttention.map(s=>{
        const col=s.score<60?'var(--red)':s.score<73?'var(--yellow)':'var(--accent)';
        const ico=s.score<60?'🚨':s.score<73?'⚠️':'📌';
        return `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
          <div style="font-size:15px">${ico}</div>
          <div style="flex:1;font-size:13px;font-weight:600">${s.name}<div style="font-size:10px;color:var(--muted)">${s.semName}</div></div>
          <div style="font-family:'Clash Display',sans-serif;font-weight:700;font-size:16px;color:${col}">${s.score.toFixed(1)}%</div>
        </div>`;
      }).join('')
    : '<div style="color:var(--green);font-size:13px;padding:8px 0">🎉 All subjects are in good shape!</div>';
  // Grade distribution
  const gradeCounts={};
  GPA.forEach(g=>gradeCounts[g.l]=0);
  allSubjects.forEach(s=>{ const l=computeSubject(s).curG.l; if(gradeCounts[l]!=null) gradeCounts[l]++; });
  const distCtx=document.getElementById('distChart');
  if(distCtx){
    if(distChartInst){distChartInst.destroy();distChartInst=null;}
    const dLabels=Object.keys(gradeCounts); const dData=Object.values(gradeCounts);
    distChartInst=new Chart(distCtx,{
      type:'bar',
      data:{labels:dLabels,datasets:[{data:dData,backgroundColor:dLabels.map(l=>gCol(l)+'aa'),borderColor:dLabels.map(l=>gCol(l)),borderWidth:1,borderRadius:4}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
        scales:{x:{ticks:{color:'rgba(255,255,255,.5)',font:{size:10}},grid:{color:'rgba(255,255,255,.04)'}},
                y:{ticks:{color:'rgba(255,255,255,.5)',font:{size:10},stepSize:1},grid:{color:'rgba(255,255,255,.04)'}}}}
    });
  }
  // Danger zone
  const dzEl=document.getElementById('danger-zone-content');
  if(dzEl&&semesters.length){
    const activeSem=semesters[semesters.length-1];
    const goalGpa=policies.goalGpa||3.0;
    dzEl.innerHTML=activeSem.subjects.map(s=>{
      const res=computeSubject(s); const cur=res.curG.p;
      const isAt=cur>=goalGpa; const isPossible=res.maxGpa>=goalGpa;
      return `<div class="safe-zone-bar">
        <div class="sz-name">${s.name}<div style="font-size:10px;color:var(--muted)">Current: ${res.cur.toFixed(1)}%</div></div>
        <div class="sz-indicator" style="background:${isAt?'rgba(52,211,153,.12)':isPossible?'rgba(251,191,36,.12)':'rgba(248,113,113,.12)'};
          color:${isAt?'var(--green)':isPossible?'var(--yellow)':'var(--red)'};border:1px solid ${isAt?'rgba(52,211,153,.3)':isPossible?'rgba(251,191,36,.3)':'rgba(248,113,113,.3)'}">
          ${isAt?'✅ On Track':isPossible?'⚠️ At Risk':'❌ Off Track'}</div>
      </div>`;
    }).join('')||'No active semester courses.';
  }
}

// ─── DEADLINES ────────────────────────────────────────────
function toggleDeadlinePanel(){
  const panel = document.getElementById('dl-slide-panel');
  const overlay = document.getElementById('dl-slide-overlay');
  if(panel.classList.contains('open')){ closeDeadlinePanel(); return; }
  panel.classList.add('open');
  overlay.style.display = 'block';
  setTimeout(()=>{ overlay.style.opacity='1'; }, 10);
  renderDeadlines();
}
function closeDeadlinePanel(){
  const panel = document.getElementById('dl-slide-panel');
  const overlay = document.getElementById('dl-slide-overlay');
  panel.classList.remove('open');
  overlay.style.opacity = '0';
  setTimeout(()=>{ overlay.style.display='none'; }, 300);
}
function updateDeadlineBadge(){
  const dls = getDeadlines();
  const now = new Date();
  const pending = dls.filter(d => !d.done).length;
  const overdue = dls.filter(d => !d.done && d.date && new Date(d.date) < now).length;
  const badge = document.getElementById('dl-count-badge');
  if(badge){
    badge.textContent = pending;
    badge.style.background = overdue > 0 ? 'var(--red)' : 'var(--accent)';
    badge.style.display = pending === 0 ? 'none' : 'flex';
  }
}
let deadlineFilter='all';
function getDeadlines(){ return getNS(userKey('gradintel_deadlines'),[]); }
function saveDeadlines(dls){ setNS(userKey('gradintel_deadlines'),dls); }
function openAddDeadlineModal(){
  const sel=document.getElementById('dl-course');
  sel.innerHTML='<option value="">— None —</option>';
  semesters.forEach(sem=>sem.subjects.forEach(s=>{
    const o=document.createElement('option'); o.value=s.id; o.textContent=s.name; sel.appendChild(o);
  }));
  document.getElementById('dl-title').value='';
  document.getElementById('dl-date').value='';
  document.getElementById('dl-weight').value='';
  document.getElementById('dl-type').value='assignment';
  document.getElementById('deadline-modal').classList.add('show');
}
function saveDeadline(){
  const title=document.getElementById('dl-title').value.trim();
  if(!title){ showToast('Add a title!'); return; }
  const dls=getDeadlines();
  dls.push({
    id:'dl_'+Date.now(), title,
    date:document.getElementById('dl-date').value,
    course:document.getElementById('dl-course').value,
    weight:parseFloat(document.getElementById('dl-weight').value)||0,
    type:document.getElementById('dl-type').value,
    done:false, created:new Date().toISOString()
  });
  saveDeadlines(dls);
  document.getElementById('deadline-modal').classList.remove('show');
  renderDeadlines(); updateDeadlineBadge(); checkBadges(); unlockBadge('deadlines_1');
  addXP(5,'Added deadline');
  showToast('📌 Deadline saved!');
}
function importDeadlinesFromCanvas(){
  const statusEl = document.getElementById('dl-canvas-status');
  if(statusEl) statusEl.style.display = 'block';
  showToast('📡 Go to Canvas → click your Gradintel bookmarklet to sync deadlines!');
  if(typeof ciStartListener === 'function') ciStartListener();
}

function filterDeadlines(f){
  deadlineFilter=f;
  ['all','upcoming','overdue'].forEach(x=>{
    const el=document.getElementById('dl-filter-'+x);
    if(el){ el.style.borderColor=x===f?'var(--accent)':''; el.style.color=x===f?'var(--accent)':''; }
  });
  renderDeadlines();
}
function renderDeadlines(){
  let dls=getDeadlines();
  const now=new Date();
  const typeIco={assignment:'📝',exam:'📋',quiz:'⚡',project:'🚀',other:'📌'};
  if(deadlineFilter==='upcoming') dls=dls.filter(d=>!d.done&&new Date(d.date)>now);
  if(deadlineFilter==='overdue') dls=dls.filter(d=>!d.done&&d.date&&new Date(d.date)<now);
  dls.sort((a,b)=>new Date(a.date||0)-new Date(b.date||0));
  const el=document.getElementById('deadline-list');
  if(!el) return;
  updateDeadlineBadge();
  if(!dls.length){
    el.innerHTML='<div style="text-align:center;padding:32px 16px"><div style="font-size:28px;margin-bottom:10px">🎉</div><div style="font-size:13px;color:var(--muted)">No deadlines here!<br>Hit <strong>+ Add Deadline</strong> to get started.</div></div>';
    return;
  }
  el.innerHTML=dls.map(d=>{
    const due=d.date?new Date(d.date):null;
    const isOverdue=due&&due<now&&!d.done;
    const isSoon=due&&!isOverdue&&(due-now)<86400000*3;
    const cls=isOverdue?'overdue':isSoon?'due-soon':d.done?'done':'';
    const dotColor=d.done?'var(--muted)':isOverdue?'var(--red)':isSoon?'var(--yellow)':'var(--accent)';
    const urgency=d.done?'✓ Done':isOverdue?'Overdue':due?Math.ceil((due-now)/86400000)+'d left':'';
    const urgencyColor=d.done?'var(--green)':isOverdue?'var(--red)':isSoon?'var(--yellow)':'var(--muted)';
    const courseName=d.course?semesters.flatMap(s=>s.subjects).find(s=>s.id===d.course)?.name||'':'';
    return `<div class="dl-notif ${cls}">
      <div class="dl-notif-dot" style="background:${dotColor}"></div>
      <div class="dl-notif-body">
        <div class="dl-notif-title" style="${d.done?'text-decoration:line-through;color:var(--muted)':''}">${typeIco[d.type]||'📌'} ${d.title}${d.weight?` <span style="font-size:10px;color:var(--accent);background:rgba(129,140,248,.12);padding:1px 5px;border-radius:4px;font-weight:700">${d.weight}%</span>`:''}</div>
        <div class="dl-notif-meta">${courseName?courseName+' · ':''}${due?due.toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'No date set'} <span style="color:${urgencyColor};font-weight:700;margin-left:4px">${urgency}</span></div>
      </div>
      <div class="dl-notif-actions">
        <button class="ca-btn" onclick="toggleDeadlineDone('${d.id}')" title="Toggle done" style="${d.done?'color:var(--muted)':'color:var(--green)'}">✓</button>
        <button class="ca-btn" onclick="deleteDeadline('${d.id}')" title="Delete" style="color:var(--red)">🗑</button>
      </div>
    </div>`;
  }).join('');
}
function toggleDeadlineDone(id){
  const dls=getDeadlines();
  const dl=dls.find(d=>d.id===id); if(!dl) return;
  dl.done=!dl.done;
  saveDeadlines(dls);
  if(dl.done){ addXP(10,'Completed deadline'); checkBadges(); }
  renderDeadlines(); updateDeadlineBadge();
  showToast(dl.done?'✅ Deadline done!':'↩️ Marked undone');
}
function deleteDeadline(id){
  const dls=getDeadlines().filter(d=>d.id!==id);
  saveDeadlines(dls); renderDeadlines(); updateDeadlineBadge(); showToast('🗑 Deadline removed');
}

// ─── POMODORO ─────────────────────────────────────────────
let pomoState={mode:'focus',running:false,remaining:25*60,sessions:0,interval:null};
const POMO_DURATIONS={focus:25*60,short:5*60,long:15*60};
function setPomoMode(m){
  clearInterval(pomoState.interval); pomoState.running=false;
  pomoState.mode=m; pomoState.remaining=POMO_DURATIONS[m];
  ['focus','short','long'].forEach(x=>{
    const el=document.getElementById('pomo-'+x);
    if(el){ el.style.borderColor=x===m?'var(--accent)':''; el.style.color=x===m?'var(--accent)':''; }
  });
  const labels={focus:'🍅 Focus Session',short:'☕ Short Break',long:'🌿 Long Break'};
  const el=document.getElementById('pomo-mode-label'); if(el) el.textContent=labels[m];
  const btn=document.getElementById('pomo-btn'); if(btn) btn.textContent='▶ Start';
  updatePomoDisplay();
}
function updatePomoDisplay(){
  const mins=Math.floor(pomoState.remaining/60);
  const secs=pomoState.remaining%60;
  const el=document.getElementById('pomo-display');
  if(el) el.textContent=`${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
}
function togglePomo(){
  if(pomoState.running){
    clearInterval(pomoState.interval); pomoState.running=false;
    document.getElementById('pomo-btn').textContent='▶ Start';
  } else {
    pomoState.running=true;
    document.getElementById('pomo-btn').textContent='⏸ Pause';
    pomoState.interval=setInterval(()=>{
      pomoState.remaining--;
      updatePomoDisplay();
      if(pomoState.remaining<=0){
        clearInterval(pomoState.interval); pomoState.running=false;
        if(pomoState.mode==='focus'){
          pomoState.sessions++;
          const total=getNS(userKey('gradintel_pomo_total'),0)+1;
          setNS(userKey('gradintel_pomo_total'),total);
          addXP(15,'Pomodoro session');
          // log session
          const course=document.getElementById('pomo-course-select')?.value||'';
          const courseName=course?semesters.flatMap(s=>s.subjects).find(s=>s.id===course)?.name||'General':'General';
          const logs=getNS(userKey('gradintel_pomo_log'),[]);
          logs.unshift({time:new Date().toISOString(),course:courseName});
          setNS(userKey('gradintel_pomo_log'),logs.slice(0,20));
          renderPomoLog(); checkBadges();
        }
        document.getElementById('pomo-btn').textContent='▶ Start';
        document.getElementById('pomo-session-count').textContent=pomoState.sessions;
        setPomoMode(pomoState.mode==='focus'?'short':'focus');
        showToast(pomoState.mode==='short'?'🍅 Focus time!':'☕ Break time!');
        if(!document.body.classList.contains('reduced-motion')) fireConfetti();
      }
    },1000);
  }
}
function resetPomo(){ clearInterval(pomoState.interval); pomoState.running=false; pomoState.remaining=POMO_DURATIONS[pomoState.mode]; updatePomoDisplay(); document.getElementById('pomo-btn').textContent='▶ Start'; }
function skipPomo(){ clearInterval(pomoState.interval); pomoState.running=false; setPomoMode(pomoState.mode==='focus'?'short':'focus'); }
function renderPomoCoursePicker(){
  const sel=document.getElementById('pomo-course-select'); if(!sel) return;
  const cur=sel.value;
  sel.innerHTML='<option value="">— None —</option>';
  semesters.forEach(sem=>sem.subjects.forEach(s=>{
    const o=document.createElement('option'); o.value=s.id; o.textContent=s.name; sel.appendChild(o);
  }));
  if(cur) sel.value=cur;
  renderPomoLog();
}
function renderPomoLog(){
  const el=document.getElementById('pomo-log-list'); if(!el) return;
  const logs=getNS(userKey('gradintel_pomo_log'),[]);
  if(!logs.length){ el.innerHTML='<div style="font-size:11px;color:var(--muted)">No sessions yet today.</div>'; return; }
  el.innerHTML=logs.slice(0,5).map(l=>`<div class="pomo-log-item"><span>${new Date(l.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span><span>${l.course}</span></div>`).join('');
}

// ─── COURSE NOTES ─────────────────────────────────────────
function renderNotesCourseList(){
  const sel=document.getElementById('notes-course-select'); if(!sel) return;
  const cur=sel.value;
  sel.innerHTML='<option value="">Select course…</option>';
  semesters.forEach(sem=>sem.subjects.forEach(s=>{
    const o=document.createElement('option'); o.value=s.id; o.textContent=s.name+' ('+sem.name+')'; sel.appendChild(o);
  }));
  if(cur) sel.value=cur;
}
function loadCourseNotes(){
  const id=document.getElementById('notes-course-select')?.value;
  const area=document.getElementById('notes-area'); if(!area) return;
  area.value=id?getNS(userKey('gradintel_notes_'+id),''):'';
  document.getElementById('notes-save-status').textContent='Auto-saved';
}
let notesTimer=null;
function saveCourseNotes(){
  const id=document.getElementById('notes-course-select')?.value; if(!id) return;
  const val=document.getElementById('notes-area')?.value||'';
  clearTimeout(notesTimer);
  notesTimer=setTimeout(()=>{ setNS(userKey('gradintel_notes_'+id),val); document.getElementById('notes-save-status').textContent='Saved ✓ '+new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}); },600);
}

// ─── STREAK GRID ─────────────────────────────────────────
function renderStreakGrid(){
  const el=document.getElementById('streak-grid'); if(!el) return;
  const data=getNS(userKey('gradintel_activity'),{});
  const days=140; // ~20 weeks
  const cells=[];
  for(let i=days-1;i>=0;i--){
    const d=new Date(); d.setDate(d.getDate()-i);
    const s=d.toISOString().slice(0,10);
    const v=data[s]||0;
    const alpha=v===0?0:v===1?0.3:v<=3?0.6:1;
    const col=v===0?'var(--surface3)':`rgba(129,140,248,${alpha})`;
    cells.push(`<div class="streak-cell" style="background:${col}" title="${s}: ${v} activities"></div>`);
  }
  // Group into rows of 7
  let html='<div style="display:flex;flex-wrap:wrap;gap:2px;max-width:100%;overflow-x:auto">';
  html+=cells.join('')+'</div>';
  el.innerHTML=html;
  const streak=getStreak();
  const sc=document.getElementById('streak-count'); if(sc) sc.textContent=streak;
  checkBadges();
}

// ─── MOOD LOG ─────────────────────────────────────────────
let moodChartInst=null;
function logMood(val){
  const moods=getNS(userKey('gradintel_mood'),[]);
  moods.push({date:todayStr(),mood:val,time:new Date().toISOString()});
  setNS(userKey('gradintel_mood'),moods);
  document.querySelectorAll('.mood-btn').forEach(b=>b.classList.toggle('selected',parseInt(b.dataset.mood)===val));
  addXP(5,'Mood logged'); checkBadges();
  renderMoodChart(); showToast('😊 Mood logged!');
}
function renderMoodChart(){
  const moods=getNS(userKey('gradintel_mood'),[]);
  // Show today's logged mood
  const today=todayStr();
  const todayMood=moods.filter(m=>m.date===today).pop();
  if(todayMood) document.querySelectorAll('.mood-btn').forEach(b=>b.classList.toggle('selected',parseInt(b.dataset.mood)===todayMood.mood));
  // Chart last 14 days
  const days=14; const labels=[]; const data=[];
  for(let i=days-1;i>=0;i--){
    const d=new Date(); d.setDate(d.getDate()-i);
    const s=d.toISOString().slice(0,10);
    labels.push(d.toLocaleDateString('en',{month:'short',day:'numeric'}));
    const dayMoods=moods.filter(m=>m.date===s);
    data.push(dayMoods.length?Math.round(dayMoods.reduce((a,b)=>a+b.mood,0)/dayMoods.length):null);
  }
  const ctx=document.getElementById('moodChart'); if(!ctx) return;
  if(moodChartInst){moodChartInst.destroy();moodChartInst=null;}
  moodChartInst=new Chart(ctx,{
    type:'line',
    data:{labels,datasets:[{label:'Mood',data,borderColor:'rgba(244,114,182,.8)',backgroundColor:'rgba(244,114,182,.1)',
      pointBackgroundColor:'rgba(244,114,182,.9)',tension:.4,fill:true,spanGaps:true,pointRadius:4,borderWidth:2}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
      scales:{y:{min:1,max:5,ticks:{color:'rgba(255,255,255,.4)',font:{size:9},callback:v=>['😞','😰','😐','🙂','😄'][v-1]||v},
        grid:{color:'rgba(255,255,255,.04)'}},
        x:{ticks:{color:'rgba(255,255,255,.4)',font:{size:9}},grid:{display:false}}}}
  });
}

// ─── DEGREE PROGRESS ──────────────────────────────────────
let currentPnRating=3;
// ══════════════════════════════════════════════════════════════
// MULTI-DEGREE SYSTEM
// ══════════════════════════════════════════════════════════════
let activeDegreeId = null;

function getDegrees() {
  let degrees = getNS(userKey('gradintel_degrees'), null);
  // Migrate legacy single-degree data on first load
  if (!degrees) {
    const legacy = getNS(userKey('gradintel_degree'), {});
    const legacyReqs = getNS(userKey('gradintel_requirements'), []);
    const id = 'deg_' + Date.now();
    degrees = [{
      id, name: legacy.name || 'My Degree',
      totalCredits: legacy.totalCredits || 120,
      targetGpa: legacy.targetGpa || 3.5,
      requirements: legacyReqs
    }];
    setNS(userKey('gradintel_degrees'), degrees);
  }
  return degrees;
}
function saveDegrees(degrees) { setNS(userKey('gradintel_degrees'), degrees); }
function getActiveDegree() {
  const degrees = getDegrees();
  return degrees.find(d => d.id === activeDegreeId) || degrees[0] || null;
}

function addNewDegree() {
  const degrees = getDegrees();
  const id = 'deg_' + Date.now();
  degrees.push({ id, name: 'New Degree', totalCredits: 120, targetGpa: 3.5, requirements: [] });
  saveDegrees(degrees);
  activeDegreeId = id;
  renderDegree();
  // Focus the name input of the new degree
  setTimeout(() => { const el = document.getElementById('deg-name'); if (el) { el.focus(); el.select(); } }, 100);
}

function switchDegree(id) {
  activeDegreeId = id;
  renderDegree();
}

function deleteDegree(id) {
  const degrees = getDegrees();
  if (degrees.length <= 1) { showToast('⚠️ You need at least one degree.'); return; }
  if (!confirm('Delete this degree and all its requirements?')) return;
  const filtered = degrees.filter(d => d.id !== id);
  saveDegrees(filtered);
  if (activeDegreeId === id) activeDegreeId = filtered[0].id;
  renderDegree();
}

function saveDegreeSetup() {
  const degrees = getDegrees();
  const deg = degrees.find(d => d.id === activeDegreeId) || degrees[0];
  if (!deg) return;
  deg.name = document.getElementById('deg-name')?.value || deg.name;
  deg.totalCredits = parseFloat(document.getElementById('deg-total-credits')?.value) || 120;
  deg.targetGpa = parseFloat(document.getElementById('deg-target-gpa')?.value) || 3.5;
  saveDegrees(degrees);
  renderDegreeTabs();
  renderDegProgress(deg);
  checkBadges();
}

function renderDegreeTabs() {
  const degrees = getDegrees();
  const tabsEl = document.getElementById('degree-tabs');
  if (!tabsEl) return;
  if (!activeDegreeId || !degrees.find(d => d.id === activeDegreeId)) {
    activeDegreeId = degrees[0]?.id;
  }
  tabsEl.innerHTML = degrees.map(d => `
    <div style="display:flex;align-items:center;gap:0;border-radius:10px;overflow:hidden;
      border:1px solid ${d.id === activeDegreeId ? 'var(--accent)' : 'var(--border2)'};
      background:${d.id === activeDegreeId ? 'rgba(129,140,248,.12)' : 'var(--surface2)'}">
      <button onclick="switchDegree('${d.id}')"
        style="padding:8px 16px;border:none;background:transparent;cursor:pointer;
               font-family:'Clash Display',sans-serif;font-weight:700;font-size:13px;
               color:${d.id === activeDegreeId ? 'var(--accent)' : 'var(--muted2)'}">
        🎓 ${d.name || 'Unnamed Degree'}
      </button>
      ${degrees.length > 1 ? `<button onclick="deleteDegree('${d.id}')"
        style="padding:8px 10px;border:none;border-left:1px solid var(--border2);background:transparent;
               cursor:pointer;color:var(--red);font-size:12px;line-height:1">✕</button>` : ''}
    </div>`).join('');
}

function renderDegProgress(deg) {
  const el = document.getElementById('deg-progress-wrap'); if (!el) return;
  let totalCP = 0, totalCR = 0;
  semesters.forEach(sem => sem.subjects.forEach(s => {
    const res = computeSubject(s); totalCP += s.credits * (res.curG?.p || 0); totalCR += s.credits;
  }));
  const credPct = deg.totalCredits ? Math.min(100, Math.round(totalCR / deg.totalCredits * 100)) : 0;
  const curGpa = totalCR ? totalCP / totalCR : 0;
  const gpaPct = deg.targetGpa ? Math.min(100, Math.round(curGpa / deg.targetGpa * 100)) : 0;
  el.innerHTML = `
    <div class="deg-prog-wrap">
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted)">
        <span>Credits: ${totalCR} / ${deg.totalCredits}</span><span>${credPct}%</span></div>
      <div class="deg-prog-bar"><div class="deg-prog-fill" style="width:${credPct}%"></div></div>
    </div>
    <div class="deg-prog-wrap">
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted)">
        <span>GPA Progress: ${curGpa.toFixed(2)} / ${deg.targetGpa}</span><span>${gpaPct}%</span></div>
      <div class="deg-prog-bar"><div class="deg-prog-fill" style="width:${gpaPct}%;background:linear-gradient(90deg,var(--accent2),var(--accent))"></div></div>
    </div>
    <div style="margin-top:10px;font-size:12px;color:var(--muted2)">
      Estimated semesters remaining: <strong>${Math.max(0, Math.ceil((deg.totalCredits - totalCR) / 18))}</strong>
      &nbsp;·&nbsp; Credits remaining: <strong>${Math.max(0, deg.totalCredits - totalCR)}</strong>
    </div>`;
}

function renderDegree() {
  const degrees = getDegrees();
  if (!activeDegreeId || !degrees.find(d => d.id === activeDegreeId)) {
    activeDegreeId = degrees[0]?.id;
  }
  renderDegreeTabs();
  const deg = getActiveDegree();
  if (!deg) { document.getElementById('degree-content').innerHTML = '<div style="color:var(--muted);padding:20px">No degree found.</div>'; return; }

  document.getElementById('degree-content').innerHTML = `
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:10px">
        <div class="card-title" style="margin-bottom:0">⚙️ Degree Setup</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:14px">
        <div class="field"><label>Degree Name</label>
          <input type="text" id="deg-name" placeholder="e.g. B.Sc. Computer Science" value="${deg.name || ''}" oninput="saveDegreeSetup()"/></div>
        <div class="field"><label>Total Credits Required</label>
          <input type="number" id="deg-total-credits" placeholder="e.g. 120" min="1" value="${deg.totalCredits || 120}" oninput="saveDegreeSetup()"/></div>
        <div class="field"><label>Target Graduation GPA</label>
          <input type="number" id="deg-target-gpa" placeholder="e.g. 3.5" min="0" max="5" step="0.01" value="${deg.targetGpa || 3.5}" oninput="saveDegreeSetup()"/></div>
      </div>
      <div id="deg-progress-wrap"></div>
    </div>
    <div class="card" style="margin-bottom:14px">
      <div class="card-title">📋 Course Requirements — ${deg.name || 'This Degree'}</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:12px">Track which required courses you've completed or still need</div>
      <button class="btn btn-primary" onclick="openAddRequirementModal()" style="margin-bottom:14px">+ Add Requirement</button>
      <div id="requirements-list"></div>
    </div>`;

  renderDegProgress(deg);
  renderRequirements();
  renderProfNotes();
}

// ── REQUIREMENTS (now scoped to active degree) ────────────────
function getRequirements() {
  const deg = getActiveDegree();
  return deg ? (deg.requirements || []) : [];
}
function saveRequirementsForDegree(reqs) {
  const degrees = getDegrees();
  const deg = degrees.find(d => d.id === activeDegreeId) || degrees[0];
  if (!deg) return;
  deg.requirements = reqs;
  saveDegrees(degrees);
}

function openAddRequirementModal() {
  openAddReq();
}
function saveRequirement() {
  const name = document.getElementById('req-name')?.value.trim();
  if (!name) { showToast('Add a course name!'); return; }
  const editId = document.getElementById('req-edit-id')?.value || '';
  const reqs = getRequirements();
  const entry = {
    id: editId || ('req_' + Date.now()),
    name,
    credits: parseFloat(document.getElementById('req-credits')?.value) || 3,
    category: document.getElementById('req-category')?.value.trim() || 'General',
    status: document.getElementById('req-status')?.value || 'pending'
  };
  if (editId) {
    const idx = reqs.findIndex(r => r.id === editId);
    if (idx >= 0) reqs[idx] = entry; else reqs.push(entry);
    showToast('✏️ Requirement updated!');
  } else {
    reqs.push(entry);
    showToast('📋 Requirement added!');
  }
  saveRequirementsForDegree(reqs);
  document.getElementById('req-modal').classList.remove('show');
  renderRequirements(); checkBadges();
}
function openAddReq() {
  document.getElementById('req-modal-title').textContent = 'Add Course Requirement';
  document.getElementById('req-edit-id').value = '';
  document.getElementById('req-name').value = '';
  document.getElementById('req-credits').value = '';
  document.getElementById('req-category').value = '';
  document.getElementById('req-status').value = 'pending';
  document.getElementById('req-modal').classList.add('show');
}
function openEditReq(id) {
  const r = getRequirements().find(x => x.id === id); if (!r) return;
  document.getElementById('req-modal-title').textContent = 'Edit Course Requirement';
  document.getElementById('req-edit-id').value = r.id;
  document.getElementById('req-name').value = r.name;
  document.getElementById('req-credits').value = r.credits;
  document.getElementById('req-category').value = r.category || '';
  document.getElementById('req-status').value = r.status || 'pending';
  document.getElementById('req-modal').classList.add('show');
}
function renderRequirements() {
  const reqs = getRequirements();
  const el = document.getElementById('requirements-list'); if (!el) return;
  if (!reqs.length) { el.innerHTML = '<div style="color:var(--muted);font-size:13px">No requirements added yet.</div>'; return; }
  const statusConfig = {
    pending: { label: 'Pending', bg: 'rgba(107,114,128,.12)', col: 'var(--muted)' },
    in_progress: { label: 'In Progress', bg: 'rgba(129,140,248,.12)', col: 'var(--accent)' },
    completed: { label: 'Completed', bg: 'rgba(52,211,153,.12)', col: 'var(--green)' },
    waived: { label: 'Waived', bg: 'rgba(251,191,36,.12)', col: 'var(--yellow)' }
  };
  el.innerHTML = reqs.map(r => {
    const sc = statusConfig[r.status] || statusConfig.pending;
    return `<div class="req-item">
      <div style="flex:1"><div style="font-weight:700;font-size:13px">${r.name}</div>
        <div style="font-size:11px;color:var(--muted)">${r.category} · ${r.credits} credits</div></div>
      <div class="req-status-badge" style="background:${sc.bg};color:${sc.col}">${sc.label}</div>
      <select onchange="updateReqStatus('${r.id}',this.value)" style="font-size:11px;background:var(--surface3);border:1px solid var(--border2);border-radius:6px;padding:3px 6px;color:var(--text)">
        ${['pending', 'in_progress', 'completed', 'waived'].map(s => `<option value="${s}" ${s === r.status ? 'selected' : ''}>${s.replace('_', ' ')}</option>`).join('')}
      </select>
      <button onclick="openEditReq('${r.id}')" title="Edit" style="background:transparent;border:none;color:var(--accent);cursor:pointer;font-size:13px;padding:2px 4px">✏️</button>
      <button onclick="deleteRequirement('${r.id}')" title="Delete" style="background:transparent;border:none;color:var(--red);cursor:pointer;font-size:13px;padding:2px 4px">🗑</button>
    </div>`;
  }).join('');
}
function updateReqStatus(id, status) {
  const reqs = getRequirements(); const r = reqs.find(x => x.id === id); if (!r) return;
  r.status = status; saveRequirementsForDegree(reqs);
  if (status === 'completed') addXP(10, 'Course requirement completed');
  renderRequirements(); checkBadges();
}
function deleteRequirement(id) {
  saveRequirementsForDegree(getRequirements().filter(r => r.id !== id));
  renderRequirements();
}

function importDegreePdfCourses(courses, degreeName, totalCredits) {
  const reqs = getRequirements();
  let added = 0;
  courses.forEach(function(c) {
    if (!reqs.some(r => r.name.toLowerCase() === (c.name || '').toLowerCase())) {
      reqs.push({ id: 'req_' + Date.now() + '_' + Math.random().toString(36).slice(2), name: c.name || 'Unnamed', credits: parseFloat(c.credits) || 3, category: c.category || 'General', status: 'pending' });
      added++;
    }
  });
  saveRequirementsForDegree(reqs);
  // Update active degree name/credits if not already set
  const degrees = getDegrees();
  const deg = degrees.find(d => d.id === activeDegreeId) || degrees[0];
  if (deg) {
    if (degreeName && (!deg.name || deg.name === 'New Degree' || deg.name === 'My Degree')) deg.name = degreeName;
    if (totalCredits && deg.totalCredits === 120) deg.totalCredits = totalCredits;
    saveDegrees(degrees);
  }
  renderDegree();
  document.getElementById('pdf-ai-preview').style.display = 'none';
  document.getElementById('pdf-ai-status').style.display = 'none';
  showToast('🎓 Imported ' + added + ' course requirements into "' + (deg?.name || 'degree') + '"!');
  checkBadges();
}

// Legacy compatibility shims
function getDegree() { return getActiveDegree() || { name: '', totalCredits: 120, targetGpa: 3.5 }; }

// ── PDF DEGREE AUTO-FILL ──────────────────────────────────────
function handleDegreePdfDrop(event) {
  const file = event.dataTransfer.files[0];
  if (file && file.type === 'application/pdf') handleDegreePdfFile(file);
  else showToast('Please drop a PDF file!');
}

function handleDegreePdfFile(file) {
  if (!file) return;
  const statusEl = document.getElementById('pdf-ai-status');
  const msgEl    = document.getElementById('pdf-ai-msg');
  const previewEl= document.getElementById('pdf-ai-preview');
  statusEl.style.display = 'block';
  previewEl.style.display = 'none';
  msgEl.textContent = 'Reading PDF…';

  const prov = localStorage.getItem('gradintel_ai_prov') || 'gemini';
  const key  = localStorage.getItem('gradintel_ai_key_' + prov) || '';
  if (!key) {
    msgEl.textContent = '⚠️ No AI key set — go to the AI Assistant tab to add your API key first.';
    document.getElementById('pdf-ai-spinner').style.display = 'none';
    return;
  }

  const reader = new FileReader();
  reader.onload = async function(e) {
    const base64 = e.target.result.split(',')[1];
    msgEl.textContent = '🤖 Asking AI to extract degree requirements…';
    try {
      let jsonText = '';
      const prompt = `You are reading a university degree requirements PDF. Extract ALL course requirements listed. For each course/requirement output a JSON array. Each item should have: "name" (course name), "credits" (number, default 3 if not specified), "category" (e.g. Core, Elective, Lab, Gen Ed, Major, Minor — infer from context), "status" (always "pending"). Also extract the degree name if visible as "degreeName" and total credits required as "totalCredits" (number). Return ONLY valid JSON, no markdown, no explanation. Format: { "degreeName": "...", "totalCredits": 120, "courses": [{...}, ...] }`;

      if (prov === 'gemini') {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [
            { inline_data: { mime_type: 'application/pdf', data: base64 } },
            { text: prompt }
          ]}], generationConfig: { maxOutputTokens: 2000 }})
        });
        const d = await res.json();
        jsonText = d?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else {
        // For non-multimodal providers, extract text from PDF using pdf.js then send as text
        msgEl.textContent = '📄 Extracting PDF text for AI…';
        let pdfText = '';
        try {
          const pdfData = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
          if (window.pdfjsLib) {
            const doc = await window.pdfjsLib.getDocument({ data: pdfData }).promise;
            for (let i = 1; i <= Math.min(doc.numPages, 15); i++) {
              const page = await doc.getPage(i);
              const tc = await page.getTextContent();
              pdfText += tc.items.map(t => t.str).join(' ') + '\n';
            }
          }
        } catch(pe) { pdfText = '[PDF text extraction failed — try Gemini for best results]'; }
        msgEl.textContent = '🤖 Asking AI to extract degree requirements…';
        const textPrompt = `Here is text extracted from a university degree requirements PDF:\n\n${pdfText.slice(0, 8000)}\n\n${prompt}`;
        if (prov === 'claude') {
          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method:'POST', headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},
            body: JSON.stringify({ model:'claude-haiku-4-5-20251001', max_tokens:2000, messages:[{role:'user',content:textPrompt}]})
          });
          const d = await res.json(); jsonText = d?.content?.[0]?.text || '';
        } else {
          const urls = { groq:'https://api.groq.com/openai/v1/chat/completions', openai:'https://api.openai.com/v1/chat/completions' };
          const models = { groq:'llama3-8b-8192', openai:'gpt-4o-mini' };
          const res = await fetch(urls[prov]||urls.openai, {
            method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
            body: JSON.stringify({ model:models[prov]||models.openai, max_tokens:2000, messages:[{role:'user',content:textPrompt}]})
          });
          const d = await res.json(); jsonText = d?.choices?.[0]?.message?.content || '';
        }
      }

      // Parse JSON
      const clean = jsonText.replace(/```json|```/g,'').trim();
      const parsed = JSON.parse(clean);
      const courses = parsed.courses || parsed;

      // Show preview
      msgEl.textContent = `✅ Found ${courses.length} course requirements!`;
      document.getElementById('pdf-ai-spinner').style.display = 'none';
      previewEl.style.display = 'block';
      previewEl.innerHTML = `
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--r);padding:16px">
          <div style="font-family:'Clash Display',sans-serif;font-weight:700;font-size:14px;margin-bottom:4px">
            ${parsed.degreeName ? '🎓 ' + parsed.degreeName : '🎓 Degree Requirements'}
          </div>
          ${parsed.totalCredits ? `<div style="font-size:12px;color:var(--muted);margin-bottom:12px">Total Credits: ${parsed.totalCredits}</div>` : ''}
          <div style="max-height:220px;overflow-y:auto;margin-bottom:14px">
            ${courses.slice(0,50).map(c=>`
              <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
                <div><span style="font-size:12px;font-weight:600">${c.name||'Untitled'}</span>
                  <span style="font-size:10px;color:var(--muted);margin-left:6px">${c.category||'General'}</span></div>
                <span style="font-size:11px;color:var(--accent)">${c.credits||3} cr</span>
              </div>`).join('')}
            ${courses.length>50?`<div style="font-size:11px;color:var(--muted);padding-top:6px">...and ${courses.length-50} more</div>`:''}
          </div>
          <div style="display:flex;gap:10px">
            <button class="btn btn-primary" onclick="importDegreePdfCourses(${JSON.stringify(courses).replace(/"/g,'&quot;')}, '${(parsed.degreeName||'').replace(/'/g,'')}', ${parsed.totalCredits||0})">
              ✅ Import All ${courses.length} Requirements
            </button>
            <button class="btn btn-secondary" onclick="document.getElementById('pdf-ai-preview').style.display='none'">Discard</button>
          </div>
        </div>`;
    } catch(err) {
      msgEl.textContent = '❌ Error: ' + (err.message || 'Could not parse response. Try a text-based PDF.');
      document.getElementById('pdf-ai-spinner').style.display = 'none';
    }
  };
  reader.readAsDataURL(file);
}


// Prof Notes
function getProfNotes(){ return getNS(userKey('gradintel_prof_notes'),[]); }
function openAddProfNoteModal(){
  document.getElementById('pn-course').value='';
  document.getElementById('pn-notes').value='';
  document.getElementById('pn-sem').value='';
  currentPnRating=3; setPnRating(3);
  document.getElementById('profnote-modal').classList.add('show');
}
function setPnRating(val){
  currentPnRating=val;
  document.querySelectorAll('.pn-star').forEach(s=>{ s.style.opacity=parseInt(s.dataset.v)<=val?'1':'0.3'; });
}
function saveProfNote(){
  const course=document.getElementById('pn-course')?.value.trim();
  if(!course){ showToast('Add a course/professor name!'); return; }
  const notes=getProfNotes();
  notes.unshift({ id:'pn_'+Date.now(), course,
    rating:currentPnRating,
    notes:document.getElementById('pn-notes')?.value.trim()||'',
    sem:document.getElementById('pn-sem')?.value.trim()||'' });
  setNS(userKey('gradintel_prof_notes'),notes);
  document.getElementById('profnote-modal').classList.remove('show');
  renderProfNotes(); showToast('📝 Note saved!');
}
function renderProfNotes(){
  const notes=getProfNotes();
  const el=document.getElementById('prof-notes-list'); if(!el) return;
  if(!notes.length){ el.innerHTML='<div style="color:var(--muted);font-size:13px">No notes yet.</div>'; return; }
  el.innerHTML=notes.map(n=>`<div class="profnote-item">
    <div class="profnote-header">
      <div class="profnote-course">${n.course}</div>
      <div class="profnote-stars">${'⭐'.repeat(n.rating)}${'☆'.repeat(5-n.rating)}</div>
    </div>
    ${n.notes?`<div class="profnote-notes">${n.notes}</div>`:''}
    <div class="profnote-meta">${n.sem?'📅 '+n.sem:''} &nbsp;
      <button onclick="deleteProfNote('${n.id}')" style="background:transparent;border:none;color:var(--red);cursor:pointer;font-size:11px">🗑 Delete</button>
    </div>
  </div>`).join('');
}
function deleteProfNote(id){ const notes=getProfNotes().filter(n=>n.id!==id); setNS(userKey('gradintel_prof_notes'),notes); renderProfNotes(); }

// ─── INIT NEW FEATURES ON AUTH SUCCESS ─────────────────────
// Hook into existing onAuthSuccess by patching the activity log
const _origOnAuthSuccess = typeof onAuthSuccess === 'function' ? onAuthSuccess : null;
// Patch logActivity into the boot
document.addEventListener('DOMContentLoaded', ()=>{
  logActivity();
});
// Patch addXP into grade saving — hook checkBadges into existing save flow
const origSaveEditModal = typeof saveEditModal === 'function' ? saveEditModal : null;

