# Guide d'installation — Gestion des comptes

Ce guide t'accompagne pas à pas pour mettre ton site en ligne, gratuitement,
avec une connexion sécurisée par email/mot de passe.

Trois étapes : **Firebase** (la base de données + la connexion) → **GitHub**
(héberger le site) → **connecter les deux**.

---

## Étape 1 — Créer le projet Firebase

1. Va sur [console.firebase.google.com](https://console.firebase.google.com)
2. Clique sur **Ajouter un projet**
3. Donne-lui un nom (ex: `mes-comptes`), clique **Continuer**
4. Tu peux désactiver Google Analytics (pas nécessaire), clique **Créer le projet**

### 1.1 Activer l'authentification par email/mot de passe

1. Dans le menu de gauche : **Build > Authentication**
2. Clique **Get started**
3. Choisis **Adresse e-mail / Mot de passe**
4. Active le premier interrupteur ("Adresse e-mail/Mot de passe"), clique **Enregistrer**

### 1.2 Créer la base de données Firestore

1. Dans le menu de gauche : **Build > Firestore Database**
2. Clique **Créer une base de données**
3. Choisis une région proche de toi (ex: `eur3 (europe-west)`)
4. Démarre en **mode production** (on configure les règles juste après)

### 1.3 Configurer les règles de sécurité

1. Toujours dans Firestore, va dans l'onglet **Règles**
2. Remplace tout le contenu par celui du fichier **`firestore.rules`** fourni avec ton site
3. Clique **Publier**

> Ces règles garantissent que seul toi (une fois connecté) peux lire ou
> modifier tes propres données. Personne d'autre n'y a accès, même en
> connaissant l'adresse du site.

### 1.4 Récupérer ta configuration Firebase

1. Clique sur l'icône ⚙️ (Paramètres) en haut à gauche → **Paramètres du projet**
2. Descends jusqu'à **Vos applications**, clique sur l'icône **`</>`** (Web)
3. Donne un nom à l'app (ex: `site-comptes`), **ne coche pas** Firebase Hosting
4. Clique **Enregistrer l'application**
5. Tu vois apparaître un bloc de code avec `firebaseConfig = { ... }` — **copie ces valeurs**

### 1.5 Renseigner la configuration dans le site

Ouvre le fichier **`js/firebase-config.js`** de ton site, et remplace les
valeurs `"REMPLACE_MOI"` par celles que tu viens de copier. Exemple :

```js
const firebaseConfig = {
  apiKey: "AIzaSyB...",
  authDomain: "mes-comptes-12345.firebaseapp.com",
  projectId: "mes-comptes-12345",
  storageBucket: "mes-comptes-12345.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

Sauvegarde le fichier.

---

## Étape 2 — Mettre le site sur GitHub

### 2.1 Créer le dépôt (repo)

1. Va sur [github.com](https://github.com), connecte-toi
2. Clique **New repository**
3. Nom du repo : par exemple `mes-comptes` (peut être public ou privé — voir note ci-dessous)
4. Ne coche aucune case (pas de README, pas de .gitignore), clique **Create repository**

> ⚠️ **Note sur public/privé** : si le repo est **public**, n'importe qui peut
> voir ton code (mais PAS tes données financières, qui sont protégées par les
> règles Firestore). Si tu préfères que même le code ne soit pas visible,
> choisis **privé** — mais GitHub Pages avec un repo privé nécessite un compte
> GitHub Pro (payant). Le plus simple et gratuit : repo **public**, tes
> données restent privées grâce à Firebase.

### 2.2 Envoyer les fichiers sur GitHub

Sur ton ordinateur, ouvre un terminal dans le dossier du site (celui qui
contient `index.html`), puis :

```bash
git init
git add .
git commit -m "Premier déploiement du site de gestion des comptes"
git branch -M main
git remote add origin https://github.com/TON-NOM-UTILISATEUR/mes-comptes.git
git push -u origin main
```

(remplace `TON-NOM-UTILISATEUR` et `mes-comptes` par tes vraies infos)

### 2.3 Activer GitHub Pages

1. Sur la page GitHub de ton repo, va dans **Settings**
2. Dans le menu de gauche : **Pages**
3. Sous **Branch**, choisis `main` et le dossier `/ (root)`, clique **Save**
4. Patiente 1-2 minutes, puis rafraîchis : un lien apparaît, du type
   `https://ton-nom-utilisateur.github.io/mes-comptes/`

C'est l'adresse de ton site ! 🎉

---

## Étape 3 — Autoriser ton domaine GitHub Pages dans Firebase

Pour que la connexion fonctionne depuis ton site en ligne (et pas seulement
en local) :

1. Retourne dans la **Console Firebase > Authentication > Settings**
2. Onglet **Authorized domains**
3. Clique **Add domain**
4. Ajoute : `ton-nom-utilisateur.github.io`
5. Enregistre

---

## Étape 4 — Créer ton compte sur le site

1. Ouvre ton site (`https://ton-nom-utilisateur.github.io/mes-comptes/`)
2. Clique **Créer un compte**
3. Renseigne ton email et un mot de passe (6 caractères minimum)
4. Tu es connecté ! Tu peux commencer à remplir tes données dans chaque module.

---

## En cas de souci

- **"Firebase: Error (auth/configuration-not-found)"** → vérifie que tu as bien
  activé l'authentification email/mot de passe (étape 1.1) et que
  `firebase-config.js` contient tes vraies valeurs (étape 1.5).
- **Le site reste bloqué sur "Chargement…"** → ouvre la console du navigateur
  (touche F12 > onglet Console) pour voir le message d'erreur exact, et
  vérifie l'orthographe de tes valeurs dans `firebase-config.js`.
- **"Missing or insufficient permissions"** → vérifie que les règles
  Firestore (étape 1.3) ont bien été publiées.
- **Connexion qui ne fonctionne pas en ligne mais marche en local** → tu as
  probablement oublié l'étape 3 (domaine autorisé).

---

## Pour aller plus loin

- Toutes tes données sont stockées sur Firebase (gratuit jusqu'à un usage
  largement suffisant pour un usage personnel — voir la grille tarifaire
  "Spark" sur firebase.google.com/pricing).
- Pour modifier le site plus tard, modifie les fichiers, puis :
  ```bash
  git add .
  git commit -m "Description de ce que tu as changé"
  git push
  ```
  GitHub Pages se mettra à jour automatiquement après 1-2 minutes.
