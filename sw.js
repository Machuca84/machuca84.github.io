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

self.addEventListener('install', event => {
  console.log('[SW] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Cacheando el App Shell');
      return cache.addAll(APP_SHELL_URLS);
    })
  );
});

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


// --- INICIO DE LA MODIFICACIÓN IMPORTANTE ---
// Escuchador del evento 'push'. Este es el método estándar y más confiable.
// Se activa siempre que llega una notificación, incluso con la app cerrada.
self.addEventListener('push', event => {
  console.log('[SW] Push recibido.');

  let payload;
  try {
    // Intentamos parsear los datos de la notificación.
    // Es crucial que envíes la notificación desde tu servidor con un campo "data".
    payload = event.data.json();
    console.log('[SW] Payload de la notificación:', payload);
  } catch (e) {
    console.error('[SW] No se pudo parsear el payload, usando texto por defecto.', e);
    payload = { data: { title: 'Nueva Notificación', body: 'Has recibido una nueva notificación.', icon: '/images/icon-192x192.png', paymentId: 'default' } };
  }

  const title = payload.data.title || 'Título no disponible';
  const options = {
    body: payload.data.body || 'Contenido no disponible.',
    icon: payload.data.icon || '/images/icon-192x192.png',
    badge: '/images/icon-192x192.png', // Opcional: ícono para la barra de notificaciones en Android
    tag: payload.data.paymentId, // Agrupa notificaciones por pago para que no se apilen
    data: { // Pasamos la URL que se debe abrir al hacer clic
        url: `/?paymentId=${payload.data.paymentId}`
    },
    actions: [
        { action: 'open_app', title: 'Abrir App' }
    ]
  };

  // event.waitUntil se asegura que el Service Worker no se "duerma"
  // antes de que la notificación se haya mostrado.
  event.waitUntil(self.registration.showNotification(title, options));
});
// --- FIN DE LA MODIFICACIÓN IMPORTANTE ---


// Listener para manejar los clics en la notificación o sus acciones
self.addEventListener('notificationclick', event => {
    event.notification.close(); // Siempre cierra la notificación al interactuar

    // Aseguramos que la URL a abrir es válida
    const urlToOpen = event.notification.data.url ? new URL(event.notification.data.url, self.location.origin).href : self.location.origin;

    // Esta función busca si la app ya está abierta y la enfoca. Si no, abre una nueva ventana.
    const promiseChain = clients.matchAll({
        type: 'window',
        includeUncontrolled: true
    }).then((windowClients) => {
        // Busca una ventana que ya esté abierta en la URL de la notificación
        for (let i = 0; i < windowClients.length; i++) {
            const windowClient = windowClients[i];
            if (windowClient.url === urlToOpen && 'focus' in windowClient) {
                return windowClient.focus();
            }
        }
        // Si no encuentra una ventana abierta, abre una nueva
        if (clients.openWindow) {
            return clients.openWindow(urlToOpen);
        }
    });

    event.waitUntil(promiseChain);
});
