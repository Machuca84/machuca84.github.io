// sw.js

// --- CONFIGURACIÓN DE INDEXEDDB ---
const DB_NAME = 'GestorPagosDB';
const DB_VERSION = 1;
const STORE_NAME = 'appData';

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = (event) => reject("Error al abrir IndexedDB");
        request.onsuccess = (event) => resolve(event.target.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'key' });
            }
        };
    });
}

function getDataFromDB(db, key) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);
        request.onerror = (event) => reject("Error al leer de IndexedDB");
        request.onsuccess = (event) => {
            resolve(event.target.result ? event.target.result.value : null);
        };
    });
}


// --- LÓGICA DE NOTIFICACIONES ---
const getMonthYearKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

async function checkForPaymentsAndNotify() {
    console.log('Service Worker: Ejecutando chequeo de pagos en segundo plano...');

    try {
        const db = await openDB();
        const payments = await getDataFromDB(db, 'monthlyPaymentsApp');
        
        if (!payments || payments.length === 0) {
            console.log('Service Worker: No hay pagos para chequear.');
            return;
        }

        const today = new Date();
        const currentDay = today.getDate();
        const currentMonthKey = getMonthYearKey(today);

        const duePayments = payments.filter(p => {
            const isPaid = p.paidMonths && p.paidMonths[currentMonthKey];
            const isActive = p.createdAt && p.createdAt <= currentMonthKey;
            const isDueSoon = p.dueDate >= currentDay && p.dueDate <= currentDay + 3;
            return !isPaid && isActive && isDueSoon;
        });

        if (duePayments.length > 0) {
            console.log(`Service Worker: Se encontraron ${duePayments.length} pagos por vencer.`);
        }

        for (const payment of duePayments) {
            const notificationKey = `${payment.id}-${currentMonthKey}`;
            const alreadyNotified = await getDataFromDB(db, `notified-${notificationKey}`);

            if (!alreadyNotified) {
                const daysUntilDue = payment.dueDate - currentDay;
                const body = daysUntilDue === 0 ? `Tu pago de ${payment.name} vence hoy.` : `Tu pago de ${payment.name} vence en ${daysUntilDue} día(s).`;
                
                await self.registration.showNotification('Recordatorio de Vencimiento', {
                    body: body,
                    icon: 'images/icon-192x192.png',
                    tag: notificationKey 
                });
            }
        }
    } catch (error) {
        console.error('Service Worker: Falló el chequeo en segundo plano.', error);
    }
}


// --- EVENT LISTENERS DEL SERVICE WORKER ---

self.addEventListener('install', event => {
    console.log('Service Worker: Instalado');
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    console.log('Service Worker: Activado');
    event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', event => {
    console.log('Service Worker: Clic en notificación recibido.');
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            for (const client of clientList) {
                if ('focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                // ** LÍNEA CORREGIDA **
                // Debe apuntar a la raíz '/' porque tu repo es del tipo <usuario>.github.io
                return clients.openWindow('/'); 
            }
        })
    );
});

self.addEventListener('periodicsync', event => {
    console.log('Service Worker: Evento de sincronización periódica recibido.', event.tag);
    if (event.tag === 'check-reminders-sync') {
        event.waitUntil(checkForPaymentsAndNotify());
    }
});
