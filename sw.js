// sw.js

const CACHE_NAME = 'gestor-pagos-cache-v1';
const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

// Evento 'install': Se dispara cuando el Service Worker se instala.
// Aquí cacheamos el "App Shell", es decir, los archivos básicos para que la app funcione.
self.addEventListener('install', event => {
  console.log('Service Worker: Instalado');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Service Worker: Cacheando el App Shell');
      // Usamos addAll para cachear todos los recursos básicos.
      // Si uno falla, la instalación del SW falla.
      return cache.addAll(APP_SHELL_URLS);
    })
  );
  // Forzar al nuevo Service Worker a activarse inmediatamente.
  self.skipWaiting();
});

// Evento 'activate': Se dispara cuando el Service Worker se activa.
// Aquí limpiamos cachés antiguas para evitar conflictos.
self.addEventListener('activate', event => {
  console.log('Service Worker: Activado');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Si el nombre del caché no es el actual, lo eliminamos.
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Limpiando caché antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Reclama el control de todos los clientes (pestañas) abiertos.
  return self.clients.claim();
});

// Evento 'fetch': Se dispara cada vez que la aplicación realiza una petición de red (fetch).
// Aquí interceptamos las peticiones para servirlas desde el caché si es posible.
self.addEventListener('fetch', event => {
  // Ignoramos las peticiones a la API de Google Gemini para que siempre vayan a la red.
  if (event.request.url.startsWith('https://generativelanguage.googleapis.com')) {
    return;
  }
  
  // Ignoramos las peticiones que no son GET.
  if (event.request.method !== 'GET') {
      return;
  }

  // Estrategia "Stale-While-Revalidate" (Rancio mientras se revalida).
  // 1. Responde inmediatamente con el recurso del caché si está disponible (rapidez).
  // 2. Mientras tanto, busca una versión actualizada en la red.
  // 3. Si la encuentra, actualiza el caché para la próxima vez.
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(response => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          // Si la petición a la red es exitosa, la guardamos en el caché y la retornamos.
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });

        // Retornamos la respuesta del caché inmediatamente si existe,
        // o esperamos a la respuesta de la red si no está en caché.
        return response || fetchPromise;
      });
    })
  );
});


// Evento 'notificationclick': Se dispara cuando el usuario hace clic en una notificación.
self.addEventListener('notificationclick', event => {
  console.log('Service Worker: Clic en notificación recibido.');
  
  // Cierra la notificación
  event.notification.close();

  // Abre la aplicación o la enfoca si ya está abierta.
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Si hay una ventana de la app abierta, la enfoca.
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      // Si no hay ninguna ventana abierta, abre una nueva.
      if (clients.openWindow) {
        return clients.openWindow('/'); 
      }
    })
  );
});
