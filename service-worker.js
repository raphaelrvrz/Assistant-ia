// Service Worker pour Assistant IA PWA
const CACHE_NAME = 'assistant-ia-v1';
const OFFLINE_CACHE = 'assistant-ia-offline-v1';

// Fichiers à mettre en cache lors de l'installation
const STATIC_ASSETS = [
  '/assistant-pwa.html',
  '/manifest.json'
];

// Installation du Service Worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installation...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Mise en cache des fichiers statiques');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activation du Service Worker
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activation...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== OFFLINE_CACHE) {
              console.log('[Service Worker] Suppression ancien cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Interception des requêtes réseau
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Ignorer les requêtes vers l'API Anthropic (elles doivent toujours aller au réseau)
  if (url.hostname === 'api.anthropic.com') {
    return;
  }
  
  // Stratégie Network First pour les fichiers HTML
  if (request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Mettre en cache la réponse
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Si pas de réseau, utiliser le cache
          return caches.match(request);
        })
    );
    return;
  }
  
  // Stratégie Cache First pour les autres ressources
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        return fetch(request)
          .then((response) => {
            // Ne pas mettre en cache les réponses non-réussies
            if (!response || response.status !== 200 || response.type === 'error') {
              return response;
            }
            
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
            
            return response;
          });
      })
  );
});

// Gestion des notifications push (si nécessaire dans le futur)
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push reçu:', event);
  
  const options = {
    body: event.data ? event.data.text() : 'Nouvelle notification',
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="0.9em" font-size="90">🤖</text></svg>',
    badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><text y="0.9em" font-size="90">🔔</text></svg>',
    vibrate: [200, 100, 200],
    tag: 'assistant-notification',
    requireInteraction: false
  };
  
  event.waitUntil(
    self.registration.showNotification('Assistant IA', options)
  );
});

// Gestion des clics sur les notifications
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification cliquée:', event);
  
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/assistant-pwa.html')
  );
});

// Synchronisation en arrière-plan (pour fonctionnalités futures)
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Sync événement:', event.tag);
  
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }
});

async function syncMessages() {
  // Placeholder pour synchronisation future
  console.log('[Service Worker] Synchronisation des messages...');
}

// Gestion des messages du client
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message reçu:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
});

console.log('[Service Worker] Chargé et prêt');
