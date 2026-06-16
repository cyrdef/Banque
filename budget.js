// ─── IMPORTS FIREBASE (ESM) ───────────────────────────────────────────────────
import { initializeApp }    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, doc, getDocs,
  setDoc, deleteDoc, onSnapshot, query, where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyAflr5Pa_aujkFcSsJ43H8LiAw_vU51Ffw",
  authDomain:        "banquecyrille-a9055.firebaseapp.com",
  projectId:         "banquecyrille-a9055",
  storageBucket:     "banquecyrille-a9055.firebasestorage.app",
  messagingSenderId: "1083349423488",
  appId:             "1:1083349423488:web:1b7df80c5affbadeaadd65"
};

// ─── CONSTANTES UI ────────────────────────────────────────────────────────────
const EMOJIS = ['🏠','🛒','🚗','💊','🎉','👕','📱','💡','🏋️','🍕','✈️','📚',
                '🐶','🌿','🔧','💼','🎓','🏥','🚌','🏦','🎮','💈','🧹','🌊',
                '🎵','🍷','☕','🛁','🏡','📦'];
const COLORS  = ['#2C5F8A','#1D7A4F','#B03A2E','#8A6200','#6B3FA0','#1A7A7A',
                 '#C45C20','#4A7A1A','#A0356B','#2A6A8A','#555','#7A4A1A'];

// ─── STATE ────────────────────────────────────────────────────────────────────
let settings    = JSON.parse(localStorage.getItem('appSettings') || '{"name":"Mon Budget","currency":"EUR","income":0}');
let db, auth, unsubTxns;
let categories  = [];
let transactions = [];
let selectedEmoji = '📦';
let selectedColor = COLORS[0];
let pieChart, barChart;

const now = new Date();
let curYear  = now.getFullYear();
let curMonth = now.getMonth();

// ─── TOAST ────────────────────────────────────────────────────────────────────
export function toast(type, title, msg = '') {
  const icons = {
    success: 'ti-circle-check',
    error:   'ti-alert-circle',
    info:    'ti-info-circle',
    warn:    'ti-alert-triangle'
  };
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `
    <i class="ti ${icons[type] || 'ti-info-circle'} toast-icon"></i>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${msg ? `<div class="toast-msg">${msg}</div>` : ''}
    </div>
    <button class="toast-close" data-dismiss><i class="ti ti-x"></i></button>
  `;
  el.querySelector('[data-dismiss]').addEventListener('click', () => dismissToast(el));
  container.appendChild(el);
  setTimeout(() => dismissToast(el), 4500);
}

function dismissToast(el) {
  if (!el || !el.parentElement) return;
  el.classList.add('hide');
  setTimeout(() => el.remove(), 300);
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
function init() {
  try {
    const app = initializeApp(FIREBASE_CONFIG);
    db   = getFirestore(app);
    auth = getAuth(app);

    onAuthStateChanged(auth, user => {
      if (!user) { window.location.href = 'login.html'; return; }
      document.getElementById('loadingScreen').style.display = 'none';
      document.getElementById('navUserEmail').textContent = user.email;
      toast('success', 'Connecté', `Bienvenue ${user.email} !`);
      updateMonthLabel();
      buildEmojiGrid();
      buildColorGrid();
      loadSettingsUI();
      listenCategories();
    });
  } catch (e) {
    document.getElementById('loadingScreen').innerHTML =
      `<p style="color:var(--red);font-size:13px;">Erreur Firebase : ${e.message}</p>`;
  }
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
async function doLogout() {
  try {
    await signOut(auth);
    toast('info', 'Déconnecté', 'À bientôt !');
    setTimeout(() => { window.location.href = 'login.html'; }, 700);
  } catch (e) { toast('error', 'Erreur', e.message); }
}

// ─── FIRESTORE LISTENERS ──────────────────────────────────────────────────────
function listenCategories() {
  onSnapshot(collection(db, 'categories'), snap => {
    categories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    listenTransactions();
    updateCatFilter();
  });
}

function listenTransactions() {
  if (unsubTxns) unsubTxns();
  const q = query(collection(db, 'transactions'), where('monthKey', '==', monthStr()));
  unsubTxns = onSnapshot(q, snap => {
    transactions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    transactions.sort((a, b) => b.date.localeCompare(a.date));
    render();
  });
  loadYearData();
}

// ─── RENDER ───────────────────────────────────────────────────────────────────
function render() {
  renderMetrics();
  renderAlerts();
  renderCats();
  renderTxns();
  renderPie();
}

function renderMetrics() {
  const totalBudget = categories.reduce((s, c) => s + (c.budget || 0), 0);
  const totalSpent  = sumDebits();
  const left = totalBudget - totalSpent;
  const pct  = totalBudget ? Math.round(totalSpent / totalBudget * 100) : 0;

  document.getElementById('m-budget').textContent     = fmt(totalBudget);
  document.getElementById('m-budget-sub').textContent = `Revenus : ${fmt(settings.income || 0)}`;
  document.getElementById('m-spent').textContent      = fmt(totalSpent);
  document.getElementById('m-spent-sub').textContent  = `${pct}% du budget prévu`;

  const mLeft = document.getElementById('m-left');
  mLeft.textContent = fmt(Math.abs(left));
  mLeft.className   = 'metric-value ' + (left >= 0 ? 'green' : 'red');
  document.getElementById('m-left-sub').textContent = left >= 0 ? 'disponible' : 'dépassement';
}

function renderAlerts() {
  const box = document.getElementById('alerts');
  box.innerHTML = '';
  categories.forEach(cat => {
    if (!cat.budget) return;
    const spent = spentByCat(cat.id);
    const pct   = spent / cat.budget * 100;
    if (pct >= 100) {
      box.innerHTML += `<div class="alert alert-over"><i class="ti ti-alert-circle"></i>
        <strong>${cat.emoji || '📦'} ${cat.name}</strong> — budget dépassé de ${fmt(spent - cat.budget)}</div>`;
    } else if (pct >= 80) {
      box.innerHTML += `<div class="alert alert-warn"><i class="ti ti-alert-triangle"></i>
        <strong>${cat.emoji || '📦'} ${cat.name}</strong> — ${Math.round(pct)}% du budget utilisé</div>`;
    }
  });
}

function renderCats() {
  const el = document.getElementById('catList');
  if (!categories.length) {
    el.innerHTML = `<div class="empty"><i class="ti ti-layout-grid"></i>
      <p>Aucune catégorie.<br>Ajoute-en une pour commencer.</p></div>`;
    return;
  }
  el.innerHTML = categories.map(cat => {
    const spent = spentByCat(cat.id);
    const budget = cat.budget || 0;
    const pct    = budget ? Math.min(spent / budget * 100, 100) : 0;
    const over   = budget && spent > budget;
    const warn   = budget && spent / budget >= 0.8 && !over;
    const fillClass = over ? 'over' : warn ? 'warn' : 'ok';
    const badge  = over
      ? `<span class="badge badge-over">Dépassé</span>`
      : warn ? `<span class="badge badge-warn">Attention</span>` : '';
    return `<div class="cat-row">
      <div class="cat-icon" style="background:${cat.color}22">${cat.emoji || '📦'}</div>
      <div class="cat-info">
        <div class="cat-name">${esc(cat.name)} ${badge}</div>
        <div class="cat-amounts">${fmt(spent)} / ${budget ? fmt(budget) : 'pas de limite'}</div>
        ${budget ? `<div class="progress-bar">
          <div class="progress-fill ${fillClass}" style="width:${pct}%"></div></div>` : ''}
      </div>
      <div class="cat-actions">
        <button class="icon-btn" data-action="editBudget" data-id="${cat.id}" title="Modifier le budget"><i class="ti ti-target"></i></button>
        <button class="icon-btn" data-action="editCat"    data-id="${cat.id}" title="Modifier"><i class="ti ti-pencil"></i></button>
        <button class="icon-btn danger" data-action="deleteCat" data-id="${cat.id}" title="Supprimer"><i class="ti ti-trash"></i></button>
      </div>
    </div>`;
  }).join('');
}

function renderTxns() {
  const el     = document.getElementById('txnList');
  const search = document.getElementById('searchInput').value.toLowerCase();
  const catF   = document.getElementById('catFilter').value;
  const txns   = transactions.filter(t => {
    const matchSearch = !search || t.desc.toLowerCase().includes(search) || (t.note || '').toLowerCase().includes(search);
    const matchCat    = !catF   || t.catId === catF;
    return matchSearch && matchCat;
  });
  if (!txns.length) {
    el.innerHTML = `<div class="empty"><i class="ti ti-inbox"></i><p>Aucune transaction ce mois.</p></div>`;
    return;
  }
  el.innerHTML = txns.map(t => {
    const cat = categories.find(c => c.id === t.catId) || { emoji: '📦', color: '#888', name: 'Autre' };
    const d   = t.date ? new Date(t.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '';
    return `<div class="txn-row">
      <div class="txn-icon" style="background:${cat.color}22">${cat.emoji || '📦'}</div>
      <div class="txn-info">
        <div class="txn-desc">${esc(t.desc)}</div>
        <div class="txn-meta">${d} · ${esc(cat.name)}${t.note ? ' · ' + esc(t.note) : ''}</div>
      </div>
      <div class="txn-amount ${t.type === 'credit' ? 'credit' : 'debit'}">
        ${t.type === 'credit' ? '+' : '-'}${fmt(t.amount)}
      </div>
      <button class="icon-btn" data-action="editTxn"   data-id="${t.id}" title="Modifier"><i class="ti ti-pencil"></i></button>
      <button class="icon-btn danger" data-action="deleteTxn" data-id="${t.id}" title="Supprimer"><i class="ti ti-trash"></i></button>
    </div>`;
  }).join('');
}

function renderPie() {
  const ctx  = document.getElementById('pieChart').getContext('2d');
  const cats = categories.filter(c => spentByCat(c.id) > 0);
  if (pieChart) pieChart.destroy();
  if (!cats.length) return;
  pieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: cats.map(c => `${c.emoji || ''} ${c.name}`),
      datasets: [{
        data: cats.map(c => spentByCat(c.id)),
        backgroundColor: cats.map(c => (c.color || '#888') + 'CC'),
        borderColor: cats.map(c => c.color || '#888'),
        borderWidth: 1.5
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { font: { size: 11, family: 'Inter' }, boxWidth: 12, padding: 10 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${fmt(ctx.raw)}` } }
      }
    }
  });
}

async function loadYearData() {
  const months = Array.from({ length: 12 }, (_, i) => `${curYear}-${String(i + 1).padStart(2, '0')}`);
  const snaps  = await Promise.all(months.map(m =>
    getDocs(query(collection(db, 'transactions'), where('monthKey', '==', m)))));
  const totals = snaps.map(s =>
    s.docs.map(d => d.data()).filter(t => t.type === 'debit').reduce((sum, t) => sum + t.amount, 0));
  renderBar(months, totals);
}

function renderBar(months, totals) {
  const ctx    = document.getElementById('barChart').getContext('2d');
  const labels = months.map(m => new Date(m + '-01').toLocaleDateString('fr-FR', { month: 'short' }));
  const colors = months.map((_, i) => i === curMonth ? '#2C5F8A' : '#2C5F8ACC');
  if (barChart) barChart.destroy();
  barChart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Dépenses', data: totals, backgroundColor: colors, borderRadius: 5, borderSkipped: false }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { ticks: { callback: v => fmt(v), font: { size: 10 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
        x: { ticks: { font: { size: 11 }, autoSkip: false }, grid: { display: false } }
      }
    }
  });
}

// ─── CRUD TRANSACTIONS ────────────────────────────────────────────────────────
async function saveTxn() {
  const desc   = v('txn-desc').trim();
  const amount = parseFloat(v('txn-amount')) || 0;
  const date   = v('txn-date');
  const catId  = v('txn-cat');
  const type   = v('txn-type');
  const note   = v('txn-note').trim();
  if (!desc || !amount) { toast('error', 'Champs manquants', 'Remplis la description et le montant.'); return; }
  const editId   = v('txnEditId');
  const isEdit   = !!editId;
  const id       = editId || auto();
  const monthKey = date ? date.substring(0, 7) : monthStr();
  try {
    await setDoc(doc(db, 'transactions', id), { desc, amount, date, catId, type, note, monthKey });
    toast('success', isEdit ? 'Transaction modifiée' : 'Transaction ajoutée', `${desc} · ${fmt(amount)}`);
    closeModal('addTxn');
    clearTxnForm();
  } catch (e) { toast('error', 'Erreur', e.message); }
}

async function deleteTxn(id) {
  const t = transactions.find(x => x.id === id);
  if (!confirm('Supprimer cette transaction ?')) return;
  try {
    await deleteDoc(doc(db, 'transactions', id));
    toast('info', 'Transaction supprimée', t ? t.desc : '');
  } catch (e) { toast('error', 'Erreur', e.message); }
}

function openEditTxn(id) {
  const t = transactions.find(x => x.id === id);
  if (!t) return;
  document.getElementById('txnModalTitle').textContent = 'Modifier la transaction';
  document.getElementById('txnEditId').value = id;
  set('txn-desc', t.desc); set('txn-amount', t.amount);
  set('txn-date', t.date || ''); set('txn-type', t.type); set('txn-note', t.note || '');
  updateCatSelect();
  document.getElementById('txn-cat').value = t.catId || '';
  openModal('addTxn');
}

// ─── CRUD CATEGORIES ──────────────────────────────────────────────────────────
async function saveCat() {
  const name   = v('cat-name').trim();
  const budget = parseFloat(v('cat-budget')) || 0;
  if (!name) { toast('error', 'Nom manquant', 'Donne un nom à la catégorie.'); return; }
  const editId = v('catEditId');
  const isEdit = !!editId;
  const id     = editId || auto();
  try {
    await setDoc(doc(db, 'categories', id), { name, emoji: selectedEmoji, color: selectedColor, budget });
    toast('success', isEdit ? 'Catégorie modifiée' : 'Catégorie créée', `${selectedEmoji} ${name}`);
    closeModal('addCat');
    clearCatForm();
  } catch (e) { toast('error', 'Erreur', e.message); }
}

async function deleteCat(id) {
  const c = categories.find(x => x.id === id);
  if (!confirm('Supprimer cette catégorie ? Les transactions liées resteront.')) return;
  try {
    await deleteDoc(doc(db, 'categories', id));
    toast('info', 'Catégorie supprimée', c ? `${c.emoji || ''} ${c.name}` : '');
  } catch (e) { toast('error', 'Erreur', e.message); }
}

function openEditCat(id) {
  const c = categories.find(x => x.id === id);
  if (!c) return;
  document.getElementById('catModalTitle').textContent = 'Modifier la catégorie';
  document.getElementById('catEditId').value = id;
  set('cat-name', c.name); set('cat-budget', c.budget || '');
  selectedEmoji = c.emoji || '📦'; selectedColor = c.color || COLORS[0];
  buildEmojiGrid(); buildColorGrid();
  openModal('addCat');
}

function openEditBudget(id) {
  const c = categories.find(x => x.id === id);
  if (!c) return;
  document.getElementById('editBudgetCatId').value = id;
  document.getElementById('editBudgetCatName').textContent = `${c.emoji || ''} ${c.name}`;
  set('editBudgetVal', c.budget || '');
  openModal('editBudget');
}

async function saveBudget() {
  const id  = v('editBudgetCatId');
  const cat = categories.find(c => c.id === id);
  if (!cat) return;
  try {
    await setDoc(doc(db, 'categories', id), { ...cat, budget: parseFloat(v('editBudgetVal')) || 0 });
    toast('success', 'Budget mis à jour', `${cat.emoji || ''} ${cat.name}`);
    closeModal('editBudget');
  } catch (e) { toast('error', 'Erreur', e.message); }
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
function loadSettingsUI() {
  set('s-name',             settings.name || 'Mon Budget');
  set('s-currency',         settings.currency || 'EUR');
  set('s-income',           settings.income || '');
  set('s-apiKey',           FIREBASE_CONFIG.apiKey);
  set('s-projectId',        FIREBASE_CONFIG.projectId);
  set('s-authDomain',       FIREBASE_CONFIG.authDomain);
  set('s-appId',            FIREBASE_CONFIG.appId);
}

function saveSettings() {
  settings = { name: v('s-name'), currency: v('s-currency'), income: parseFloat(v('s-income')) || 0 };
  localStorage.setItem('appSettings', JSON.stringify(settings));
  toast('success', 'Paramètres sauvegardés');
  closeModal('settings');
  renderMetrics();
}

// ─── NAVIGATION MOIS ──────────────────────────────────────────────────────────
function changeMonth(d) {
  curMonth += d;
  if (curMonth > 11) { curMonth = 0; curYear++; }
  if (curMonth < 0)  { curMonth = 11; curYear--; }
  updateMonthLabel();
  listenTransactions();
  toast('info', 'Navigation',
    new Date(curYear, curMonth, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }));
}

function updateMonthLabel() {
  const label = new Date(curYear, curMonth, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  document.getElementById('monthLabel').textContent = label.charAt(0).toUpperCase() + label.slice(1);
}

// ─── MODALS ───────────────────────────────────────────────────────────────────
function openModal(name) {
  if (name === 'addTxn') {
    document.getElementById('txnModalTitle').textContent = 'Nouvelle transaction';
    document.getElementById('txnEditId').value = '';
    set('txn-date', new Date().toISOString().split('T')[0]);
    updateCatSelect();
  }
  if (name === 'settings') loadSettingsUI();
  document.getElementById('modal-' + name).classList.add('open');
}

function closeModal(name) {
  document.getElementById('modal-' + name).classList.remove('open');
}

function switchTab(tab) {
  ['general', 'firebase'].forEach(t => {
    document.getElementById('tab-content-' + t).style.display = t === tab ? '' : 'none';
    document.getElementById('tab-' + t).classList.toggle('active', t === tab);
  });
}

// ─── UI HELPERS ───────────────────────────────────────────────────────────────
function updateCatSelect() {
  document.getElementById('txn-cat').innerHTML =
    categories.map(c => `<option value="${c.id}">${c.emoji || '📦'} ${esc(c.name)}</option>`).join('');
}

function updateCatFilter() {
  document.getElementById('catFilter').innerHTML =
    '<option value="">Toutes les cat.</option>' +
    categories.map(c => `<option value="${c.id}">${c.emoji || '📦'} ${esc(c.name)}</option>`).join('');
}

function buildEmojiGrid() {
  document.getElementById('emojiGrid').innerHTML =
    EMOJIS.map(e => `<div class="emoji-opt ${e === selectedEmoji ? 'selected' : ''}" data-emoji="${e}">${e}</div>`).join('');
}

function buildColorGrid() {
  document.getElementById('colorGrid').innerHTML =
    COLORS.map(c => `<div class="color-swatch ${c === selectedColor ? 'selected' : ''}" style="background:${c}" data-color="${c}" title="${c}"></div>`).join('');
}

function clearTxnForm() { ['txn-desc', 'txn-amount', 'txn-note'].forEach(id => set(id, '')); }
function clearCatForm() {
  set('cat-name', ''); set('cat-budget', '');
  document.getElementById('catEditId').value = '';
  selectedEmoji = '📦'; selectedColor = COLORS[0];
  buildEmojiGrid(); buildColorGrid();
}

// ─── UTILS ────────────────────────────────────────────────────────────────────
function monthStr()       { return `${curYear}-${String(curMonth + 1).padStart(2, '0')}`; }
function spentByCat(catId){ return transactions.filter(t => t.catId === catId && t.type === 'debit').reduce((s, t) => s + t.amount, 0); }
function sumDebits()      { return transactions.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0); }
function auto()           { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function v(id)            { return document.getElementById(id)?.value || ''; }
function set(id, val)     { const el = document.getElementById(id); if (el) el.value = val; }
function esc(s)           { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmt(n) {
  const sym   = { EUR: '€', USD: '$', CHF: 'CHF ', GBP: '£', MAD: 'MAD ' }[settings.currency || 'EUR'] || '€';
  const after = ['EUR', 'GBP', 'USD'].includes(settings.currency);
  const s     = Math.abs(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return after ? `${s} ${sym}`.trim() : `${sym}${s}`;
}

// ─── EVENT DELEGATION (remplace tous les onclick="") ──────────────────────────
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;
  if (action === 'editTxn')    openEditTxn(id);
  if (action === 'deleteTxn')  deleteTxn(id);
  if (action === 'editCat')    openEditCat(id);
  if (action === 'deleteCat')  deleteCat(id);
  if (action === 'editBudget') openEditBudget(id);
});

document.addEventListener('click', e => {
  const emoji = e.target.closest('[data-emoji]');
  if (emoji) { selectedEmoji = emoji.dataset.emoji; buildEmojiGrid(); return; }
  const color = e.target.closest('[data-color]');
  if (color) { selectedColor = color.dataset.color; buildColorGrid(); return; }
});

// ─── BINDINGS NAVIGATION & MODALS ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Nav mois
  document.querySelector('[data-prev-month]')?.addEventListener('click', () => changeMonth(-1));
  document.querySelector('[data-next-month]')?.addEventListener('click', () => changeMonth(1));

  // Boutons nav principaux
  document.getElementById('btn-addTxn')    ?.addEventListener('click', () => openModal('addTxn'));
  document.getElementById('btn-settings')  ?.addEventListener('click', () => openModal('settings'));
  document.getElementById('btn-addCat')    ?.addEventListener('click', () => openModal('addCat'));
  document.getElementById('btn-logout')    ?.addEventListener('click', doLogout);

  // Modals save/cancel
  document.getElementById('btn-saveTxn')   ?.addEventListener('click', saveTxn);
  document.getElementById('btn-cancelTxn') ?.addEventListener('click', () => closeModal('addTxn'));
  document.getElementById('btn-saveCat')   ?.addEventListener('click', saveCat);
  document.getElementById('btn-cancelCat') ?.addEventListener('click', () => closeModal('addCat'));
  document.getElementById('btn-saveBudget')    ?.addEventListener('click', saveBudget);
  document.getElementById('btn-cancelBudget')  ?.addEventListener('click', () => closeModal('editBudget'));
  document.getElementById('btn-saveSettings')  ?.addEventListener('click', saveSettings);
  document.getElementById('btn-cancelSettings')?.addEventListener('click', () => closeModal('settings'));

  // Tabs paramètres
  document.getElementById('tab-general') ?.addEventListener('click', () => switchTab('general'));
  document.getElementById('tab-firebase')?.addEventListener('click', () => switchTab('firebase'));

  // Fermeture modals au clic overlay
  document.querySelectorAll('.modal-overlay').forEach(m =>
    m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); }));

  // Recherche / filtre transactions
  document.getElementById('searchInput')?.addEventListener('input', renderTxns);
  document.getElementById('catFilter')  ?.addEventListener('change', renderTxns);
});

// ─── DÉMARRAGE ────────────────────────────────────────────────────────────────
init();
