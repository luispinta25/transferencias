const CACHE_NAME = 'ferresoluciones-v14';
const urlsToCache = [
  './',
  './index.html',
  './login.html',
  './styles.css',
  './app.js',
  './auth.js',
  './update.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .catch(err => console.log('Error al cachear archivos:', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  
  // No cachear peticiones POST o fuera de HTTP
  if (request.method !== 'GET' || !request.url.startsWith('http')) {
    return;
  }
  
  const url = new URL(request.url);

  // No cachear llamadas a Supabase ni Webhooks (Siempre Network)
  if (
    url.hostname.includes('supabase') ||
    url.hostname.includes('luispintasolutions.com') ||
    url.hostname.includes('ferrisoluciones')
  ) {
    event.respondWith(fetch(request));
    return;
  }

  // --- ESTRATEGIA: NETWORK FIRST ---
  // Intentamos obtener del internet primero para asegurar última versión.
  // Si falla (offline), servimos desde caché.
  event.respondWith(
    fetch(request)
      .then(networkResponse => {
        if (networkResponse && networkResponse.ok) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});
