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
  apiKey:            "AIzaSyAflr5Pa_aujkFcSsJ43H8LiAw_vU51Ffw",
  authDomain:        "banquecyrille-a9055.firebaseapp.com",
  projectId:         "banquecyrille-a9055",
  storageBucket:     "banquecyrille-a9055.firebasestorage.app",
  messagingSenderId: "1083349423488",
  appId:             "1:1083349423488:web:1b7df80c5affbadeaadd65"
};

// Initialisation Firebase (SDK compat, chargé en CDN dans index.html)
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
