// Service Worker for Gestor de Pagos App (v2 with Scheduled Notifications)

const DB_NAME = 'GestorPagosDB';
const DB_VERSION = 1;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

// --- DB HELPER (Simplified for SW context) ---
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject("Error opening DB in SW");
        request.onsuccess = (event) => resolve(event.target.result);
        // onupgradeneeded is handled by the main app, so it should exist
    });
}

async function getAllFromDB(storeName) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => {
            db.close();
            resolve(request.result);
        };
        request.onerror = (e) => {
            db.close();
            reject(`Error getting all from ${storeName}: ${e.target.error}`);
        }
    });
}

async function getFromDB(storeName, key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);
        request.onsuccess = () => {
            db.close();
            resolve(request.result);
        }
        request.onerror = (e) => {
            db.close();
            reject(`Error getting from ${storeName}: ${e.target.error}`);
        }
    });
}

// --- MESSAGE LISTENER ---
// Listens for commands from the main app
self.addEventListener('message', (event) => {
    if (event.data && event.data.action) {
        switch (event.data.action) {
            case 'update-settings':
                console.log('SW: Recibida configuración de notificación', event.data.settings);
                event.waitUntil(scheduleDailyCheck(event.data.settings));
                break;
            case 'cancel-notifications':
                console.log('SW: Cancelando notificaciones para el pago ID:', event.data.paymentId);
                event.waitUntil(cancelNotificationsForPayment(event.data.paymentId));
                break;
        }
    }
});

// --- MAIN SCHEDULING LOGIC ---
async function scheduleDailyCheck(settings) {
    // First, clear any existing daily check to avoid duplicates
    await self.registration.getNotifications({ tag: 'daily-check-trigger' }).then(notifications => {
        notifications.forEach(notification => notification.close());
    });

    if (!settings || !settings.enabled) {
        console.log('SW: Notificaciones desactivadas. No se programará nada.');
        return;
    }

    const [hours, minutes] = settings.time.split(':').map(Number);
    const now = new Date();
    
    let scheduledTime = new Date();
    scheduledTime.setHours(hours, minutes, 0, 0);

    if (scheduledTime <= now) {
        // If the time has already passed for today, schedule it for tomorrow
        scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    console.log(`SW: Próxima revisión diaria programada para: ${scheduledTime}`);

    try {
        await self.registration.showNotification('Recordatorios Activados', {
            tag: 'daily-check-trigger',
            body: `Se revisarán los vencimientos diariamente a las ${settings.time}.`,
            showTrigger: new TimestampTrigger(scheduledTime.getTime()),
            silent: true,
        });
    } catch (e) {
        console.error('SW: Error al programar la notificación diaria. La API puede no ser compatible.', e);
    }
}


// --- NOTIFICATION CLICK & TRIGGER LOGIC ---

self.addEventListener('notificationclick', event => {
  event.notification.close();
  // Focus or open the app when a notification is clicked
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus();
      }
      return clients.openWindow('/');
    })
  );
});


self.addEventListener('notificationclose', event => {
    // This event fires when the notification is closed, OR when it triggers its action.
    if (event.notification.tag === 'daily-check-trigger') {
        console.log('SW: Disparador de revisión diaria activado.');
        // Re-schedule for the next day and perform the check
        event.waitUntil(
            getFromDB('settings', 'notificationsEnabled').then(enabled => {
                if (enabled && enabled.value) {
                    getFromDB('settings', 'notificationTime').then(time => {
                         scheduleDailyCheck({ enabled: true, time: time.value });
                         checkDueDatesAndNotify();
                    });
                }
            })
        );
    }
});


async function checkDueDatesAndNotify() {
    console.log('SW: Realizando la revisión de vencimientos...');
    try {
        const payments = await getAllFromDB('payments');
        const today = new Date();
        const currentDay = today.getDate();
        const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

        for (const payment of payments) {
            if (payment.dueDate === currentDay) {
                const isPaid = payment.paidMonths && payment.paidMonths[currentMonthKey];
                
                if (!isPaid) {
                    console.log(`SW: Vencimiento pendiente encontrado: ${payment.name}`);
                    // Schedule initial and re-notifications
                    scheduleRecurringNotifications(payment, currentMonthKey);
                }
            }
        }
    } catch (error) {
        console.error('SW: Fallo la revisión de vencimientos:', error);
    }
}

async function scheduleRecurringNotifications(payment, monthKey) {
    const hours = [0, 3, 6, 9]; // 0 = now, then +3h, +6h, +9h
    
    for (const hour of hours) {
        const tag = `payment-${payment.id}-${monthKey}-${hour}h`;
        const timestamp = Date.now() + hour * 60 * 60 * 1000;
        
        const title = hour === 0 ? `Vence Hoy: ${payment.name}` : `Recordatorio: ${payment.name}`;
        const body = `Tu pago de "${payment.name}" sigue pendiente de pago.`;

        try {
             await self.registration.showNotification(title, {
                body: body,
                icon: './images/icon-192x192.png',
                tag: tag,
                showTrigger: new TimestampTrigger(timestamp),
                renotify: true, // Vibrate/sound on re-notifications
            });
            console.log(`SW: Notificación programada para "${payment.name}" a las ${hour} horas.`);
        } catch(e) {
            console.error(`SW: Error al programar notificación de ${hour}h.`, e);
        }
    }
}

async function cancelNotificationsForPayment(paymentId) {
    const notifications = await self.registration.getNotifications();
    let cancelledCount = 0;
    for (const notification of notifications) {
        if (notification.tag.startsWith(`payment-${paymentId}-`)) {
            notification.close();
            cancelledCount++;
        }
    }
    console.log(`SW: Canceladas ${cancelledCount} notificaciones para el pago ID ${paymentId}.`);
}
