
// Configuração do Firebase Realtime Database
const firebaseConfig = {
  apiKey: "AIzaSyBL8Nh5v9gy6w2NjK8foZi18t-vK31KRf0",
  authDomain: "chess-d6bcf.firebaseapp.com",
  databaseURL: "https://chess-d6bcf-default-rtdb.firebaseio.com",
  projectId: "chess-d6bcf",
  storageBucket: "chess-d6bcf.firebasestorage.app",
  messagingSenderId: "720408733866",
  appId: "1:720408733866:web:ce6899c215c9c50b16c8d3"
};

// @ts-ignore - O Firebase é importado via CDN no index.html (compat mode)
const fb = window.firebase;

if (!fb.apps.length) {
  fb.initializeApp(firebaseConfig);
} else {
  fb.app(); // Usa a app já inicializada
}

// Exportamos o Realtime Database, que é o motor do nosso multiplayer
export const db = fb.database();
