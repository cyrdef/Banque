// ============================================================
// CONFIGURATION FIREBASE
// ============================================================
// Remplace les valeurs ci-dessous par celles de TON projet Firebase.
// Tu les trouveras dans : Console Firebase > Paramètres du projet
// > Tes applications > Configuration du SDK
//
// Ces informations ne sont PAS secrètes : elles identifient juste
// ton projet Firebase, la sécurité réelle se fait via les règles
// Firestore et l'authentification (voir GUIDE.md).
// ============================================================

const firebaseConfig = {
  apiKey: "REMPLACE_MOI",
  authDomain: "REMPLACE_MOI.firebaseapp.com",
  projectId: "REMPLACE_MOI",
  storageBucket: "REMPLACE_MOI.appspot.com",
  messagingSenderId: "REMPLACE_MOI",
  appId: "REMPLACE_MOI"
};

// Initialisation Firebase (SDK compat, chargé en CDN dans index.html)
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
