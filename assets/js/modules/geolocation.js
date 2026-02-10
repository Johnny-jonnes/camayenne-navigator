/**
 * MODULE GÉOLOCALISATION
 * Gestion GPS + Vérification zone Camayenne
 * 
 * RÈGLE ABSOLUE : Seul Camayenne est valide
 */

const GeolocationModule = (function () {
  'use strict';

  // ─────────────────────────────────────────
  // CONFIGURATION
  // ─────────────────────────────────────────

  const CONFIG = {
    // Options Geolocation API
    GPS_OPTIONS: {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 30000
    },

    // Intervalle de mise à jour automatique (ms)
    UPDATE_INTERVAL: 30000,

    // Centre approximatif de Camayenne (pour fallback)
    CAMAYENNE_CENTER: {
      lat: 9.5376,
      lng: -13.6827
    }
  };

  // ─────────────────────────────────────────
  // POLYGONE CAMAYENNE (Limite géographique)
  // Coordonnées définissant les frontières exactes
  // ─────────────────────────────────────────

  const CAMAYENNE_POLYGON = [
    [9.5520, -13.6850],  // Nord-Ouest (étendu vers le haut)
    [9.5550, -13.6750],  // Nord (étendu vers le haut)
    [9.5500, -13.6680],  // Nord-Est (étendu vers le haut)
    [9.5400, -13.6680],  // Est
    [9.5350, -13.6685],  // Sud-Est
    [9.5290, -13.6710],  // Sud
    [9.5280, -13.6850],  // Sud-Ouest (étendu)
    [9.5320, -13.6950],  // Ouest (étendu)
    [9.5450, -13.6920],  // Nord-Ouest (retour)
    [9.5520, -13.6850]   // Fermeture polygone
  ];

  // ─────────────────────────────────────────
  // POINTS DE REPÈRE MAJEURS (pour contextualisation)
  // ─────────────────────────────────────────

  const LANDMARKS = [
    {
      id: 'donka',
      name: 'Hôpital National Donka',
      shortName: 'Hôpital Donka',
      lat: 9.5376,
      lng: -13.6827,
      type: 'health',
      importance: 1
    },
    {
      id: 'university',
      name: 'Université Gamal Abdel Nasser',
      shortName: 'Université UGANC',
      lat: 9.5444,
      lng: -13.6764,
      type: 'education',
      importance: 1
    },
    {
      id: 'stade',
      name: 'Stade du 28 Septembre',
      shortName: 'Stade 28 Septembre',
      lat: 9.5458,
      lng: -13.6729,
      type: 'sport',
      importance: 1
    },
    {
      id: 'marche',
      name: 'Marché de Camayenne',
      shortName: 'Marché Camayenne',
      lat: 9.5327,
      lng: -13.6908,
      type: 'commerce',
      importance: 2
    },
    {
      id: 'mosquee',
      name: 'Grande Mosquée de Camayenne',
      shortName: 'Grande Mosquée',
      lat: 9.5350,
      lng: -13.6878,
      type: 'religious',
      importance: 2
    },
    {
      id: 'carrefour',
      name: 'Carrefour Bellevue',
      shortName: 'Bellevue',
      lat: 9.5380,
      lng: -13.6810,
      type: 'landmark',
      importance: 2
    },
    {
      id: 'corniche',
      name: 'Corniche Nord',
      shortName: 'Corniche',
      lat: 9.5320,
      lng: -13.6850,
      type: 'landmark',
      importance: 3
    }
  ];

  // ─────────────────────────────────────────
  // ÉTAT DU MODULE
  // ─────────────────────────────────────────

  let state = {
    currentPosition: null,      // {lat, lng, accuracy, timestamp}
    isInCamayenne: false,       // Booléen zone valide
    watchId: null,              // ID surveillance GPS
    updateTimer: null,          // Timer mise à jour
    nearestLandmark: null,      // Repère le plus proche
    callbacks: {
      onPositionUpdate: null,
      onZoneChange: null,
      onError: null
    }
  };

  // ─────────────────────────────────────────
  // INITIALISATION
  // ─────────────────────────────────────────

  function init(callbacks = {}) {
    state.callbacks = { ...state.callbacks, ...callbacks };

    console.log('[Geolocation] Module initialisé');

    return checkSupport();
  }

  /**
   * Vérifie le support de la géolocalisation
   */
  function checkSupport() {
    if (!navigator.geolocation) {
      console.error('[Geolocation] API non supportée');
      triggerError('UNSUPPORTED', 'Votre navigateur ne supporte pas la géolocalisation');
      return false;
    }
    return true;
  }

  // ─────────────────────────────────────────
  // OBTENTION DE LA POSITION
  // ─────────────────────────────────────────

  /**
   * Récupère la position actuelle (une fois)
   * @returns {Promise<Object>} Position avec métadonnées
   */
  async function getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!checkSupport()) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const processedPosition = processPosition(position);
          resolve(processedPosition);
        },
        (error) => {
          handleError(error);
          reject(error);
        },
        CONFIG.GPS_OPTIONS
      );
    });
  }

  /**
   * Démarre la surveillance continue de la position
   */
  function startWatching() {
    if (!checkSupport()) return;

    // Arrêter surveillance existante
    stopWatching();

    // Surveillance GPS native
    state.watchId = navigator.geolocation.watchPosition(
      (position) => {
        processPosition(position);
      },
      (error) => {
        handleError(error);
      },
      CONFIG.GPS_OPTIONS
    );

    console.log('[Geolocation] Surveillance démarrée');
  }

  /**
   * Arrête la surveillance GPS
   */
  function stopWatching() {
    if (state.watchId !== null) {
      navigator.geolocation.clearWatch(state.watchId);
      state.watchId = null;
      console.log('[Geolocation] Surveillance arrêtée');
    }

    if (state.updateTimer) {
      clearInterval(state.updateTimer);
      state.updateTimer = null;
    }
  }

  // ─────────────────────────────────────────
  // TRAITEMENT DE LA POSITION
  // ─────────────────────────────────────────

  /**
   * Traite une position GPS brute
   * @param {GeolocationPosition} rawPosition 
   * @returns {Object} Position traitée avec contexte
   */
  function processPosition(rawPosition) {
    const coords = rawPosition.coords;

    const position = {
      lat: coords.latitude,
      lng: coords.longitude,
      accuracy: coords.accuracy,
      altitude: coords.altitude,
      heading: coords.heading,
      speed: coords.speed,
      timestamp: rawPosition.timestamp
    };

    // Vérifier si dans la zone Camayenne
    const wasInCamayenne = state.isInCamayenne;
    state.isInCamayenne = isPointInCamayenne(position.lat, position.lng);

    // Trouver le repère le plus proche
    state.nearestLandmark = findNearestLandmark(position.lat, position.lng);

    // Mettre à jour l'état
    state.currentPosition = position;

    // Construire l'objet de retour enrichi
    const enrichedPosition = {
      ...position,
      isInCamayenne: state.isInCamayenne,
      nearestLandmark: state.nearestLandmark,
      distanceToLandmark: state.nearestLandmark
        ? calculateDistance(position.lat, position.lng, state.nearestLandmark.lat, state.nearestLandmark.lng)
        : null
    };

    // Callbacks
    if (state.callbacks.onPositionUpdate) {
      state.callbacks.onPositionUpdate(enrichedPosition);
    }

    // Notification si changement de zone
    if (wasInCamayenne !== state.isInCamayenne && state.callbacks.onZoneChange) {
      state.callbacks.onZoneChange(state.isInCamayenne);
    }

    console.log('[Geolocation] Position mise à jour:', {
      lat: position.lat.toFixed(6),
      lng: position.lng.toFixed(6),
      inZone: state.isInCamayenne
    });

    return enrichedPosition;
  }

  // ─────────────────────────────────────────
  // VÉRIFICATION ZONE CAMAYENNE
  // ─────────────────────────────────────────

  /**
   * Vérifie si un point est dans le polygone de Camayenne
   * Algorithme : Ray Casting
   * @param {number} lat 
   * @param {number} lng 
   * @returns {boolean}
   */
  function isPointInCamayenne(lat, lng) {
    const polygon = CAMAYENNE_POLYGON;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0], yi = polygon[i][1];
      const xj = polygon[j][0], yj = polygon[j][1];

      const intersect = ((yi > lng) !== (yj > lng))
        && (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);

      if (intersect) inside = !inside;
    }

    return inside;
  }

  /**
   * Calcule la distance en mètres entre deux points (Haversine)
   */
  function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Rayon Terre en mètres
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function toRad(deg) {
    return deg * Math.PI / 180;
  }

  /**
   * Trouve le repère le plus proche de la position
   */
  function findNearestLandmark(lat, lng) {
    let nearest = null;
    let minDistance = Infinity;

    LANDMARKS.forEach(landmark => {
      const distance = calculateDistance(lat, lng, landmark.lat, landmark.lng);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = { ...landmark, distance };
      }
    });

    return nearest;
  }

  /**
   * Calcule la direction relative vers un point (bearing)
   */
  function calculateBearing(lat1, lng1, lat2, lng2) {
    const dLng = toRad(lng2 - lng1);
    const lat1Rad = toRad(lat1);
    const lat2Rad = toRad(lat2);

    const y = Math.sin(dLng) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
      Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);

    let bearing = Math.atan2(y, x);
    bearing = bearing * 180 / Math.PI;
    return (bearing + 360) % 360;
  }

  /**
   * Convertit un bearing en direction cardinale
   */
  function bearingToCardinal(bearing) {
    const directions = [
      { min: 0, max: 22.5, name: 'nord', prep: 'au nord de' },
      { min: 22.5, max: 67.5, name: 'nord-est', prep: 'au nord-est de' },
      { min: 67.5, max: 112.5, name: 'est', prep: 'à l\'est de' },
      { min: 112.5, max: 157.5, name: 'sud-est', prep: 'au sud-est de' },
      { min: 157.5, max: 202.5, name: 'sud', prep: 'au sud de' },
      { min: 202.5, max: 247.5, name: 'sud-ouest', prep: 'au sud-ouest de' },
      { min: 247.5, max: 292.5, name: 'ouest', prep: 'à l\'ouest de' },
      { min: 292.5, max: 337.5, name: 'nord-ouest', prep: 'au nord-ouest de' },
      { min: 337.5, max: 360, name: 'nord', prep: 'au nord de' }
    ];

    for (const dir of directions) {
      if (bearing >= dir.min && bearing < dir.max) {
        return dir;
      }
    }
    return directions[0];
  }

  /**
   * Génère une description de position relative
   */
  function getRelativePosition(lat, lng, landmark) {
    const distance = calculateDistance(lat, lng, landmark.lat, landmark.lng);
    const bearing = calculateBearing(landmark.lat, landmark.lng, lat, lng);
    const direction = bearingToCardinal(bearing);

    return {
      distance,
      bearing,
      direction: direction.name,
      preposition: direction.prep,
      landmark: landmark.shortName
    };
  }

  // ─────────────────────────────────────────
  // GESTION DES ERREURS
  // ─────────────────────────────────────────

  function handleError(error) {
    let errorCode, errorMessage;

    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorCode = 'PERMISSION_DENIED';
        errorMessage = 'Vous avez refusé l\'accès à votre position. Veuillez l\'autoriser dans les paramètres.';
        break;
      case error.POSITION_UNAVAILABLE:
        errorCode = 'POSITION_UNAVAILABLE';
        errorMessage = 'Position indisponible. Vérifiez votre GPS.';
        break;
      case error.TIMEOUT:
        errorCode = 'TIMEOUT';
        errorMessage = 'Délai dépassé. Réessayez dans un endroit avec meilleure réception.';
        break;
      default:
        errorCode = 'UNKNOWN';
        errorMessage = 'Erreur de géolocalisation inconnue.';
    }

    triggerError(errorCode, errorMessage);
  }

  function triggerError(code, message) {
    console.error(`[Geolocation] ${code}: ${message}`);

    if (state.callbacks.onError) {
      state.callbacks.onError({ code, message });
    }
  }

  // ─────────────────────────────────────────
  // API PUBLIQUE
  // ─────────────────────────────────────────

  return {
    init,
    getCurrentPosition,
    startWatching,
    stopWatching,
    isPointInCamayenne,
    calculateDistance,
    calculateBearing,
    bearingToCardinal,
    getRelativePosition,
    findNearestLandmark,

    // Getters
    getState: () => ({ ...state }),
    getCurrentState: () => state.currentPosition,
    isInZone: () => state.isInCamayenne,
    getNearestLandmark: () => state.nearestLandmark,
    getLandmarks: () => LANDMARKS,
    getCamayennePolygon: () => CAMAYENNE_POLYGON,
    getCamayenneCenter: () => CONFIG.CAMAYENNE_CENTER
  };

})();

// Export pour CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GeolocationModule;
}

// Export global pour le navigateur
window.GeolocationModule = GeolocationModule;