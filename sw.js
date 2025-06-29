// sw.js

// Este es el "asistente" que funciona en segundo plano.

self.addEventListener('install', event => {
  console.log('Service Worker: Instalado');
  // Forzar al nuevo Service Worker a activarse inmediatamente.
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('Service Worker: Activado');
  // Limpia cachés antiguas si es necesario (no se usa ahora, pero es buena práctica).
  event.waitUntil(self.clients.claim());
});

// Este evento se dispara cuando el usuario hace clic en una notificación.
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
        // Cambia '/' por la ruta a tu archivo HTML si no está en la raíz.
        // Por ejemplo: '/gestor-pagos.html'
        return clients.openWindow('index.html'); 
      }
    })
  );
});
