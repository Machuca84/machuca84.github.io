// Import and configure the Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getMessaging, onBackgroundMessage } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging-sw.js";

// Tu configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBmpLx3B-IZ4FNo8pgmSR2-0JETc8_wL64",
    authDomain: "gestor-de-pagos-fd138.firebaseapp.com",
    projectId: "gestor-de-pagos-fd138",
    storageBucket: "gestor-de-pagos-fd138.appspot.com",
    messagingSenderId: "905643052314",
    appId: "1:905643052314:web:6001fa9c264850562770a3"
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

onBackgroundMessage(messaging, (payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: payload.notification.icon || '/images/icon-192x192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
