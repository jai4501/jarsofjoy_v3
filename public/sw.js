// Jars of Joy Service Worker for PWA asset caching and offline capability
const CACHE_NAME = 'jarsofjoy-assets-v1';
const IMAGE_CACHE_NAME = 'jarsofjoy-images-v1';

// Static assets to precache on SW install - including all local background/theme webp images
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/bakery_hero.webp',
  '/bakery_packaging.webp',
  '/business_logo_new.webp',
  '/category_brownie.webp',
  '/category_celebration_cake.webp',
  '/category_cookie.webp',
  '/category_swiss_roll.webp',
  '/category_tea_cake.webp',
  '/icon-192.webp',
  '/icon-512.webp'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  // Clear old caches
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== IMAGE_CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Identify image requests (Supabase storage paths or standard extensions)
  const isImage = 
    e.request.destination === 'image' || 
    url.pathname.includes('/storage/v1/object/public/') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.png');

  if (isImage) {
    // Cache-First strategy for images with background network update (Stale-While-Revalidate)
    e.respondWith(
      caches.open(IMAGE_CACHE_NAME).then((cache) => {
        return cache.match(e.request).then((cachedResponse) => {
          if (cachedResponse) {
            // Serve immediately from cache, update in background
            fetch(e.request).then((networkResponse) => {
              if (networkResponse.status === 200) {
                cache.put(e.request, networkResponse);
              }
            }).catch(() => {});
            return cachedResponse;
          }
          
          // If not cached, fetch from network, cache copy and return
          return fetch(e.request).then((networkResponse) => {
            if (networkResponse.status === 200) {
              cache.put(e.request, networkResponse.clone());
            }
            return networkResponse;
          });
        });
      })
    );
  } else {
    // Stale-While-Revalidate for other static assets (js, css, HTML, manifest)
    e.respondWith(
      caches.match(e.request).then((cachedResponse) => {
        if (cachedResponse) {
          fetch(e.request).then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(e.request, networkResponse));
            }
          }).catch(() => {});
          return cachedResponse;
        }
        return fetch(e.request);
      })
    );
  }
});
