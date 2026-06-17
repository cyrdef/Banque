// ─── IMPORTS FIREBASE (ESM) ───────────────────────────────────────────────────
import { initializeApp }    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc,
  updateDoc, deleteDoc, onSnapshot, query, where, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
// ⚠️  Remplace par ta propre config Firebase
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAflr5Pa_aujkFcSsJ43H8LiAw_vU51Ffw",
  authDomain: "banquecyrille-a9055.firebaseapp.com",
  projectId: "banquecyrille-a9055",
  storageBucket: "banquecyrille-a9055.firebasestorage.app",
  messagingSenderId: "1083349423488",
  appId: "1:1083349423488:web:1b7df80c5affbadeaadd65"
};

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
const EMOJIS = ['🏠','🛒','🚗','💊','🎉','👕','📱','💡','🏋️','🍕','✈️','📚',
                '🐶','🌿','🔧','💼','🎓','🏥','🚌','🏦','🎮','💈','🧹','🌊',
                '🎵','🍷','☕','🛁','🏡','📦'];

const ACCOUNT_ICONS = ['🏦','💳','💰','🏡','📱','✈️','🛒','🎓','💼','🏥',
                       '🚗','🌿','🎵','🍷','☕','🏋️','🐶','🎮','🧹','📦'];

const COLORS = ['#2C5F8A','#1D7A4F','#B03A2E','#8A6200','#6B3FA0','#1A7A7A',
                '#C45C20','#4A7A1A','#A0356B','#2A6A8A','#555','#7A4A1A'];

const ACCOUNT_TYPE_LABELS = {
  courant: 'Compte courant', epargne: 'Épargne / Livret',
  joint: 'Compte joint', carte: 'Carte prépayée', autre: 'Autre'
};

const RECUR_FREQ_LABELS = {
  monthly: 'Chaque mois', bimonthly: 'Tous les 2 mois',
  quarterly: 'Tous les trimestres', yearly: 'Chaque année'
};

// ─── STATE ────────────────────────────────────────────────────────────────────
let settings = JSON.parse(localStorage.getItem('appSettings') || '{"name":"Mon Foyer","currency":"EUR","income":0}');
let db, auth, uid;
let unsubTxns, unsubRecurrents, unsubCats, unsubAccounts;

let accounts     = [];   // tous les comptes du foyer
let categories   = [];   // catégories du compte courant
let transactions = [];   // transactions du compte courant (mois en cours)
let recurrents   = [];   // récurrents du compte courant

let curAccountId = null;
let selectedEmoji = '📦';
let selectedColor = COLORS[0];
let selectedAccountIcon  = '🏦';
let selectedAccountColor = COLORS[0];
let accountToDelete = null;

let pieChart, barChart;
let yearCache = { year: null, accountId: null, totals: null };

const now = new Date();
let curYear  = now.getFullYear();
let curMonth = now.getMonth();

// ─── TOAST ────────────────────────────────────────────────────────────────────
function toast(type, title, msg = '') {
  const icons = { success: 'ti-circle-check', error: 'ti-alert-circle', info: 'ti-info-circle', warn: 'ti-alert-triangle' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `
    <i class="ti ${icons[type]||'ti-info-circle'} toast-icon"></i>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${msg ? `<div class="toast-msg">${msg}</div>` : ''}
    </div>
    <button class="toast-close" data-dismiss><i class="ti ti-x"></i></button>`;
  el.querySelector('[data-dismiss]').addEventListener('click', () => dismissToast(el));
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => dismissToast(el), 4500);
}
function dismissToast(el) {
  if (!el?.parentElement) return;
  el.classList.add('hide');
  setTimeout(() => el.remove(), 300);
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
function init() {
  try {
    const app = initializeApp(FIREBASE_CONFIG);
    db   = getFirestore(app);
    auth = getAuth(app);
    onAuthStateChanged(auth, async user => {
      if (!user) { window.location.href = 'login.html'; return; }
      uid = user.uid;
      await loadSettings();
      document.getElementById('navUserEmail').textContent = user.email;
      document.getElementById('loadingScreen').style.display = 'none';
      toast('success', 'Connecté', `Bienvenue !`);
      updateMonthLabel();
      buildEmojiGrid();
      buildColorGrid();
      buildAccountIconGrid();
      buildAccountColorGrid();
      loadSettingsUI();
      listenAccounts();
    });
  } catch (e) {
    document.getElementById('loadingScreen').innerHTML =
      `<p style="color:var(--red);font-size:13px;">Erreur Firebase : ${e.message}</p>`;
  }
}

async function doLogout() {
  try { await signOut(auth); window.location.href = 'login.html'; }
  catch (e) { toast('error', 'Erreur', e.message); }
}

// ─── COMPTES ──────────────────────────────────────────────────────────────────
function listenAccounts() {
  if (unsubAccounts) unsubAccounts();
  const q = query(collection(db, 'accounts'), where('uid', '==', uid));
  unsubAccounts = onSnapshot(q, async snap => {
    accounts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    accounts.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    // Créer un compte par défaut si aucun n'existe
    if (!accounts.length) {
      await createDefaultAccount();
      return; // listenAccounts sera rappelé par le snapshot
    }

    // Sélectionner le dernier compte utilisé ou le premier
    const saved = localStorage.getItem('lastAccountId_' + uid);
    if (saved && accounts.find(a => a.id === saved)) {
      curAccountId = saved;
    } else {
      curAccountId = accounts[0].id;
    }

    renderAccountSelector();
    renderAccountCards();
    renderFoyerBanner();
    renderAccountModalList();
    listenCategories();
    listenRecurrents();
  });
}

async function createDefaultAccount() {
  const id = auto();
  await setDoc(doc(db, 'accounts', id), {
    uid, name: 'Compte principal', icon: '🏦', color: '#2C5F8A',
    type: 'courant', initialBalance: 0, note: '', createdAt: Date.now()
  });
}

async function saveAccount() {
  const name    = v('acc-name').trim();
  const type    = v('acc-type');
  const balance = parseFloat(v('acc-balance')) || 0;
  const note    = v('acc-note').trim();
  if (!name) { toast('error', 'Nom manquant', 'Donne un nom à ce compte.'); return; }

  const editId = v('accountEditId');
  const isEdit = !!editId;
  const id = editId || auto();

  try {
    const data = {
      uid, name, type, initialBalance: balance, note,
      icon: selectedAccountIcon, color: selectedAccountColor,
      createdAt: isEdit ? (accounts.find(a=>a.id===editId)?.createdAt || Date.now()) : Date.now()
    };
    await setDoc(doc(db, 'accounts', id), data);
    toast('success', isEdit ? 'Compte modifié' : 'Compte créé', `${selectedAccountIcon} ${name}`);
    closeModal('editAccount');
    if (!isEdit) switchAccount(id);
  } catch (e) { toast('error', 'Erreur', e.message); }
}

async function deleteAccountConfirmed() {
  if (!accountToDelete) return;
  const id = accountToDelete;
  try {
    const batch = writeBatch(db);
    // Supprimer catégories, transactions, récurrents liés
    const [catSnap, txnSnap, recSnap] = await Promise.all([
      getDocs(query(collection(db, 'categories'),   where('uid','==',uid), where('accountId','==',id))),
      getDocs(query(collection(db, 'transactions'), where('uid','==',uid), where('accountId','==',id))),
      getDocs(query(collection(db, 'recurrents'),   where('uid','==',uid), where('accountId','==',id)))
    ]);
    [...catSnap.docs, ...txnSnap.docs, ...recSnap.docs].forEach(d => batch.delete(d.ref));
    batch.delete(doc(db, 'accounts', id));
    await batch.commit();
    toast('info', 'Compte supprimé');
    accountToDelete = null;
    closeModal('deleteAccount');
    // Si c'était le compte courant, basculer sur un autre
    if (curAccountId === id) {
      const remaining = accounts.filter(a => a.id !== id);
      if (remaining.length) switchAccount(remaining[0].id);
    }
  } catch (e) { toast('error', 'Erreur', e.message); }
}

function switchAccount(id) {
  if (!accounts.find(a => a.id === id)) return;
  curAccountId = id;
  localStorage.setItem('lastAccountId_' + uid, id);
  yearCache = { year: null, accountId: null, totals: null };
  // Re-render selector
  const sel = document.getElementById('accountSelector');
  if (sel) sel.value = id;
  renderAccountCards();
  renderFoyerBanner();
  listenCategories();
  listenRecurrents();
  const acc = accounts.find(a => a.id === id);
  if (acc) toast('info', acc.icon + ' ' + acc.name);
}

// ─── SOLDE COMPTE ─────────────────────────────────────────────────────────────
async function getAccountBalance(accountId) {
  const acc = accounts.find(a => a.id === accountId);
  if (!acc) return 0;
  // Toutes les transactions de ce compte (tous mois)
  const snap = await getDocs(query(
    collection(db, 'transactions'),
    where('uid', '==', uid),
    where('accountId', '==', accountId)
  ));
  const txns = snap.docs.map(d => d.data());
  const totalCredit = txns.filter(t => t.type === 'credit').reduce((s,t) => s + t.amount, 0);
  const totalDebit  = txns.filter(t => t.type === 'debit' ).reduce((s,t) => s + t.amount, 0);
  return (acc.initialBalance || 0) + totalCredit - totalDebit;
}

// ─── FOYER BANNER ─────────────────────────────────────────────────────────────
async function renderFoyerBanner() {
  if (!accounts.length) return;
  let totalSolde = 0;
  let totalSpentMonth = 0;
  let totalCreditMonth = 0;
  const key = monthStr();

  for (const acc of accounts) {
    const bal = await getAccountBalance(acc.id);
    totalSolde += bal;

    const snap = await getDocs(query(
      collection(db, 'transactions'),
      where('uid', '==', uid),
      where('accountId', '==', acc.id),
      where('monthKey', '==', key)
    ));
    snap.docs.forEach(d => {
      const t = d.data();
      if (t.type === 'debit')  totalSpentMonth  += t.amount;
      if (t.type === 'credit') totalCreditMonth += t.amount;
    });
  }

  document.getElementById('fb-solde').textContent = fmt(totalSolde);
  document.getElementById('fb-solde').className = 'foyer-banner-value ' + (totalSolde >= 0 ? '' : 'red');
  document.getElementById('fb-comptes').textContent = `${accounts.length} compte${accounts.length > 1 ? 's' : ''}`;
  document.getElementById('fb-spent').textContent = fmt(totalSpentMonth);
  const epargne = totalCreditMonth - totalSpentMonth;
  document.getElementById('fb-epargne').textContent = fmt(Math.abs(epargne));
  document.getElementById('fb-epargne').style.color = epargne >= 0 ? 'rgba(255,255,255,0.9)' : '#ffb3a7';
}

// ─── ACCOUNT CARDS ────────────────────────────────────────────────────────────
async function renderAccountCards() {
  const el = document.getElementById('accountCards');
  if (!el) return;

  let html = '<div class="grid-4" style="margin-bottom:4px;">';
  for (const acc of accounts) {
    const bal = await getAccountBalance(acc.id);
    const isActive = acc.id === curAccountId;
    html += `
    <div class="account-card ${isActive ? 'active' : ''}" data-action="switchAccount" data-id="${acc.id}">
      <div class="account-card-accent" style="background:${acc.color}"></div>
      <div class="account-card-header">
        <div class="account-card-icon">${acc.icon || '🏦'}</div>
        <div class="account-card-info">
          <div class="account-card-name">${esc(acc.name)}</div>
          <div class="account-card-type">${ACCOUNT_TYPE_LABELS[acc.type] || acc.type}</div>
        </div>
      </div>
      <div class="account-card-balance ${bal >= 0 ? 'positive' : 'negative'}">${fmt(bal)}</div>
      <div class="account-card-sub">Solde actuel</div>
      ${isActive ? `<div class="account-card-actions">
        <button class="icon-btn" data-action="editAccount" data-id="${acc.id}" title="Modifier"><i class="ti ti-pencil"></i></button>
        ${accounts.length > 1 ? `<button class="icon-btn danger" data-action="deleteAccount" data-id="${acc.id}" title="Supprimer"><i class="ti ti-trash"></i></button>` : ''}
      </div>` : ''}
    </div>`;
  }
  html += `
    <div class="account-card-add" data-action="openAddAccount">
      <i class="ti ti-plus"></i>
      <span>Ajouter un compte</span>
    </div>`;
  html += '</div>';
  el.innerHTML = html;
}

function renderAccountSelector() {
  const sel = document.getElementById('accountSelector');
  if (!sel) return;
  sel.innerHTML = accounts.map(a =>
    `<option value="${a.id}" ${a.id === curAccountId ? 'selected' : ''}>${a.icon || '🏦'} ${esc(a.name)}</option>`
  ).join('');
}

function renderAccountModalList() {
  const el = document.getElementById('accountModalList');
  if (!el) return;
  if (!accounts.length) {
    el.innerHTML = `<div class="empty"><i class="ti ti-wallet"></i><p>Aucun compte.</p></div>`;
    return;
  }
  el.innerHTML = accounts.map(acc => `
    <div class="account-list-row">
      <div class="account-list-dot" style="background:${acc.color}"></div>
      <div style="font-size:18px">${acc.icon || '🏦'}</div>
      <div class="account-list-info">
        <div class="account-list-name">${esc(acc.name)}</div>
        <div class="account-list-meta">${ACCOUNT_TYPE_LABELS[acc.type] || acc.type}${acc.note ? ' · ' + esc(acc.note) : ''}</div>
      </div>
      <div style="display:flex;gap:6px;align-items:center;">
        <button class="icon-btn" data-action="editAccount" data-id="${acc.id}" title="Modifier"><i class="ti ti-pencil"></i></button>
        ${accounts.length > 1 ? `<button class="icon-btn danger" data-action="deleteAccount" data-id="${acc.id}" title="Supprimer"><i class="ti ti-trash"></i></button>` : ''}
      </div>
    </div>`).join('');
}

function openAddAccountForm() {
  document.getElementById('accountModalTitle').textContent = 'Nouveau compte';
  document.getElementById('accountEditId').value = '';
  set('acc-name', ''); set('acc-balance', ''); set('acc-note', '');
  set('acc-type', 'courant');
  selectedAccountIcon  = '🏦';
  selectedAccountColor = COLORS[0];
  buildAccountIconGrid();
  buildAccountColorGrid();
  openModal('editAccount');
}

function openEditAccount(id) {
  const acc = accounts.find(a => a.id === id);
  if (!acc) return;
  document.getElementById('accountModalTitle').textContent = 'Modifier le compte';
  document.getElementById('accountEditId').value = id;
  set('acc-name', acc.name);
  set('acc-type', acc.type || 'courant');
  set('acc-balance', acc.initialBalance || '');
  set('acc-note', acc.note || '');
  selectedAccountIcon  = acc.icon  || '🏦';
  selectedAccountColor = acc.color || COLORS[0];
  buildAccountIconGrid();
  buildAccountColorGrid();
  openModal('editAccount');
}

function openDeleteAccount(id) {
  const acc = accounts.find(a => a.id === id);
  if (!acc) return;
  accountToDelete = id;
  document.getElementById('deleteAccountName').textContent = `${acc.icon || '🏦'} ${acc.name}`;
  openModal('deleteAccount');
}

// ─── FIRESTORE LISTENERS ──────────────────────────────────────────────────────
function listenCategories() {
  if (unsubCats) unsubCats();
  if (!curAccountId) return;
  const q = query(collection(db, 'categories'),
    where('uid', '==', uid),
    where('accountId', '==', curAccountId));
  unsubCats = onSnapshot(q, snap => {
    categories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    listenTransactions();
    updateCatFilter();
    updateCatSelect();
    updateRecurCatSelect();
  });
}

function listenTransactions() {
  if (unsubTxns) unsubTxns();
  if (!curAccountId) return;
  const q = query(collection(db, 'transactions'),
    where('uid', '==', uid),
    where('accountId', '==', curAccountId),
    where('monthKey', '==', monthStr()));
  unsubTxns = onSnapshot(q, snap => {
    transactions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    transactions.sort((a, b) => b.date.localeCompare(a.date));
    render();
    refreshCurrentMonthInYearCache();
    renderFoyerBanner(); // maj solde foyer
    renderAccountCards(); // maj soldes
  });
}

function listenRecurrents() {
  if (unsubRecurrents) unsubRecurrents();
  if (!curAccountId) return;
  const q = query(collection(db, 'recurrents'),
    where('uid', '==', uid),
    where('accountId', '==', curAccountId));
  unsubRecurrents = onSnapshot(q, snap => {
    recurrents = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderRecurrentsList();
    injectRecurrents();
  });
}

// ─── RÉCURRENTS ───────────────────────────────────────────────────────────────
async function injectRecurrents() {
  if (!recurrents.length || !curAccountId) return;
  const key = monthStr();
  const [y, m] = key.split('-').map(Number);
  for (const r of recurrents) {
    if (!shouldInjectThisMonth(r, y, m)) continue;
    const existing = transactions.find(t => t.recurrentId === r.id && t.monthKey === key);
    if (existing) continue;
    const dateStr = `${key}-${String(r.dayOfMonth || 1).padStart(2,'0')}`;
    const id = 'rec_' + r.id + '_' + key.replace('-','');
    try {
      await setDoc(doc(db, 'transactions', id), {
        uid, accountId: curAccountId,
        desc: r.desc, amount: r.amount, date: dateStr,
        catId: r.catId, type: r.type || 'debit', note: r.note || '',
        monthKey: key, recurrentId: r.id, auto: true
      });
    } catch (e) { console.warn('Injection récurrent échouée :', r.desc, e.message); }
  }
}

async function syncRecurrentToCurrentMonthTxn(r) {
  const key = monthStr();
  const existing = transactions.find(t => t.recurrentId === r.id && t.monthKey === key);
  if (!existing || existing.modified) return;
  try {
    await updateDoc(doc(db, 'transactions', existing.id), {
      desc: r.desc, amount: r.amount, catId: r.catId,
      type: r.type || 'debit', note: r.note || '',
      date: `${key}-${String(r.dayOfMonth || 1).padStart(2,'0')}`
    });
  } catch (e) { console.warn('Sync récurrent échouée :', e.message); }
}

function shouldInjectThisMonth(r, year, month) {
  const freq = r.frequency || 'monthly';
  if (freq === 'monthly')   return true;
  if (freq === 'bimonthly') return month % 2 === (r.startMonth % 2 || 0);
  if (freq === 'quarterly') return (month - 1) % 3 === ((r.startMonth - 1) % 3 || 0);
  if (freq === 'yearly')    return month === (r.startMonth || 1);
  return false;
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
  const acc = accounts.find(a => a.id === curAccountId);
  const totalBudget = categories.reduce((s, c) => s + (c.budget || 0), 0);
  const totalSpent  = sumDebits();
  const totalCredit = sumCredits();
  const left = totalBudget - totalSpent;
  const pct  = totalBudget ? Math.round(totalSpent / totalBudget * 100) : 0;

  // Solde : on calcule à partir des transactions chargées (approx du mois courant)
  // Le vrai solde est calculé via getAccountBalance (asynchrone, dans les cards)
  const initBal = acc?.initialBalance || 0;
  document.getElementById('m-solde').textContent = acc ? `${acc.icon} ${esc(acc.name)}` : '–';
  document.getElementById('m-solde').style.fontSize = '15px';
  document.getElementById('m-solde').style.fontFamily = 'Inter';
  document.getElementById('m-solde-sub').textContent = `Solde initial : ${fmt(initBal)}`;

  document.getElementById('m-spent').textContent     = fmt(totalSpent);
  document.getElementById('m-spent-sub').textContent = `${pct}% du budget · Revenus : ${fmt(totalCredit)}`;

  const mLeft = document.getElementById('m-left');
  mLeft.textContent = fmt(Math.abs(left));
  mLeft.className   = 'metric-value ' + (left >= 0 ? 'green' : 'red');
  document.getElementById('m-left-sub').textContent = left >= 0 ? 'disponible sur budget' : 'budget dépassé';
}

function renderAlerts() {
  const box = document.getElementById('alerts');
  box.innerHTML = '';
  categories.forEach(cat => {
    if (!cat.budget) return;
    const spent = spentByCat(cat.id);
    const pct   = spent / cat.budget * 100;
    if (pct >= 100)
      box.innerHTML += `<div class="alert alert-over"><i class="ti ti-alert-circle"></i><strong>${cat.emoji||'📦'} ${esc(cat.name)}</strong> — budget dépassé de ${fmt(spent - cat.budget)}</div>`;
    else if (pct >= 80)
      box.innerHTML += `<div class="alert alert-warn"><i class="ti ti-alert-triangle"></i><strong>${cat.emoji||'📦'} ${esc(cat.name)}</strong> — ${Math.round(pct)}% du budget utilisé</div>`;
  });
}

function renderCats() {
  const el = document.getElementById('catList');
  const uncat = uncategorizedTotal();
  if (!categories.length && !uncat) {
    el.innerHTML = `<div class="empty"><i class="ti ti-layout-grid"></i><p>Aucune catégorie.<br>Ajoute-en une pour commencer.</p></div>`;
    return;
  }
  let html = categories.map(cat => {
    const spent  = spentByCat(cat.id);
    const budget = cat.budget || 0;
    const pct    = budget ? Math.min(spent / budget * 100, 100) : 0;
    const over   = budget && spent > budget;
    const warn   = budget && spent / budget >= 0.8 && !over;
    const badge  = over  ? `<span class="badge badge-over">Dépassé</span>`
                 : warn  ? `<span class="badge badge-warn">Attention</span>` : '';
    return `<div class="cat-row">
      <div class="cat-icon" style="background:${cat.color}22">${cat.emoji||'📦'}</div>
      <div class="cat-info">
        <div class="cat-name">${esc(cat.name)} ${badge}</div>
        <div class="cat-amounts">${fmt(spent)} / ${budget ? fmt(budget) : 'pas de limite'}</div>
        ${budget ? `<div class="progress-bar"><div class="progress-fill ${over?'over':warn?'warn':'ok'}" style="width:${pct}%"></div></div>` : ''}
      </div>
      <div class="cat-actions">
        <button class="icon-btn" data-action="editBudget" data-id="${cat.id}" title="Budget"><i class="ti ti-target"></i></button>
        <button class="icon-btn" data-action="editCat"    data-id="${cat.id}" title="Modifier"><i class="ti ti-pencil"></i></button>
        <button class="icon-btn danger" data-action="deleteCat" data-id="${cat.id}" title="Supprimer"><i class="ti ti-trash"></i></button>
      </div>
    </div>`;
  }).join('');

  if (uncat > 0)
    html += `<div class="cat-row">
      <div class="cat-icon" style="background:#88888822">❓</div>
      <div class="cat-info">
        <div class="cat-name">Non classé <span class="badge badge-warn">Cat. supprimée</span></div>
        <div class="cat-amounts">${fmt(uncat)} · à réattribuer</div>
      </div>
    </div>`;

  el.innerHTML = html;
}

function renderTxns() {
  const el     = document.getElementById('txnList');
  const search = document.getElementById('searchInput').value.toLowerCase();
  const catF   = document.getElementById('catFilter').value;
  const txns   = transactions.filter(t => {
    const ms = !search || t.desc.toLowerCase().includes(search) || (t.note||'').toLowerCase().includes(search);
    const mc = !catF   || t.catId === catF;
    return ms && mc;
  });
  if (!txns.length) {
    el.innerHTML = `<div class="empty"><i class="ti ti-inbox"></i><p>Aucune transaction ce mois.</p></div>`;
    return;
  }
  el.innerHTML = txns.map(t => {
    const cat = categories.find(c => c.id === t.catId) || { emoji:'❓', color:'#888', name:'Non classé' };
    const d   = t.date ? new Date(t.date).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'}) : '';
    const recurBadge = t.auto ? `<span class="badge badge-recur"><i class="ti ti-repeat"></i> Auto</span>` : '';
    return `<div class="txn-row">
      <div class="txn-icon" style="background:${cat.color}22">${cat.emoji||'📦'}</div>
      <div class="txn-info">
        <div class="txn-desc">${esc(t.desc)} ${recurBadge}</div>
        <div class="txn-meta">${d} · ${esc(cat.name)}${t.note?' · '+esc(t.note):''}</div>
      </div>
      <div class="txn-amount ${t.type==='credit'?'credit':'debit'}">
        ${t.type==='credit'?'+':'-'}${fmt(t.amount)}
      </div>
      <button class="icon-btn" data-action="editTxn"   data-id="${t.id}" title="Modifier"><i class="ti ti-pencil"></i></button>
      <button class="icon-btn danger" data-action="deleteTxn" data-id="${t.id}" title="Supprimer"><i class="ti ti-trash"></i></button>
    </div>`;
  }).join('');
}

function renderRecurrentsList() {
  const el = document.getElementById('recurList');
  if (!el) return;
  if (!recurrents.length) {
    el.innerHTML = `<div class="empty" style="padding:24px 0"><i class="ti ti-repeat" style="font-size:32px;display:block;margin-bottom:8px"></i><p>Aucun paiement récurrent.</p></div>`;
    return;
  }
  el.innerHTML = recurrents.map(r => {
    const cat = categories.find(c => c.id === r.catId) || { emoji:'📦', color:'#888', name:'Autre' };
    const fl  = RECUR_FREQ_LABELS[r.frequency] || r.frequency;
    return `<div class="recur-row">
      <div class="cat-icon" style="background:${cat.color}22;width:34px;height:34px;border-radius:8px;font-size:15px">${cat.emoji||'📦'}</div>
      <div class="txn-info" style="flex:1;min-width:0">
        <div class="txn-desc">${esc(r.desc)}</div>
        <div class="txn-meta">${fl} · le ${r.dayOfMonth||1} · ${esc(cat.name)}
          ${r.type==='credit'?'<span class="badge badge-ok" style="margin-left:4px">Revenu</span>':''}
        </div>
      </div>
      <div class="txn-amount ${r.type==='credit'?'credit':'debit'}" style="font-size:13px;margin-right:6px">
        ${r.type==='credit'?'+':'-'}${fmt(r.amount)}
      </div>
      <button class="icon-btn" data-action="editRecur"   data-id="${r.id}"><i class="ti ti-pencil"></i></button>
      <button class="icon-btn danger" data-action="deleteRecur" data-id="${r.id}"><i class="ti ti-trash"></i></button>
    </div>`;
  }).join('');
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
  const monthKey = date ? date.substring(0,7) : monthStr();
  const existing = isEdit ? transactions.find(t => t.id === editId) : null;
  try {
    const data = { uid, accountId: curAccountId, desc, amount, date, catId, type, note, monthKey };
    if (existing?.auto) { data.auto = true; data.recurrentId = existing.recurrentId; data.modified = true; }
    await setDoc(doc(db, 'transactions', id), data);
    toast('success', isEdit ? 'Transaction modifiée' : 'Transaction ajoutée', `${desc} · ${fmt(amount)}`);
    closeModal('addTxn'); clearTxnForm();
  } catch (e) { toast('error', 'Erreur', e.message); }
}

async function deleteTxn(id) {
  const t = transactions.find(x => x.id === id);
  if (!confirm('Supprimer cette transaction ?')) return;
  try { await deleteDoc(doc(db, 'transactions', id)); toast('info', 'Supprimé', t?.desc || ''); }
  catch (e) { toast('error', 'Erreur', e.message); }
}

function openEditTxn(id) {
  const t = transactions.find(x => x.id === id);
  if (!t) return;
  document.getElementById('txnModalTitle').textContent = 'Modifier la transaction';
  document.getElementById('txnEditId').value = id;
  set('txn-desc', t.desc); set('txn-amount', t.amount);
  set('txn-date', t.date||''); set('txn-type', t.type); set('txn-note', t.note||'');
  updateCatSelect();
  document.getElementById('txn-cat').value = t.catId || '';
  openModal('addTxn');
}

// ─── CRUD CATÉGORIES ──────────────────────────────────────────────────────────
async function saveCat() {
  const name   = v('cat-name').trim();
  const budget = parseFloat(v('cat-budget')) || 0;
  if (!name) { toast('error', 'Nom manquant', 'Donne un nom à la catégorie.'); return; }
  const editId = v('catEditId');
  const isEdit = !!editId;
  const id = editId || auto();
  try {
    await setDoc(doc(db, 'categories', id), {
      uid, accountId: curAccountId, name,
      emoji: selectedEmoji, color: selectedColor, budget
    });
    toast('success', isEdit ? 'Catégorie modifiée' : 'Catégorie créée', `${selectedEmoji} ${name}`);
    closeModal('addCat'); clearCatForm();
  } catch (e) { toast('error', 'Erreur', e.message); }
}

async function deleteCat(id) {
  const c = categories.find(x => x.id === id);
  if (!confirm('Supprimer cette catégorie ?\nLes transactions liées passeront en "Non classé".')) return;
  try { await deleteDoc(doc(db, 'categories', id)); toast('info', 'Catégorie supprimée', c ? `${c.emoji||''} ${c.name}` : ''); }
  catch (e) { toast('error', 'Erreur', e.message); }
}

function openEditCat(id) {
  const c = categories.find(x => x.id === id);
  if (!c) return;
  document.getElementById('catModalTitle').textContent = 'Modifier la catégorie';
  document.getElementById('catEditId').value = id;
  set('cat-name', c.name); set('cat-budget', c.budget||'');
  selectedEmoji = c.emoji||'📦'; selectedColor = c.color||COLORS[0];
  buildEmojiGrid(); buildColorGrid();
  openModal('addCat');
}

function openEditBudget(id) {
  const c = categories.find(x => x.id === id);
  if (!c) return;
  document.getElementById('editBudgetCatId').value = id;
  document.getElementById('editBudgetCatName').textContent = `${c.emoji||''} ${c.name}`;
  set('editBudgetVal', c.budget||'');
  openModal('editBudget');
}

async function saveBudget() {
  const id  = v('editBudgetCatId');
  const cat = categories.find(c => c.id === id);
  if (!cat) return;
  try {
    await updateDoc(doc(db, 'categories', id), { budget: parseFloat(v('editBudgetVal')) || 0 });
    toast('success', 'Budget mis à jour', `${cat.emoji||''} ${cat.name}`);
    closeModal('editBudget');
  } catch (e) { toast('error', 'Erreur', e.message); }
}

// ─── CRUD RÉCURRENTS ──────────────────────────────────────────────────────────
async function saveRecurrent() {
  const desc       = v('recur-desc').trim();
  const amount     = parseFloat(v('recur-amount')) || 0;
  const catId      = v('recur-cat');
  const type       = v('recur-type');
  const frequency  = v('recur-frequency');
  const dayOfMonth = Math.min(Math.max(parseInt(v('recur-day')) || 1, 1), 28);
  const note       = v('recur-note').trim();
  if (!desc || !amount) { toast('error', 'Champs manquants', 'Remplis description et montant.'); return; }
  const editId = v('recurEditId');
  const isEdit = !!editId;
  const id = editId || auto();
  const startMonth = parseInt(v('recur-startMonth')) || (curMonth + 1);
  const data = { uid, accountId: curAccountId, desc, amount, catId, type, frequency, dayOfMonth, note, startMonth };
  try {
    await setDoc(doc(db, 'recurrents', id), data);
    toast('success', isEdit ? 'Récurrent modifié' : 'Récurrent ajouté', `${desc} · ${fmt(amount)}`);
    closeModal('addRecurrent');
    if (isEdit) await syncRecurrentToCurrentMonthTxn({ id, ...data });
    await injectRecurrents();
  } catch (e) { toast('error', 'Erreur', e.message); }
}

async function deleteRecurrent(id) {
  const r = recurrents.find(x => x.id === id);
  if (!confirm('Supprimer ce paiement récurrent ?\nLes transactions déjà injectées resteront.')) return;
  try { await deleteDoc(doc(db, 'recurrents', id)); toast('info', 'Récurrent supprimé', r?.desc||''); }
  catch (e) { toast('error', 'Erreur', e.message); }
}

function openEditRecurrent(id) {
  const r = recurrents.find(x => x.id === id);
  if (!r) return;
  document.getElementById('recurModalTitle').textContent = 'Modifier le récurrent';
  document.getElementById('recurEditId').value = id;
  set('recur-desc', r.desc); set('recur-amount', r.amount);
  set('recur-type', r.type||'debit'); set('recur-frequency', r.frequency||'monthly');
  set('recur-day', r.dayOfMonth||1); set('recur-startMonth', r.startMonth||(curMonth+1));
  set('recur-note', r.note||'');
  updateRecurCatSelect();
  document.getElementById('recur-cat').value = r.catId || '';
  updateFrequencyFieldVisibility();
  openModal('addRecurrent');
}

function openAddRecurrentForm() {
  document.getElementById('recurModalTitle').textContent = 'Nouveau récurrent';
  document.getElementById('recurEditId').value = '';
  set('recur-desc',''); set('recur-amount',''); set('recur-note','');
  set('recur-type','debit'); set('recur-frequency','monthly');
  set('recur-day',1); set('recur-startMonth', curMonth+1);
  updateRecurCatSelect();
  updateFrequencyFieldVisibility();
  openModal('addRecurrent');
}

function updateFrequencyFieldVisibility() {
  const row = document.getElementById('recur-startMonth-row');
  if (row) row.style.display = v('recur-frequency') === 'monthly' ? 'none' : '';
}

// ─── PARAMÈTRES ───────────────────────────────────────────────────────────────
async function loadSettings() {
  try {
    const snap = await getDoc(doc(db, 'settings', uid));
    if (snap.exists()) { settings = snap.data(); localStorage.setItem('appSettings', JSON.stringify(settings)); }
    else await setDoc(doc(db, 'settings', uid), settings);
  } catch (e) { console.warn('Settings Firestore:', e.message); }
}
function loadSettingsUI() {
  set('s-name', settings.name||'Mon Foyer');
  set('s-currency', settings.currency||'EUR');
  set('s-income', settings.income||'');
  set('s-apiKey',    FIREBASE_CONFIG.apiKey);
  set('s-projectId', FIREBASE_CONFIG.projectId);
  set('s-authDomain',FIREBASE_CONFIG.authDomain);
  set('s-appId',     FIREBASE_CONFIG.appId);
}
async function saveSettings() {
  settings = { name: v('s-name'), currency: v('s-currency'), income: parseFloat(v('s-income'))||0 };
  localStorage.setItem('appSettings', JSON.stringify(settings));
  try { await setDoc(doc(db, 'settings', uid), settings); toast('success', 'Paramètres sauvegardés'); }
  catch (e) { toast('warn', 'Sauvegardé localement', e.message); }
  closeModal('settings');
}

// ─── NAVIGATION MOIS ──────────────────────────────────────────────────────────
function changeMonth(d) {
  curMonth += d;
  if (curMonth > 11) { curMonth = 0; curYear++; }
  if (curMonth < 0)  { curMonth = 11; curYear--; }
  updateMonthLabel();
  listenTransactions();
  toast('info', new Date(curYear, curMonth, 1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'}));
}
function updateMonthLabel() {
  const label = new Date(curYear, curMonth, 1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
  document.getElementById('monthLabel').textContent = label.charAt(0).toUpperCase() + label.slice(1);
}

// ─── GRAPHIQUES ───────────────────────────────────────────────────────────────
function renderPie() {
  const ctx  = document.getElementById('pieChart').getContext('2d');
  const cats = categories.filter(c => spentByCat(c.id) > 0);
  const uncat = uncategorizedTotal();
  if (pieChart) pieChart.destroy();
  if (!cats.length && !uncat) return;
  const labels = cats.map(c => `${c.emoji||''} ${c.name}`);
  const data   = cats.map(c => spentByCat(c.id));
  const bg     = cats.map(c => (c.color||'#888') + 'CC');
  const border = cats.map(c => c.color||'#888');
  if (uncat > 0) { labels.push('❓ Non classé'); data.push(uncat); bg.push('#888888CC'); border.push('#888'); }
  pieChart = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: bg, borderColor: border, borderWidth: 1.5 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { font:{size:11,family:'Inter'}, boxWidth:12, padding:10 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${fmt(ctx.raw)}` } }
      }
    }
  });
}

async function loadYearData() {
  const months = Array.from({length:12}, (_,i) => `${curYear}-${String(i+1).padStart(2,'0')}`);
  if (yearCache.year === curYear && yearCache.accountId === curAccountId && yearCache.totals) {
    renderBar(months, yearCache.totals); return;
  }
  const snaps = await Promise.all(months.map(m =>
    getDocs(query(collection(db,'transactions'),
      where('uid','==',uid),
      where('accountId','==',curAccountId),
      where('monthKey','==',m)))));
  const totals = snaps.map(s =>
    s.docs.map(d=>d.data()).filter(t=>t.type==='debit').reduce((sum,t)=>sum+t.amount,0));
  yearCache = { year: curYear, accountId: curAccountId, totals };
  renderBar(months, totals);
}

function refreshCurrentMonthInYearCache() {
  if (yearCache.year !== curYear || yearCache.accountId !== curAccountId || !yearCache.totals) {
    loadYearData(); return;
  }
  yearCache.totals[curMonth] = sumDebits();
  const months = Array.from({length:12}, (_,i) => `${curYear}-${String(i+1).padStart(2,'0')}`);
  renderBar(months, yearCache.totals);
}

function renderBar(months, totals) {
  const ctx    = document.getElementById('barChart').getContext('2d');
  const labels = months.map(m => new Date(m+'-01').toLocaleDateString('fr-FR',{month:'short'}));
  const colors = months.map((_,i) => i === curMonth ? '#2C5F8A' : '#2C5F8ACC');
  if (barChart) barChart.destroy();
  barChart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{label:'Dépenses', data:totals, backgroundColor:colors, borderRadius:5, borderSkipped:false}] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { ticks: { callback: v => fmt(v), font:{size:10} }, grid: { color:'rgba(0,0,0,0.05)' } },
        x: { ticks: { font:{size:11}, autoSkip:false }, grid: { display:false } }
      }
    }
  });
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
  if (name === 'recurrents') renderRecurrentsList();
  if (name === 'accounts') renderAccountModalList();
  const overlay = document.getElementById('modal-' + name);
  if (!overlay) return;
  overlay.classList.add('open');
  const first = overlay.querySelector('input:not([type="hidden"]), select');
  if (first) setTimeout(() => first.focus(), 50);
}
function closeModal(name) {
  document.getElementById('modal-' + name)?.classList.remove('open');
}
function closeTopOpenModal() {
  const open = document.querySelectorAll('.modal-overlay.open');
  if (!open.length) return;
  open[open.length-1].classList.remove('open');
}

function switchTab(tab) {
  ['general','firebase'].forEach(t => {
    document.getElementById('tab-content-'+t).style.display = t===tab?'':'none';
    document.getElementById('tab-'+t).classList.toggle('active', t===tab);
  });
}

// ─── UI HELPERS ───────────────────────────────────────────────────────────────
function updateCatSelect() {
  document.getElementById('txn-cat').innerHTML =
    categories.map(c => `<option value="${c.id}">${c.emoji||'📦'} ${esc(c.name)}</option>`).join('');
}
function updateRecurCatSelect() {
  document.getElementById('recur-cat').innerHTML =
    categories.map(c => `<option value="${c.id}">${c.emoji||'📦'} ${esc(c.name)}</option>`).join('');
}
function updateCatFilter() {
  document.getElementById('catFilter').innerHTML =
    '<option value="">Toutes les cat.</option>' +
    categories.map(c => `<option value="${c.id}">${c.emoji||'📦'} ${esc(c.name)}</option>`).join('');
}

function buildEmojiGrid() {
  document.getElementById('emojiGrid').innerHTML =
    EMOJIS.map(e => `<div class="emoji-opt ${e===selectedEmoji?'selected':''}" data-emoji="${e}">${e}</div>`).join('');
}
function buildColorGrid() {
  document.getElementById('colorGrid').innerHTML =
    COLORS.map(c => `<div class="color-swatch ${c===selectedColor?'selected':''}" style="background:${c}" data-color="${c}"></div>`).join('');
}
function buildAccountIconGrid() {
  document.getElementById('accountIconGrid').innerHTML =
    ACCOUNT_ICONS.map(e => `<div class="icon-opt ${e===selectedAccountIcon?'selected':''}" data-account-icon="${e}">${e}</div>`).join('');
}
function buildAccountColorGrid() {
  document.getElementById('accountColorGrid').innerHTML =
    COLORS.map(c => `<div class="color-swatch ${c===selectedAccountColor?'selected':''}" style="background:${c}" data-account-color="${c}"></div>`).join('');
}

function clearTxnForm() { ['txn-desc','txn-amount','txn-note'].forEach(id => set(id,'')); }
function clearCatForm() {
  set('cat-name',''); set('cat-budget','');
  document.getElementById('catEditId').value = '';
  selectedEmoji = '📦'; selectedColor = COLORS[0];
  buildEmojiGrid(); buildColorGrid();
}

// ─── UTILS ────────────────────────────────────────────────────────────────────
function monthStr()        { return `${curYear}-${String(curMonth+1).padStart(2,'0')}`; }
function spentByCat(catId) { return transactions.filter(t=>t.catId===catId&&t.type==='debit').reduce((s,t)=>s+t.amount,0); }
function sumDebits()       { return transactions.filter(t=>t.type==='debit').reduce((s,t)=>s+t.amount,0); }
function sumCredits()      { return transactions.filter(t=>t.type==='credit').reduce((s,t)=>s+t.amount,0); }
function uncategorizedTotal() {
  return transactions.filter(t=>t.type==='debit'&&t.catId&&!categories.find(c=>c.id===t.catId)).reduce((s,t)=>s+t.amount,0);
}
function auto() { return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function v(id)  { return document.getElementById(id)?.value||''; }
function set(id,val) { const el=document.getElementById(id); if(el) el.value=val; }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmt(n) {
  const sym   = {EUR:'€',USD:'$',CHF:'CHF ',GBP:'£',MAD:'MAD '}[settings.currency||'EUR']||'€';
  const after = ['EUR','GBP','USD'].includes(settings.currency);
  const s     = Math.abs(n).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2});
  return after ? `${s} ${sym}`.trim() : `${sym}${s}`;
}

// ─── EVENT DELEGATION ─────────────────────────────────────────────────────────
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;
  if (action === 'editTxn')       openEditTxn(id);
  if (action === 'deleteTxn')     deleteTxn(id);
  if (action === 'editCat')       openEditCat(id);
  if (action === 'deleteCat')     deleteCat(id);
  if (action === 'editBudget')    openEditBudget(id);
  if (action === 'editRecur')     openEditRecurrent(id);
  if (action === 'deleteRecur')   deleteRecurrent(id);
  if (action === 'switchAccount') switchAccount(id);
  if (action === 'editAccount')   { e.stopPropagation(); openEditAccount(id); }
  if (action === 'deleteAccount') { e.stopPropagation(); openDeleteAccount(id); }
  if (action === 'openAddAccount') openAddAccountForm();
});

document.addEventListener('click', e => {
  const emoji = e.target.closest('[data-emoji]');
  if (emoji) { selectedEmoji = emoji.dataset.emoji; buildEmojiGrid(); return; }
  const color = e.target.closest('[data-color]');
  if (color) { selectedColor = color.dataset.color; buildColorGrid(); return; }
  const aIcon = e.target.closest('[data-account-icon]');
  if (aIcon) { selectedAccountIcon = aIcon.dataset.accountIcon; buildAccountIconGrid(); return; }
  const aColor = e.target.closest('[data-account-color]');
  if (aColor) { selectedAccountColor = aColor.dataset.accountColor; buildAccountColorGrid(); return; }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeTopOpenModal();
});

// ─── BINDINGS ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('[data-prev-month]')?.addEventListener('click', () => changeMonth(-1));
  document.querySelector('[data-next-month]')?.addEventListener('click', () => changeMonth(1));

  document.getElementById('accountSelector')?.addEventListener('change', e => switchAccount(e.target.value));
  document.getElementById('btn-manageAccounts')?.addEventListener('click', () => openModal('accounts'));
  document.getElementById('btn-closeAccounts')?.addEventListener('click', () => closeModal('accounts'));
  document.getElementById('btn-addAccount')?.addEventListener('click', openAddAccountForm);
  document.getElementById('btn-saveAccount')?.addEventListener('click', saveAccount);
  document.getElementById('btn-cancelAccount')?.addEventListener('click', () => closeModal('editAccount'));
  document.getElementById('btn-cancelDeleteAccount')?.addEventListener('click', () => closeModal('deleteAccount'));
  document.getElementById('btn-confirmDeleteAccount')?.addEventListener('click', deleteAccountConfirmed);

  document.getElementById('btn-addTxn')    ?.addEventListener('click', () => openModal('addTxn'));
  document.getElementById('btn-settings')  ?.addEventListener('click', () => openModal('settings'));
  document.getElementById('btn-addCat')    ?.addEventListener('click', () => openModal('addCat'));
  document.getElementById('btn-logout')    ?.addEventListener('click', doLogout);
  document.getElementById('btn-recurrents')?.addEventListener('click', () => openModal('recurrents'));
  document.getElementById('btn-closeRecurrents')?.addEventListener('click', () => closeModal('recurrents'));

  document.getElementById('btn-saveTxn')   ?.addEventListener('click', saveTxn);
  document.getElementById('btn-cancelTxn') ?.addEventListener('click', () => closeModal('addTxn'));
  document.getElementById('btn-saveCat')   ?.addEventListener('click', saveCat);
  document.getElementById('btn-cancelCat') ?.addEventListener('click', () => closeModal('addCat'));
  document.getElementById('btn-saveBudget')    ?.addEventListener('click', saveBudget);
  document.getElementById('btn-cancelBudget')  ?.addEventListener('click', () => closeModal('editBudget'));
  document.getElementById('btn-saveSettings')  ?.addEventListener('click', saveSettings);
  document.getElementById('btn-cancelSettings')?.addEventListener('click', () => closeModal('settings'));

  document.getElementById('btn-addRecurrent')   ?.addEventListener('click', openAddRecurrentForm);
  document.getElementById('btn-saveRecurrent')  ?.addEventListener('click', saveRecurrent);
  document.getElementById('btn-cancelRecurrent')?.addEventListener('click', () => closeModal('addRecurrent'));
  document.getElementById('recur-frequency')    ?.addEventListener('change', updateFrequencyFieldVisibility);

  document.getElementById('tab-general') ?.addEventListener('click', () => switchTab('general'));
  document.getElementById('tab-firebase')?.addEventListener('click', () => switchTab('firebase'));

  document.querySelectorAll('.modal-overlay').forEach(m =>
    m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); }));

  document.getElementById('searchInput')?.addEventListener('input', renderTxns);
  document.getElementById('catFilter')  ?.addEventListener('change', renderTxns);
});

// ─── DÉMARRAGE ────────────────────────────────────────────────────────────────
init();
