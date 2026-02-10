/**
 * MODULE OFFLINE
 * Gestion IndexedDB, cache local, synchronisation
 */

const OfflineModule = (function () {
  'use strict';

  // ─────────────────────────────────────────
  // CONFIGURATION
  // ─────────────────────────────────────────

  const CONFIG = {
    DB_NAME: 'CamayenneNavigatorDB',
    DB_VERSION: 1,
    STORES: {
      PLACES: 'places',
      ALERTS: 'alerts',
      USER_DATA: 'userData',
      CACHED_ROUTES: 'cachedRoutes',
      TILES: 'tiles'
    },
    // Durée de validité du cache (24h)
    CACHE_DURATION: 24 * 60 * 60 * 1000,
    // Tuiles à pré-charger autour de Camayenne
    PRELOAD_BOUNDS: [9.5250, -13.6920, 9.5480, -13.6650],
    PRELOAD_ZOOM_LEVELS: [14, 15, 16, 17]
  };

  // ─────────────────────────────────────────
  // ÉTAT
  // ─────────────────────────────────────────

  let state = {
    db: null,
    isOnline: navigator.onLine,
    isInitialized: false,
    syncQueue: [],
    lastSync: null
  };

  // ─────────────────────────────────────────
  // INITIALISATION INDEXEDDB
  // ─────────────────────────────────────────

  async function init() {
    try {
      state.db = await openDatabase();
      state.isInitialized = true;

      // Écouter les changements de connexion
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      // Charger la dernière synchronisation
      state.lastSync = await getLastSyncTime();

      console.log('[Offline] Module initialisé');
      return true;
    } catch (error) {
      console.error('[Offline] Erreur initialisation:', error);
      return false;
    }
  }

  /**
   * Ouvre ou crée la base de données IndexedDB
   */
  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);

      request.onerror = () => {
        reject(new Error('Impossible d\'ouvrir IndexedDB'));
      };

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Store pour les lieux
        if (!db.objectStoreNames.contains(CONFIG.STORES.PLACES)) {
          const placesStore = db.createObjectStore(CONFIG.STORES.PLACES, { keyPath: 'id' });
          placesStore.createIndex('category', 'category', { unique: false });
          placesStore.createIndex('importance', 'importance', { unique: false });
        }

        // Store pour les alertes
        if (!db.objectStoreNames.contains(CONFIG.STORES.ALERTS)) {
          const alertsStore = db.createObjectStore(CONFIG.STORES.ALERTS, { keyPath: 'id' });
          alertsStore.createIndex('type', 'type', { unique: false });
          alertsStore.createIndex('active', 'active', { unique: false });
        }

        // Store pour les données utilisateur
        if (!db.objectStoreNames.contains(CONFIG.STORES.USER_DATA)) {
          db.createObjectStore(CONFIG.STORES.USER_DATA, { keyPath: 'key' });
        }

        // Store pour les itinéraires cachés
        if (!db.objectStoreNames.contains(CONFIG.STORES.CACHED_ROUTES)) {
          const routesStore = db.createObjectStore(CONFIG.STORES.CACHED_ROUTES, { keyPath: 'id' });
          routesStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        console.log('[Offline] Base de données créée/mise à jour');
      };
    });
  }

  // ─────────────────────────────────────────
  // OPÉRATIONS CRUD GÉNÉRIQUES
  // ─────────────────────────────────────────

  /**
   * Ajoute ou met à jour un élément dans un store
   */
  function put(storeName, data) {
    return new Promise((resolve, reject) => {
      if (!state.db) {
        reject(new Error('Base de données non initialisée'));
        return;
      }

      const transaction = state.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Récupère un élément par sa clé
   */
  function get(storeName, key) {
    return new Promise((resolve, reject) => {
      if (!state.db) {
        reject(new Error('Base de données non initialisée'));
        return;
      }

      const transaction = state.db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Récupère tous les éléments d'un store
   */
  function getAll(storeName) {
    return new Promise((resolve, reject) => {
      if (!state.db) {
        reject(new Error('Base de données non initialisée'));
        return;
      }

      const transaction = state.db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Supprime un élément
   */
  function remove(storeName, key) {
    return new Promise((resolve, reject) => {
      if (!state.db) {
        reject(new Error('Base de données non initialisée'));
        return;
      }

      const transaction = state.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Vide un store
   */
  function clear(storeName) {
    return new Promise((resolve, reject) => {
      if (!state.db) {
        reject(new Error('Base de données non initialisée'));
        return;
      }

      const transaction = state.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ─────────────────────────────────────────
  // GESTION DES LIEUX
  // ─────────────────────────────────────────

  async function savePlaces(places) {
    const timestamp = Date.now();

    for (const place of places) {
      await put(CONFIG.STORES.PLACES, {
        ...place,
        _cachedAt: timestamp
      });
    }

    await setUserData('places_last_update', timestamp);
    console.log(`[Offline] ${places.length} lieux sauvegardés`);
  }

  async function getPlaces() {
    return await getAll(CONFIG.STORES.PLACES);
  }

  async function getPlaceById(id) {
    return await get(CONFIG.STORES.PLACES, id);
  }

  // ─────────────────────────────────────────
  // GESTION DES ALERTES
  // ─────────────────────────────────────────

  async function saveAlerts(alerts) {
    const timestamp = Date.now();

    // Nettoyer les anciennes alertes
    await clear(CONFIG.STORES.ALERTS);

    for (const alert of alerts) {
      await put(CONFIG.STORES.ALERTS, {
        ...alert,
        _cachedAt: timestamp
      });
    }

    await setUserData('alerts_last_update', timestamp);
    console.log(`[Offline] ${alerts.length} alertes sauvegardées`);
  }

  async function getAlerts() {
    return await getAll(CONFIG.STORES.ALERTS);
  }

  // ─────────────────────────────────────────
  // DONNÉES UTILISATEUR
  // ─────────────────────────────────────────

  async function setUserData(key, value) {
    return await put(CONFIG.STORES.USER_DATA, { key, value, timestamp: Date.now() });
  }

  async function getUserData(key) {
    const data = await get(CONFIG.STORES.USER_DATA, key);
    return data ? data.value : null;
  }

  async function saveLastPosition(position) {
    await setUserData('last_position', {
      lat: position.lat,
      lng: position.lng,
      accuracy: position.accuracy,
      timestamp: Date.now()
    });
  }

  async function getLastPosition() {
    return await getUserData('last_position');
  }

  async function getLastSyncTime() {
    return await getUserData('last_sync');
  }

  // ─────────────────────────────────────────
  // CACHE D'ITINÉRAIRES
  // ─────────────────────────────────────────

  async function cacheRoute(origin, destination, routeData) {
    const id = `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}_${destination.lat.toFixed(4)},${destination.lng.toFixed(4)}`;

    await put(CONFIG.STORES.CACHED_ROUTES, {
      id,
      origin,
      destination,
      route: routeData,
      timestamp: Date.now()
    });

    console.log('[Offline] Itinéraire mis en cache:', id);
  }

  async function getCachedRoute(origin, destination) {
    const id = `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}_${destination.lat.toFixed(4)},${destination.lng.toFixed(4)}`;
    const cached = await get(CONFIG.STORES.CACHED_ROUTES, id);

    if (cached && (Date.now() - cached.timestamp) < CONFIG.CACHE_DURATION) {
      console.log('[Offline] Itinéraire trouvé en cache');
      return cached.route;
    }

    return null;
  }

  async function cleanOldRoutes() {
    const routes = await getAll(CONFIG.STORES.CACHED_ROUTES);
    const now = Date.now();

    for (const route of routes) {
      if (now - route.timestamp > CONFIG.CACHE_DURATION) {
        await remove(CONFIG.STORES.CACHED_ROUTES, route.id);
      }
    }
  }

  // ─────────────────────────────────────────
  // PRÉ-CHARGEMENT DES TUILES
  // ─────────────────────────────────────────

  async function preloadTiles() {
    if (!navigator.serviceWorker || !navigator.serviceWorker.controller) {
      console.warn('[Offline] Service Worker non disponible');
      return;
    }

    const [south, west, north, east] = CONFIG.PRELOAD_BOUNDS;

    for (const zoom of CONFIG.PRELOAD_ZOOM_LEVELS) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_TILES',
        payload: {
          bounds: [south, west, north, east],
          zoom
        }
      });
    }

    console.log('[Offline] Pré-chargement des tuiles lancé');
  }

  // ─────────────────────────────────────────
  // SYNCHRONISATION
  // ─────────────────────────────────────────

  async function sync() {
    if (!state.isOnline) {
      console.log('[Offline] Hors ligne, synchronisation reportée');
      return false;
    }

    try {
      console.log('[Offline] Synchronisation en cours...');

      // Synchroniser les lieux
      try {
        const response = await fetch('data/places.json');
        if (response.ok) {
          const data = await response.json();
          await savePlaces(data.places || []);
        }
      } catch (e) {
        console.warn('[Offline] Échec sync lieux:', e);
      }

      // Synchroniser les alertes
      try {
        const response = await fetch('data/alerts.json');
        if (response.ok) {
          const data = await response.json();
          await saveAlerts(data.alerts || []);
        }
      } catch (e) {
        console.warn('[Offline] Échec sync alertes:', e);
      }

      // Nettoyer les anciens itinéraires
      await cleanOldRoutes();

      // Marquer la synchronisation
      state.lastSync = Date.now();
      await setUserData('last_sync', state.lastSync);

      console.log('[Offline] Synchronisation terminée');
      return true;
    } catch (error) {
      console.error('[Offline] Erreur synchronisation:', error);
      return false;
    }
  }

  /**
   * Vérifie si une synchronisation est nécessaire
   */
  async function needsSync() {
    const lastSync = await getLastSyncTime();
    if (!lastSync) return true;

    return (Date.now() - lastSync) > CONFIG.CACHE_DURATION;
  }

  // ─────────────────────────────────────────
  // GESTION CONNEXION
  // ─────────────────────────────────────────

  function handleOnline() {
    state.isOnline = true;
    console.log('[Offline] Connexion rétablie');

    // Synchroniser automatiquement
    sync();

    // Notifier l'application
    if (typeof ToastModule !== 'undefined') {
      ToastModule.show({
        type: 'success',
        title: 'Connexion rétablie',
        message: 'Synchronisation des données...'
      });
    }
  }

  function handleOffline() {
    state.isOnline = false;
    console.log('[Offline] Connexion perdue');

    // Notifier l'application
    if (typeof ToastModule !== 'undefined') {
      ToastModule.show({
        type: 'warning',
        title: 'Mode hors ligne',
        message: 'Les données en cache seront utilisées'
      });
    }
  }

  // ─────────────────────────────────────────
  // STATISTIQUES DU CACHE
  // ─────────────────────────────────────────

  async function getCacheStats() {
    const stats = {
      places: 0,
      alerts: 0,
      routes: 0,
      lastSync: null,
      storageUsed: 0
    };

    try {
      stats.places = (await getAll(CONFIG.STORES.PLACES)).length;
      stats.alerts = (await getAll(CONFIG.STORES.ALERTS)).length;
      stats.routes = (await getAll(CONFIG.STORES.CACHED_ROUTES)).length;
      stats.lastSync = await getLastSyncTime();

      // Estimer l'utilisation du stockage
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        stats.storageUsed = estimate.usage || 0;
        stats.storageQuota = estimate.quota || 0;
      }
    } catch (error) {
      console.warn('[Offline] Erreur stats:', error);
    }

    return stats;
  }

  /**
   * Efface toutes les données en cache
   */
  async function clearAllData() {
    await clear(CONFIG.STORES.PLACES);
    await clear(CONFIG.STORES.ALERTS);
    await clear(CONFIG.STORES.CACHED_ROUTES);
    await clear(CONFIG.STORES.USER_DATA);

    // Effacer aussi le cache du Service Worker
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
    }

    console.log('[Offline] Toutes les données effacées');
  }

  // ─────────────────────────────────────────
  // API PUBLIQUE
  // ─────────────────────────────────────────

  return {
    init,

    // Lieux
    savePlaces,
    getPlaces,
    getPlaceById,

    // Alertes
    saveAlerts,
    getAlerts,

    // Données utilisateur
    setUserData,
    getUserData,
    saveLastPosition,
    getLastPosition,

    // Itinéraires
    cacheRoute,
    getCachedRoute,

    // Synchronisation
    sync,
    needsSync,
    preloadTiles,

    // Statistiques
    getCacheStats,
    clearAllData,

    // État
    isOnline: () => state.isOnline,
    isInitialized: () => state.isInitialized,
    getLastSync: () => state.lastSync
  };

})();

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OfflineModule;
}
window.OfflineModule = OfflineModule;