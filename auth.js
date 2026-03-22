// ══════════════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════════════
function switchAuth(tab) {
  ['in','up'].forEach(t => {
    document.getElementById('at-'+t).classList.toggle('on', t===tab);
    document.getElementById('auth-'+t).classList.toggle('hidden', t!==tab);
  });
  document.getElementById('auth-err').style.display = 'none';
}
function showAuthErr(m) { const e=document.getElementById('auth-err'); e.textContent=m; e.style.display='block'; }
function setAuthLoading(id, loading) {
  const btn = document.getElementById(id);
  btn.disabled = loading;
  btn.textContent = loading ? '⏳ Please wait...' : (id==='in-btn' ? 'Sign In →' : 'Create Account →');
}

async function doSignIn() {
  if (!sb) { showAuthErr('Supabase not configured.'); return; }
  const email = document.getElementById('in-email').value.trim();
  const pass = document.getElementById('in-pass').value;
  if (!email||!pass) { showAuthErr('Fill in all fields.'); return; }
  setAuthLoading('in-btn', true);
  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
  setAuthLoading('in-btn', false);
  if (error) { showAuthErr(error.message); return; }
  currentUser = data.user;
  await onAuthSuccess();
}
async function doSignUp() {
  if (!sb) { showAuthErr('Supabase not configured.'); return; }
  const name = document.getElementById('up-name').value.trim();
  const email = document.getElementById('up-email').value.trim();
  const pass = document.getElementById('up-pass').value;
  const uni = document.getElementById('up-uni').value.trim();
  if (!name||!email||!pass) { showAuthErr('Please fill in name, email and password.'); return; }
  if (pass.length < 6) { showAuthErr('Password must be at least 6 characters.'); return; }
  setAuthLoading('up-btn', true);
  const { data, error } = await sb.auth.signUp({ email, password: pass, options: { data: { full_name: name, university: uni } } });
  setAuthLoading('up-btn', false);
  if (error) { showAuthErr(error.message); return; }
  if (data.user && !data.session) { showAuthErr('Check your email to confirm your account, then sign in.'); switchAuth('in'); return; }
  currentUser = data.user;
  await onAuthSuccess();
}
async function doReset() {
  if (!sb) return;
  const email = document.getElementById('in-email').value.trim();
  if (!email) { showAuthErr('Enter your email above first.'); return; }
  const { error } = await sb.auth.resetPasswordForEmail(email);
  if (error) showAuthErr(error.message);
  else showAuthErr('✅ Password reset email sent!');
}
async function doSignOut() {
  if (sb) await sb.auth.signOut();
  currentUser = null; profile = null; semesters = [];
  calcSubjs = []; calcRes = [];
  document.getElementById('user-modal').classList.remove('show');
  document.getElementById('app').style.display = 'none';
  document.getElementById('auth-wrap').classList.remove('out');
  const authWrap = document.getElementById('auth-wrap');
  authWrap.style.display = 'flex';
  authWrap.classList.add('ready');
  authWrap.classList.remove('out');
  document.body.classList.add('auth-visible');
  document.getElementById('in-email').value = '';
  document.getElementById('in-pass').value = '';
  document.getElementById('auth-err').style.display = 'none';
  showToast('Signed out.');
}
async function onAuthSuccess() {
  document.getElementById('auth-wrap').classList.add('out');
  document.body.classList.remove('auth-visible');
  setTimeout(() => document.getElementById('auth-wrap').style.display = 'none', 400);
  await loadProfile();
  setTimeout(maybeShowAdminBtn, 500);
}

// ══════════════════════════════════════════════════════════════
// DB
// ══════════════════════════════════════════════════════════════
async function loadProfile() {
  const { data, error } = await sb.from('gpa_profiles').select('*').eq('user_id', currentUser.id).single();
  if (error || !data) {
    document.getElementById('ob-wrap').classList.remove('hidden');
  } else {
    profile = data;
    await loadSemesters();
    loadPolicies();
    launchApp();
  }
}
async function loadSemesters() {
  const { data, error } = await sb.from('gpa_semesters').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: true });
  if (!error && data) semesters = data.map(s => ({ ...s, subjects: s.subjects || [] }));
  else semesters = [];
}
async function saveSemesterToDB(sem) {
  const { data, error } = await sb.from('gpa_semesters').upsert({ ...sem, user_id: currentUser.id }, { onConflict: 'id' }).select().single();
  if (!error && data) {
    const idx = semesters.findIndex(s => s.id === data.id);
    if (idx >= 0) semesters[idx] = data;
    else semesters.push(data);
  }
  showSyncBadge();
}
async function deleteSemesterFromDB(id) {
  await sb.from('gpa_semesters').delete().eq('id', id);
  semesters = semesters.filter(s => s.id !== id);
  showSyncBadge();
}
function showSyncBadge() {
  const b = document.getElementById('sync-badge');
  b.style.display = 'inline-flex';
  setTimeout(() => b.style.display = 'none', 3000);
}

