// Service Worker for Gestor de Pagos App

const CACHE_NAME = 'gestor-pagos-cache-v1';
const URLS_TO_CACHE = [
  '/',
  './index.html',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/chart.js'
];
const DB_NAME = 'GestorPagosDB';
const DB_VERSION = 1;

// --- INSTALL & ACTIVATE ---
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(URLS_TO_CACHE);
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// --- FETCH (Cache First Strategy) ---
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
        .then(response => {
            if (response) {
                return response;
            }
            return fetch(event.request);
        })
    );
});


// --- INDEXEDDB HELPER (Simplified for SW context) ---
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = (event) => reject("Error opening DB in SW");
        request.onsuccess = (event) => resolve(event.target.result);
        request.onupgradeneeded = (event) => {
             const db = event.target.result;
             if (!db.objectStoreNames.contains('payments')) {
                 db.createObjectStore('payments', { keyPath: 'id' });
             }
             if (!db.objectStoreNames.contains('futureInstallments')) {
                  db.createObjectStore('futureInstallments', { keyPath: 'id' });
             }
        };
    });
}

function getAllFromDB(db, storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(`Error getting all from ${storeName}: ${e.target.error}`);
    });
}


// --- PERIODIC SYNC LOGIC ---
self.addEventListener('periodicsync', event => {
    if (event.tag === 'check-due-dates') {
        console.log('Ejecutando revisión de vencimientos en segundo plano...');
        event.waitUntil(checkDueDatesAndNotify());
    }
});

async function checkDueDatesAndNotify() {
    try {
        const db = await openDB();
        const payments = await getAllFromDB(db, 'payments');
        db.close();
        
        const today = new Date();
        const currentDay = today.getDate();
        const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

        for (const payment of payments) {
             // Check if the payment is due today
            if (payment.dueDate === currentDay) {
                // Check if it's already paid for the current month
                const isPaid = payment.paidMonths && payment.paidMonths[currentMonthKey];
                
                if (!isPaid) {
                    console.log(`Enviando notificación para: ${payment.name}`);
                    await self.registration.showNotification('Recordatorio de Pago', {
                        body: `El pago de "${payment.name}" vence hoy.`,
                        icon: './images/icon-192x192.png', // Ensure you have this icon in your repo
                        tag: `due-payment-${payment.id}-${currentMonthKey}` // Tag to prevent duplicate notifications
                    });
                }
            }
        }
    } catch (error) {
        console.error('Fallo la revisión de vencimientos en segundo plano:', error);
    }
}
