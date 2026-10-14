import * as F from './firebase.js';
const { auth, db } = F;

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const R = n => 'R ' + Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = t => t ? t.toDate().toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const plus3m = t => { const d = t.toDate(); d.setMonth(d.getMonth() + 3); return d; };
const status = t => { const n = Date.now(); return t.opensAt.toMillis() > n ? 'Opens soon' : t.closesAt.toMillis() < n ? 'Closed' : 'Open'; };

let user = null, profile = null, tenders = [], cur = null, authMode = 'login', signingUp = false;
const views = ['feed', 'detail', 'apply', 'done', 'bids', 'dash', 'about', 'privacy'];
const show = v => { views.forEach(x => $('view-' + x).classList.toggle('hidden', x !== v)); scrollTo(0, 0); };
let tt;
const toast = (m, bad) => { const t = $('toast'); t.textContent = m; t.className = t.className.replace(/hidden|bg-\S+/g, '') + ' ' + (bad ? 'bg-rose-200' : 'bg-slate-100'); clearTimeout(tt); tt = setTimeout(() => t.classList.add('hidden'), 4500); };

/* ---------- Auth ---------- */
F.onAuthStateChanged(auth, u => { user = u; if (!signingUp) afterAuth(); });

async function afterAuth() {
  profile = null;
  if (user) { const s = await F.getDoc(F.doc(db, 'users', user.uid)); profile = s.exists() ? s.data() : null; }
  const r = profile?.role;
  $('nav-out').classList.toggle('hidden', !!user);
  $('nav-in').classList.toggle('hidden', !user); $('nav-in').classList.toggle('flex', !!user);
  $('nav-bids').classList.toggle('hidden', r !== 'bidder');
  $('nav-dash').classList.toggle('hidden', r !== 'sector');
  $('who').textContent = profile ? (profile.companyName || profile.name) : '';
  if (user) await loadTenders(); else { tenders = []; renderFeed(); }
}

function setMode(m) {
  authMode = m;
  const login = m === 'login';
  $('auth-title').textContent = login ? 'Log in' : 'Create your account';
  $('auth-submit').textContent = login ? 'Log in' : 'Sign up';
  document.querySelector('[data-act=authSwitch]').textContent = login ? 'New here? Sign up' : 'Have an account? Log in';
  document.querySelectorAll('.su').forEach(e => e.classList.toggle('hidden', login));
  document.querySelector('.login-only').classList.toggle('hidden', !login);
  syncRole();
}
function syncRole() {
  const sector = authMode === 'signup' && document.querySelector('[name=role]:checked').value === 'sector';
  document.querySelectorAll('.sec').forEach(e => e.classList.toggle('hidden', !sector));
  $('lbl-company').textContent = sector ? 'Organisation name' : 'Company name (optional)';
}
document.addEventListener('change', e => { if (e.target.name === 'role') syncRole(); });

$('auth-form').addEventListener('submit', async e => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  try {
    if (authMode === 'login') { await F.signInWithEmailAndPassword(auth, f.email, f.password); }
    else {
      if (!f.name.trim() || !f.phone.trim()) return toast('Enter your name and phone number.', true);
      if (f.role === 'sector' && (!f.companyName.trim() || !f.registrationNo.trim())) return toast('Enter your organisation name and registration number.', true);
      signingUp = true;
      const c = await F.createUserWithEmailAndPassword(auth, f.email, f.password);
      const p = { role: f.role, name: f.name.trim(), email: f.email, phone: f.phone.trim(), companyName: f.companyName.trim(), createdAt: F.serverTimestamp() };
      if (f.role === 'sector') { p.sectorType = f.sectorType; p.registrationNo = f.registrationNo.trim(); }
      await F.setDoc(F.doc(db, 'users', c.user.uid), p);
      signingUp = false; user = c.user; await afterAuth();
    }
    $('auth-modal').classList.add('hidden');
    go(profile?.role === 'sector' ? 'dash' : 'feed');
  } catch (err) { signingUp = false; toast(err.message.replace('Firebase: ', ''), true); }
});

/* ---------- Tenders (browse + detail) ---------- */
async function loadTenders() {
  const s = await F.getDocs(F.query(F.collection(db, 'tenders'), F.orderBy('closesAt', 'desc')));
  tenders = s.docs.map(d => ({ id: d.id, ...d.data() }));
  renderFeed();
}

function renderFeed() {
  const el = $('feed-list');
  if (!user) { el.innerHTML = '<div class="card md:col-span-2 lg:col-span-3"><p class="mb-3 text-slate-300">Log in or sign up to see available tenders.</p><button class="btn" data-act="auth" data-id="login">Log in</button></div>'; return; }
  const q = $('f-q').value.toLowerCase(), sec = $('f-sector').value, st = $('f-status').value;
  const list = tenders.filter(t => (!q || (t.title + t.sectorName).toLowerCase().includes(q)) && (!sec || t.sectorType === sec) && (!st || status(t) === st));
  el.innerHTML = list.length ? list.map(t => `
    <button data-act="open" data-id="${t.id}" class="card text-left transition hover:border-emerald-500/60">
      <div class="mb-2 flex items-center justify-between"><span class="tag">${esc(t.sectorType)} sector</span><span class="tag ${status(t) === 'Open' ? '!bg-emerald-500/20 !text-emerald-300' : ''}">${status(t)}</span></div>
      <h3 class="font-bold">${esc(t.title)}</h3>
      <p class="text-xs text-slate-400">${esc(t.sectorName)}</p>
      <p class="mt-3 text-sm">Budget limit <b>${R(t.budget)}</b></p>
      <p class="text-xs text-slate-400">${t.items.length} item${t.items.length > 1 ? 's' : ''} · closes ${day(t.closesAt)}</p>
    </button>`).join('') : '<div class="card text-sm text-slate-400 md:col-span-2 lg:col-span-3">No tenders match. Sector accounts can post the first one from their dashboard.</div>';
}
['f-q', 'f-sector', 'f-status'].forEach(id => $(id).addEventListener('input', renderFeed));

function openTender(id) {
  cur = tenders.find(t => t.id === id); const t = cur; if (!t) return;
  $('view-detail').innerHTML = `
  <div class="mx-auto max-w-3xl space-y-4">
    <button class="text-sm text-slate-400" data-act="go" data-id="feed">Back to tenders</button>
    <div class="card space-y-3">
      <div class="flex gap-2"><span class="tag">${esc(t.sectorType)} sector</span><span class="tag">${status(t)}</span></div>
      <h1 class="text-2xl font-extrabold">${esc(t.title)}</h1>
      <p class="text-sm text-slate-400">${esc(t.sectorName)}</p>
      <p class="whitespace-pre-line text-sm text-slate-300">${esc(t.description)}</p>
      <dl class="grid grid-cols-2 gap-3 text-sm">
        <div><dt class="lbl">Budget limit</dt><dd class="font-bold">${R(t.budget)}</dd></div>
        <div><dt class="lbl">Contact email</dt><dd>${esc(t.contactEmail)}</dd></div>
        <div><dt class="lbl">Applications open</dt><dd>${day(t.opensAt)}</dd></div>
        <div><dt class="lbl">Applications close</dt><dd>${day(t.closesAt)}</dd></div>
        <div><dt class="lbl">Work starts</dt><dd>${day(t.startDate)}</dd></div>
        <div><dt class="lbl">Work finishes</dt><dd>${day(t.endDate)}</dd></div>
      </dl>
    </div>
    <div class="card"><h2 class="mb-2 font-bold">What to supply</h2>
      <ul class="divide-y divide-slate-800 text-sm">${t.items.map(i => `<li class="flex justify-between py-2"><span>${esc(i.name)}</span><span class="text-slate-400">${i.qty} ${esc(i.unit)}</span></li>`).join('')}</ul></div>
    <button class="btn" data-act="apply" ${status(t) !== 'Open' ? 'disabled' : ''}>${status(t) === 'Open' ? 'Apply for this tender' : 'Applications are not open'}</button>
  </div>`;
  show('detail');
}

/* ---------- Apply: details, quotation, save for later ---------- */
async function startApply() {
  if (!user) return $('auth-modal').classList.remove('hidden'), setMode('login');
  if (profile?.role !== 'bidder') return toast('Only bidder accounts can apply for tenders.', true);
  const t = cur;
  if ((await F.getDoc(F.doc(db, 'applications', t.id + '_' + user.uid))).exists()) return toast('You have already applied for this tender.', true);
  const ds = await F.getDoc(F.doc(db, 'users', user.uid, 'drafts', t.id));
  const d = ds.exists() ? ds.data() : {};
  const [first = '', ...rest] = (profile.name || '').split(' ');
  const p = d.personal || { name: first, surname: rest.join(' '), phone: profile.phone || '', email: profile.email || '' };
  const q = d.quote || [];
  const fld = (id, l, v, type = 'text') => `<div><label class="lbl">${l}</label><input id="${id}" type="${type}" class="inp" value="${esc(v)}"></div>`;
  $('view-apply').innerHTML = `
  <div class="mx-auto max-w-3xl space-y-4">
    <button class="text-sm text-slate-400" data-act="open" data-id="${t.id}">Back to tender</button>
    <h1 class="text-2xl font-extrabold">${esc(t.title)}</h1>
    ${d.personal ? '<p class="text-sm text-emerald-300">Your saved draft has been loaded.</p>' : ''}
    <div id="ap1" class="card space-y-3"><h2 class="font-bold">Your details</h2>
      <div class="grid gap-3 sm:grid-cols-2">${fld('ap-name', 'Name', p.name)}${fld('ap-surname', 'Surname', p.surname)}${fld('ap-phone', 'Phone number', p.phone, 'tel')}${fld('ap-email', 'Email', p.email, 'email')}</div>
      <button class="btn" data-act="step" data-id="2">Next: your prices</button></div>
    <div id="ap2" class="hidden space-y-3">
      <p class="text-sm text-slate-400">Enter your price per unit, where you got it, and whether it is an estimate. Budget limit: <b>${R(t.budget)}</b>.</p>
      ${t.items.map((it, i) => `<div class="card line space-y-3">
        <div class="flex justify-between"><b>${esc(it.name)}</b><span class="text-sm text-slate-400">${it.qty} ${esc(it.unit)}</span></div>
        <div class="grid gap-3 sm:grid-cols-3">
          <div><label class="lbl">Unit price (R)</label><input type="number" min="0" step="0.01" class="inp pr" value="${q[i]?.price ?? ''}"></div>
          <div class="sm:col-span-2"><label class="lbl">Where did you get it?</label><input class="inp src" value="${esc(q[i]?.source || '')}" placeholder="Supplier, website or price list"></div></div>
        <label class="flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" class="est" ${q[i]?.estimated ? 'checked' : ''}> This price is an estimate</label>
        <p class="text-right text-sm">Line total <b class="lt">R 0.00</b></p></div>`).join('')}
      <div class="card space-y-2 text-sm">
        <div class="flex justify-between"><span>Subtotal</span><b id="ap-sub"></b></div>
        <label class="flex items-center justify-between"><span><input type="checkbox" id="ap-vat" class="mr-2" ${d.vat === false ? '' : 'checked'}>Add 15% VAT</span><b id="ap-vatv"></b></label>
        <div class="flex justify-between border-t border-slate-800 pt-2 text-base"><span>Total quotation</span><b id="ap-tot" class="text-emerald-400"></b></div>
        <p id="ap-warn" class="hidden text-rose-300">Your total is above the budget limit.</p></div>
      <div class="flex flex-wrap gap-2">
        <button class="btn2" data-act="step" data-id="1">Back</button>
        <button class="btn2" data-act="saveDraft">Save for later</button>
        <button class="btn" data-act="submitApp">Send quotation</button></div>
    </div>
  </div>`;
  $('ap2').addEventListener('input', recalc);
  recalc(); show('apply');
}

function form() {
  const g = id => $(id).value.trim();
  return {
    personal: { name: g('ap-name'), surname: g('ap-surname'), phone: g('ap-phone'), email: g('ap-email') },
    quote: [...document.querySelectorAll('#ap2 .line')].map(c => ({ price: Number(c.querySelector('.pr').value) || 0, source: c.querySelector('.src').value.trim(), estimated: c.querySelector('.est').checked })),
    vat: $('ap-vat').checked
  };
}
function totals(f) {
  const sub = cur.items.reduce((s, it, i) => s + it.qty * f.quote[i].price, 0);
  return { sub, total: f.vat ? sub * 1.15 : sub };
}
function recalc() {
  const f = form(), { sub, total } = totals(f);
  document.querySelectorAll('#ap2 .line').forEach((c, i) => c.querySelector('.lt').textContent = R(cur.items[i].qty * f.quote[i].price));
  $('ap-sub').textContent = R(sub); $('ap-vatv').textContent = R(total - sub); $('ap-tot').textContent = R(total);
  $('ap-warn').classList.toggle('hidden', !(cur.budget > 0 && total > cur.budget));
}

async function saveDraft() {
  await F.setDoc(F.doc(db, 'users', user.uid, 'drafts', cur.id), { tenderId: cur.id, tenderTitle: cur.title, closesAt: cur.closesAt, ...form(), updatedAt: F.serverTimestamp() });
  toast('Saved. Close the page any time and continue from My bids.');
}

async function submitApp() {
  const f = form(), p = f.personal;
  if (!p.name || !p.surname || !p.phone || !p.email) return toast('Fill in your name, surname, phone number and email.', true), $('ap1').scrollIntoView();
  if (f.quote.some(l => l.price <= 0 || !l.source)) return toast('Every item needs a price and where you got it.', true);
  const { sub, total } = totals(f);
  const lines = cur.items.map((it, i) => ({ ...it, ...f.quote[i] }));
  await F.setDoc(F.doc(db, 'applications', cur.id + '_' + user.uid), {
    tenderId: cur.id, tenderTitle: cur.title, sectorUid: cur.sectorUid, applicantUid: user.uid, closesAt: cur.closesAt,
    companyName: profile.companyName || '', applicant: p, lines, vat: f.vat, subtotal: sub, total, status: 'submitted', createdAt: F.serverTimestamp()
  });
  await F.deleteDoc(F.doc(db, 'users', user.uid, 'drafts', cur.id));
  const body = `Hi, I have submitted a quotation for "${cur.title}" on TenderZA (total ${R(total)}). My certified documents are ready and I will send them once you contact me.\n\n${p.name} ${p.surname}\n${p.phone}`;
  $('done-mail').href = `mailto:${cur.contactEmail}?subject=${encodeURIComponent('Tender application: ' + cur.title)}&body=${encodeURIComponent(body)}`;
  $('done-until').textContent = `If you have not heard back by ${plus3m(cur.closesAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}, consider this tender closed for you.`;
  show('done');
}

/* ---------- Bidder: My bids ---------- */
async function loadBids() {
  show('bids');
  const [d, a] = await Promise.all([
    F.getDocs(F.collection(db, 'users', user.uid, 'drafts')),
    F.getDocs(F.query(F.collection(db, 'applications'), F.where('applicantUid', '==', user.uid)))]);
  $('bids-drafts').innerHTML = d.empty ? '<p class="text-sm text-slate-400">Nothing saved. Use Save for later while you gather prices.</p>' :
    d.docs.map(x => { const v = x.data(); return `<div class="card flex flex-wrap items-center justify-between gap-3"><div><b>${esc(v.tenderTitle)}</b><p class="text-xs text-slate-400">Closes ${day(v.closesAt)}</p></div>
      <div class="flex gap-2"><button class="btn" data-act="resume" data-id="${x.id}">Continue</button><button class="btn2" data-act="delDraft" data-id="${x.id}">Delete</button></div></div>`; }).join('');
  $('bids-apps').innerHTML = a.empty ? '<p class="text-sm text-slate-400">You have not sent any quotations yet.</p>' :
    a.docs.map(x => { const v = x.data(), until = plus3m(v.closesAt), over = v.status === 'submitted' && until < new Date();
      return `<div class="card"><div class="flex justify-between"><b>${esc(v.tenderTitle)}</b><span class="tag">${over ? 'No response, moved on' : esc(v.status)}</span></div>
      <p class="text-sm text-slate-400">Total ${R(v.total)} · wait until ${until.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}</p></div>`; }).join('');
}

/* ---------- Sector dashboard ---------- */
function itemRow() {
  const d = document.createElement('div');
  d.className = 'row grid grid-cols-12 gap-2';
  d.innerHTML = `<input class="inp in col-span-6" placeholder="Item"><input class="inp iq col-span-2" type="number" min="1" placeholder="Qty"><input class="inp iu col-span-3" placeholder="Unit"><button type="button" class="btn2 col-span-1 px-0" data-act="rmItem" aria-label="Remove item">✕</button>`;
  $('p-items').append(d);
}
async function loadDash() {
  show('dash'); if (!$('p-items').children.length) itemRow();
  if (!$('p-email').value) $('p-email').value = profile.email || '';
  const s = await F.getDocs(F.query(F.collection(db, 'tenders'), F.where('sectorUid', '==', user.uid)));
  $('dash-list').innerHTML = s.empty ? '<p class="text-sm text-slate-400">You have not posted any tenders yet.</p>' :
    s.docs.map(x => { const t = x.data(); return `<div class="card space-y-3"><div class="flex flex-wrap items-center justify-between gap-2"><div><b>${esc(t.title)}</b><p class="text-xs text-slate-400">${status(t)} · closes ${day(t.closesAt)}</p></div>
      <div class="flex gap-2"><button class="btn2" data-act="viewApps" data-id="${x.id}">Applications</button><button class="btn2" data-act="delTender" data-id="${x.id}">Delete</button></div></div><div id="apps-${x.id}"></div></div>`; }).join('');
}
$('post-form').addEventListener('submit', async e => {
  e.preventDefault();
  const g = id => $(id).value, D = (v, end) => new Date(v + (end ? 'T23:59:59' : 'T00:00:00'));
  const items = [...document.querySelectorAll('#p-items .row')].map(r => ({ name: r.querySelector('.in').value.trim(), qty: Number(r.querySelector('.iq').value) || 0, unit: r.querySelector('.iu').value.trim() || 'units' })).filter(i => i.name && i.qty > 0);
  if (!g('p-title').trim() || !items.length || !g('p-opens') || !g('p-closes') || !g('p-start') || !g('p-end') || !g('p-email')) return toast('Add a title, at least one item, all four dates and a contact email.', true);
  if (D(g('p-closes'), 1) <= D(g('p-opens'))) return toast('Closing date must be after the opening date.', true);
  if (D(g('p-end'), 1) < D(g('p-start'))) return toast('Finish date must be after the start date.', true);
  const T = (v, end) => F.Timestamp.fromDate(D(v, end));
  await F.addDoc(F.collection(db, 'tenders'), {
    sectorUid: user.uid, sectorName: profile.companyName, sectorType: profile.sectorType, title: g('p-title').trim(), description: g('p-desc').trim(),
    budget: Number(g('p-budget')) || 0, items, startDate: T(g('p-start')), endDate: T(g('p-end'), 1), opensAt: T(g('p-opens')), closesAt: T(g('p-closes'), 1),
    contactEmail: g('p-email').trim(), createdAt: F.serverTimestamp()
  });
  e.target.reset(); $('p-items').innerHTML = ''; toast('Tender published.');
  await loadTenders(); loadDash();
});

/* ---------- Click router ---------- */
function go(v) { if (v === 'bids') return loadBids(); if (v === 'dash') return loadDash(); show(v); if (v === 'feed') renderFeed(); }
const actions = {
  go, open: openTender, apply: startApply, saveDraft, submitApp, addItem: itemRow,
  auth: m => { $('auth-modal').classList.remove('hidden'); $('auth-modal').classList.add('flex'); setMode(m); },
  authClose: () => { $('auth-modal').classList.add('hidden'); $('auth-modal').classList.remove('flex'); },
  authSwitch: () => setMode(authMode === 'login' ? 'signup' : 'login'),
  reset: async () => { const em = document.querySelector('#auth-form [name=email]').value; if (!em) return toast('Enter your email first.', true); await F.sendPasswordResetEmail(auth, em); toast('Password reset email sent.'); },
  logout: async () => { await F.signOut(auth); go('feed'); },
  step: n => { $('ap1').classList.toggle('hidden', n === '2'); $('ap2').classList.toggle('hidden', n !== '2'); },
  rmItem: (_, b) => b.closest('.row').remove(),
  resume: async id => { cur = tenders.find(t => t.id === id); if (cur) { await startApply(); actions.step('2'); } },
  delDraft: async id => { await F.deleteDoc(F.doc(db, 'users', user.uid, 'drafts', id)); loadBids(); },
  delTender: async id => { if (confirm('Delete this tender?')) { await F.deleteDoc(F.doc(db, 'tenders', id)); await loadTenders(); loadDash(); } },
  viewApps: async id => {
    const s = await F.getDocs(F.query(F.collection(db, 'applications'), F.where('sectorUid', '==', user.uid), F.where('tenderId', '==', id)));
    $('apps-' + id).innerHTML = s.empty ? '<p class="text-sm text-slate-400">No applications yet.</p>' : s.docs.map(x => { const a = x.data(); return `
      <details class="rounded-lg border border-slate-800 p-3 text-sm"><summary class="cursor-pointer"><b>${esc(a.applicant.name)} ${esc(a.applicant.surname)}</b> ${esc(a.companyName)} · ${R(a.total)} · <span class="tag">${esc(a.status)}</span></summary>
        <p class="mt-2 text-slate-300">${esc(a.applicant.phone)} · ${esc(a.applicant.email)}</p>
        <ul class="mt-2 space-y-1 text-slate-400">${a.lines.map(l => `<li>${esc(l.name)}: ${l.qty} × ${R(l.price)}${l.estimated ? ' (estimate)' : ''}, from ${esc(l.source)}</li>`).join('')}</ul>
        <div class="mt-3 flex gap-2"><button class="btn2" data-act="setStatus" data-id="${x.id}" data-status="contacted" data-tender="${id}">Mark contacted</button><button class="btn2" data-act="setStatus" data-id="${x.id}" data-status="declined" data-tender="${id}">Decline</button></div></details>`; }).join('');
  },
  setStatus: async (id, b) => { await F.updateDoc(F.doc(db, 'applications', id), { status: b.dataset.status }); actions.viewApps(b.dataset.tender); }
};
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  try { await actions[b.dataset.act]?.(b.dataset.id, b); } catch (err) { toast(err.message.replace('Firebase: ', ''), true); }
});
