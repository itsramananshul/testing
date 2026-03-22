// FEEDBACK
// ══════════════════════════════════════════════════════════════
let _fbRating = 0;
function setFbRating(n) {
  _fbRating = n;
  document.querySelectorAll('#fb-stars button').forEach(function(b) {
    const v = parseInt(b.getAttribute('data-rating'));
    b.style.background = v <= n ? 'rgba(129,140,248,.15)' : 'transparent';
    b.style.borderColor = v <= n ? 'var(--accent)' : 'var(--border2)';
    b.style.color = v <= n ? 'var(--accent)' : 'var(--muted)';
  });
}
async function submitFeedback() {
  const type    = document.getElementById('fb-type')?.value || 'general';
  const subject = document.getElementById('fb-subject')?.value.trim();
  const message = document.getElementById('fb-message')?.value.trim();
  const status  = document.getElementById('fb-status');
  if (!subject || !message) { showToast('⚠️ Please fill in subject and message'); return; }
  const payload = {
    user_id:    currentUser?.id || null,
    user_email: currentUser?.email || 'anonymous',
    type, subject, message,
    rating: _fbRating || null,
    created_at: new Date().toISOString(),
    user_agent: navigator.userAgent.slice(0, 200)
  };
  try {
    const { error } = await sb.from('gradintel_feedback').insert(payload);
    if (error) throw error;
    status.style.display = 'block';
    status.style.background = 'rgba(52,211,153,.1)';
    status.style.border = '1px solid rgba(52,211,153,.3)';
    status.style.color = 'var(--green)';
    status.textContent = '✅ Thank you! Your feedback has been sent.';
    document.getElementById('fb-subject').value = '';
    document.getElementById('fb-message').value = '';
    _fbRating = 0; setFbRating(0);
  } catch(e) {
    status.style.display = 'block';
    status.style.background = 'rgba(248,113,113,.1)';
    status.style.border = '1px solid rgba(248,113,113,.3)';
    status.style.color = 'var(--red)';
    status.textContent = '❌ Could not send feedback: ' + (e.message || 'Unknown error');
  }
}

// ══════════════════════════════════════════════════════════════
// ADMIN PANEL
// ══════════════════════════════════════════════════════════════
const ADMIN_EMAIL = 'akanshul20062008@gmail.com'; // ← your admin email

let _adminAllFeedback = [];
let _adminFilter = 'all';

function maybeShowAdminBtn() {
  if (!currentUser || currentUser.email !== ADMIN_EMAIL) return;
  // Show admin nav item
  const btn = document.getElementById('admin-nav-btn');
  if (btn) btn.style.display = '';
  // Set email display
  const ed = document.getElementById('admin-email-display');
  if (ed) ed.textContent = currentUser.email;
  // Auto-load feedback when tab is first shown
  loadAdminFeedback();
}

async function loadAdminFeedback() {
  const list = document.getElementById('admin-feedback-list');
  if (!list) return;
  list.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:40px">⏳ Loading…</div>';
  try {
    const { data, error } = await sb.from('gradintel_feedback').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) throw error;
    _adminAllFeedback = data || [];
    // Update stats
    document.getElementById('admin-stat-total').textContent = _adminAllFeedback.length;
    document.getElementById('admin-stat-bugs').textContent = _adminAllFeedback.filter(f=>f.type==='bug').length;
    document.getElementById('admin-stat-features').textContent = _adminAllFeedback.filter(f=>f.type==='feature').length;
    const rated = _adminAllFeedback.filter(f=>f.rating);
    document.getElementById('admin-stat-avg').textContent = rated.length ? (rated.reduce((a,f)=>a+f.rating,0)/rated.length).toFixed(1)+'★' : '—';
    renderAdminFeedback();
  } catch(e) {
    list.innerHTML = '<div style="color:var(--red);font-size:13px;text-align:center;padding:40px">❌ ' + (e.message||'Could not load feedback') + '<br><br><small>Make sure the Supabase table and RLS policy are set up correctly.</small></div>';
  }
}

function adminFilter(type) {
  _adminFilter = type;
  ['all','bug','feature','general','praise'].forEach(t => {
    const btn = document.getElementById('af-'+t);
    if (btn) { btn.className = t === type ? 'btn btn-primary' : 'btn btn-secondary'; btn.style.fontSize='11px'; btn.style.padding='5px 12px'; }
  });
  renderAdminFeedback();
}

function renderAdminFeedback() {
  const list = document.getElementById('admin-feedback-list');
  if (!list) return;
  const filtered = _adminFilter === 'all' ? _adminAllFeedback : _adminAllFeedback.filter(f=>f.type===_adminFilter);
  if (!filtered.length) { list.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:40px">No feedback found.</div>'; return; }
  const typeColors = { bug:'#f87171', feature:'#818cf8', general:'#60a5fa', praise:'#34d399' };
  const typeIcons  = { bug:'🐛', feature:'✨', general:'💬', praise:'🙌' };
  list.innerHTML = filtered.map(function(f) {
    const col   = typeColors[f.type] || 'var(--muted)';
    const ico   = typeIcons[f.type]  || '💬';
    const stars = f.rating ? '★'.repeat(f.rating) + '<span style="opacity:.3">★</span>'.repeat(5-f.rating) : '—';
    const date  = new Date(f.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' });
    return '<div class="card" style="margin-bottom:12px;border-left:3px solid '+col+'">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">' +
        '<span style="background:'+col+'22;color:'+col+';border-radius:6px;padding:3px 10px;font-size:11px;font-weight:700">'+ico+' '+(f.type||'general').toUpperCase()+'</span>' +
        '<span style="font-family:\'Clash Display\',sans-serif;font-weight:700;font-size:15px">'+escHtml(f.subject||'(no subject)')+'</span>' +
        '<span style="margin-left:auto;font-size:11px;color:var(--muted)">'+date+'</span>' +
      '</div>' +
      '<div style="font-size:13px;color:var(--muted2);line-height:1.7;margin-bottom:10px;white-space:pre-wrap">'+escHtml(f.message||'')+'</div>' +
      '<div style="display:flex;gap:16px;font-size:12px;color:var(--muted);flex-wrap:wrap">' +
        '<span>👤 '+escHtml(f.user_email||'anonymous')+'</span>' +
        '<span>⭐ '+stars+'</span>' +
      '</div>' +
    '</div>';
  }).join('');
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}