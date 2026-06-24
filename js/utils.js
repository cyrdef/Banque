// ============================================================
// UTILS — fonctions partagées par tous les modules
// ============================================================

/** Formate un nombre en euros, ex: 1234.5 -> "1 234,50 €" */
function formatEUR(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

/** Formate une date ISO (yyyy-mm-dd) en format français lisible */
function formatDateFR(isoDate) {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Date du jour au format yyyy-mm-dd, pour pré-remplir les <input type=date> */
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Affiche un message temporaire en bas à droite */
function showToast(message, isError) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = isError ? 'show error' : 'show';
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => { toast.className = ''; }, 3200);
}

/** Échappe du texte pour une insertion sûre dans innerHTML */
function esc(str) {
  if (str === null || str === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

/** Génère un id lisible pour des éléments DOM dynamiques */
function uid(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 9);
}

// ------------------------------------------------------------
// Couche d'accès Firestore générique
// Toutes les données de l'utilisateur vivent sous :
//   users/{uid}/{collection}/{docId}
// Cela isole naturellement les données par compte (utile même
// en solo, et prêt si tu ajoutes des comptes plus tard).
// ------------------------------------------------------------

function userCollection(name) {
  const user = auth.currentUser;
  if (!user) throw new Error('Utilisateur non connecté');
  return db.collection('users').doc(user.uid).collection(name);
}

async function fetchAll(collectionName, orderField) {
  let ref = userCollection(collectionName);
  if (orderField) ref = ref.orderBy(orderField);
  const snap = await ref.get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function addDoc(collectionName, data) {
  return userCollection(collectionName).add(data);
}

async function updateDoc(collectionName, id, data) {
  return userCollection(collectionName).doc(id).update(data);
}

async function deleteDoc(collectionName, id) {
  return userCollection(collectionName).doc(id).delete();
}

/** Wrapper pour gérer proprement les erreurs Firestore dans les modules */
async function withErrorToast(fn) {
  try {
    return await fn();
  } catch (err) {
    console.error(err);
    showToast('Erreur : ' + (err.message || 'une erreur est survenue'), true);
    throw err;
  }
}

// ------------------------------------------------------------
// Modal générique réutilisable par tous les modules
// ------------------------------------------------------------

function showModal(innerHTML, onMount) {
  closeModal(); // sécurité : pas deux modales en même temps

  const backdrop = document.createElement('div');
  backdrop.id = 'app-modal-backdrop';
  backdrop.style.position = 'fixed';
  backdrop.style.inset = '0';
  backdrop.style.background = 'rgba(31,43,45,0.35)';
  backdrop.style.zIndex = '49';

  const modal = document.createElement('div');
  modal.id = 'app-modal';
  modal.className = 'card';
  modal.style.position = 'fixed';
  modal.style.top = '50%';
  modal.style.left = '50%';
  modal.style.transform = 'translate(-50%, -50%)';
  modal.style.zIndex = '50';
  modal.style.width = 'min(460px, 90vw)';
  modal.style.maxHeight = '85vh';
  modal.style.overflowY = 'auto';
  modal.style.boxShadow = '0 8px 30px rgba(0,0,0,0.18)';
  modal.innerHTML = innerHTML;

  document.body.appendChild(backdrop);
  document.body.appendChild(modal);

  backdrop.addEventListener('click', closeModal);
  modal.querySelectorAll('[data-modal-cancel]').forEach(btn => {
    btn.addEventListener('click', closeModal);
  });

  // Empêche la fermeture quand on clique dans la modale elle-même
  modal.addEventListener('click', (e) => e.stopPropagation());

  if (onMount) onMount(modal);
  return modal;
}

function closeModal() {
  const backdrop = document.getElementById('app-modal-backdrop');
  const modal = document.getElementById('app-modal');
  if (backdrop) backdrop.remove();
  if (modal) modal.remove();
}
