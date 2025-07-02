// Importamos los scripts de Firebase (versión compat, para Service Workers)
importScripts("https://www.gstatic.com/firebasejs/11.6.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging-compat.js");

// --- LÓGICA DE CACHÉ (PARA FUNCIONAMIENTO OFFLINE) ---

const CACHE_NAME = 'gestor-pagos-cache-v2'; // Versión del caché
const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  '/images/icon-192x192.png',
  '/images/icon-512x512.png'
];

// Evento 'install': Se cachean los archivos básicos de la app.
self.addEventListener('install', event => {
  console.log('[SW] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Cacheando el App Shell');
      return cache.addAll(APP_SHELL_URLS);
    })
  );
});

// Evento 'activate': Se limpia el caché antiguo.
self.addEventListener('activate', event => {
  console.log('[SW] Activado.');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Limpiando caché antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Evento 'fetch': Se interceptan las peticiones para servirlas desde el caché.
self.addEventListener('fetch', event => {
  if (event.request.url.startsWith('https://generativelanguage.googleapis.com') || event.request.url.startsWith('https://firestore.googleapis.com')) {
    return; // No cachear las peticiones a las APIs de Google.
  }
  
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request).then(fetchResponse => {
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, fetchResponse.clone());
          return fetchResponse;
        });
      });
    })
  );
});

// --- LÓGICA DE NOTIFICACIONES PUSH (EN SEGUNDO PLANO) ---

const firebaseConfig = {
    apiKey: "AIzaSyBmpLx3B-IZ4FNo8pgmSR2-0JETc8_wL64",
    authDomain: "gestor-de-pagos-fd138.firebaseapp.com",
    projectId: "gestor-de-pagos-fd138",
    storageBucket: "gestor-de-pagos-fd138.appspot.com",
    messagingSenderId: "905643052314",
    appId: "1:905643052314:web:6001fa9c264850562770a3"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Mensaje en segundo plano recibido: ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: payload.notification.icon || '/images/icon-192x192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
