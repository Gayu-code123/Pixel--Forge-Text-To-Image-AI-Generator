
// ════════════════════════════════════════════════════
// CONFIG — Change backend URL if needed
// ════════════════════════════════════════════════════
const API_BASE = "http://localhost:5000/api";

// ════════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════════
let role = 'other', authMode = 'login';
let selW = 1080, selH = 1920, selDimLabel = 'WhatsApp — 1080×1920';
let currentUser = null, authToken = null;
let isGenerating = false;
let lastEnhancedPrompt = null;
let backendOnline = false;

// ════════════════════════════════════════════════════
// API HELPER
// ════════════════════════════════════════════════════
async function api(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (authToken) opts.headers['Authorization'] = `Bearer ${authToken}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API_BASE + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Server error');
  return data;
}

// ════════════════════════════════════════════════════
// BACKEND HEALTH CHECK
// ════════════════════════════════════════════════════
async function checkBackend() {
  const badge = document.getElementById('backend-badge');
  const text  = document.getElementById('badge-text');
  try {
    const data = await api('/health');
    backendOnline = true;
    badge.className = 'backend-badge ok';
    const groqOk = data.groq_configured && data.groq_available;
    text.textContent = groqOk ? '🤖 Backend + Groq Online' : '⚡ Backend Online (no Groq key)';
  } catch {
    backendOnline = false;
    badge.className = 'backend-badge fail';
    text.textContent = '❌ Backend Offline — run app.py';
  }
}

// ════════════════════════════════════════════════════
// AUTH UI
// ════════════════════════════════════════════════════
function switchAuth(m) {
  authMode = m;
  document.querySelectorAll('.auth-tab').forEach((t, i) =>
    t.classList.toggle('active', (m === 'login' && i === 0) || (m === 'signup' && i === 1))
  );
  const cf = document.getElementById('confirm-field');
  if (m === 'signup') {
    cf.classList.add('show');
    document.getElementById('role-label').textContent = 'Sign up as';
    document.getElementById('auth-footer').innerHTML = `Already have an account? <button class="auth-link" onclick="switchAuth('login')">Login here</button>`;
  } else {
    cf.classList.remove('show');
    document.getElementById('role-label').textContent = 'Login as';
    document.getElementById('auth-footer').innerHTML = `Don't have an account? <button class="auth-link" onclick="switchAuth('signup')">Create one free</button>`;
  }
  document.getElementById('auth-error').classList.remove('show');
  updateSubmitBtn();
}

function selectRole(r, el) {
  role = r;
  document.querySelectorAll('.role-card').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  const bf = document.getElementById('biz-field');
  const pg = document.getElementById('pwd-group');
  if (r === 'business') { bf.classList.add('show'); pg.style.display = 'none'; }
  else { bf.classList.remove('show'); pg.style.display = 'block'; }
  updateSubmitBtn();
}

function updateSubmitBtn() {
  const a = authMode === 'signup' ? 'Sign Up' : 'Login';
  const i = authMode === 'signup' ? '✨' : '🚀';
  const w = role === 'business' ? 'as Businessman' : 'as Other User';
  document.getElementById('submit-btn').textContent = `${i} ${a} ${w}`;
}

// ════════════════════════════════════════════════════
// SUBMIT (calls Python backend)
// ════════════════════════════════════════════════════
async function handleSubmit() {
  const errEl = document.getElementById('auth-error');
  errEl.classList.remove('show');

  if (!backendOnline) {
    errEl.textContent = '❌ Backend is offline! Start app.py first.';
    errEl.classList.add('show');
    return;
  }

  const username = document.getElementById('f-username').value.trim();
  const email    = document.getElementById('f-email').value.trim();
  const password = document.getElementById('f-password').value;
  const confirm  = document.getElementById('f-confirm').value;
  const bizname  = document.getElementById('f-bizname').value.trim();
  const bizaddr  = document.getElementById('f-bizaddr').value.trim();

  if (!username || !email) {
    errEl.textContent = '❌ Username and email required.'; errEl.classList.add('show'); return;
  }
  if (authMode === 'signup' && role === 'other' && password !== confirm) {
    errEl.textContent = '❌ Passwords do not match!'; errEl.classList.add('show'); return;
  }

  const btn = document.getElementById('submit-btn');
  btn.textContent = '⏳ Please wait…'; btn.disabled = true;

  try {
    const endpoint = authMode === 'signup' ? '/signup' : '/login';
    const payload  = { username, email, password, role, bizname, bizaddr };
    const data = await api(endpoint, 'POST', payload);

    authToken   = data.token;
    currentUser = data.user;
    localStorage.setItem('pf_token', authToken);

    onLogin(currentUser);
    showToast(authMode === 'signup' ? '✅ Welcome to PixelForge!' : '✅ Welcome back, ' + currentUser.username + '!');
  } catch (e) {
    errEl.textContent = '❌ ' + e.message;
    errEl.classList.add('show');
  } finally {
    btn.disabled = false; updateSubmitBtn();
  }
}

// ════════════════════════════════════════════════════
// ON LOGIN
// ════════════════════════════════════════════════════
function onLogin(u) {
  currentUser = u;
  document.getElementById('auth-overlay').classList.add('hidden');
  document.getElementById('sb-avatar').textContent  = u.username.charAt(0).toUpperCase();
  document.getElementById('sb-name').textContent    = u.username;
  document.getElementById('sb-role').textContent    = u.role === 'business' ? '💼 Businessman' : '👤 Other User';
  addAIMessage(`👋 Welcome back, **${u.username}**! I'm ready to create stunning designs.\n\nYour prompts are **auto-enhanced** with Groq AI before generation. Describe your idea below!`);
  document.getElementById('welcome-screen').style.display = 'none';
  loadHistoryToSidebar();
}

// ════════════════════════════════════════════════════
// GENERATE (calls Python backend → Groq → Pollinations)
// ════════════════════════════════════════════════════
async function generateImage() {
  const prompt = document.getElementById('main-prompt').value.trim();
  const type   = document.getElementById('design-type').value;
  if (!prompt) { showToast('⚠️ Please enter a prompt!'); return; }
  if (isGenerating) { showToast('⏳ Already generating…'); return; }
  if (!currentUser) { showToast('⚠️ Please login first!'); return; }

  if (!backendOnline) {
    // Fallback: direct Pollinations without enhancement
    generateDirect(prompt, type);
    return;
  }

  isGenerating = true;
  document.getElementById('send-btn').disabled = true;
  addUserMessage(prompt);

  // Show typing with steps
  addTypingWithSteps();
  document.getElementById('main-prompt').value = '';
  autoResize(document.getElementById('main-prompt'));

  try {
    const data = await api('/generate', 'POST', {
      prompt,
      type,
      width:  Math.min(selW, 1024),
      height: Math.min(selH, 1024),
    });

    lastEnhancedPrompt = data.enhanced;
    removeTyping();

    // Load image
    const img = new Image();
    img.onload = () => {
      addAIMessageWithEnhance(
        `Here's your **${type}** at **${selDimLabel}** ✨`,
        data.image_url,
        data.original,
        data.enhanced,
        data.model_used
      );
      loadHistoryToSidebar();
      showToast('✅ Image generated!');
      isGenerating = false;
      document.getElementById('send-btn').disabled = false;
    };
    img.onerror = () => {
      removeTyping();
      addAIMessage('❌ Image load failed — the URL was generated but the image timed out. Try again!');
      isGenerating = false;
      document.getElementById('send-btn').disabled = false;
    };
    img.src = data.image_url;

  } catch (e) {
    removeTyping();
    addAIMessage('❌ Error: ' + e.message);
    isGenerating = false;
    document.getElementById('send-btn').disabled = false;
  }
}

// Fallback without backend
function generateDirect(prompt, type) {
  const TYPE_HINTS = {
    general: 'high quality, detailed, attractive, professional',
    poster:  'poster design, bold typography, cinematic lighting',
    banner:  'banner design, wide layout, modern style',
    logo:    'logo design, minimal, vector style, professional',
  };
  isGenerating = true;
  document.getElementById('send-btn').disabled = true;
  addUserMessage(prompt);
  addTyping();
  document.getElementById('main-prompt').value = '';
  autoResize(document.getElementById('main-prompt'));

  const suffix  = TYPE_HINTS[type] || TYPE_HINTS.general;
  const w = Math.min(selW, 1024), h = Math.min(selH, 1024);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt + ', ' + suffix)}?width=${w}&height=${h}&nologo=true&seed=${Date.now()}`;
  const img = new Image();
  img.onload = () => {
    addAIMessage(`Here's your **${type}** ✨ _(Backend offline — prompt not enhanced)_`, url);
    showToast('✅ Image generated (no enhancement)!');
    isGenerating = false; document.getElementById('send-btn').disabled = false;
  };
  img.onerror = () => {
    removeTyping(); addAIMessage('❌ Generation failed. Try again!');
    isGenerating = false; document.getElementById('send-btn').disabled = false;
  };
  img.src = url;
}

// ════════════════════════════════════════════════════
// CHAT HELPERS
// ════════════════════════════════════════════════════
function addUserMessage(text) {
  const initials = currentUser ? currentUser.username.charAt(0).toUpperCase() : 'U';
  document.getElementById('messages').innerHTML +=
    `<div class="msg user"><div class="msg-avatar user-av">${initials}</div><div class="msg-body"><div class="msg-name">You</div><div class="bubble user-bubble">${escHtml(text)}</div></div></div>`;
  scrollChat();
}

function addTyping() {
  document.getElementById('messages').innerHTML +=
    `<div class="msg" id="typing-msg"><div class="msg-avatar ai">🎨</div><div class="msg-body"><div class="msg-name">PixelForge AI</div><div class="bubble ai-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div></div></div>`;
  scrollChat();
}

function addTypingWithSteps() {
  document.getElementById('messages').innerHTML +=
    `<div class="msg" id="typing-msg"><div class="msg-avatar ai">🎨</div><div class="msg-body"><div class="msg-name">PixelForge AI</div><div class="bubble ai-bubble">
      <div class="gen-steps">
        <div class="gen-step active"><span class="step-icon">✨</span> Enhancing your prompt with Groq AI…</div>
        <div class="gen-step"><span class="step-icon">🎨</span> Generating image with Pollinations AI…</div>
        <div class="gen-step"><span class="step-icon">📐</span> Sizing to ${selDimLabel}…</div>
      </div>
    </div></div></div>`;
  scrollChat();
}

function removeTyping() {
  const t = document.getElementById('typing-msg');
  if (t) t.remove();
}

function addAIMessage(text, imgUrl = null) {
  removeTyping();
  const clean = mdToHtml(text);
  let imgHtml = '';
  if (imgUrl) {
    imgHtml = `<div class="bubble-img"><img src="${imgUrl}" alt="Generated" loading="lazy"/></div>
    <div class="img-actions">
      <div class="img-btn" onclick="downloadImg('${imgUrl}')">⬇️ Download</div>
      <div class="img-btn" onclick="copyUrl('${imgUrl}')">🔗 Copy URL</div>
      <div class="img-btn" onclick="reusePrompt()">🔄 Regenerate</div>
    </div>`;
  }
  document.getElementById('messages').innerHTML +=
    `<div class="msg"><div class="msg-avatar ai">🎨</div><div class="msg-body" style="max-width:80%;"><div class="msg-name">PixelForge AI</div><div class="bubble ai-bubble">${clean}${imgHtml}</div></div></div>`;
  scrollChat();
}

function addAIMessageWithEnhance(text, imgUrl, original, enhanced, model) {
  removeTyping();
  const clean = mdToHtml(text);
  const modelLabel = model ? `<span style="font-size:9px;color:var(--muted2);margin-left:6px;">via ${model}</span>` : '';
  const enhanceHtml = `
    <div class="enhance-box">
      <div class="enhance-header" onclick="toggleEnhance(this)">
        🪄 View enhanced prompt ${modelLabel} <span style="margin-left:auto;opacity:0.5;">▼</span>
      </div>
      <div class="enhance-body">${escHtml(enhanced)}</div>
    </div>`;
  const imgHtml = `<div class="bubble-img"><img src="${imgUrl}" alt="Generated" loading="lazy"/></div>
    <div class="img-actions">
      <div class="img-btn" onclick="downloadImg('${imgUrl}')">⬇️ Download</div>
      <div class="img-btn" onclick="copyUrl('${imgUrl}')">🔗 Copy URL</div>
      <div class="img-btn" onclick="reusePrompt()">🔄 Regenerate</div>
    </div>`;
  document.getElementById('messages').innerHTML +=
    `<div class="msg"><div class="msg-avatar ai">🎨</div><div class="msg-body" style="max-width:80%;"><div class="msg-name">PixelForge AI</div><div class="bubble ai-bubble">${clean}${enhanceHtml}${imgHtml}</div></div></div>`;
  scrollChat();
}

function toggleEnhance(header) {
  const body = header.nextElementSibling;
  body.classList.toggle('open');
  header.querySelector('span:last-child').textContent = body.classList.contains('open') ? '▲' : '▼';
}

function mdToHtml(text) {
  return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/_(.*?)_/g, '<em>$1</em>').replace(/\n/g, '<br>');
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function scrollChat() { document.getElementById('chat-area').scrollTop = document.getElementById('chat-area').scrollHeight; }

// ════════════════════════════════════════════════════
// HISTORY
// ════════════════════════════════════════════════════
async function loadHistoryToSidebar() {
  if (!authToken || !backendOnline) return;
  try {
    const data = await api('/history');
    const list = document.getElementById('history-list');
    if (!data.history || !data.history.length) return;
    list.innerHTML = data.history.slice(0, 8).map(h =>
      `<div class="hist-item"><span class="hist-dot"></span><span class="hist-text">${escHtml(h.prompt)}</span></div>`
    ).join('');
  } catch {}
}

async function loadHistory() {
  setNav('history');
  if (!currentUser) { showToast('⚠️ Login first!'); return; }
  if (!backendOnline) { showToast('⚠️ Backend offline'); return; }
  try {
    const data = await api('/history');
    openPanel('Generation History', data.history.map(h =>
      `<div style="margin-bottom:12px;padding:10px;background:var(--card2);border:1px solid var(--border2);border-radius:9px;">
        <div style="font-size:11px;color:var(--teal2);margin-bottom:4px;">${h.type} · ${h.created ? h.created.split('T')[0] : ''}</div>
        <div style="font-size:12px;color:var(--text);margin-bottom:6px;">${escHtml(h.prompt)}</div>
        ${h.image_url ? `<img src="${h.image_url}" style="width:100%;border-radius:8px;border:1px solid var(--border);" loading="lazy"/>` : ''}
      </div>`
    ).join('') || '<div style="color:var(--muted);font-size:13px;">No history yet.</div>');
  } catch (e) { showToast('❌ ' + e.message); }
}

// ════════════════════════════════════════════════════
// DIM / NAV / PANEL
// ════════════════════════════════════════════════════
function selectDimPill(el, label) {
  document.querySelectorAll('.dim-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  selW = parseInt(el.dataset.w); selH = parseInt(el.dataset.h); selDimLabel = label;
  document.getElementById('dim-label').textContent = '📐 ' + label;
}

function setNav(nav) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const el = document.getElementById('nav-' + nav); if (el) el.classList.add('active');
  closePanels();
  if (nav === 'settings') openSettingsPanel();
  if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');
}

function openPanel(title, html) {
  document.getElementById('panel-title').textContent = title;
  document.getElementById('panel-body').innerHTML = html;
  document.getElementById('right-panel').classList.remove('hidden');
  if (window.innerWidth <= 768) {
    document.getElementById('right-panel').classList.add('open');
    document.getElementById('mob-overlay').classList.add('show');
  }
}

function openSettingsPanel() {
  const u = currentUser;
  const isBiz = u && u.role === 'business';
  const profileHtml = u ? `
    <div style="margin-bottom:16px;">
      <div style="font-size:10px;font-weight:600;color:var(--muted2);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">My Profile</div>
      <div class="profile-cover-mini"><div class="profile-cover-pat"></div>
        <div class="profile-av-wrap">
          <div class="profile-av">${u.username.charAt(0).toUpperCase()}</div>
          <div class="profile-av-badge">${isBiz ? '💼' : '👤'}</div>
        </div>
      </div>
      <div class="p-name-big">${u.username}</div>
      <div class="p-tag-pill">${isBiz ? '💼 Businessman' : '👤 Other User'}</div>
      <div class="p-info-list">
        <div class="p-info-item"><span class="p-info-icon">📧</span><div><div class="p-info-lbl">Email</div><div class="p-info-val">${u.email}</div></div></div>
        <div class="p-info-item"><span class="p-info-icon">📅</span><div><div class="p-info-lbl">Member Since</div><div class="p-info-val">${u.joined || '—'}</div></div></div>
        ${isBiz && u.bizname ? `<div class="p-info-item"><span class="p-info-icon">🏢</span><div><div class="p-info-lbl">Business</div><div class="p-info-val">${u.bizname}</div></div></div>` : ''}
      </div>
      <div class="stats-row">
        <div class="stat-mini"><div class="stat-num">${u.designs || 0}</div><div class="stat-lbl">Designs</div></div>
        <div class="stat-mini"><div class="stat-num">${u.posters || 0}</div><div class="stat-lbl">Posters</div></div>
        <div class="stat-mini"><div class="stat-num">${u.banners || 0}</div><div class="stat-lbl">Banners</div></div>
      </div>
      <div class="panel-actions" style="margin-bottom:8px;">
        <button class="panel-btn primary" onclick="openEditForm()">✏️ Edit Profile</button>
        <button class="panel-btn secondary" onclick="logout()">⬅ Logout</button>
      </div>
      <div class="edit-form" id="edit-form" style="margin-top:12px;">
        <div class="panel-divider"></div>
        <div class="ef-group"><label class="ef-label">Email</label><input class="ef-input" id="e-email" value="${u.email || ''}"/></div>
        ${isBiz ? `<div class="ef-group"><label class="ef-label">Business Name</label><input class="ef-input" id="e-bizname" value="${u.bizname || ''}"/></div>
        <div class="ef-group"><label class="ef-label">Business Address</label><textarea class="ef-input" id="e-bizaddr" rows="2">${u.bizaddr || ''}</textarea></div>` : ''}
        <div class="ef-actions">
          <button class="panel-btn primary" onclick="saveEdit()" style="font-size:11px;padding:8px;">💾 Save</button>
          <button class="panel-btn secondary" onclick="closeEditForm()" style="font-size:11px;padding:8px;">Cancel</button>
        </div>
      </div>
      <div class="panel-divider"></div>
    </div>` : '<div style="color:var(--muted);font-size:13px;margin-bottom:16px;">Not logged in.</div>';

  openPanel('Settings', profileHtml + `
    <div style="font-size:10px;font-weight:600;color:var(--muted2);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">Preferences</div>
    <div style="display:flex;flex-direction:column;gap:10px;">
      <div class="p-info-item" style="cursor:pointer;" onclick="toggleTheme()">
        <span class="p-info-icon">🎨</span>
        <div><div class="p-info-lbl">Theme</div><div class="p-info-val" id="theme-label">Dark Mode</div></div>
      </div>
      <div class="p-info-item">
        <span class="p-info-icon">🤖</span>
        <div><div class="p-info-lbl">Prompt Enhancer</div><div class="p-info-val">Groq / LLaMA 3.3 70B</div></div>
      </div>
      <div class="p-info-item">
        <span class="p-info-icon">🎨</span>
        <div><div class="p-info-lbl">Image Engine</div><div class="p-info-val">Pollinations AI (Free)</div></div>
      </div>
    </div>`);
}

function closePanel() {
  document.getElementById('right-panel').classList.add('hidden');
  document.getElementById('right-panel').classList.remove('open');
  document.getElementById('mob-overlay').classList.remove('show');
}
function closePanels() { closePanel(); }
function openEditForm() { const f = document.getElementById('edit-form'); if (f) f.classList.toggle('show'); }
function closeEditForm() { const f = document.getElementById('edit-form'); if (f) f.classList.remove('show'); }

async function saveEdit() {
  try {
    const payload = { email: document.getElementById('e-email')?.value.trim() };
    const ebn = document.getElementById('e-bizname'); if (ebn) payload.bizname = ebn.value.trim();
    const eba = document.getElementById('e-bizaddr'); if (eba) payload.bizaddr = eba.value.trim();
    const data = await api('/profile', 'PUT', payload);
    currentUser = data.user;
    closePanel(); setTimeout(() => openSettingsPanel(), 100);
    showToast('✅ Profile updated!');
  } catch (e) { showToast('❌ ' + e.message); }
}

// ════════════════════════════════════════════════════
// LOGOUT
// ════════════════════════════════════════════════════
async function logout() {
  try { await api('/logout', 'POST'); } catch {}
  currentUser = null; authToken = null;
  localStorage.removeItem('pf_token');
  closePanel();
  document.getElementById('auth-overlay').classList.remove('hidden');
  document.getElementById('messages').innerHTML = '';
  document.getElementById('welcome-screen').style.display = 'block';
  document.getElementById('sb-avatar').textContent = '?';
  document.getElementById('sb-name').textContent = 'Not logged in';
  document.getElementById('sb-role').textContent = 'Login to continue';
  ['f-username','f-email','f-password','f-confirm','f-bizname','f-bizaddr'].forEach(id => {
    const e = document.getElementById(id); if (e) e.value = '';
  });
  showToast('👋 Logged out!');
}

function newChat() {
  document.getElementById('messages').innerHTML = '';
  document.getElementById('welcome-screen').style.display = 'block';
  document.getElementById('main-prompt').value = '';
  showToast('✨ New session started!');
}

// ════════════════════════════════════════════════════
// UTILS
// ════════════════════════════════════════════════════
function downloadImg(src) {
  const a = document.createElement('a'); a.href = src; a.download = `pixelforge-${Date.now()}.png`; a.click();
  showToast('⬇️ Downloading…');
}
function copyUrl(url) { navigator.clipboard.writeText(url).then(() => showToast('🔗 URL copied!')); }
function reusePrompt() { document.getElementById('main-prompt').focus(); showToast('✏️ Edit your prompt to regenerate!'); }
function toggleSidebar() { const s = document.getElementById('sidebar'); s.classList.toggle('open'); document.getElementById('mob-overlay').classList.toggle('show', s.classList.contains('open')); }
function toggleTheme() { const b = document.body; const isDark = b.getAttribute('data-theme') === 'dark'; b.setAttribute('data-theme', isDark ? 'light' : 'dark'); document.querySelector('.theme-btn').textContent = isDark ? '🌙' : '☀️'; const lbl = document.getElementById('theme-label'); if (lbl) lbl.textContent = isDark ? 'Dark Mode' : 'Light Mode'; }
function autoResize(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 160) + 'px'; }
function handleKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); generateImage(); } }
function clearPrompt() { document.getElementById('main-prompt').value = ''; autoResize(document.getElementById('main-prompt')); }
function useChip(text) { document.getElementById('main-prompt').value = text; autoResize(document.getElementById('main-prompt')); document.getElementById('main-prompt').focus(); }
function showToast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); }

// ════════════════════════════════════════════════════
// INIT — auto-restore session token
// ════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', async () => {
  await checkBackend();

  const savedToken = localStorage.getItem('pf_token');
  if (savedToken && backendOnline) {
    authToken = savedToken;
    try {
      const data = await api('/profile');
      currentUser = data.user;
      onLogin(currentUser);
    } catch {
      authToken = null;
      localStorage.removeItem('pf_token');
    }
  }

  // Re-check backend every 30s
  setInterval(checkBackend, 30000);
});
