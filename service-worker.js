const APP_VERSION = '1.0.1';
const CACHE_NAME = `ferresoluciones-v${APP_VERSION}`;
const urlsToCache = [
  '/',
  '/index.html',
  '/login.html',
  '/update.html',
  '/styles.css',
  '/app.js',
  '/auth.js',
  '/update.js',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

function shouldBypassRequest(url) {
  return url.hostname.includes('supabase');
}

function shouldCacheResponse(request, response) {
  return request.method === 'GET' && response && (response.ok || response.type === 'opaque');
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const networkResponse = await fetch(request);

    if (shouldCacheResponse(request, networkResponse)) {
      await cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    const cachedResponse = await cache.match(request) || await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    if (request.mode === 'navigate' || request.destination === 'document') {
      const fallbackPage = await cache.match('/index.html') || await caches.match('/index.html');
      if (fallbackPage) {
        return fallbackPage;
      }
    }

    return new Response('Sin conexion', {
      status: 503,
      statusText: 'Servicio no disponible',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8'
      }
    });
  }
}

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

  if (request.method !== 'GET') {
    return;
  }

  if (!request.url.startsWith('http')) {
    return;
  }

  const url = new URL(request.url);

  // Manejar favicon.ico para evitar 404
  if (url.pathname === '/favicon.ico') {
    event.respondWith(
      fetch('https://lh3.googleusercontent.com/d/1bqJM3Qw96FEIo4QSjHyn-n8laPHpfS1C=w2048')
        .catch(() => new Response(null, { status: 204 }))
    );
    return;
  }

  if (shouldBypassRequest(url)) {
    return;
  }

  event.respondWith(networkFirst(request));
});
