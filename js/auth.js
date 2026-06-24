// ============================================================
// AUTH — connexion / inscription / déconnexion
// ============================================================

let authMode = 'login'; // 'login' | 'signup'

function renderLoginScreen() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <div class="mark">€</div>
        <h1>Gestion des comptes</h1>
        <p class="sub">${authMode === 'login' ? 'Connecte-toi pour accéder à tes comptes' : 'Crée ton compte pour démarrer'}</p>

        <div id="login-error"></div>

        <form id="auth-form">
          <div class="field">
            <label for="auth-email">Email</label>
            <input type="email" id="auth-email" required autocomplete="email" placeholder="toi@exemple.fr">
          </div>
          <div class="field">
            <label for="auth-password">Mot de passe</label>
            <input type="password" id="auth-password" required autocomplete="current-password" placeholder="••••••••" minlength="6">
          </div>
          <button type="submit" class="btn btn-primary">
            ${authMode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </button>
        </form>

        <div class="switch-mode">
          ${authMode === 'login'
            ? `Pas encore de compte ? <a href="#" id="switch-link">Créer un compte</a>`
            : `Déjà un compte ? <a href="#" id="switch-link">Se connecter</a>`}
        </div>
      </div>
    </div>
  `;

  document.getElementById('switch-link').addEventListener('click', (e) => {
    e.preventDefault();
    authMode = authMode === 'login' ? 'signup' : 'login';
    renderLoginScreen();
  });

  document.getElementById('auth-form').addEventListener('submit', handleAuthSubmit);
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const errorBox = document.getElementById('login-error');
  errorBox.innerHTML = '';

  try {
    if (authMode === 'login') {
      await auth.signInWithEmailAndPassword(email, password);
    } else {
      await auth.createUserWithEmailAndPassword(email, password);
    }
    // onAuthStateChanged (dans app.js) prend le relai automatiquement
  } catch (err) {// ============================================================
// AUTH — connexion / inscription / déconnexion
// ============================================================

let authMode = 'login'; // 'login' | 'signup'

function renderLoginScreen() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <div class="mark">€</div>
        <h1>Gestion des comptes</h1>
        <p class="sub">${authMode === 'login' ? 'Connecte-toi pour accéder à tes comptes' : 'Crée ton compte pour démarrer'}</p>

        <div id="login-error"></div>

        <form id="auth-form">
          <div class="field">
            <label for="auth-email">Email</label>
            <input type="email" id="auth-email" required autocomplete="email" placeholder="toi@exemple.fr">
          </div>
          <div class="field">
            <label for="auth-password">Mot de passe</label>
            <input type="password" id="auth-password" required autocomplete="current-password" placeholder="••••••••" minlength="6">
          </div>
          <button type="submit" class="btn btn-primary">
            ${authMode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </button>
        </form>

        <div class="switch-mode">
          ${authMode === 'login'
            ? `Pas encore de compte ? <a href="#" id="switch-link">Créer un compte</a>`
            : `Déjà un compte ? <a href="#" id="switch-link">Se connecter</a>`}
        </div>
      </div>
    </div>
  `;

  document.getElementById('switch-link').addEventListener('click', (e) => {
    e.preventDefault();
    authMode = authMode === 'login' ? 'signup' : 'login';
    renderLoginScreen();
  });

  document.getElementById('auth-form').addEventListener('submit', handleAuthSubmit);
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const errorBox = document.getElementById('login-error');
  errorBox.innerHTML = '';

  try {
    if (authMode === 'login') {
      await auth.signInWithEmailAndPassword(email, password);
    } else {
      await auth.createUserWithEmailAndPassword(email, password);
    }
    // onAuthStateChanged (dans app.js) prend le relai automatiquement
  } catch (err) {
    errorBox.innerHTML = `<div class="login-error">${esc(authErrorMessage(err))}</div>`;
  }
}

function authErrorMessage(err) {
  const map = {
    'auth/invalid-email': 'Adresse email invalide.',
    'auth/user-not-found': 'Aucun compte avec cet email.',
    'auth/wrong-password': 'Mot de passe incorrect.',
    'auth/invalid-credential': 'Email ou mot de passe incorrect.',
    'auth/email-already-in-use': 'Un compte existe déjà avec cet email.',
    'auth/weak-password': 'Le mot de passe doit faire au moins 6 caractères.',
    'auth/too-many-requests': 'Trop de tentatives. Réessaie dans quelques minutes.'
  };
  return map[err.code] || ('Erreur : ' + err.message);
}

function signOut() {
  auth.signOut();
}
    errorBox.innerHTML = `<div class="login-error">${esc(authErrorMessage(err))}</div>`;
  }
}

function authErrorMessage(err) {
  const map = {
    'auth/invalid-email': 'Adresse email invalide.',
    'auth/user-not-found': 'Aucun compte avec cet email.',
    'auth/wrong-password': 'Mot de passe incorrect.',
    'auth/invalid-credential': 'Email ou mot de passe incorrect.',
    'auth/email-already-in-use': 'Un compte existe déjà avec cet email.',
    'auth/weak-password': 'Le mot de passe doit faire au moins 6 caractères.',
    'auth/too-many-requests': 'Trop de tentatives. Réessaie dans quelques minutes.'
  };
  return map[err.code] || ('Erreur : ' + err.message);
}

function signOut() {
  auth.signOut();
}
