// ============================================================
// APP — point d'entrée, routing entre les modules
// ============================================================

const MODULES = [
  { id: 'depenses-fixes', label: 'Dépenses fixes', icon: '📅', render: renderDepensesFixes },
  { id: 'enveloppes',     label: 'Enveloppes',     icon: '🐷', render: renderEnveloppes },
  { id: 'credits',        label: 'Crédits internes', icon: '💳', render: renderCredits },
  { id: 'travaux',        label: 'Travaux',        icon: '🔨', render: renderTravaux },
  { id: 'projets',        label: 'Projets',        icon: '💍', render: renderProjets },
  { id: 'location',       label: 'Location',       icon: '🏠', render: renderLocation },
];

let currentModuleId = MODULES[0].id;

auth.onAuthStateChanged((user) => {
  if (user) {
    renderShell();
  } else {
    renderLoginScreen();
  }
});

function renderShell() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="topbar">
      <div class="brand"><span class="mark">€</span> Gestion des comptes</div>
      <div class="user-zone">
        <span>${esc(auth.currentUser.email)}</span>
        <button class="btn" id="logout-btn">Déconnexion</button>
      </div>
    </div>
    <nav class="module-nav" id="module-nav"></nav>
    <main id="module-content"></main>
  `;

  document.getElementById('logout-btn').addEventListener('click', signOut);

  const nav = document.getElementById('module-nav');
  nav.innerHTML = MODULES.map(m => `
    <button data-module="${m.id}" class="${m.id === currentModuleId ? 'active' : ''}">
      <span>${m.icon}</span> ${esc(m.label)}
    </button>
  `).join('');

  nav.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => switchModule(btn.dataset.module));
  });

  loadCurrentModule();
}

function switchModule(moduleId) {
  currentModuleId = moduleId;
  document.querySelectorAll('.module-nav button').forEach(b => {
    b.classList.toggle('active', b.dataset.module === moduleId);
  });
  loadCurrentModule();
}

function loadCurrentModule() {
  const mod = MODULES.find(m => m.id === currentModuleId);
  const container = document.getElementById('module-content');
  container.innerHTML = `<div class="empty-state"><p>Chargement…</p></div>`;
  mod.render(container);
}
