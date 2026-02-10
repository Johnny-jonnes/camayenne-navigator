/**
 * SERVICE WORKER — CAMAYENNE NAVIGATOR
 * Gestion du cache et mode offline
 */

const CACHE_NAME = 'camayenne-navigator-v13';
const STATIC_CACHE = 'camayenne-static-v10';
const DYNAMIC_CACHE = 'camayenne-dynamic-v10';
const TILES_CACHE = 'camayenne-tiles-v10';

// Fichiers statiques à mettre en cache immédiatement
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/css/design-system.css',
  '/assets/css/components.css',
  '/assets/css/layouts.css',
  '/assets/css/map-theme.css',
  '/assets/css/navigation.css',
  '/assets/css/animations.css',
  '/assets/css/auth.css',
  '/assets/js/core/utils.js',
  '/assets/js/core/state.js',
  '/assets/js/core/app.js',
  '/assets/js/core/auth.js',
  '/assets/js/modules/geolocation.js',
  '/assets/js/modules/address.js',
  '/assets/js/modules/map.js',
  '/assets/js/modules/routing.js',
  '/assets/js/modules/places.js',
  '/assets/js/modules/alerts.js',
  '/assets/js/modules/offline.js',
  '/assets/js/components/toast.js',
  '/assets/js/components/bottom-sheet.js',
  '/data/places.json',
  '/data/alerts.json',
  '/assets/icons/favicon.svg'
];

// URLs externes à mettre en cache
const EXTERNAL_ASSETS = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// ─────────────────────────────────────────
// INSTALLATION
// ─────────────────────────────────────────

self.addEventListener('install', (event) => {
  console.log('[SW] Installation...');

  event.waitUntil(
    Promise.all([
      // Cache statique
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('[SW] Mise en cache des assets statiques');
        return cache.addAll(STATIC_ASSETS);
      }),
      // Cache externe
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('[SW] Mise en cache des assets externes');
        return Promise.all(
          EXTERNAL_ASSETS.map(url =>
            fetch(url)
              .then(response => cache.put(url, response))
              .catch(err => console.warn('[SW] Erreur cache externe:', url, err))
          )
        );
      })
    ]).then(() => {
      console.log('[SW] Installation terminée');
      return self.skipWaiting();
    })
  );
});

// ─────────────────────────────────────────
// ACTIVATION
// ─────────────────────────────────────────

self.addEventListener('activate', (event) => {
  console.log('[SW] Activation...');

  event.waitUntil(
    // Nettoyer les anciens caches
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return name.startsWith('camayenne-') &&
              name !== STATIC_CACHE &&
              name !== DYNAMIC_CACHE &&
              name !== TILES_CACHE;
          })
          .map((name) => {
            console.log('[SW] Suppression ancien cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] Activation terminée');
      return self.clients.claim();
    })
  );
});

// ─────────────────────────────────────────
// STRATÉGIES DE CACHE
// ─────────────────────────────────────────

/**
 * Cache First — Pour les assets statiques
 */
async function cacheFirst(request, cacheName = STATIC_CACHE) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.warn('[SW] Erreur fetch:', request.url, error);
    return new Response('Offline', { status: 503 });
  }
}

/**
 * Network First — Pour les données dynamiques
 */
async function networkFirst(request, cacheName = DYNAMIC_CACHE) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return new Response(JSON.stringify({ error: 'Offline', cached: false }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Stale While Revalidate — Pour les tuiles de carte
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(TILES_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);

  return cached || fetchPromise;
}

// ─────────────────────────────────────────
// INTERCEPTION DES REQUÊTES
// ─────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes non-GET
  if (request.method !== 'GET') {
    return;
  }

  // Tuiles OpenStreetMap — Stale While Revalidate
  if (url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // API OSRM — Network First avec cache
  if (url.hostname.includes('router.project-osrm.org')) {
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
    return;
  }

  // Données JSON — Network First
  if (url.pathname.endsWith('.json')) {
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
    return;
  }

  // Assets externes (Leaflet, fonts) — Cache First
  if (!url.hostname.includes(self.location.hostname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Assets locaux — Cache First
  event.respondWith(cacheFirst(request, STATIC_CACHE));
});

// ─────────────────────────────────────────
// MESSAGES
// ─────────────────────────────────────────

self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CACHE_TILES':
      // Pré-charger les tuiles pour une zone
      if (payload && payload.bounds) {
        preCacheTiles(payload.bounds, payload.zoom || 16);
      }
      break;

    case 'CLEAR_CACHE':
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
      break;

    case 'GET_CACHE_SIZE':
      getCacheSize().then(size => {
        event.ports[0].postMessage({ size });
      });
      break;
  }
});

/**
 * Pré-charge les tuiles de carte pour une zone
 */
async function preCacheTiles(bounds, zoom) {
  const cache = await caches.open(TILES_CACHE);
  const tiles = getTileUrls(bounds, zoom);

  console.log(`[SW] Pré-chargement de ${tiles.length} tuiles...`);

  for (const url of tiles) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        await cache.put(url, response);
      }
    } catch (error) {
      console.warn('[SW] Erreur cache tuile:', url);
    }
  }

  console.log('[SW] Pré-chargement terminé');
}

/**
 * Génère les URLs des tuiles pour une zone
 */
function getTileUrls(bounds, zoom) {
  const urls = [];
  const [south, west, north, east] = bounds;

  const minTileX = lon2tile(west, zoom);
  const maxTileX = lon2tile(east, zoom);
  const minTileY = lat2tile(north, zoom);
  const maxTileY = lat2tile(south, zoom);

  for (let x = minTileX; x <= maxTileX; x++) {
    for (let y = minTileY; y <= maxTileY; y++) {
      const subdomain = ['a', 'b', 'c'][Math.floor(Math.random() * 3)];
      urls.push(`https://${subdomain}.tile.openstreetmap.org/${zoom}/${x}/${y}.png`);
    }
  }

  return urls;
}

function lon2tile(lon, zoom) {
  return Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
}

function lat2tile(lat, zoom) {
  return Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
}

/**
 * Calcule la taille totale du cache
 */
async function getCacheSize() {
  const cacheNames = await caches.keys();
  let totalSize = 0;

  for (const name of cacheNames) {
    const cache = await caches.open(name);
    const keys = await cache.keys();

    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.blob();
        totalSize += blob.size;
      }
    }
  }

  return totalSize;
}

// ─────────────────────────────────────────
// NOTIFICATIONS (pour futures alertes push)
// ─────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();

  const options = {
    body: data.message,
    icon: '/assets/icons/icon-192.png',
    badge: '/assets/icons/badge-72.png',
    tag: data.id || 'camayenne-alert',
    data: data,
    actions: [
      { action: 'view', title: 'Voir' },
      { action: 'dismiss', title: 'Ignorer' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

console.log('[SW] Service Worker chargé');