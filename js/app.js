import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, GOOGLE_LOGIN, SOCIETY_ID } from './config.js';

/* ================= helpers ================= */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const todayISO = () => new Date().toLocaleDateString('en-CA');
const thisMonth = () => todayISO().slice(0, 7) + '-01';
const mLabel = m => { const [y, mm] = m.split('-'); return MONTHS[+mm - 1] + ' ' + y; };
const dLabel = d => { if (!d) return '—'; const [y, m, dd] = d.slice(0, 10).split('-'); return +dd + ' ' + MONTHS[+m - 1] + (y !== String(new Date().getFullYear()) ? ' ' + y : ''); };
const addMonths = (m, n) => { let [y, mm] = m.split('-').map(Number); mm += n; while (mm > 12) { mm -= 12; y++; } while (mm < 1) { mm += 12; y--; } return `${y}-${String(mm).padStart(2, '0')}-01`; };
const byNum = (a, b) => String(a).localeCompare(String(b), 'en', { numeric: true });
const store = { get(k) { try { return localStorage.getItem(k) } catch (e) { return null } }, set(k, v) { try { localStorage.setItem(k, v) } catch (e) { } } };

const SLOTS = { morning: 'Morning (6–10 AM)', afternoon: 'Afternoon (12–4 PM)', evening: 'Evening (5–10 PM)', full: 'Full day' };
const STATUS = { paid: ['Paid', 'c-ok'], pending: ['Verifying', 'c-warn'], due: ['Due', 'c-bad'], open: ['Open', 'c-bad'], 'in-progress': ['In progress', 'c-warn'], resolved: ['Resolved', 'c-ok'], active: ['Active', 'c-ok'], rejected: ['Rejected', 'c-bad'] };
const chip = s => `<span class="chip ${STATUS[s]?.[1] || 'c-info'}">${STATUS[s]?.[0] || esc(s)}</span>`;
const ICONS = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
  dues: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><path d="M7 15h3"/>',
  notices: '<path d="M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1z"/><path d="M16 9a4 4 0 0 1 0 6"/>',
  help: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
  book: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  acc: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  dir: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
  members: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/><path d="M19 4l2 2-4 4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'
};
const icon = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[k]}</svg>`;

function toast(t, bad) { const el = document.createElement('div'); el.className = 'toast'; if (bad) el.style.background = 'var(--bad)'; el.textContent = t; el.setAttribute('role', 'status'); document.body.appendChild(el); setTimeout(() => el.remove(), bad ? 4500 : 2400); }
function modal(html) { $('#layer').innerHTML = `<div class="overlay" data-act="close-bg"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`; const f = $('#layer input,#layer textarea,#layer select'); f && f.focus(); }
function closeModal() { $('#layer').innerHTML = ''; }
async function copyText(text, btn) {
  try { await navigator.clipboard.writeText(text); toast('Copied'); }
  catch (e) { const n = btn.closest('.modal,.card')?.querySelector('.note,.secret,code'); if (n) { const r = document.createRange(); r.selectNodeContents(n); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast('Selected. Press Ctrl/Cmd + C'); } }
}
function download(name, text, type = 'text/csv') {
  const blob = new Blob([type === 'text/csv' ? '﻿' + text : text], { type: type + ';charset=utf-8' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
const csv = rows => rows.map(r => r.map(v => { v = String(v ?? ''); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',')).join('\n');

/* ================= state ================= */
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  $('#main').innerHTML = `<div class="auth"><div class="card"><h2>Almost ready</h2><p>Open <code>js/config.js</code> and paste your Supabase project URL and anon key. The steps are in <b>README.md</b>.</p></div></div>`;
  $('#shell').classList.add('solo');
  throw new Error('Missing Supabase config');
}
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let session = null, mems = [], cur = null, D = {}, owner = false, pubName = '';
const ui = { tab: 'home', month: thisMonth(), dueFilter: 'all', q: '', tFilter: 'active', authStep: 'email', email: '' };
const uid = () => session?.user?.id;
const isAdmin = () => cur?.role === 'admin';
const sid = () => cur.society_id;
const soc = () => cur.societies;

async function q(p) { const { data, error, count } = await p; if (error) throw new Error(error.message || 'Something went wrong. Please try again.'); return count != null && data == null ? count : data; }

/* ================= boot ================= */
async function boot() {
  const { data } = await sb.auth.getSession();
  session = data.session;
  if (!session) return location.hash === '#login' ? renderLogin() : renderLanding();
  try {
    await q(sb.rpc('claim_invites'));           // links this login to every society that added this email
    [mems, owner] = await Promise.all([
      q(sb.from('members').select('*, societies(*), villas(number)').eq('user_id', uid()).eq('status', 'active').order('created_at')),
      q(sb.rpc('is_platform_admin'))]);
  } catch (e) { return fatal(e); }
  const want = store.get('sh-society');
  cur = mems.find(m => m.society_id === want) || mems[0] || null;
  if (!cur) return owner ? renderNewSociety() : renderNotAdded();
  renderApp();
}
// Supabase advises not to await its own calls inside this callback, so defer with setTimeout.
window.addEventListener('hashchange', () => { if (!session) location.hash === '#login' ? renderLogin() : renderLanding(); });
sb.auth.onAuthStateChange((ev, s) => { if (ev === 'SIGNED_IN' && !session) { session = s; setTimeout(boot, 0); } if (ev === 'SIGNED_OUT') { session = null; mems = []; cur = null; history.replaceState(null, '', location.pathname); setTimeout(renderLanding, 0); } });

function fatal(e) { solo(`<div class="auth"><div class="card"><h2>Could not load</h2><p class="err">${esc(e.message)}</p><div class="row"><button class="btn primary" data-act="reload">Try again</button><button class="btn ghost" data-act="signout">Sign out</button></div></div></div>`); }
function solo(html, who = '') {
  $('#shell').classList.add('solo'); $('#nav').innerHTML = ''; $('#main').innerHTML = html;
  $('#socName').textContent = pubName || 'Society Hub'; $('#whoami').textContent = who;
  $('#topActions').innerHTML = session ? `<button class="btn small ghost" data-act="signout">Sign out</button>` : '';
}

/* ================= public home page ================= */
const VILLAS_ART = `<svg viewBox="0 0 520 300" role="img" aria-label="Illustration of villas among trees">
  <rect x="0" y="262" width="520" height="38" rx="6" fill="var(--green-soft)"/>
  <g fill="var(--surface)" stroke="var(--green)" stroke-width="3" stroke-linejoin="round">
    <path d="M40 262V170l70-52 70 52v92z"/><path d="M200 262V150l85-64 85 64v112z"/><path d="M390 262V182l60-44 60 44v80z"/></g>
  <g fill="var(--green)"><path d="M28 172l82-62 82 62-8 8-74-55-74 55z"/><path d="M186 152l99-75 99 75-9 9-90-67-90 67z"/><path d="M380 184l70-52 70 52-8 8-62-46-62 46z"/></g>
  <g fill="var(--gold)"><rect x="70" y="190" width="24" height="22" rx="3"/><rect x="126" y="190" width="24" height="22" rx="3"/>
    <rect x="232" y="170" width="28" height="26" rx="3"/><rect x="310" y="170" width="28" height="26" rx="3"/><rect x="420" y="200" width="22" height="20" rx="3"/></g>
  <g fill="var(--green)" opacity=".85"><rect x="96" y="226" width="28" height="36" rx="3"/><rect x="270" y="214" width="32" height="48" rx="3"/><rect x="458" y="226" width="24" height="36" rx="3"/></g>
  <g fill="var(--green)" opacity=".55"><circle cx="190" cy="226" r="22"/><circle cx="378" cy="232" r="18"/><circle cx="16" cy="236" r="14"/></g>
  <g stroke="var(--green)" stroke-width="4" opacity=".55"><path d="M190 248v14M378 250v12M16 250v12"/></g>
</svg>`;

async function renderLanding() {
  $('#shell').classList.add('solo'); $('#nav').innerHTML = '';
  $('#topActions').innerHTML = `<button class="btn small" data-act="show-login">Resident login</button>`;
  let info = null;
  try { if (SOCIETY_ID) info = await q(sb.rpc('public_society', { p_id: SOCIETY_ID })); } catch (e) { }
  const name = info?.name || 'Society Hub'; pubName = info?.name || ''; const am = info?.amenities || [], notes = info?.notices || [];
  $('#socName').textContent = name; $('#whoami').textContent = info?.address || '';
  document.title = name;
  $('#main').innerHTML = `<div class="landing">
    <section class="hero">
      <div class="hero-text">
        <span class="eyebrow">Gated villa community</span>
        <h1>${esc(name)}</h1>
        <p class="lead">${esc(info?.about || `A friendly gated community${info?.villas > 1 ? ` of ${info.villas} villas` : ''}, run by its residents' committee.`)}</p>
        ${info?.address ? `<p class="sub">${esc(info.address)}</p>` : ''}
      </div>
      <div class="hero-art">${VILLAS_ART}</div>
    </section>
    <div class="facts">
      ${info?.villas ? `<div><b class="num">${info.villas}</b><span>${info.villas === 1 ? 'Villa' : 'Villas'}</span></div>` : ''}
      ${am.length ? `<div><b class="num">${am.length}</b><span>Shared amenities</span></div>` : ''}
      <div><b>24×7</b><span>Gated security</span></div>
    </div>
    ${am.length ? `<section class="card"><h2>Amenities</h2><div class="pills">${am.map(a => `<span>${esc(a)}</span>`).join('')}</div></section>` : ''}
    <section class="card"><h2>Community updates</h2>${notes.length ? `<div class="list">${notes.map(n => `<div class="item notice"><div class="body">
      <div class="row" style="gap:8px"><span class="tag">${esc(n.tag)}</span><span class="meta">${dLabel(n.created_at)}</span></div>
      <h3>${esc(n.title)}</h3>${n.body ? `<p style="white-space:pre-wrap">${esc(n.body)}</p>` : ''}</div></div>`).join('')}</div>`
      : '<p class="sub">News from the committee will appear here.</p>'}</section>
    <section class="card resident-cta"><div><h2>Live here?</h2><p class="sub">Residents sign in to pay maintenance, read all notices and raise complaints.</p></div>
      <button class="btn primary" data-act="show-login">Resident login</button></section>
    <p class="foot" style="justify-content:center">Managed by the residents' committee · Free, made with Society Hub · <a href="privacy.html" style="color:inherit">Privacy</a></p>
  </div>`;
}

/* ================= login ================= */
function renderLogin(msg = '') {
  const email = ui.authStep === 'email';
  solo(`<div class="auth"><button class="btn ghost small" data-act="show-home" style="align-self:flex-start;padding-left:0">← Back to home</button><div class="card">
    <div><h1>Resident login</h1><p class="sub">Your society's maintenance, notices, complaints and bookings in one place. Free.</p></div>
    ${email ? `<p class="note" style="white-space:normal">Use the email address your society committee registered for you. New here? Send your villa number and email to your committee first.</p>` : ''}
    ${GOOGLE_LOGIN && email ? `<button class="btn primary" data-act="google" style="padding:11px">Continue with Google</button><div class="row" style="justify-content:center"><span class="sub">or use email</span></div>` : ''}
    ${email ? `<form class="stack" data-form="email">
        <div class="field"><label for="email">Email address</label><input id="email" name="email" type="email" required autocomplete="email" placeholder="you@gmail.com" value="${esc(ui.email)}"></div>
        <button class="btn${GOOGLE_LOGIN ? '' : ' primary'}">Email me a sign-in link</button></form>`
      : `<form class="stack" data-form="otp">
        <p>We sent an email to <b>${esc(ui.email)}</b>. Open it on this device and tap <b>Sign in</b>. Check Spam if you don't see it in a minute.</p>
        <div class="field"><label for="otp">Or, if the email shows a code, enter it here</label><input id="otp" name="otp" inputmode="numeric" autocomplete="one-time-code" required minlength="6" maxlength="10" placeholder="6-digit code"></div>
        <div class="row"><button class="btn primary">Sign in</button><button type="button" class="btn ghost" data-act="auth-back">Use another email</button></div></form>`}
    ${msg ? `<p class="err">${esc(msg)}</p>` : ''}
  </div></div>`);
}

/* ================= onboarding ================= */
function renderNotAdded() {
  solo(`<div class="auth"><div class="card">
    <h2>You are not added yet</h2>
    <p>You are signed in as <b>${esc(session.user.email)}</b>, but no society has added this email.</p>
    <p class="sub">Ask your society committee to add you with this exact email address. Then tap "Check again".</p>
    <div class="row"><button class="btn primary" data-act="reload">Check again</button><button class="btn ghost" data-act="signout">Use another email</button></div>
  </div></div>`, session.user.email);
}
function renderNewSociety() {
  solo(`<div class="auth" style="max-width:520px"><div class="card">
    <div><h1>New society</h1><p class="sub">Only the app owner sees this. The admin you enter here can then add villas and residents.</p></div>
    <form class="stack" data-form="create">
      <div class="field"><label for="cName">Society name</label><input id="cName" name="society" required placeholder="e.g. Aashima Anupama City"></div>
      <div class="field"><label for="cAdmin">Admin's name</label><input id="cAdmin" name="name" required></div>
      <div class="field"><label for="cEmail">Admin's email (they sign in with this)</label><input id="cEmail" name="email" type="email" required value="${esc(session.user.email)}"></div>
      <div class="two"><div class="field"><label for="cPhone">Admin's mobile</label><input id="cPhone" name="phone" inputmode="tel"></div>
      <div class="field"><label for="cVilla">Admin's villa number (optional)</label><input id="cVilla" name="villa" placeholder="e.g. V-001"></div></div>
      <div class="row"><button class="btn primary">Create society</button>${mems.length ? '<button type="button" class="btn ghost" data-act="reload">Back</button>' : ''}</div></form>
  </div></div>`, session.user.email);
}

/* ================= app shell ================= */
function tabs() {
  const f = soc().features || [], t = [['home', 'Home']];
  if (isAdmin()) t.push(['dues', 'Maintenance']);
  t.push(['notices', 'Notices'], ['help', 'Complaints']);
  if (f.includes('book')) t.push(['book', 'Bookings']);
  if (f.includes('acc')) t.push(['acc', 'Accounts']);
  if (f.includes('dir')) t.push(['dir', 'Directory']);
  if (isAdmin()) t.push(['members', 'Members'], ['settings', 'Settings']);
  return t;
}
const has = k => (soc().features || []).includes(k);
function renderApp() {
  $('#shell').classList.remove('solo');
  $('#socName').textContent = soc().name;
  $('#whoami').textContent = (cur.name || session.user.email) + (cur.villas?.number ? ' · ' + cur.villas.number : '') + (isAdmin() ? ' · Admin' : '');
  const others = mems.filter(m => m.status === 'active');
  $('#topActions').innerHTML = (others.length > 1 ? `<select class="mini" aria-label="Switch society" data-act="switch" style="width:auto">${others.map(m => `<option value="${m.society_id}" ${m === cur ? 'selected' : ''}>${esc(m.societies.name)}</option>`).join('')}</select>` : '')
    + (owner ? `<button class="btn small" data-act="new-society">+ New society</button>` : '')
    + `<button class="btn small ghost" data-act="signout">Sign out</button>`;
  if (!tabs().some(([k]) => k === ui.tab)) ui.tab = 'home';
  $('#nav').innerHTML = tabs().map(([k, l]) => `<button data-act="go" data-v="${k}" ${ui.tab === k ? 'aria-current="page"' : ''}>${icon(k)}${l}<span class="badge" id="badge-${k}" hidden></span></button>`).join('');
  show();
  if (isAdmin()) refreshBadges();
}
async function refreshBadges() {
  try {
    const [pend, tk] = await Promise.all([
      q(sb.from('dues').select('id', { count: 'exact', head: true }).eq('society_id', sid()).eq('status', 'pending')),
      q(sb.from('tickets').select('id', { count: 'exact', head: true }).eq('society_id', sid()).eq('status', 'open'))]);
    [['dues', pend], ['help', tk]].forEach(([k, n]) => { const b = $('#badge-' + k); if (b) { b.hidden = !n; b.textContent = n; } });
  } catch (e) { }
}
async function show(reload = true) {
  document.querySelectorAll('#nav button').forEach(b => b.dataset.v === ui.tab ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  const v = VIEWS[ui.tab];
  if (reload) {
    $('#main').innerHTML = '<div class="loading">Loading…</div>';
    try { await v.load(); } catch (e) { $('#main').innerHTML = `<div class="card"><p class="err">${esc(e.message)}</p><div><button class="btn" data-act="go" data-v="${ui.tab}">Try again</button></div></div>`; return; }
  }
  $('#main').innerHTML = v.draw();
  v.after?.();
}
const redraw = () => show(false);
async function refresh() { await show(true); if (isAdmin()) refreshBadges(); }

/* ================= views ================= */
const VIEWS = {};

VIEWS.home = {
  async load() {
    const s = sid(), base = [
      q(sb.from('notices').select('*').eq('society_id', s).order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(3)),
      q(sb.rpc('society_summary', { p_society: s }))];
    if (isAdmin()) {
      const [notices, sum, dues, openT, pendM] = await Promise.all([...base,
      q(sb.from('dues').select('status,amount').eq('society_id', s).eq('month', thisMonth())),
      q(sb.from('tickets').select('id', { count: 'exact', head: true }).eq('society_id', s).neq('status', 'resolved')),
      q(sb.from('members').select('id', { count: 'exact', head: true }).eq('society_id', s).eq('status', 'invited'))]);
      D.home = { notices, sum, dues, openT, pendM };
    } else {
      const v = cur.villa_id;
      const [notices, sum, dues, tickets, bookings] = await Promise.all([...base,
      q(sb.from('dues').select('*').eq('society_id', s).order('month', { ascending: false }).limit(12)),
      q(sb.from('tickets').select('id,title,status').eq('society_id', s).neq('status', 'resolved').order('created_at', { ascending: false }).limit(4)),
      v && has('book') ? q(sb.from('bookings').select('*').eq('society_id', s).eq('villa_id', v).gte('day', todayISO()).order('day').limit(3)) : []]);
      D.home = { notices, sum, dues, tickets, bookings };
    }
  },
  draw() {
    const h = D.home, sum = h.sum, bal = Number(sum.opening) + Number(sum.collected) - Number(sum.spent);
    const notices = `<div class="card"><div class="row"><h2>Notices</h2><button class="btn ghost small spacer" data-act="go" data-v="notices">All notices</button></div>${noticeList(h.notices)}</div>`;
    if (isAdmin()) {
      const tot = h.dues.reduce((a, d) => a + d.amount, 0), paid = h.dues.filter(d => d.status === 'paid'), col = paid.reduce((a, d) => a + d.amount, 0);
      const pend = h.dues.filter(d => d.status === 'pending').length, pct = tot ? Math.round(col / tot * 100) : 0;
      return `<div class="head"><div><h1>Committee desk</h1><p>${mLabel(thisMonth())} · bills fall due on the ${soc().due_day}th</p></div></div>
      ${!sum.villas ? `<div class="card"><h2>First step: add your villas</h2><p class="sub">Add the list of villa numbers, then add residents in Members.</p><div><button class="btn primary" data-act="go" data-v="settings">Add villas</button></div></div>` : ''}
      <div class="grid">
        <div class="card hero"><span class="label">Collected this month</span><div class="big">${inr(col)}</div>
          <div class="bar"><span style="width:${pct}%"></span></div>
          <span class="sub">${h.dues.length ? `${paid.length} of ${h.dues.length} villas paid · ${pct}%` : `No bills raised for ${mLabel(thisMonth())} yet`}</span></div>
        <div class="card"><span class="label">Waiting for you</span>
          <div class="row"><span class="big">${pend}</span><span class="sub">UPI payments to verify</span></div>
          <div class="row"><span class="big">${h.pendM}</span><span class="sub">residents added but not signed in yet</span></div>
          <div class="row"><span class="big">${h.openT}</span><span class="sub">open complaints</span></div></div>
        <div class="card"><span class="label">Society fund balance</span><div class="big">${inr(bal)}</div><span class="sub">Opening ${inr(sum.opening)} + dues ${inr(sum.collected)} − spent ${inr(sum.spent)}</span></div>
      </div>
      <div class="card"><h2>Quick actions</h2><div class="row">
        ${!h.dues.length && sum.villas ? `<button class="btn primary" data-act="gen">Raise ${mLabel(thisMonth())} bills</button>` : `<button class="btn primary" data-act="go" data-v="dues">Verify payments</button>`}
        <button class="btn" data-act="go" data-v="members">Add residents</button>
        <button class="btn" data-act="go" data-v="notices">Post a notice</button></div></div>${notices}`;
    }
    const due = h.dues.filter(d => d.status === 'due').sort((a, b) => a.month.localeCompare(b.month)), owe = due.reduce((a, d) => a + d.amount, 0), pend = h.dues.some(d => d.status === 'pending'), m0 = sum.months[0];
    return `<div class="head"><div><h1>Namaste, ${esc((cur.name || '').split(' ')[0])}</h1><p>${cur.villas?.number ? 'Villa ' + esc(cur.villas.number) + ' · ' : ''}${esc(soc().name)}</p></div></div>
    <div class="grid">
      <div class="card hero"><span class="label">Your maintenance</span>
        ${owe ? `<div class="big">${inr(owe)}</div><span class="sub">${due.map(d => mLabel(d.month)).join(', ')} · due by the ${soc().due_day}th</span><div><button class="btn primary" data-act="pay" data-v="${due[0].id}">Pay with UPI</button></div>`
        : pend ? `<div class="big">Checking</div><span class="sub">The treasurer will confirm your UPI payment soon.</span>`
          : `<div class="big">All paid</div><span class="sub">Nothing due. Thank you!</span>`}</div>
      <div class="card"><span class="label">Your complaints</span>
        ${h.tickets.length ? h.tickets.map(t => `<div class="row"><span style="min-width:0;flex:1">${esc(t.title)}</span>${chip(t.status)}</div>`).join('') : '<span class="sub">No open complaints.</span>'}
        <div><button class="btn small" data-act="go" data-v="help">Raise a complaint</button></div></div>
      ${has('book') ? `<div class="card"><span class="label">Your bookings</span>
        ${h.bookings.length ? h.bookings.map(b => `<div><b>${esc(b.amenity)}</b><div class="sub">${dLabel(b.day)} · ${SLOTS[b.slot]}</div></div>`).join('') : '<span class="sub">No upcoming bookings.</span>'}
        <div><button class="btn small" data-act="go" data-v="book">Book an amenity</button></div></div>` : ''}
    </div>${notices}
    <div class="card"><h2>Your bills</h2>${h.dues.length ? `<div class="tablewrap" style="border:0"><table style="min-width:420px"><thead><tr><th>Month</th><th class="r">Amount</th><th>Status</th><th></th></tr></thead><tbody>
      ${h.dues.map(d => `<tr><td>${mLabel(d.month)}</td><td class="r num">${inr(d.amount)}</td><td>${chip(d.status)}</td>
      <td class="r">${d.status === 'due' ? `<button class="btn small primary" data-act="pay" data-v="${d.id}">Pay</button>` : d.status === 'paid' ? `<button class="btn small ghost" data-act="receipt" data-v="${d.id}">Receipt</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="sub">No bills yet.</p>'}</div>
    ${has('acc') ? `<div class="card"><div class="row"><h2>Where the money goes</h2><span class="sub spacer">Every resident sees the same accounts</span></div>
      <div class="row" style="gap:28px"><div><div class="label">Fund balance</div><div class="big">${inr(bal)}</div></div>
      ${m0 ? `<div><div class="label">${mLabel(m0.month)} collection</div><div class="big">${Math.round(m0.collected / (m0.billed || 1) * 100)}%</div></div>` : ''}</div>
      <div><button class="btn small" data-act="go" data-v="acc">See accounts</button></div></div>` : ''}`;
  }
};

function noticeList(arr) {
  if (!arr.length) return '<div class="empty">No notices yet.</div>';
  return `<div class="list">${arr.map(n => `<div class="item notice"><div class="body">
    <div class="row" style="gap:8px">${n.pinned ? '<span class="pin">Pinned</span>' : ''}${isAdmin() && n.is_public ? '<span class="chip c-info">Public</span>' : ''}<span class="tag">${esc(n.tag)}</span><span class="meta">${dLabel(n.created_at)}</span></div>
    <h3>${esc(n.title)}</h3><p style="white-space:pre-wrap">${esc(n.body)}</p></div>
    ${isAdmin() ? `<div class="row" style="flex-wrap:nowrap"><button class="btn small ghost" data-act="pin" data-v="${n.id}" data-p="${n.pinned ? 1 : 0}">${n.pinned ? 'Unpin' : 'Pin'}</button><button class="btn small ghost danger" data-act="del-notice" data-v="${n.id}">Delete</button></div>` : ''}</div>`).join('')}</div>`;
}

VIEWS.dues = {
  async load() {
    if (isAdmin()) {
      const [rows, sum] = await Promise.all([
        q(sb.from('dues').select('id,villa_id,month,amount,status,utr,mode,paid_on,villas(number,owner_name)').eq('society_id', sid()).eq('month', ui.month)),
        q(sb.rpc('society_summary', { p_society: sid() }))]);
      rows.sort((a, b) => byNum(a.villas?.number, b.villas?.number));
      D.dues = { rows, months: sum.months.map(m => m.month) };
    } else {
      D.dues = { rows: await q(sb.from('dues').select('*').eq('society_id', sid()).order('month', { ascending: false }).limit(36)) };
    }
  },
  draw() {
    const rows = D.dues.rows;
    if (!isAdmin()) {
      return `<div class="head"><div><h1>Maintenance</h1><p>${inr(soc().maintenance_amount)} per month · pay by UPI to <b>${esc(soc().upi_id || 'UPI ID not set yet')}</b></p></div></div>
      ${rows.length ? `<div class="tablewrap"><table><thead><tr><th>Month</th><th class="r">Amount</th><th>Status</th><th>Details</th><th></th></tr></thead><tbody>
      ${rows.map(d => `<tr><td>${mLabel(d.month)}</td><td class="r num">${inr(d.amount)}</td><td>${chip(d.status)}</td><td class="num sub">${d.paid_on ? dLabel(d.paid_on) + ' · ' + esc(d.mode) : d.utr ? 'UTR ' + esc(d.utr) : '—'}</td>
      <td class="r">${d.status === 'due' ? `<button class="btn small primary" data-act="pay" data-v="${d.id}">Pay</button>` : d.status === 'paid' ? `<button class="btn small ghost" data-act="receipt" data-v="${d.id}">Receipt</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">No bills yet.</div>'}
      <p class="sub">Paid in cash or by cheque? Give it to the treasurer and they will mark it here.</p>`;
    }
    const months = [...new Set([addMonths(thisMonth(), 1), thisMonth(), ...D.dues.months, ui.month])].sort().reverse();
    const n = s => rows.filter(d => d.status === s).length, col = rows.filter(d => d.status === 'paid').reduce((a, d) => a + d.amount, 0);
    const qq = ui.q.trim().toLowerCase();
    const list = rows.filter(d => (ui.dueFilter === 'all' || d.status === ui.dueFilter) && (!qq || (d.villas?.number + ' ' + d.villas?.owner_name).toLowerCase().includes(qq)));
    return `<div class="head"><div><h1>Maintenance collection</h1><p>${rows.length ? `${n('paid')}/${rows.length} paid · ${inr(col)} collected · ${n('pending')} to verify · ${n('due')} unpaid` : 'No bills for this month yet'}</p></div>
      <div class="field" style="width:150px"><label for="monthSel">Month</label><select id="monthSel" data-act="month">${months.map(m => `<option value="${m}" ${m === ui.month ? 'selected' : ''}>${mLabel(m)}</option>`).join('')}</select></div></div>
    <div class="row">
      ${rows.length ? '' : `<button class="btn primary" data-act="gen" data-v="${ui.month}">Raise ${mLabel(ui.month)} bills</button>`}
      ${rows.length ? `<button class="btn" data-act="remind">WhatsApp reminder</button><button class="btn" data-act="csv-dues">Download Excel (CSV)</button>
      <button class="btn ghost" data-act="gen" data-v="${ui.month}">Add bills for new villas</button>` : ''}</div>
    ${rows.length ? `<div class="row"><div class="seg" role="group" aria-label="Filter">${[['all', 'All'], ['pending', 'Verifying'], ['due', 'Unpaid'], ['paid', 'Paid']].map(([k, l]) => `<button data-act="dfilter" data-v="${k}" aria-pressed="${ui.dueFilter === k}">${l} ${k === 'all' ? rows.length : n(k)}</button>`).join('')}</div>
      <input class="search spacer" id="dueSearch" type="search" placeholder="Search villa or name" value="${esc(ui.q)}" data-act="dsearch" aria-label="Search villa or name"></div>
    <div class="tablewrap"><table><thead><tr><th>Villa</th><th>Owner</th><th class="r">Amount</th><th>Status</th><th>Details</th><th class="r">Action</th></tr></thead><tbody id="dueRows">${dueRows(list)}</tbody></table></div>` : ''}`;
  },
  after() { const s = $('#dueSearch'); if (s && ui.q) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }
};
function dueRows(list) {
  if (!list.length) return `<tr><td colspan="6" class="sub" style="text-align:center">Nothing here.</td></tr>`;
  return list.map(d => `<tr><td><b>${esc(d.villas?.number)}</b></td><td>${esc(d.villas?.owner_name)}</td><td class="r num">${inr(d.amount)}</td><td>${chip(d.status)}</td>
    <td class="num sub">${d.status === 'paid' ? dLabel(d.paid_on) + ' · ' + esc(d.mode) : d.utr ? 'UTR ' + esc(d.utr) : '—'}</td>
    <td class="r" style="white-space:nowrap">${d.status === 'pending' ? `<button class="btn small primary" data-act="approve" data-v="${d.id}">Confirm</button> <button class="btn small ghost" data-act="reject" data-v="${d.id}">Reject</button>`
      : d.status === 'due' ? `<button class="btn small" data-act="offline" data-v="${d.id}">Mark paid</button>`
        : `<button class="btn small ghost" data-act="receipt" data-v="${d.id}">Receipt</button> <button class="btn small ghost" data-act="undo" data-v="${d.id}">Undo</button>`}</td></tr>`).join('');
}

VIEWS.notices = {
  async load() { D.notices = await q(sb.from('notices').select('*').eq('society_id', sid()).order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(100)); },
  draw() {
    return `<div class="head"><div><h1>Notices</h1><p>Announcements from the committee</p></div></div>
    ${isAdmin() ? `<div class="card"><h2>Post a notice</h2><form class="stack" data-form="notice">
      <div class="field"><label for="nTitle">Title</label><input id="nTitle" name="title" required maxlength="160" placeholder="e.g. Power shutdown on Sunday"></div>
      <div class="field"><label for="nBody">Message</label><textarea id="nBody" name="body" required></textarea></div>
      <div class="two"><div class="field"><label for="nTag">Category</label><select id="nTag" name="tag"><option>General</option><option>Maintenance</option><option>Event</option><option>Security</option><option>Committee</option><option>Urgent</option></select></div>
      <div class="stack" style="display:flex;flex-direction:column;gap:6px;align-self:end"><label class="check"><input id="nPin" type="checkbox" name="pinned"> Pin to top</label>
      <label class="check"><input id="nPub" type="checkbox" name="is_public"> Also show on the public home page</label></div></div>
      <div><button class="btn primary">Publish notice</button></div></form></div>` : ''}
    <div class="card">${noticeList(D.notices)}</div>`;
  }
};

VIEWS.help = {
  async load() { D.tickets = await q(sb.from('tickets').select('*, villas(number)').eq('society_id', sid()).order('created_at', { ascending: false }).limit(300)); },
  draw() {
    const all = D.tickets, adm = isAdmin();
    const list = adm ? all.filter(t => ui.tFilter === 'all' || (ui.tFilter === 'active' ? t.status !== 'resolved' : t.status === ui.tFilter)) : all;
    return `<div class="head"><div><h1>Helpdesk</h1><p>${adm ? 'Complaints from residents' : 'Report a problem and track it'}</p></div></div>
    ${!adm || cur.villa_id ? `<div class="card"><h2>Raise a complaint</h2>${cur.villa_id ? `<form class="stack" data-form="ticket">
      <div class="two"><div class="field"><label for="tCat">Type</label><select id="tCat" name="category"><option>Plumbing</option><option>Electrical</option><option>Housekeeping</option><option>Security</option><option>Garden</option><option>Lift / common area</option><option>Other</option></select></div>
      <div class="field"><label for="tTitle">What is wrong?</label><input id="tTitle" name="title" required maxlength="160" placeholder="e.g. Street light off near V-107"></div></div>
      <div class="field"><label for="tDet">More details (optional)</label><textarea id="tDet" name="details"></textarea></div>
      <div><button class="btn primary">Submit complaint</button></div></form>` : '<p class="sub">Your account is not linked to a villa. Ask an admin to set your villa.</p>'}</div>` : ''}
    ${adm ? `<div class="seg" role="group" aria-label="Filter">${[['active', 'Not resolved'], ['open', 'Open'], ['in-progress', 'In progress'], ['resolved', 'Resolved'], ['all', 'All']].map(([k, l]) => `<button data-act="tfilter" data-v="${k}" aria-pressed="${ui.tFilter === k}">${l}</button>`).join('')}</div>` : ''}
    ${list.length ? `<div class="tablewrap"><table><thead><tr><th>#</th>${adm ? '<th>Villa</th>' : ''}<th>Issue</th><th>Raised</th><th>Status</th><th>Update from committee</th></tr></thead><tbody>
    ${list.map(t => `<tr><td class="num sub">${t.id}</td>${adm ? `<td><b>${esc(t.villas?.number || '—')}</b></td>` : ''}<td style="min-width:200px"><b>${esc(t.title)}</b><div class="sub">${esc(t.category)}${t.details ? ' · ' + esc(t.details) : ''}</div></td><td class="num">${dLabel(t.created_at)}</td>
     <td>${adm ? `<select class="mini" aria-label="Status for #${t.id}" data-act="tstatus" data-v="${t.id}">${['open', 'in-progress', 'resolved'].map(s => `<option value="${s}" ${s === t.status ? 'selected' : ''}>${STATUS[s][0]}</option>`).join('')}</select>` : chip(t.status)}</td>
     <td class="sub" style="min-width:160px">${adm ? `<input class="mini" aria-label="Note for #${t.id}" data-act="tnote" data-v="${t.id}" value="${esc(t.note)}" placeholder="e.g. Plumber coming Tuesday">` : esc(t.note) || '—'}</td></tr>`).join('')}
    </tbody></table></div>` : `<div class="empty">${adm ? 'No complaints here.' : 'You have not raised any complaints.'}</div>`}`;
  }
};

VIEWS.book = {
  async load() { D.book = await q(sb.from('bookings').select('*, villas(number)').eq('society_id', sid()).gte('day', todayISO()).order('day').limit(200)); },
  draw() {
    const am = soc().amenities || [];
    return `<div class="head"><div><h1>Bookings</h1><p>Book common areas for your family. Everyone can see what is booked.</p></div></div>
    ${cur.villa_id && am.length ? `<div class="card"><h2>Book an amenity</h2><form class="stack" data-form="booking">
     <div class="two"><div class="field"><label for="bAm">Amenity</label><select id="bAm" name="amenity">${am.map(a => `<option>${esc(a)}</option>`).join('')}</select></div>
     <div class="field"><label for="bDate">Date</label><input id="bDate" type="date" name="day" min="${todayISO()}" required></div>
     <div class="field"><label for="bSlot">Slot</label><select id="bSlot" name="slot">${Object.entries(SLOTS).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div>
     <div class="field"><label for="bPur">Purpose (optional)</label><input id="bPur" name="purpose" placeholder="e.g. Birthday party"></div></div>
     <div><button class="btn primary">Book</button></div></form></div>` : !am.length ? `<div class="empty">No amenities set up yet.${isAdmin() ? ' Add them in Settings.' : ''}</div>` : ''}
    ${D.book.length ? `<div class="tablewrap"><table><thead><tr><th>Date</th><th>Amenity</th><th>Slot</th><th>Villa</th><th>Purpose</th><th></th></tr></thead><tbody>
    ${D.book.map(b => `<tr><td class="num"><b>${dLabel(b.day)}</b></td><td>${esc(b.amenity)}</td><td>${SLOTS[b.slot]}</td><td>${esc(b.villas?.number)}${b.villa_id === cur.villa_id ? ' <span class="chip c-info">You</span>' : ''}</td><td class="sub">${esc(b.purpose) || '—'}</td>
     <td class="r">${isAdmin() || b.villa_id === cur.villa_id ? `<button class="btn small ghost danger" data-act="cancel-book" data-v="${b.id}">Cancel</button>` : ''}</td></tr>`).join('')}
    </tbody></table></div>` : '<div class="empty">No upcoming bookings.</div>'}`;
  }
};

VIEWS.acc = {
  async load() {
    const [sum, exps] = await Promise.all([q(sb.rpc('society_summary', { p_society: sid() })),
    q(sb.from('expenses').select('*').eq('society_id', sid()).order('spent_on', { ascending: false }).limit(500))]);
    D.acc = { sum, exps };
  },
  draw() {
    const { sum, exps } = D.acc, bal = Number(sum.opening) + Number(sum.collected) - Number(sum.spent);
    const max = Math.max(1, ...sum.months.flatMap(m => [Number(m.collected), Number(m.spent)]));
    return `<div class="head"><div><h1>Accounts</h1><p>Open books. Every resident sees what comes in and what goes out.</p></div>
      <button class="btn" data-act="csv-exp">Download expenses (CSV)</button></div>
    <div class="grid">
      <div class="card hero"><span class="label">Fund balance</span><div class="big">${inr(bal)}</div><span class="sub">Opening balance ${inr(sum.opening)}</span></div>
      <div class="card"><span class="label">Maintenance received</span><div class="big">${inr(sum.collected)}</div><span class="sub">All months</span></div>
      <div class="card"><span class="label">Spent</span><div class="big">${inr(sum.spent)}</div><span class="sub">${exps.length} entries</span></div>
    </div>
    ${sum.months.length ? `<div class="card"><h2>Month by month</h2><div class="list">${sum.months.map(x => `<div class="item" style="align-items:center"><b style="width:76px;flex:none">${mLabel(x.month)}</b>
      <div class="body" style="display:flex;flex-direction:column;gap:5px">
       <div class="row" style="flex-wrap:nowrap"><div class="bar" style="flex:1"><span style="width:${x.collected / max * 100}%"></span></div><span class="num sub" style="width:96px;text-align:right">${inr(x.collected)}</span></div>
       <div class="row" style="flex-wrap:nowrap"><div class="bar" style="flex:1"><span style="width:${x.spent / max * 100}%;background:var(--gold)"></span></div><span class="num sub" style="width:96px;text-align:right">${inr(x.spent)}</span></div>
       <span class="sub">${x.paid} of ${x.bills} villas paid</span></div></div>`).join('')}</div>
     <div class="row sub"><span class="row" style="gap:6px"><span style="width:10px;height:10px;border-radius:3px;background:var(--green)"></span>Collected</span><span class="row" style="gap:6px"><span style="width:10px;height:10px;border-radius:3px;background:var(--gold)"></span>Spent</span></div></div>` : ''}
    ${isAdmin() ? `<div class="card"><h2>Record an expense</h2><form class="stack" data-form="expense"><div class="two">
      <div class="field"><label for="eHead">Head</label><select id="eHead" name="head">${['Security', 'Housekeeping', 'Electricity', 'Water', 'Repairs', 'Gardening', 'Lift', 'Events', 'Salaries', 'Other'].map(h => `<option>${h}</option>`).join('')}</select></div>
      <div class="field"><label for="eAmt">Amount (₹)</label><input id="eAmt" type="number" min="1" step="0.01" name="amount" required></div>
      <div class="field"><label for="eDate">Date</label><input id="eDate" type="date" name="spent_on" value="${todayISO()}" required></div>
      <div class="field"><label for="eNote">Note</label><input id="eNote" name="note" placeholder="Vendor / bill number"></div></div>
      <div><button class="btn primary">Add expense</button></div></form></div>` : ''}
    ${exps.length ? `<div class="tablewrap"><table><thead><tr><th>Date</th><th>Head</th><th>Note</th><th class="r">Amount</th>${isAdmin() ? '<th></th>' : ''}</tr></thead><tbody>
    ${exps.map(e => `<tr><td class="num">${dLabel(e.spent_on)}</td><td>${esc(e.head)}</td><td class="sub">${esc(e.note)}</td><td class="r num">${inr(e.amount)}</td>${isAdmin() ? `<td class="r"><button class="btn small ghost danger" data-act="del-exp" data-v="${e.id}">Delete</button></td>` : ''}</tr>`).join('')}
    </tbody></table></div>` : '<div class="empty">No expenses recorded yet.</div>'}`;
  }
};

VIEWS.dir = {
  async load() { D.dir = await q(sb.rpc('directory', { p_society: sid() })); },
  draw() {
    const qq = ui.q.trim().toLowerCase(), contacts = soc().contacts || [];
    const list = D.dir.filter(v => !qq || (v.number + ' ' + v.owner_name + ' ' + v.residents).toLowerCase().includes(qq));
    return `<div class="head"><div><h1>Directory</h1><p>${D.dir.length} villas${isAdmin() ? '' : ' · phone numbers shown only for the committee'}</p></div>
      <input class="search" type="search" id="dirSearch" data-act="dirsearch" placeholder="Search villa or name" value="${esc(ui.q)}" aria-label="Search villa or name"></div>
    ${contacts.length ? `<div class="card"><h2>Emergency & services</h2><div class="villas">${contacts.map(c => `<div class="villa"><span class="tagline">${esc(c.name)}</span><b class="num" style="user-select:all">${esc(c.phone)}</b></div>`).join('')}</div></div>` : ''}
    <div class="villas">${list.slice(0, 500).map(v => `<div class="villa"><div class="row"><span class="no">${esc(v.number)}</span>${v.committee ? `<span class="chip c-info spacer">${esc(v.committee)}</span>` : ''}</div>
     <b>${esc(v.residents || v.owner_name || '—')}</b><span class="tagline num">${[v.villa_type, v.phone].filter(Boolean).map(esc).join(' · ') || '&nbsp;'}</span></div>`).join('') || '<div class="empty">No villas found.</div>'}</div>`;
  },
  after() { const s = $('#dirSearch'); if (s && ui.q) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }
};

VIEWS.members = {
  async load() {
    const [m, v] = await Promise.all([q(sb.from('members').select('*, villas(number)').eq('society_id', sid()).order('created_at')),
    q(sb.from('villas').select('id,number').eq('society_id', sid()))]);
    v.sort((a, b) => byNum(a.number, b.number));
    D.members = { m, v };
  },
  draw() {
    const { m, v } = D.members, qq = ui.q.trim().toLowerCase();
    const list = m.filter(x => !qq || (x.name + ' ' + (x.villas?.number || '') + ' ' + x.email).toLowerCase().includes(qq)).sort((a, b) => byNum(a.villas?.number || 'zzz', b.villas?.number || 'zzz'));
    return `<div class="head"><div><h1>Members</h1><p>${m.length} people · they sign in with the email you add here</p></div>
      <button class="btn" data-act="invite">Share app link</button></div>
    <div class="card">${v.length ? `<form class="addrow" data-form="member">
        <select name="villa_id" aria-label="Villa" required>${v.map(x => `<option value="${x.id}">${esc(x.number)}</option>`).join('')}</select>
        <input name="name" aria-label="Name" placeholder="Name" required>
        <input name="email" type="email" aria-label="Email" placeholder="Email" required>
        <button class="btn primary">Add</button></form>
      <details><summary class="sub">Adding many villas? Paste a list</summary><form class="stack" data-form="members-paste" style="margin-top:10px">
        <div class="field"><label for="mList">One per line: villa, name, email</label><textarea id="mList" name="list" placeholder="B-12, Neha Sharma, neha@gmail.com"></textarea></div>
        <div><button class="btn">Add all</button></div></form></details>`
      : `<p>First add your villa numbers in <button class="btn small" data-act="go" data-v="settings">Settings</button>.</p>`}</div>
    ${m.length > 8 ? `<input class="search" type="search" id="memSearch" data-act="memsearch" placeholder="Search name, villa or email" value="${esc(ui.q)}" aria-label="Search members">` : ''}
    <div class="card"><div class="list">${list.map(x => `<div class="item" style="align-items:center">
      <b class="num" style="width:64px;flex:none">${esc(x.villas?.number || '—')}</b>
      <div class="body"><b>${esc(x.name)}</b>${x.user_id === uid() ? ' <span class="chip c-info">You</span>' : ''}${x.role === 'admin' ? ' <span class="chip c-ok">Admin</span>' : ''}
        <div class="meta">${esc(x.email)}${x.status !== 'active' ? ' · not signed in yet' : ''}</div></div>
      ${x.user_id === uid() ? '' : `<button class="btn small ghost" data-act="m-admin" data-v="${x.id}" data-r="${x.role === 'admin' ? 'resident' : 'admin'}">${x.role === 'admin' ? 'Remove admin' : 'Make admin'}</button>
      <button class="btn small ghost danger" data-act="m-remove" data-v="${x.id}">Remove</button>`}</div>`).join('') || '<p class="sub">No one found.</p>'}</div></div>`;
  },
  after() { const s = $('#memSearch'); if (s && ui.q) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }
};

VIEWS.settings = {
  async load() {
    const [vc, sec] = await Promise.all([q(sb.from('villas').select('id', { count: 'exact', head: true }).eq('society_id', sid())),
    q(sb.from('society_secrets').select('export_key').eq('society_id', sid()).maybeSingle())]);
    D.settings = { villas: vc, key: sec?.export_key || '' };
  },
  draw() {
    const s = soc();
    return `<div class="head"><div><h1>Settings</h1><p>Only admins see this page.</p></div></div>
    <div class="card"><h2>Society</h2><form class="stack" data-form="society"><div class="two">
      <div class="field"><label for="sName">Society name</label><input id="sName" name="name" required value="${esc(s.name)}"></div>
      <div class="field"><label for="sUpi">UPI ID for maintenance</label><input id="sUpi" name="upi_id" value="${esc(s.upi_id)}" placeholder="e.g. greenmeadows@okaxis"></div>
      <div class="field"><label for="sAmt">Maintenance per villa (₹ a month)</label><input id="sAmt" type="number" min="0" name="maintenance_amount" value="${s.maintenance_amount}"></div>
      <div class="field"><label for="sDue">Due day of month</label><input id="sDue" type="number" min="1" max="28" name="due_day" value="${s.due_day}"></div>
      <div class="field"><label for="sOpen">Opening fund balance (₹)</label><input id="sOpen" type="number" step="0.01" name="opening_balance" value="${s.opening_balance}"></div>
      <div class="field"><label for="sAddr">Address (shown on the public page)</label><input id="sAddr" name="address" value="${esc(s.address)}"></div></div>
      <div class="field"><label for="sAbout">About the society (shown on the public page)</label><textarea id="sAbout" name="about" placeholder="e.g. 400 villas with a clubhouse, pool and gardens, 10 minutes from the highway.">${esc(s.about || '')}</textarea></div>
      <div class="two"><div class="field"><label for="sAm">Amenities (one per line, shown on the public page)</label><textarea id="sAm" name="amenities">${esc((s.amenities || []).join('\n'))}</textarea></div>
      <div class="field"><label for="sCon">Emergency contacts for the Directory (Name - number)</label><textarea id="sCon" name="contacts" placeholder="Main gate - 9845000111">${esc((s.contacts || []).map(c => c.name + ' - ' + c.phone).join('\n'))}</textarea></div></div>
      <fieldset class="features"><legend>Extra screens (off keeps the app simple)</legend>
        <label class="check"><input type="checkbox" name="f_book" ${has('book') ? 'checked' : ''}> Bookings: residents book the clubhouse and other amenities</label>
        <label class="check"><input type="checkbox" name="f_acc" ${has('acc') ? 'checked' : ''}> Accounts: everyone sees money collected and spent</label>
        <label class="check"><input type="checkbox" name="f_dir" ${has('dir') ? 'checked' : ''}> Directory: list of villas and emergency numbers</label></fieldset>
      <div><button class="btn primary">Save</button></div></form></div>

    <div class="card"><h2>Villas</h2><p class="sub">${D.settings.villas} villas in the list. Residents can join only with a villa number from this list.</p>
      <form class="stack" data-form="villas-range"><div class="two">
        <div class="field"><label for="vPre">Prefix</label><input id="vPre" name="prefix" value="V-"></div>
        <div class="field"><label for="vFrom">From number</label><input id="vFrom" name="from" type="number" min="0" value="1" required></div>
        <div class="field"><label for="vTo">To number</label><input id="vTo" name="to" type="number" min="0" value="400" required></div>
        <div class="field"><label for="vPad">Digits</label><select id="vPad" name="pad"><option value="0">1, 2 … 400</option><option value="3" selected>001, 002 … 400</option></select></div></div>
        <div><button class="btn">Add villa range</button></div></form>
      <details><summary>Or paste a list (villa, owner name, type)</summary><form class="stack" data-form="villas-paste" style="margin-top:10px">
        <div class="field"><label for="vList">One villa per line</label><textarea id="vList" name="list" placeholder="V-001, Ramesh Iyer, 4 BHK&#10;V-002, Priya Nair, 3 BHK"></textarea></div>
        <div><button class="btn">Add / update villas</button></div></form></details></div>

    <div class="card"><h2>Residents</h2><p class="sub">Add residents by email in Members. Then share the app link in your WhatsApp group.</p>
      <div class="row"><button class="btn primary" data-act="go" data-v="members">Add residents</button><button class="btn" data-act="invite">Share app link</button></div></div>

    <div class="card"><h2>Backups</h2>
      <div class="row"><button class="btn primary" data-act="backup-json">Download full backup now</button><button class="btn" data-act="backup-csv">Download all bills (CSV)</button></div>
      <details><summary>Google Sheet nightly backup key</summary><div class="stack" style="margin-top:10px;display:flex;flex-direction:column;gap:10px">
        <p class="sub">Paste this key into the Google Sheet backup script (see backup/google-sheet-backup.gs). Keep it secret: anyone with it can read all society data.</p>
        <div class="secret">${esc(D.settings.key)}</div>
        <div class="row"><button class="btn small" data-act="copy" data-v="${esc(D.settings.key)}">Copy key</button><button class="btn small ghost danger" data-act="new-key">Make a new key</button></div></div></details></div>`;
  }
};

/* ================= modals ================= */
function payModal(d) {
  const s = soc();
  if (!s.upi_id) return toast('The committee has not set a UPI ID yet.', true);
  const note = `Maintenance ${mLabel(d.month)} ${cur.villas?.number || ''}`.trim();
  const link = `upi://pay?pa=${encodeURIComponent(s.upi_id)}&pn=${encodeURIComponent(s.name)}&am=${d.amount}&cu=INR&tn=${encodeURIComponent(note)}`;
  let qrsvg = '';
  try { const qr = window.qrcode(0, 'M'); qr.addData(link); qr.make(); qrsvg = qr.createSvgTag(4, 0); } catch (e) { }
  modal(`<h2>Pay ${inr(d.amount)}</h2><p class="sub">${esc(note)}. Scan with any UPI app (GPay, PhonePe, Paytm, BHIM). No fees.</p>
    ${qrsvg ? `<div class="qrbox" aria-label="UPI QR code">${qrsvg}</div>` : ''}
    <div class="upi"><code>${esc(s.upi_id)}</code><button class="btn small" data-act="copy" data-v="${esc(s.upi_id)}">Copy</button></div>
    <a class="btn" href="${esc(link)}" style="text-align:center;text-decoration:none">Open UPI app (on this phone)</a>
    <form class="stack" data-form="utr" data-v="${d.id}"><div class="field"><label for="utr">After paying, enter the 12-digit UTR / UPI reference number</label><input id="utr" name="utr" inputmode="numeric" required minlength="6" placeholder="e.g. 432198765432"></div>
    <div class="row"><button class="btn primary">I have paid</button><button type="button" class="btn ghost" data-act="close">Cancel</button></div></form>`);
}
function receiptModal(d, villaNo, owner) {
  const txt = `${soc().name}\nReceipt no. ${String(d.id).padStart(6, '0')}\n\nVilla: ${villaNo}${owner ? ' (' + owner + ')' : ''}\nFor: Maintenance ${mLabel(d.month)}\nAmount: ${inr(d.amount)}\nPaid on: ${dLabel(d.paid_on)} by ${d.mode}${d.utr ? '\nReference: ' + d.utr : ''}`;
  modal(`<h2>Receipt</h2><div class="note">${esc(txt)}</div><div class="row"><button class="btn primary" data-act="copy" data-v="${esc(txt)}">Copy</button><button class="btn ghost" data-act="close">Close</button></div>`);
}
function textModal(title, sub, txt) {
  modal(`<h2>${esc(title)}</h2><p class="sub">${esc(sub)}</p><div class="note">${esc(txt)}</div>
  <div class="row"><button class="btn primary" data-act="copy" data-v="${esc(txt)}">Copy message</button><a class="btn" target="_blank" rel="noopener" style="text-decoration:none" href="https://wa.me/?text=${encodeURIComponent(txt)}">Open WhatsApp</a><button class="btn ghost" data-act="close">Close</button></div>`);
}

/* ================= events ================= */
async function busy(btn, fn) {
  if (btn) btn.disabled = true;
  try { await fn(); } catch (e) { toast(e.message, true); } finally { if (btn && btn.isConnected) btn.disabled = false; }
}
const findDue = id => D.dues?.rows?.find(x => x.id == id) || D.home?.dues?.find(x => x.id == id);

document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]'); if (!t) return;
  const a = t.dataset.act, v = t.dataset.v;
  if (a === 'close-bg') { if (e.target === t) closeModal(); return; }
  if (t.tagName === 'SELECT' || t.tagName === 'INPUT') return;
  const go = fn => busy(t, fn);
  switch (a) {
    case 'reload': return boot();
    case 'signout': return sb.auth.signOut();
    case 'new-society': return renderNewSociety();
    case 'auth-back': ui.authStep = 'email'; return renderLogin();
    case 'show-login': if (location.hash !== '#login') location.hash = 'login'; else renderLogin(); return;
    case 'show-home': history.replaceState(null, '', location.pathname); return renderLanding();
    case 'google': return go(async () => { const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } }); if (error) throw error; });
    case 'go': ui.tab = v; ui.q = ''; window.scrollTo(0, 0); return show();
    case 'close': return closeModal();
    case 'copy': return copyText(v, t);
    case 'pay': { const d = findDue(v); return d && payModal(d); }
    case 'receipt': { const d = findDue(v); return d && receiptModal(d, d.villas?.number || cur.villas?.number || '', d.villas?.owner_name || cur.name); }
    case 'dfilter': ui.dueFilter = v; return redraw();
    case 'tfilter': ui.tFilter = v; return redraw();
    case 'invite': {
      const s = soc(), url = location.origin + location.pathname;
      return textModal('Share app link', 'Send this in your society WhatsApp group.', `🏡 ${s.name} is now on Society Hub (free).\nPay maintenance by UPI, see notices, raise complaints and book the clubhouse.\n\n1. Open ${url}\n2. Sign in with the email you gave the committee\n3. That's it. You will see our society.\n\nNot added yet? Send your villa number and email to the committee.`);
    }
    case 'remind': {
      const unpaid = D.dues.rows.filter(d => d.status === 'due').map(d => d.villas?.number);
      return textModal('Payment reminder', `${unpaid.length} villas have not paid for ${mLabel(ui.month)}.`, `🏡 ${soc().name}\nGentle reminder: maintenance of ${inr(soc().maintenance_amount)} for ${mLabel(ui.month)} is pending for ${unpaid.length} villas:\n${unpaid.join(', ')}\n\nPlease pay by UPI to ${soc().upi_id} from the society app: ${location.origin + location.pathname}\nThank you! – Committee`);
    }
    case 'gen': {
      const m = v || thisMonth();
      return modal(`<h2>Raise bills</h2><p class="sub">Creates one bill for every villa. Villas that already have a bill for this month are skipped.</p>
        <form class="stack" data-form="gen"><div class="two"><div class="field"><label for="gMonth">Month</label><input id="gMonth" type="month" name="month" value="${m.slice(0, 7)}" required></div>
        <div class="field"><label for="gAmt">Amount per villa (₹)</label><input id="gAmt" type="number" min="1" name="amount" value="${soc().maintenance_amount || ''}" required></div></div>
        <div class="row"><button class="btn primary">Raise bills</button><button type="button" class="btn ghost" data-act="close">Cancel</button></div></form>`);
    }
    case 'approve': return go(async () => { const d = findDue(v); await q(sb.from('dues').update({ status: 'paid', paid_on: todayISO(), confirmed_by: uid(), mode: d.mode || 'UPI' }).eq('id', v)); toast('Payment confirmed'); await refresh(); });
    case 'reject': return go(async () => { await q(sb.from('dues').update({ status: 'due', utr: '', mode: '', submitted_by: null }).eq('id', v)); toast('Marked as unpaid'); await refresh(); });
    case 'undo': return go(async () => { await q(sb.from('dues').update({ status: 'due', paid_on: null, mode: '', utr: '', confirmed_by: null }).eq('id', v)); toast('Payment removed'); await refresh(); });
    case 'offline': {
      const d = findDue(v);
      return modal(`<h2>Mark ${esc(d.villas?.number)} as paid</h2><p class="sub">${mLabel(d.month)} · ${inr(d.amount)}</p><form class="stack" data-form="offline" data-v="${d.id}"><div class="two">
        <div class="field"><label for="oMode">Paid by</label><select id="oMode" name="mode"><option>Cash</option><option>UPI</option><option>Cheque</option><option>Bank</option></select></div>
        <div class="field"><label for="oDate">Date</label><input id="oDate" type="date" name="paid_on" value="${todayISO()}" required></div></div>
        <div class="field"><label for="oRef">Reference (cheque / UTR, optional)</label><input id="oRef" name="utr"></div>
        <div class="row"><button class="btn primary">Mark paid</button><button type="button" class="btn ghost" data-act="close">Cancel</button></div></form>`);
    }
    case 'csv-dues': return download(`maintenance-${ui.month.slice(0, 7)}.csv`, csv([['Villa', 'Owner', 'Month', 'Amount', 'Status', 'Paid on', 'Mode', 'UTR'], ...D.dues.rows.map(d => [d.villas?.number, d.villas?.owner_name, d.month.slice(0, 7), d.amount, STATUS[d.status][0], d.paid_on || '', d.mode, d.utr])]));
    case 'csv-exp': return download('expenses.csv', csv([['Date', 'Head', 'Amount', 'Note'], ...D.acc.exps.map(e => [e.spent_on, e.head, e.amount, e.note])]));
    case 'pin': return go(async () => { await q(sb.from('notices').update({ pinned: t.dataset.p !== '1' }).eq('id', v)); await refresh(); });
    case 'del-notice': return confirmStep(t, 'Delete?', () => go(async () => { await q(sb.from('notices').delete().eq('id', v)); toast('Notice deleted'); await refresh(); }));
    case 'cancel-book': return confirmStep(t, 'Cancel it?', () => go(async () => { await q(sb.from('bookings').delete().eq('id', v)); toast('Booking cancelled'); await refresh(); }));
    case 'del-exp': return confirmStep(t, 'Delete?', () => go(async () => { await q(sb.from('expenses').delete().eq('id', v)); toast('Expense deleted'); await refresh(); }));
    case 'm-admin': return go(async () => { await q(sb.from('members').update({ role: t.dataset.r }).eq('id', v)); toast(t.dataset.r === 'admin' ? 'Now an admin' : 'Admin removed'); await refresh(); });
    case 'm-remove': return confirmStep(t, 'Remove?', () => go(async () => { await q(sb.from('members').delete().eq('id', v)); toast('Member removed'); await refresh(); }));
    case 'new-key': return confirmStep(t, 'Old key will stop. Sure?', () => go(async () => { const k = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, ''); await q(sb.from('society_secrets').update({ export_key: k }).eq('society_id', sid())); D.settings.key = k; toast('New key made. Update your Google Sheet.'); redraw(); }));
    case 'backup-json': return go(async () => { const data = await q(sb.rpc('export_society', { p_key: D.settings.key })); download(`backup-${todayISO()}.json`, JSON.stringify(data, null, 1), 'application/json'); });
    case 'backup-csv': return go(async () => { const data = await q(sb.rpc('export_society', { p_key: D.settings.key })); download(`all-bills-${todayISO()}.csv`, csv([['Month', 'Villa', 'Amount', 'Status', 'Mode', 'UTR', 'Paid on'], ...data.dues.map(d => [d.month, d.villa, d.amount, d.status, d.mode, d.utr, d.paid_on || ''])])); });
  }
});
function confirmStep(btn, label, fn) {
  if (btn.dataset.sure) return fn();
  const old = btn.textContent; btn.dataset.sure = 1; btn.textContent = label;
  setTimeout(() => { if (btn.isConnected) { delete btn.dataset.sure; btn.textContent = old; } }, 4000);
}

let searchT;
document.addEventListener('input', e => {
  const t = e.target, a = t.dataset.act;
  if (a === 'dsearch' || a === 'dirsearch' || a === 'memsearch') {
    ui.q = t.value; clearTimeout(searchT);
    searchT = setTimeout(() => {
      if (a === 'dsearch') { const qq = ui.q.trim().toLowerCase(); $('#dueRows').innerHTML = dueRows(D.dues.rows.filter(d => (ui.dueFilter === 'all' || d.status === ui.dueFilter) && (!qq || (d.villas?.number + ' ' + d.villas?.owner_name).toLowerCase().includes(qq)))); }
      else redraw();
    }, 200);
  }
});
document.addEventListener('change', e => {
  const t = e.target, a = t.dataset.act, v = t.dataset.v;
  const upd = (table, patch, msg) => busy(null, async () => { await q(sb.from(table).update(patch).eq('id', v)); toast(msg); });
  if (a === 'switch') { store.set('sh-society', t.value); cur = mems.find(m => m.society_id === t.value); ui.tab = 'home'; return renderApp(); }
  if (a === 'month') { ui.month = t.value; ui.dueFilter = 'all'; return show(); }
  if (a === 'tstatus') return upd('tickets', { status: t.value }, 'Status updated');
  if (a === 'tnote') return upd('tickets', { note: t.value }, 'Note saved');
  if (a === 'm-role') return busy(null, async () => { const self = D.members.m.find(x => x.id == v)?.user_id === uid(); try { await q(sb.from('members').update({ role: t.value }).eq('id', v)); toast('Role updated'); } catch (err) { toast(err.message, true); } self ? boot() : refresh(); });
  if (a === 'm-title') return upd('members', { title: t.value.trim() }, 'Title saved');
  if (a === 'm-villa') return upd('members', { villa_id: t.value || null }, 'Villa updated');
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

document.addEventListener('submit', e => {
  const f = e.target; if (!f.dataset.form) return; e.preventDefault();
  const d = Object.fromEntries(new FormData(f)), btn = f.querySelector('button:not([type="button"])');
  busy(btn, async () => {
    switch (f.dataset.form) {
      case 'email': {
        ui.email = d.email.trim().toLowerCase();
        const { error } = await sb.auth.signInWithOtp({ email: ui.email, options: { shouldCreateUser: true, emailRedirectTo: location.origin + location.pathname } });
        if (error) return renderLogin(/rate/i.test(error.message) ? 'Too many emails were sent. Please wait a few minutes and try again.'
          : /not registered|signups not allowed|hook/i.test(error.message) ? 'This email is not registered with any society. Please ask your committee to add you with this email.' : error.message);
        ui.authStep = 'otp'; return renderLogin();
      }
      case 'otp': {
        const { data, error } = await sb.auth.verifyOtp({ email: ui.email, token: d.otp.trim(), type: 'email' });
        if (error) return renderLogin('That code did not work. Check the latest email, or ask for a new code.');
        session = data.session; ui.authStep = 'email'; return boot();
      }
      case 'create': {
        const id = await q(sb.rpc('create_society', { p_name: d.society, p_admin_name: d.name, p_admin_email: d.email, p_phone: d.phone, p_villa_number: d.villa }));
        const mine = d.email.trim().toLowerCase() === session.user.email.toLowerCase();
        if (mine) { store.set('sh-society', id); ui.tab = 'settings'; }
        toast(mine ? 'Society created. Now add your villas.' : `Society created. ${d.email.trim()} can now sign in as its admin.`);
        return boot();
      }
      case 'member': await q(sb.from('members').insert({ society_id: sid(), villa_id: d.villa_id, name: d.name.trim(), email: d.email.trim().toLowerCase(), status: 'invited' })).catch(e => { throw /duplicate|unique/i.test(e.message) ? new Error('This email is already added.') : e; }); toast(`${d.name.trim()} added. They can sign in now.`); return refresh();
      case 'members-paste': {
        const byNo = Object.fromEntries(D.members.v.map(x => [x.number.toUpperCase(), x.id])), have = new Set(D.members.m.map(x => x.email));
        const rows = [], bad = [];
        d.list.split('\n').map(l => l.split(/[,\t]/).map(x => x.trim())).filter(p => p[0]).forEach(([no, name, email = ''], i) => {
          email = email.toLowerCase(); const vid = byNo[(no || '').toUpperCase()];
          if (!vid || !name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) bad.push(no || 'line ' + (i + 1)); else if (!have.has(email)) { have.add(email); rows.push({ society_id: sid(), villa_id: vid, name, email, status: 'invited' }); }
        });
        if (rows.length) await q(sb.from('members').insert(rows));
        toast(`${rows.length} added${bad.length ? ` · check these lines: ${bad.slice(0, 5).join(', ')}${bad.length > 5 ? '…' : ''}` : ''}`, !!bad.length); return refresh();
      }
      case 'utr': await q(sb.rpc('submit_payment', { p_due_id: +f.dataset.v, p_utr: d.utr })); closeModal(); toast('Sent to the treasurer for checking'); return refresh();
      case 'offline': await q(sb.from('dues').update({ status: 'paid', mode: d.mode, paid_on: d.paid_on, utr: d.utr.trim(), confirmed_by: uid() }).eq('id', f.dataset.v)); closeModal(); toast('Marked paid'); return refresh();
      case 'gen': { const n = await q(sb.rpc('generate_dues', { p_society: sid(), p_month: d.month + '-01', p_amount: +d.amount })); closeModal(); ui.month = d.month + '-01'; ui.tab = 'dues'; toast(n ? `${n} bills raised for ${mLabel(ui.month)}` : 'All villas already have a bill for this month'); return refresh(); }
      case 'notice': await q(sb.from('notices').insert({ society_id: sid(), title: d.title.trim(), body: d.body.trim(), tag: d.tag, pinned: !!d.pinned, is_public: !!d.is_public })); toast('Notice published'); return refresh();
      case 'ticket': await q(sb.from('tickets').insert({ society_id: sid(), villa_id: cur.villa_id, category: d.category, title: d.title.trim(), details: d.details.trim() })); toast('Complaint raised'); return refresh();
      case 'booking': await q(sb.from('bookings').insert({ society_id: sid(), villa_id: cur.villa_id, amenity: d.amenity, day: d.day, slot: d.slot, purpose: d.purpose.trim() })); toast(`Booked ${d.amenity} for ${dLabel(d.day)}`); return refresh();
      case 'expense': await q(sb.from('expenses').insert({ society_id: sid(), head: d.head, amount: +d.amount, spent_on: d.spent_on, note: d.note.trim() })); toast('Expense added'); return refresh();
      case 'society': {
        const patch = {
          name: d.name.trim(), upi_id: d.upi_id.trim(), about: d.about.trim(), features: ['book', 'acc', 'dir'].filter(k => d['f_' + k]), maintenance_amount: +d.maintenance_amount || 0, due_day: +d.due_day || 10, opening_balance: +d.opening_balance || 0, address: d.address.trim(),
          amenities: d.amenities.split('\n').map(x => x.trim()).filter(Boolean),
          contacts: d.contacts.split('\n').map(x => x.trim()).filter(Boolean).map(x => { const i = x.lastIndexOf('-'); return i > 0 ? { name: x.slice(0, i).trim(), phone: x.slice(i + 1).trim() } : { name: x, phone: '' }; })
        };
        const row = await q(sb.from('societies').update(patch).eq('id', sid()).select().single());
        cur.societies = row; toast('Saved'); return renderApp();
      }
      case 'villas-range': {
        const from = +d.from, to = +d.to, pad = +d.pad;
        if (to < from || to - from > 2000) throw new Error('Check the numbers. You can add up to 2000 villas at once.');
        const rows = []; for (let i = from; i <= to; i++) rows.push({ society_id: sid(), number: d.prefix.trim() + String(i).padStart(pad, '0') });
        await q(sb.from('villas').upsert(rows, { onConflict: 'society_id,number', ignoreDuplicates: true }));
        toast(`Villas ${rows[0].number} to ${rows[rows.length - 1].number} added`); return refresh();
      }
      case 'villas-paste': {
        const rows = d.list.split('\n').map(l => l.split(/[,\t]/).map(x => x.trim())).filter(p => p[0]).map(([number, owner_name = '', villa_type = '']) => ({ society_id: sid(), number, owner_name, villa_type }));
        if (!rows.length) throw new Error('Paste at least one line.');
        await q(sb.from('villas').upsert(rows, { onConflict: 'society_id,number' }));
        toast(`${rows.length} villas saved`); return refresh();
      }
    }
  });
});

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
boot();
