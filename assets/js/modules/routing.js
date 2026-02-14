/**
 * MODULE ROUTING INTERNE
 * Navigation 100% sans services externes propriétaires
 * 
 * Utilise : OSRM (Open Source Routing Machine) - 100% gratuit
 * Fallback : Ligne directe avec boussole
 */

const RoutingModule = (function () {
  'use strict';

  // ─────────────────────────────────────────
  // CONFIGURATION
  // ─────────────────────────────────────────

  const CONFIG = {
    // OSRM Demo Server (gratuit, open source)
    // Alternative : héberger son propre serveur OSRM
    OSRM_API: 'https://router.project-osrm.org/route/v1',

    // Profil de routing (walking = à pied, idéal pour quartier)
    PROFILE: 'foot', // Options: 'car', 'bike', 'foot'

    // Options de requête
    OPTIONS: {
      alternatives: false,
      steps: true,           // Instructions détaillées
      geometries: 'geojson', // Format GeoJSON pour Leaflet
      overview: 'full',      // Géométrie complète du trajet
      annotations: true      // Durée, distance par segment
    },

    // Style du tracé sur la carte
    ROUTE_STYLE: {
      color: '#2563EB',        // Bleu primaire
      weight: 6,
      opacity: 0.85,
      lineCap: 'round',
      lineJoin: 'round'
    },

    ROUTE_STYLE_OUTLINE: {
      color: '#1E40AF',
      weight: 10,
      opacity: 0.3
    },

    // Style de la ligne directe (fallback)
    DIRECT_LINE_STYLE: {
      color: '#F59E0B',
      weight: 4,
      opacity: 0.7,
      dashArray: '10, 10'
    }
  };

  // ─────────────────────────────────────────
  // ÉTAT DU MODULE
  // ─────────────────────────────────────────

  let state = {
    map: null,                    // Instance Leaflet
    routeLayer: null,             // Groupe de layers pour la route
    currentRoute: null,           // Données de la route actuelle
    userMarker: null,             // Marker position utilisateur
    destinationMarker: null,      // Marker destination
    isNavigating: false,          // Mode navigation actif
    watchId: null                 // ID du watch GPS
  };

  // ─────────────────────────────────────────
  // INITIALISATION
  // ─────────────────────────────────────────

  function init(mapInstance) {
    state.map = mapInstance;

    // Initialiser le layer de route s'il n'existe pas
    if (!state.routeLayer) {
      state.routeLayer = L.layerGroup();
    }
    state.routeLayer.addTo(state.map);

    // S'abonner aux changements de sheet pour réafficher le panel navigation
    if (typeof StateManager !== 'undefined') {
      StateManager.subscribe('activeSheet', (sheetId) => {
        // Si aucun sheet n'est ouvert et qu'on est en train de naviguer
        if (!sheetId && (state.isNavigating || localStorage.getItem('nav_isNavigating') === 'true')) {
          const panel = document.getElementById('navigation-panel');
          if (panel) panel.classList.add('active');
        }
      });
    }

    // Restaurer l'itinéraire si présent dans le localStorage
    restoreActiveRoute();

    console.log('[Routing] Module initialisé');
  }

  // ─────────────────────────────────────────
  // CALCUL D'ITINÉRAIRE VIA OSRM
  // ─────────────────────────────────────────

  /**
   * Calcule et affiche un itinéraire entre deux points
   * @param {Object} origin - {lat, lng}
   * @param {Object} destination - {lat, lng}
   * @param {Object} options - Options additionnelles
   * @returns {Promise<Object>} Données de la route
   */
  async function calculateRoute(origin, destination, options = {}) {
    const placeName = options.placeName || 'Destination';

    try {
      // Afficher état de chargement
      showLoadingState();

      // VÉRIFICATION DE ZONE STRICTE (Camayenne uniquement)
      const isOriginInZone = GeolocationModule.isPointInCamayenne(origin.lat, origin.lng);
      const isDestInZone = GeolocationModule.isPointInCamayenne(destination.lat, destination.lng);

      if (!isOriginInZone || !isDestInZone) {
        ToastModule.show({
          type: 'warning',
          title: 'Hors zone Camayenne',
          message: !isOriginInZone
            ? "Votre position actuelle est hors du quartier Camayenne. Navigation impossible."
            : "La destination est hors du quartier Camayenne. Navigation impossible."
        });
        hideLoadingState();
        return Promise.reject('Outside neighborhood boundaries');
      }

      // Construire l'URL OSRM
      const url = buildOSRMUrl(origin, destination);

      // Appel API
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`OSRM Error: ${response.status}`);
      }

      const data = await response.json();

      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        throw new Error('Aucun itinéraire trouvé');
      }

      // Traiter et afficher la route
      const route = processRoute(data.routes[0], origin, destination, placeName);
      displayRoute(route);

      return route;

    } catch (error) {
      console.warn('[Routing] OSRM indisponible, fallback ligne directe:', error);

      // Fallback : ligne directe avec boussole
      return displayDirectLine(origin, destination, placeName);
    } finally {
      hideLoadingState();
    }
  }

  /**
   * Construit l'URL pour l'API OSRM
   */
  function buildOSRMUrl(origin, destination) {
    const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
    const params = new URLSearchParams({
      alternatives: CONFIG.OPTIONS.alternatives,
      steps: CONFIG.OPTIONS.steps,
      geometries: CONFIG.OPTIONS.geometries,
      overview: CONFIG.OPTIONS.overview,
      annotations: CONFIG.OPTIONS.annotations
    });

    return `${CONFIG.OSRM_API}/${CONFIG.PROFILE}/${coords}?${params}`;
  }

  /**
   * Traite les données de route OSRM
   */
  function processRoute(rawRoute, origin, destination, placeName) {
    const route = {
      distance: rawRoute.distance,           // mètres
      duration: rawRoute.duration,           // secondes
      geometry: rawRoute.geometry,           // GeoJSON
      steps: [],
      origin: origin,
      destination: destination,
      placeName: placeName
    };

    // Extraire les instructions de navigation
    if (rawRoute.legs && rawRoute.legs[0] && rawRoute.legs[0].steps) {
      route.steps = rawRoute.legs[0].steps.map(step => ({
        instruction: translateInstruction(step.maneuver),
        distance: step.distance,
        duration: step.duration,
        name: step.name || 'Route',
        maneuver: step.maneuver
      }));
    }

    return route;
  }

  /**
   * Traduit les instructions OSRM en français simplifié
   */
  function translateInstruction(maneuver) {
    const translations = {
      'depart': 'Départ',
      'arrive': 'Arrivée à destination',
      'turn': {
        'left': 'Tournez à gauche',
        'right': 'Tournez à droite',
        'slight left': 'Légèrement à gauche',
        'slight right': 'Légèrement à droite',
        'sharp left': 'Tournez fortement à gauche',
        'sharp right': 'Tournez fortement à droite',
        'uturn': 'Faites demi-tour'
      },
      'continue': 'Continuez tout droit',
      'roundabout': 'Au rond-point',
      'fork': {
        'left': 'Prenez à gauche à la fourche',
        'right': 'Prenez à droite à la fourche'
      },
      'end of road': {
        'left': 'En fin de route, tournez à gauche',
        'right': 'En fin de route, tournez à droite'
      }
    };

    const type = maneuver.type;
    const modifier = maneuver.modifier;

    if (type === 'turn' && translations.turn[modifier]) {
      return translations.turn[modifier];
    }

    if (type === 'fork' && translations.fork[modifier]) {
      return translations.fork[modifier];
    }

    if (type === 'end of road' && translations['end of road'][modifier]) {
      return translations['end of road'][modifier];
    }

    return translations[type] || `${type} ${modifier || ''}`.trim();
  }

  // ─────────────────────────────────────────
  // AFFICHAGE DE LA ROUTE SUR LEAFLET
  // ─────────────────────────────────────────

  function displayRoute(route) {
    // Nettoyer les anciens tracés
    clearRoute();

    // Créer le tracé principal
    const routeOutline = L.geoJSON(route.geometry, {
      style: CONFIG.ROUTE_STYLE_OUTLINE
    });

    const routeLine = L.geoJSON(route.geometry, {
      style: CONFIG.ROUTE_STYLE
    });

    // Ajouter au layer group
    state.routeLayer.addLayer(routeOutline);
    state.routeLayer.addLayer(routeLine);

    // Ajouter les markers
    addRouteMarkers(route);

    // Ajuster la vue de la carte
    const bounds = routeLine.getBounds().pad(0.1);
    state.map.fitBounds(bounds, {
      padding: [50, 50],
      maxZoom: 17
    });

    // Sauvegarder la route courante
    state.currentRoute = route;
    state.isNavigating = true;

    // Persister dans le localStorage
    saveActiveRoute();

    // Afficher le panneau d'instructions
    showNavigationPanel(route);

    // Démarrer le suivi GPS
    startPositionTracking();
  }

  /**
   * Ajoute les markers de départ et d'arrivée
   */
  function addRouteMarkers(route) {
    // Marker de départ (position utilisateur)
    const startIcon = L.divIcon({
      className: 'route-marker-start',
      html: `
        <div class="marker-pulse"></div>
        <div class="marker-dot">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="8"/>
          </svg>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    state.userMarker = L.marker(
      [route.origin.lat, route.origin.lng],
      { icon: startIcon }
    ).addTo(state.routeLayer);

    // Marker d'arrivée (destination)
    const endIcon = L.divIcon({
      className: 'route-marker-end',
      html: `
        <div class="marker-pin">
          <svg width="32" height="40" viewBox="0 0 24 32" fill="none">
            <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20c0-6.6-5.4-12-12-12z" fill="#EF4444"/>
            <circle cx="12" cy="12" r="5" fill="white"/>
          </svg>
        </div>
        <div class="marker-label">${route.placeName}</div>
      `,
      iconSize: [120, 60],
      iconAnchor: [60, 50]
    });

    state.destinationMarker = L.marker(
      [route.destination.lat, route.destination.lng],
      { icon: endIcon }
    ).addTo(state.routeLayer);
  }

  // ─────────────────────────────────────────
  // FALLBACK : LIGNE DIRECTE
  // ─────────────────────────────────────────

  function displayDirectLine(origin, destination, placeName) {
    clearRoute();

    // Calculer la distance à vol d'oiseau
    const distance = calculateDistance(origin, destination);

    // Calculer l'orientation (bearing)
    const bearing = calculateBearing(origin, destination);
    const direction = bearingToDirection(bearing);

    // Tracer la ligne directe
    const directLine = L.polyline(
      [[origin.lat, origin.lng], [destination.lat, destination.lng]],
      CONFIG.DIRECT_LINE_STYLE
    );

    state.routeLayer.addLayer(directLine);

    // Créer la route simplifiée
    const route = {
      distance: distance,
      duration: Math.round(distance / 80) * 60, // Estimation : 80m/min à pied
      geometry: null,
      steps: [
        {
          instruction: `Direction ${direction}`,
          distance: distance,
          bearing: bearing
        }
      ],
      origin: origin,
      destination: destination,
      placeName: placeName,
      isFallback: true
    };

    // Ajouter les markers avec icône boussole
    addFallbackMarkers(route);

    // Ajuster la vue
    const bounds = directLine.getBounds().pad(0.2);
    state.map.fitBounds(bounds);

    state.currentRoute = route;
    state.isNavigating = true;

    // Persister dans le localStorage
    saveActiveRoute();

    // Afficher panneau simplifié
    showFallbackNavigationPanel(route);

    return route;
  }

  /**
   * Calcule la distance entre deux points (formule Haversine)
   */
  function calculateDistance(point1, point2) {
    const R = 6371000; // Rayon de la Terre en mètres
    const dLat = toRad(point2.lat - point1.lat);
    const dLon = toRad(point2.lng - point1.lng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(point1.lat)) * Math.cos(toRad(point2.lat)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Calcule l'orientation (bearing) entre deux points
   */
  function calculateBearing(point1, point2) {
    const dLon = toRad(point2.lng - point1.lng);
    const lat1 = toRad(point1.lat);
    const lat2 = toRad(point2.lat);

    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

    let bearing = Math.atan2(y, x);
    bearing = toDeg(bearing);
    return (bearing + 360) % 360;
  }

  /**
   * Convertit un bearing en direction cardinale
   */
  function bearingToDirection(bearing) {
    const directions = [
      'Nord', 'Nord-Est', 'Est', 'Sud-Est',
      'Sud', 'Sud-Ouest', 'Ouest', 'Nord-Ouest'
    ];
    const index = Math.round(bearing / 45) % 8;
    return directions[index];
  }

  function toRad(deg) { return deg * Math.PI / 180; }
  function toDeg(rad) { return rad * 180 / Math.PI; }

  // ─────────────────────────────────────────
  // SUIVI DE POSITION EN TEMPS RÉEL
  // ─────────────────────────────────────────

  function startPositionTracking() {
    if (!navigator.geolocation) return;

    state.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        updateUserPosition({ lat: latitude, lng: longitude });
      },
      (error) => {
        console.warn('[Routing] Erreur suivi GPS:', error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000
      }
    );
  }

  function updateUserPosition(newPosition) {
    if (!state.isNavigating || !state.userMarker) return;

    // Mettre à jour le marker
    state.userMarker.setLatLng([newPosition.lat, newPosition.lng]);

    // Vérifier si proche de la destination
    if (state.currentRoute) {
      const distanceToEnd = calculateDistance(
        newPosition,
        state.currentRoute.destination
      );

      if (distanceToEnd < 30) {
        showArrivalMessage();
      }
    }
  }

  // ─────────────────────────────────────────
  // INTERFACE NAVIGATION
  // ─────────────────────────────────────────

  function showNavigationPanel(route) {
    const panel = document.getElementById('navigation-panel');
    if (!panel) return;

    const distanceText = formatDistance(route.distance);
    const durationText = formatDuration(route.duration);

    panel.innerHTML = `
      <div class="nav-panel-header">
        <div class="nav-panel-destination">
          <span class="nav-panel-label">Vers</span>
          <span class="nav-panel-name">${route.placeName}</span>
        </div>
        <button class="btn btn-icon btn-secondary nav-panel-close" onclick="RoutingModule.stopNavigation()">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      
      <div class="nav-panel-stats">
        <div class="nav-stat">
          <span class="nav-stat-value">${distanceText}</span>
          <span class="nav-stat-label">Distance</span>
        </div>
        <div class="nav-stat-divider"></div>
        <div class="nav-stat">
          <span class="nav-stat-value">${durationText}</span>
          <span class="nav-stat-label">À pied</span>
        </div>
      </div>
      
      ${route.steps.length > 0 ? `
        <div class="nav-panel-instructions">
          <div class="nav-instruction nav-instruction-current">
            <div class="nav-instruction-icon">
              ${getManeuverIcon(route.steps[0].maneuver)}
            </div>
            <div class="nav-instruction-text">
              <span class="nav-instruction-action">${route.steps[0].instruction}</span>
              ${route.steps[0].name ? `<span class="nav-instruction-street">${route.steps[0].name}</span>` : ''}
            </div>
            <div class="nav-instruction-distance">
              ${formatDistance(route.steps[0].distance)}
            </div>
          </div>
        </div>
      ` : ''}
      
      <button class="nav-panel-cancel" onclick="RoutingModule.stopNavigation()">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
        Annuler la navigation
      </button>
    `;

    panel.classList.add('active');
  }

  function showFallbackNavigationPanel(route) {
    const panel = document.getElementById('navigation-panel');
    if (!panel) return;

    const distanceText = formatDistance(route.distance);
    const bearing = route.steps[0].bearing;

    panel.innerHTML = `
      <div class="nav-panel-header">
        <div class="nav-panel-destination">
          <span class="nav-panel-label">Vers</span>
          <span class="nav-panel-name">${route.placeName}</span>
        </div>
        <button class="btn btn-icon btn-secondary nav-panel-close" onclick="RoutingModule.stopNavigation()">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      
      <div class="nav-panel-compass">
        <div class="compass-ring">
          <div class="compass-arrow" style="transform: rotate(${bearing}deg)">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
            </svg>
          </div>
        </div>
        <div class="compass-info">
          <span class="compass-direction">${route.steps[0].instruction}</span>
          <span class="compass-distance">${distanceText}</span>
        </div>
      </div>
      
      <div class="nav-panel-notice">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
        <span>Mode boussole • Suivez la direction indiquée</span>
      </div>
      
      <button class="nav-panel-cancel" onclick="RoutingModule.stopNavigation()">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
        Annuler la navigation
      </button>
    `;

    panel.classList.add('active');
  }

  function showArrivalMessage() {
    ToastModule.show({
      type: 'success',
      title: 'Vous êtes arrivé !',
      message: `Destination : ${state.currentRoute.placeName}`
    });
  }

  // ─────────────────────────────────────────
  // UTILITAIRES AFFICHAGE
  // ─────────────────────────────────────────

  function formatDistance(meters) {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
  }

  function formatDuration(seconds) {
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}min`;
  }

  function getManeuverIcon(maneuver) {
    const icons = {
      'turn-left': '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M14 7v4h-4l6 8 6-8h-4V7h-4z" transform="rotate(-90 12 12)"/></svg>',
      'turn-right': '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M14 7v4h-4l6 8 6-8h-4V7h-4z" transform="rotate(90 12 12)"/></svg>',
      'straight': '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l-6 8h4v8h4v-8h4l-6-8z"/></svg>',
      'default': '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="4"/></svg>'
    };

    if (!maneuver) return icons.default;

    const type = maneuver.type;
    const modifier = maneuver.modifier;

    if (type === 'turn' && modifier && modifier.includes('left')) {
      return icons['turn-left'];
    }
    if (type === 'turn' && modifier && modifier.includes('right')) {
      return icons['turn-right'];
    }
    if (type === 'continue' || type === 'depart') {
      return icons.straight;
    }

    return icons.default;
  }

  // ─────────────────────────────────────────
  // CONTRÔLES
  // ─────────────────────────────────────────

  function stopNavigation() {
    const hadRoute = !!state.currentRoute;
    const routeName = state.currentRoute ? state.currentRoute.placeName : '';

    clearRoute();

    state.currentRoute = null;
    state.isNavigating = false;

    if (state.watchId) {
      navigator.geolocation.clearWatch(state.watchId);
      state.watchId = null;
    }

    // Fermer le panneau de navigation
    const panel = document.getElementById('navigation-panel');
    if (panel) {
      panel.classList.remove('active');
    }

    // Fermer le bottom sheet de détails s'il est ouvert
    if (typeof BottomSheetModule !== 'undefined') {
      BottomSheetModule.close('route-detail-sheet');
    }

    // Nettoyer l'état persisté dans localStorage
    try {
      localStorage.removeItem('nav_activeRoute');
      localStorage.removeItem('nav_isNavigating');
      localStorage.removeItem('nav_timestamp');
    } catch (e) {
      // Silencieux si localStorage indisponible
    }

    // Mettre à jour le StateManager si nécessaire
    if (typeof StateManager !== 'undefined') {
      StateManager.actions.stopNavigation();
    }

    // Afficher un toast de confirmation
    if (hadRoute && typeof ToastModule !== 'undefined') {
      ToastModule.show({
        type: 'info',
        title: 'Itinéraire annulé',
        message: routeName ? `Navigation vers ${routeName} terminée` : 'La navigation a été arrêtée'
      });
    }

    console.log('[Routing] Navigation arrêtée');
  }

  /**
   * Sauvegarde l'itinéraire actuel dans le localStorage
   */
  function saveActiveRoute() {
    if (!state.currentRoute) return;
    try {
      localStorage.setItem('nav_activeRoute', JSON.stringify(state.currentRoute));
      localStorage.setItem('nav_isNavigating', 'true');
      localStorage.setItem('nav_timestamp', Date.now().toString());

      // Synchroniser avec StateManager
      if (typeof StateManager !== 'undefined') {
        StateManager.actions.startNavigation(state.currentRoute);
      }
    } catch (e) {
      console.warn('[Routing] Échec sauvegarde itinéraire:', e);
    }
  }

  /**
   * Restaure l'itinéraire depuis le localStorage
   */
  async function restoreActiveRoute() {
    try {
      const savedRoute = localStorage.getItem('nav_activeRoute');
      const isNavigating = localStorage.getItem('nav_isNavigating') === 'true';
      const timestamp = localStorage.getItem('nav_timestamp');

      // Si l'itinéraire date de plus de 4 heures, on l'expire
      if (timestamp && (Date.now() - parseInt(timestamp) > 4 * 60 * 60 * 1000)) {
        localStorage.removeItem('nav_activeRoute');
        localStorage.removeItem('nav_isNavigating');
        localStorage.removeItem('nav_timestamp');
        return;
      }

      if (savedRoute && isNavigating) {
        const route = JSON.parse(savedRoute);
        console.log('[Routing] Restauration itinéraire:', route.placeName);

        // Attendre que la carte soit initialisée (important après refresh)
        const checkMap = setInterval(() => {
          if (state.map) {
            clearInterval(checkMap);
            displayRoute(route);

            // Si on est sur une autre page que la carte, masquer le layer pour l'instant
            // mais garder l'état 'isNavigating'
            if (window.location.hash !== '#map' && window.location.hash !== '') {
              const panel = document.getElementById('navigation-panel');
              if (panel) panel.classList.remove('active');
            }
          }
        }, 100);

        // Timeout de sécurité pour arrêter de chercher la carte
        setTimeout(() => clearInterval(checkMap), 5000);
      }
    } catch (e) {
      console.warn('[Routing] Échec restauration itinéraire:', e);
      localStorage.removeItem('nav_activeRoute');
      localStorage.removeItem('nav_isNavigating');
      localStorage.removeItem('nav_timestamp');
    }
  }

  function clearRoute() {
    state.routeLayer.clearLayers();
    state.userMarker = null;
    state.destinationMarker = null;
  }

  function showLoadingState() {
    const panel = document.getElementById('navigation-panel');
    if (panel) {
      panel.innerHTML = `
        <div class="nav-panel-loading">
          <div class="spinner"></div>
          <span>Calcul de l'itinéraire...</span>
        </div>
      `;
      panel.classList.add('active');
    }
  }

  function hideLoadingState() {
    const panel = document.getElementById('navigation-panel');
    if (panel) {
      panel.classList.remove('active');
    }
  }

  // ─────────────────────────────────────────
  // API PUBLIQUE
  // ─────────────────────────────────────────

  return {
    init,
    calculateRoute,
    stopNavigation,
    clearRoute,
    getCurrentRoute: () => state.currentRoute,
    isNavigating: () => state.isNavigating
  };

})();

// Export pour modules ES6 si nécessaire
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RoutingModule;
}
window.RoutingModule = RoutingModule;