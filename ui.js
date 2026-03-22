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

/* ─── GRADINTEL V3 SIDEBAR & THEME ─── */
/* ═══════ GRADINTEL V3 JS ═══════════════════════════════ */

/* ── Tab switching ── */
function gv3Switch(tab) {
  if (typeof showTab === 'function') showTab(tab);
  document.querySelectorAll('.gv3-item').forEach(function(b) {
    b.classList.toggle('on', b.getAttribute('data-tab') === tab);
  });
  gv3CloseMob();
}
(function() {
  var orig = window.showTab;
  window.showTab = function(tab) {
    if (orig) orig.call(this, tab);
    document.querySelectorAll('.gv3-item').forEach(function(b) {
      b.classList.toggle('on', b.getAttribute('data-tab') === tab);
    });
  };
})();

/* ── Collapse — logo is the toggle, no separate button ── */
function gv3ToggleCollapse() {
  var collapsed = document.body.classList.toggle('gv3-collapsed');
  try { localStorage.setItem('gv3_col', collapsed ? '1' : ''); } catch(e){}
}

/* ── Mobile ── */
function gv3ToggleMob() {
  document.getElementById('gv3-sb').classList.toggle('mob-open');
  document.getElementById('gv3-mob-overlay').classList.toggle('on');
}
function gv3CloseMob() {
  document.getElementById('gv3-sb').classList.remove('mob-open');
  document.getElementById('gv3-mob-overlay').classList.remove('on');
}

/* ── Theme system ── */
var GV3_THEMES = {
  violet:  {a1:'#a78bfa', a2:'#f472b6', label:'Violet'},
  ocean:   {a1:'#38bdf8', a2:'#6366f1', label:'Ocean'},
  emerald: {a1:'#34d399', a2:'#38bdf8', label:'Emerald'},
  sunset:  {a1:'#fb7185', a2:'#fbbf24', label:'Sunset'},
  gold:    {a1:'#fbbf24', a2:'#f97316', label:'Gold'},
  neon:    {a1:'#a3e635', a2:'#22d3ee', label:'Neon'},
  crimson: {a1:'#ef4444', a2:'#a78bfa', label:'Crimson'},
  arctic:  {a1:'#bae6fd', a2:'#818cf8', label:'Arctic'},
};

function gv3Hex2Rgb(h) {
  return parseInt(h.slice(1,3),16)+','+parseInt(h.slice(3,5),16)+','+parseInt(h.slice(5,7),16);
}

function gv3SetTheme(name) {
  var t = GV3_THEMES[name]; if (!t) return;
  var rs = document.documentElement.style;
  /* Set our vars */
  rs.setProperty('--a1',  t.a1);
  rs.setProperty('--a2',  t.a2);
  rs.setProperty('--bd1', 'rgba('+gv3Hex2Rgb(t.a1)+',0.10)');
  rs.setProperty('--bd2', 'rgba('+gv3Hex2Rgb(t.a1)+',0.22)');
  rs.setProperty('--c-bd',  'rgba('+gv3Hex2Rgb(t.a1)+',0.10)');
  rs.setProperty('--c-bd2', 'rgba('+gv3Hex2Rgb(t.a1)+',0.22)');
  /* Also update originals so existing components pick up the color */
  rs.setProperty('--accent',  t.a1);
  rs.setProperty('--accent2', t.a2);
  rs.setProperty('--border',  'rgba('+gv3Hex2Rgb(t.a1)+',0.10)');
  rs.setProperty('--border2', 'rgba('+gv3Hex2Rgb(t.a1)+',0.22)');

  /* Update the SVG gradient in defs */
  var stops = document.querySelectorAll('#site-ig stop');
  if (stops.length >= 2) {
    stops[0].setAttribute('stop-color', t.a1);
    stops[1].setAttribute('stop-color', t.a2);
  }

  /* Update dot + label */
  var dot = document.querySelector('.gv3-dot');
  if (dot) { dot.style.background = t.a1; dot.style.boxShadow = '0 0 5px '+t.a1; }
  var lbl = document.getElementById('gv3-theme-lbl');
  if (lbl) lbl.textContent = t.label;

  /* Mark active card */
  document.querySelectorAll('.gv3-tc').forEach(function(c) { c.classList.remove('on'); });
  var ac = document.querySelector('.gv3-tc[onclick*="'+name+'"]');
  if (ac) ac.classList.add('on');

  try { localStorage.setItem('gv3_theme', name); } catch(e){}
  gv3ClosePanel();
}

function gv3TogglePanel() {
  document.getElementById('gv3-theme-panel').classList.toggle('open');
}
function gv3ClosePanel() {
  document.getElementById('gv3-theme-panel').classList.remove('open');
}
document.addEventListener('click', function(e) {
  var p = document.getElementById('gv3-theme-panel');
  var b = document.getElementById('gv3-theme-btn');
  if (p && b && !p.contains(e.target) && !b.contains(e.target)) p.classList.remove('open');
});

/* ── 3D card tilt ── */
function gv3InitTilt() {
  document.querySelectorAll('.card, .stat-card, .export-card, .ai-prov-card, .badge-card').forEach(function(card) {
    if (card._gv3) return;
    card._gv3 = true;
    card.addEventListener('mousemove', function(e) {
      var r = card.getBoundingClientRect();
      var dx = (e.clientX - r.left - r.width/2)  / (r.width/2);
      var dy = (e.clientY - r.top  - r.height/2) / (r.height/2);
      var mx = card.classList.contains('stat-card') ? 6 : 4;
      card.style.transform = 'perspective(700px) rotateX('+(-dy*mx)+'deg) rotateY('+(dx*mx)+'deg) translateZ(4px)';
      var px = ((e.clientX - r.left) / r.width  * 100).toFixed(1);
      var py = ((e.clientY - r.top)  / r.height * 100).toFixed(1);
      var sh = card.querySelector('.gv3-shine');
      if (!sh) { sh = document.createElement('div'); sh.className='gv3-shine'; card.appendChild(sh); }
      sh.style.cssText = 'position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:1;transition:opacity .3s;';
      sh.style.background = 'radial-gradient(circle at '+px+'% '+py+'%, rgba(255,255,255,0.08), transparent 55%)';
      sh.style.opacity = '1';
    });
    card.addEventListener('mouseleave', function() {
      card.style.transform = '';
      var sh = card.querySelector('.gv3-shine');
      if (sh) sh.style.opacity = '0';
    });
  });
}

/* ── Restore saved settings on load ── */
document.addEventListener('DOMContentLoaded', function() {
  try {
    var t = localStorage.getItem('gv3_theme');
    if (t && GV3_THEMES[t]) gv3SetTheme(t);
    if (localStorage.getItem('gv3_col') === '1') document.body.classList.add('gv3-collapsed');
  } catch(e){}
  setTimeout(gv3InitTilt, 600);
});
setInterval(gv3InitTilt, 2500);

/* ═══════════════════════════════════════════════════════
   CANVAS LMS INTEGRATION
════════════════════════════════════════════════════════ */
var cvCourses = [];
var cvSelected = new Set();
var cvConfig = {};
var cvToastTimer = null;

function cvLoadConfig() {
  try {
    var raw = localStorage.getItem('gradintel_canvas_config');
    cvConfig = raw ? JSON.parse(raw) : {};
  } catch(e) { cvConfig = {}; }
  if (cvConfig.url)    document.getElementById('cv-url').value    = cvConfig.url;
  if (cvConfig.token)  document.getElementById('cv-token').value  = cvConfig.token;
  if (cvConfig.worker) document.getElementById('cv-worker').value = cvConfig.worker;
  if (cvConfig.enrollState) document.getElementById('cv-enroll-state').value = cvConfig.enrollState;
  cvUpdateStatus();
}

function cvSaveConfig() {
  cvConfig = {
    url:         document.getElementById('cv-url').value.trim().replace(/\/+$/, ''),
    token:       document.getElementById('cv-token').value.trim(),
    worker:      document.getElementById('cv-worker').value.trim().replace(/\/+$/, ''),
    enrollState: document.getElementById('cv-enroll-state').value,
    connected:   cvConfig.connected || false,
    lastSync:    cvConfig.lastSync  || null,
  };
  localStorage.setItem('gradintel_canvas_config', JSON.stringify(cvConfig));
  cvUpdateStatus();
}

function cvUpdateStatus() {
  var dot  = document.getElementById('cv-dot');
  var text = document.getElementById('cv-status-text');
  var sub  = document.getElementById('cv-status-sub');
  var disc = document.getElementById('cv-disconnect-btn');
  if (!dot) return;
  if (cvConfig.connected && cvConfig.lastSync) {
    dot.className  = 'cv-status-dot connected';
    text.textContent = '✓ Connected to ' + (cvConfig.url || 'Canvas');
    sub.textContent  = 'Last synced: ' + cvConfig.lastSync;
    disc.style.display = 'flex';
  } else if (cvConfig.url && cvConfig.token && cvConfig.worker) {
    dot.className  = 'cv-status-dot';
    dot.style.background = 'var(--a1)'; dot.style.boxShadow = '0 0 8px var(--a1)';
    text.textContent = 'Ready to sync';
    sub.textContent  = 'Press "Sync from Canvas" to fetch your courses';
    disc.style.display = 'none';
  } else {
    dot.className  = 'cv-status-dot';
    dot.style.background = ''; dot.style.boxShadow = '';
    text.textContent = 'Not connected';
    sub.textContent  = 'Fill in the fields below to get started';
    disc.style.display = 'none';
  }
}

function cvLog(msg, type) {
  var log = document.getElementById('cv-log');
  log.classList.add('show');
  var line = document.createElement('div');
  line.className = type || '';
  line.textContent = (type === 'ok' ? '✓ ' : type === 'err' ? '✗ ' : '→ ') + msg;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

function cvClearLog() {
  var log = document.getElementById('cv-log');
  log.innerHTML = '';
  log.classList.remove('show');
}

async function cvFetch(path) {
  var worker = cvConfig.worker;
  var token  = cvConfig.token;
  var base   = cvConfig.url;
  if (!worker || !token || !base) throw new Error('Missing config');
  var targetUrl = base + path;
  var proxyUrl  = worker + '?url=' + encodeURIComponent(targetUrl) + '&token=' + encodeURIComponent(token);
  var resp = await fetch(proxyUrl);
  if (!resp.ok) throw new Error('HTTP ' + resp.status + ' from Canvas');
  return resp.json();
}

async function cvTestConnection() {
  cvClearLog();
  cvLog('Testing connection…', 'inf');
  try {
    var profile = await cvFetch('/api/v1/users/self/profile');
    cvLog('Connected as: ' + (profile.name || profile.short_name || 'Unknown'), 'ok');
    cvConfig.connected = true;
    cvSaveConfig();
    cvShowToast('✓ Connected as ' + (profile.name || 'Canvas User'));
  } catch(e) {
    cvLog('Connection failed: ' + e.message, 'err');
    cvLog('Check your Canvas URL, token, and Worker URL', 'inf');
    cvShowToast('Connection failed — check the log below');
  }
}

async function cvSync() {
  var btn = document.getElementById('cv-sync-btn');
  if (!cvConfig.url || !cvConfig.token || !cvConfig.worker) {
    cvShowToast('⚠️ Please fill in Canvas URL, token, and Worker URL first');
    return;
  }
  btn.disabled = true;
  btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="animation:spin 1s linear infinite"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/></svg> Syncing…';

  var dot = document.getElementById('cv-dot');
  dot.className = 'cv-status-dot syncing';

  cvClearLog();
  cvLog('Connecting to Canvas…', 'inf');
  cvCourses = [];
  cvSelected.clear();

  try {
    // Fetch courses
    var enrollState = cvConfig.enrollState || 'active';
    var param = enrollState === 'all' ? '' : '&enrollment_state=' + enrollState;
    cvLog('Fetching courses…', 'inf');
    var courses = await cvFetch('/api/v1/courses?include[]=total_scores&include[]=current_grading_period_scores&per_page=50' + param);

    // Filter out courses without names (sandbox/deleted)
    courses = (courses || []).filter(function(c) { return c.name && !c.access_restricted_by_date; });
    cvLog('Found ' + courses.length + ' courses', 'ok');

    // Fetch assignments for each course (up to 10 courses to avoid rate limits)
    var enriched = [];
    var toFetch = courses.slice(0, 12);
    for (var i = 0; i < toFetch.length; i++) {
      var c = toFetch[i];
      cvLog('Loading ' + c.name + '…', 'inf');
      try {
        // Assignment groups (weights)
        var groups = await cvFetch('/api/v1/courses/' + c.id + '/assignment_groups?include[]=assignments&include[]=submission');
        c._groups = groups || [];

        // Upcoming assignments (due soon)
        var assigns = await cvFetch('/api/v1/courses/' + c.id + '/assignments?include[]=submission&order_by=due_at&per_page=30');
        c._assignments = (assigns || []).filter(function(a) {
          return a.due_at && new Date(a.due_at) > new Date();
        }).slice(0, 8);
      } catch(e2) {
        c._groups = []; c._assignments = [];
      }
      enriched.push(c);
    }

    cvCourses = enriched;
    cvConfig.connected = true;
    cvConfig.lastSync  = new Date().toLocaleString();
    cvSaveConfig();

    cvRenderCourses();
    cvRenderAssignments();

    document.getElementById('cv-courses-section').style.display = 'block';
    document.getElementById('cv-how-section').style.display = 'none';

    cvLog('Sync complete! Select courses below to import into Gradintel.', 'ok');
    cvShowToast('✓ Synced ' + courses.length + ' courses from Canvas');

  } catch(e) {
    cvLog('Sync failed: ' + e.message, 'err');
    cvShowToast('Sync failed — see log below');
    dot.className = 'cv-status-dot error';
  }

  btn.disabled = false;
  btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg> Sync from Canvas';
}

function cvGradeToPercent(c) {
  if (c.enrollments && c.enrollments.length > 0) {
    var e = c.enrollments[0];
    if (e.computed_current_score != null) return e.computed_current_score;
    if (e.current_score != null) return e.current_score;
  }
  return null;
}

function cvPercentToLetter(pct) {
  if (pct == null) return null;
  if (pct >= 93) return 'A';  if (pct >= 90) return 'A-';
  if (pct >= 87) return 'B+'; if (pct >= 83) return 'B';
  if (pct >= 80) return 'B-'; if (pct >= 77) return 'C+';
  if (pct >= 73) return 'C';  if (pct >= 70) return 'C-';
  if (pct >= 67) return 'D+'; if (pct >= 63) return 'D';
  if (pct >= 60) return 'D-'; return 'F';
}

function cvRenderCourses() {
  var grid = document.getElementById('cv-courses-grid');
  grid.innerHTML = '';
  cvCourses.forEach(function(c) {
    var pct = cvGradeToPercent(c);
    var letter = cvPercentToLetter(pct);
    var assignCount = (c._assignments || []).length;
    var totalAssigns = 0;
    (c._groups || []).forEach(function(g) { totalAssigns += (g.assignments || []).length; });

    var card = document.createElement('div');
    card.className = 'cv-course-card';
    card.setAttribute('data-id', c.id);
    card.innerHTML =
      '<div class="cv-cc-top">' +
        '<div><div class="cv-cc-name">' + cvEsc(c.name) + '</div>' +
        '<div class="cv-cc-code">' + cvEsc(c.course_code || '') + '</div></div>' +
        '<div class="cv-cc-grade ' + (pct == null ? 'no-grade' : '') + '">' +
          (pct != null ? (pct.toFixed(1) + '%') : 'N/A') + '</div>' +
      '</div>' +
      '<div class="cv-cc-meta">' +
        '<span class="cv-cc-tag">' + (letter || '–') + '</span>' +
        '<span class="cv-cc-assignments">' +
          (totalAssigns > 0 ? totalAssigns + ' assignments' : '') +
          (assignCount > 0 ? ' · ' + assignCount + ' upcoming' : '') +
        '</span>' +
      '</div>' +
      '<div class="cv-cc-check"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>';
    card.onclick = function() { cvToggleCourse(c.id, card); };
    grid.appendChild(card);
  });
  cvUpdateSemTargets();
}

function cvToggleCourse(id, card) {
  if (cvSelected.has(id)) {
    cvSelected.delete(id);
    card.classList.remove('selected');
  } else {
    cvSelected.add(id);
    card.classList.add('selected');
  }
  cvUpdateImportConfirm();
}

function cvSelectAll() {
  cvCourses.forEach(function(c) {
    cvSelected.add(c.id);
    var card = document.querySelector('.cv-course-card[data-id="' + c.id + '"]');
    if (card) card.classList.add('selected');
  });
  cvUpdateImportConfirm();
}

function cvUpdateImportConfirm() {
  var box = document.getElementById('cv-import-confirm');
  if (cvSelected.size === 0) { box.classList.remove('show'); return; }

  var selectedCourses = cvCourses.filter(function(c) { return cvSelected.has(c.id); });
  var totalAssigns = 0;
  selectedCourses.forEach(function(c) {
    (c._groups || []).forEach(function(g) { totalAssigns += (g.assignments || []).length; });
  });

  document.getElementById('cv-import-summary').innerHTML =
    '<span>' + cvSelected.size + '</span> course(s) selected · ' +
    '<span>' + totalAssigns + '</span> total assignments · ' +
    'Will be added to Gradintel as subjects with exam weights';
  box.classList.add('show');
}

function cvRenderAssignments() {
  var allUpcoming = [];
  cvCourses.forEach(function(c) {
    (c._assignments || []).forEach(function(a) {
      a._courseName = c.name;
      allUpcoming.push(a);
    });
  });
  allUpcoming.sort(function(a, b) { return new Date(a.due_at) - new Date(b.due_at); });

  if (allUpcoming.length === 0) return;

  var card = document.getElementById('cv-assign-card');
  card.style.display = 'block';
  document.getElementById('cv-assign-count').textContent = '(' + allUpcoming.length + ' upcoming)';

  var list = document.getElementById('cv-assign-list');
  list.innerHTML = '';
  allUpcoming.slice(0, 20).forEach(function(a) {
    var sub = a.submission || {};
    var score = null, scoreClass = 'pending';
    if (sub.score != null && a.points_possible > 0) {
      score = sub.score.toFixed(1) + '/' + a.points_possible;
      scoreClass = sub.score / a.points_possible >= 0.7 ? '' : 'missing';
    } else if (sub.missing) {
      score = 'MISSING'; scoreClass = 'missing';
    } else {
      score = '—'; scoreClass = 'pending';
    }

    var dueDate = new Date(a.due_at);
    var today = new Date();
    var diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
    var dueStr = diffDays === 0 ? 'Today' :
                 diffDays === 1 ? 'Tomorrow' :
                 diffDays < 7  ? 'In ' + diffDays + 'd' :
                 dueDate.toLocaleDateString('en-US', { month:'short', day:'numeric' });

    var row = document.createElement('div');
    row.className = 'cv-assign-row';
    row.innerHTML =
      '<div class="cv-assign-name">' + cvEsc(a.name) + '<span style="font-weight:400;color:var(--c-muted);font-size:11px;margin-left:6px">' + cvEsc(a._courseName) + '</span></div>' +
      '<span class="cv-assign-due">' + dueStr + '</span>' +
      '<span class="cv-assign-score ' + scoreClass + '">' + score + '</span>';
    list.appendChild(row);
  });
}

function cvUpdateSemTargets() {
  var sel = document.getElementById('cv-sem-target');
  sel.innerHTML = '<option value="new">➕ Create new semester</option>';
  if (typeof semesters !== 'undefined') {
    semesters.forEach(function(s) {
      var opt = document.createElement('option');
      opt.value = s.id; opt.textContent = s.name;
      sel.appendChild(opt);
    });
  }
}

function cvCourseToSubject(course) {
  // Convert Canvas course + assignment groups → Gradintel subject schema
  var pct   = cvGradeToPercent(course);
  var groups = course._groups || [];

  // Build exam list from Canvas assignment groups
  var exams = [];
  var otherPct = 0;
  var otherScore = pct || 0;
  var examTotalPct = 0;

  // Identify if there are meaningful assignment groups with weights
  var weightedGroups = groups.filter(function(g) { return g.group_weight > 0; });

  if (weightedGroups.length >= 2) {
    // Use the two largest weighted groups as "exams", rest as "other"
    weightedGroups.sort(function(a, b) { return b.group_weight - a.group_weight; });

    // Top groups become exams (max 4)
    var examGroups = weightedGroups.slice(0, 4);
    examGroups.forEach(function(g) {
      // Calculate this group's current score
      var assigns = g.assignments || [];
      var graded  = assigns.filter(function(a) { return a.submission && a.submission.score != null; });
      var earned  = graded.reduce(function(s, a) { return s + a.submission.score; }, 0);
      var max     = graded.reduce(function(s, a) { return s + (a.points_possible || 0); }, 0);
      var groupScore = max > 0 ? (earned / max * 100) : null;

      exams.push({
        name:   g.name,
        weight: Math.round(g.group_weight),
        taken:  groupScore != null,
        score:  groupScore != null ? parseFloat(groupScore.toFixed(1)) : null
      });
      examTotalPct += g.group_weight;
    });

    otherPct   = Math.max(0, Math.round(100 - examTotalPct));
    otherScore = pct || 0;
  } else {
    // No meaningful groups — treat entire grade as "other"
    otherPct   = 100;
    otherScore = pct || 0;
    exams = [{ name: 'Final Exam', weight: 100, taken: false, score: null }];
    examTotalPct = 0;
    otherPct = 100;
  }

  // Keep exam weights as absolute percentages of total course grade — do NOT normalize to 100
  // examTotalPct already holds the correct sum

  return {
    id:          uid(),
    name:        course.name,
    credits:     course.credits_hours || 3,
    other_pct:   examTotalPct > 0 ? otherPct : 100,
    other_score: parseFloat((otherScore).toFixed(1)),
    exam_pct:    examTotalPct > 0 ? Math.round(examTotalPct) : 0,
    exams:       exams,
    status:      'normal',
    _canvas_id:  course.id,
  };
}

async function cvImportSelected() {
  if (cvSelected.size === 0) { cvShowToast('Select at least one course first'); return; }

  var selectedCourses = cvCourses.filter(function(c) { return cvSelected.has(c.id); });
  var subjects = selectedCourses.map(cvCourseToSubject);

  var semTarget = document.getElementById('cv-sem-target').value;
  var semName   = document.getElementById('cv-sem-name').value.trim() ||
                  'Canvas Sync — ' + new Date().toLocaleDateString('en-US', { month:'short', year:'numeric' });

  try {
    if (semTarget === 'new') {
      // Create new semester
      var sem = {
        id:       uid(),
        name:     semName,
        date:     new Date().toLocaleDateString(),
        subjects: subjects
      };
      var semCP = subjects.reduce(function(a, s) {
        return a + s.credits * (s.other_pct === 100 ? s.other_score / 100 : s.other_score / 100);
      }, 0);
      var semCR = subjects.reduce(function(a, s) { return a + s.credits; }, 0);
      sem._gpa = semCR > 0 ? parseFloat((semCP / semCR).toFixed(3)) : 0;
      await saveSemesterToDB(sem);
    } else {
      // Add to existing semester
      var existing = semesters.find(function(s) { return s.id === semTarget; });
      if (!existing) { cvShowToast('Semester not found'); return; }
      subjects.forEach(function(s) { existing.subjects.push(s); });
      await saveSemesterToDB(existing);
    }

    // Refresh app
    if (typeof renderSemesterList === 'function') renderSemesterList();
    if (typeof renderDashboard === 'function') renderDashboard();
    if (typeof renderDash === 'function') renderDash();

    cvShowToast('✓ Imported ' + subjects.length + ' course(s) into Gradintel!');
    cvLog('Imported ' + subjects.length + ' courses as subjects', 'ok');

    // Reset selection
    cvSelected.clear();
    document.querySelectorAll('.cv-course-card').forEach(function(c) { c.classList.remove('selected'); });
    document.getElementById('cv-import-confirm').classList.remove('show');

  } catch(e) {
    cvShowToast('Import failed: ' + e.message);
    cvLog('Import error: ' + e.message, 'err');
  }
}

function cvDisconnect() {
  if (!confirm('Disconnect Canvas? This only removes the connection — your imported data stays.')) return;
  cvConfig = {};
  localStorage.removeItem('gradintel_canvas_config');
  document.getElementById('cv-url').value    = '';
  document.getElementById('cv-token').value  = '';
  document.getElementById('cv-worker').value = '';
  cvCourses = [];
  cvSelected.clear();
  document.getElementById('cv-courses-section').style.display = 'none';
  document.getElementById('cv-how-section').style.display = 'block';
  cvUpdateStatus();
  cvShowToast('Disconnected from Canvas');
}

function cvShowToast(msg) {
  var t = document.getElementById('cv-toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(cvToastTimer);
  cvToastTimer = setTimeout(function() { t.classList.remove('show'); }, 3000);
}

function cvEsc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Load config when canvas tab opens
document.addEventListener('DOMContentLoaded', function() {
  // Inject spin keyframe for sync
  var style = document.createElement('style');
  style.textContent = '@keyframes gv3spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}';
  document.head.appendChild(style);
  cvLoadConfig();
});

/* ─── AI FLOAT BUBBLE ─── */
function toggleAIBubble(){
  const box=document.getElementById('ai-floatbox');
  const btn=document.getElementById('ai-bubble');
  const show=!box.classList.contains('show');
  box.classList.toggle('show',show);
  btn.classList.toggle('open',show);
  if(show) document.getElementById('ai-float-input').focus();
}

async function sendFloatAI(){
  const inp     = document.getElementById('ai-float-input');
  const msgs    = document.getElementById('ai-float-msgs');
  const sendBtn = document.getElementById('ai-float-send');
  const text    = inp.value.trim();
  if (!text) return;

  const userDiv = document.createElement('div');
  userDiv.className = 'af-msg user'; userDiv.textContent = text;
  msgs.appendChild(userDiv); inp.value = ''; sendBtn.disabled = true;

  const thinkDiv = document.createElement('div');
  thinkDiv.className = 'af-msg thinking'; thinkDiv.textContent = 'Thinking…';
  msgs.appendChild(thinkDiv); msgs.scrollTop = msgs.scrollHeight;

  const allSubjects = [];
  (semesters||[]).forEach(function(sem){
    (sem.subjects||[]).forEach(function(s){
      try { const r=computeSubject(s); allSubjects.push(s.name+': '+r.cur.toFixed(1)+'% ('+r.curG.l+'), '+r.remExams.length+' exams remaining'); }
      catch(e){ allSubjects.push(s.name); }
    });
  });
  const ctx = allSubjects.length ? 'Student courses: '+allSubjects.join('; ') : 'No course data yet.';
  const systemPrompt = 'You are a concise, friendly academic advisor embedded in Gradintel, a GPA tracker. '+ctx+' Answer briefly in 2-4 sentences max.';

  let reply = '';
  try {
    // Pollinations.AI — free built-in, no key needed
    const res = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'openai', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: text }] })
    });
    const d = await res.json();
    reply = d.choices?.[0]?.message?.content || '';
    if (!reply) throw new Error('Empty response, please try again.');
  } catch(e) { reply = 'Error: ' + e.message; }

  thinkDiv.className = 'af-msg ai'; thinkDiv.textContent = reply;
  sendBtn.disabled = false; msgs.scrollTop = msgs.scrollHeight;
}