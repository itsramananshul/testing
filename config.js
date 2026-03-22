
// ══════════════════════════════════════════════════════════════
//  ⚙️  SUPABASE CONFIG
// ══════════════════════════════════════════════════════════════
const SUPABASE_URL  = 'https://pbcahhkobxrrnqzeqhra.supabase.co';
const SUPABASE_ANON = 'sb_publishable_JNjLBiahRGmxbY5pF9deeQ_PQ4dg8yl';

// ══════════════════════════════════════════════════════════════
//  🤖  GEMINI API KEY — paste yours here
//  Get it free at: aistudio.google.com → Get API Key
// ══════════════════════════════════════════════════════════════
// AI now uses direct provider APIs — no Cloudflare Worker needed

// ══════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════
let sb = null;
function initSupabase() {
  if (!SUPABASE_URL || SUPABASE_URL === 'YOUR_SUPABASE_PROJECT_URL') {
    document.getElementById('config-banner').classList.remove('hidden');
    return false;
  }
  try {
    sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
    document.getElementById('config-banner').classList.add('hidden');
    return true;
  } catch(e) {
    document.getElementById('config-banner').classList.remove('hidden');
    return false;
  }
}

// ══════════════════════════════════════════════════════════════
// GPA SCALES
// ══════════════════════════════════════════════════════════════
const GPA_SCALES = {
  '4.0': [
    {l:'A',p:4.0,m:93},{l:'A-',p:3.6667,m:90},
    {l:'B+',p:3.3333,m:87},{l:'B',p:3.0,m:83},
    {l:'B-',p:2.6667,m:80},{l:'C+',p:2.3333,m:77},
    {l:'C',p:2.0,m:73},{l:'C-',p:1.6667,m:70},
    {l:'D+',p:1.3333,m:67},{l:'D',p:1.0,m:63},
    {l:'D-',p:0.6667,m:60},{l:'F',p:0.0,m:0}
  ],
  '4.3': [
    {l:'A+',p:4.3,m:97},{l:'A',p:4.0,m:93},{l:'A-',p:3.7,m:90},
    {l:'B+',p:3.3,m:87},{l:'B',p:3.0,m:83},{l:'B-',p:2.7,m:80},
    {l:'C+',p:2.3,m:77},{l:'C',p:2.0,m:73},{l:'C-',p:1.7,m:70},
    {l:'D+',p:1.3,m:67},{l:'D',p:1.0,m:63},{l:'F',p:0.0,m:0}
  ],
  '5.0': [
    {l:'A',p:5.0,m:93},{l:'A-',p:4.667,m:90},
    {l:'B+',p:4.333,m:87},{l:'B',p:4.0,m:83},{l:'B-',p:3.667,m:80},
    {l:'C+',p:3.333,m:77},{l:'C',p:3.0,m:73},{l:'C-',p:2.667,m:70},
    {l:'D+',p:2.333,m:67},{l:'D',p:2.0,m:63},{l:'F',p:0.0,m:0}
  ]
};
let GPA = GPA_SCALES['4.0'];
const pctToG = s => GPA.find(g=>s>=g.m)||GPA[GPA.length-1];
const gCol = l => ({
  'A+':'#10b981','A':'#34d399','A-':'#6ee7b7',
  'B+':'#818cf8','B':'#a78bfa','B-':'#c4b5fd',
  'C+':'#fbbf24','C':'#fcd34d','C-':'#fde68a',
  'D+':'#f87171','D':'#fca5a5','D-':'#fecaca','F':'#ef4444'
}[l]||'#6b7280');
const closestL = gpa => GPA.reduce((b,g)=>Math.abs(g.p-gpa)<Math.abs(b.p-gpa)?g:b).l;

// ══════════════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════════════
let currentUser = null;
let profile = null;
let semesters = [];
let policies = { scale:'4.0', replace:false, pnp:false, withdraw:true, weighted:false, goalGpa:0, goalCredits:0 };
let appMode = 'single';
let calcSubjs = [], calcRes = [];
let activeCalcIdx = 0;
let modalCtx = null;
let editCtx = null;
let chartInst = null, trendInst = null, semTrendInst = null;
let examDates = {}; // examId -> date string

