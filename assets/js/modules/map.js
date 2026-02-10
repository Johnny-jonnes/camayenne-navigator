/**
 * MODULE CARTE LEAFLET
 * Carte interactive limitée à Camayenne
 * 
 * RÈGLE : Zoom et pan limités au quartier uniquement
 */

const MapModule = (function () {
  'use strict';

  // ─────────────────────────────────────────
  // CONFIGURATION
  // ─────────────────────────────────────────

  const CONFIG = {
    // Centre de Camayenne
    // Centre de Camayenne
    CENTER: [9.5376, -13.6827],

    // Zoom
    DEFAULT_ZOOM: 16,
    MIN_ZOOM: 14,
    MAX_ZOOM: 19,

    // Limites de la carte (bounding box Camayenne)
    MAX_BOUNDS: [
      [9.5250, -13.7000],  // Sud-Ouest (étendu)
      [9.5600, -13.6600]   // Nord-Est (étendu)
    ],

    // Tiles OpenStreetMap
    TILE_LAYER: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    TILE_ATTRIBUTION: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',

    // Style du polygone Camayenne
    ZONE_STYLE: {
      color: '#2563EB',
      weight: 3,
      opacity: 0.8,
      fillColor: '#3B82F6',
      fillOpacity: 0.1,
      dashArray: '5, 10'
    },

    // Style de la zone hors limites
    OUTSIDE_STYLE: {
      color: '#9CA3AF',
      weight: 1,
      opacity: 0.5,
      fillColor: '#1F2937',
      fillOpacity: 0.3
    }
  };

  // ─────────────────────────────────────────
  // ÉTAT
  // ─────────────────────────────────────────

  let state = {
    map: null,
    userMarker: null,
    userAccuracyCircle: null,
    zonePolygon: null,
    markersLayer: null,
    placesLayer: null,
    isInitialized: false
  };

  // ─────────────────────────────────────────
  // INITIALISATION
  // ─────────────────────────────────────────

  /**
   * Initialise la carte Leaflet
   * @param {string} containerId - ID du conteneur HTML
   */
  function init(containerId = 'map-container') {
    if (state.isInitialized) {
      console.warn('[Map] Déjà initialisée');
      return state.map;
    }

    const container = document.getElementById(containerId);
    if (!container) {
      console.error('[Map] Conteneur non trouvé:', containerId);
      return null;
    }

    // Créer la carte
    state.map = L.map(containerId, {
      center: CONFIG.CENTER,
      zoom: CONFIG.DEFAULT_ZOOM,
      minZoom: CONFIG.MIN_ZOOM,
      maxZoom: CONFIG.MAX_ZOOM,
      maxBounds: CONFIG.MAX_BOUNDS,
      maxBoundsViscosity: 1.0,
      zoomControl: false,  // On utilise nos propres contrôles
      attributionControl: true
    });

    // Ajouter les tuiles
    L.tileLayer(CONFIG.TILE_LAYER, {
      attribution: CONFIG.TILE_ATTRIBUTION,
      maxZoom: CONFIG.MAX_ZOOM
    }).addTo(state.map);

    // Créer les groupes de layers
    state.markersLayer = L.layerGroup().addTo(state.map);
    state.placesLayer = L.layerGroup().addTo(state.map);

    // Dessiner le polygone de Camayenne
    drawCamayenneZone();

    // Initialiser le module de routing avec la carte
    if (typeof RoutingModule !== 'undefined') {
      RoutingModule.init(state.map);
    }

    state.isInitialized = true;
    console.log('[Map] Initialisée avec succès');

    return state.map;
  }

  // ─────────────────────────────────────────
  // POLYGONE ZONE CAMAYENNE
  // ─────────────────────────────────────────

  function drawCamayenneZone() {
    const polygon = GeolocationModule.getCamayennePolygon();

    if (!polygon || polygon.length === 0) {
      console.error('[Map] Polygone Camayenne non disponible');
      return;
    }

    // Convertir les coordonnées [lat, lng] pour Leaflet
    const latLngs = polygon.map(coord => [coord[0], coord[1]]);

    // Créer le polygone
    state.zonePolygon = L.polygon(latLngs, CONFIG.ZONE_STYLE);
    state.zonePolygon.addTo(state.map);

    // Ajouter un tooltip
    state.zonePolygon.bindTooltip('Quartier Camayenne', {
      permanent: false,
      direction: 'center',
      className: 'zone-tooltip'
    });
  }

  // ─────────────────────────────────────────
  // MARKER UTILISATEUR
  // ─────────────────────────────────────────

  /**
   * Met à jour la position de l'utilisateur sur la carte
   * @param {Object} position - {lat, lng, accuracy}
   */
  function updateUserPosition(position) {
    if (!state.map || !position) return;

    const { lat, lng, accuracy } = position;
    const latLng = [lat, lng];

    // Créer ou mettre à jour le marker
    if (!state.userMarker) {
      // Créer l'icône personnalisée
      const userIcon = L.divIcon({
        className: 'user-marker',
        html: `
          <div class="user-marker-pulse"></div>
          <div class="user-marker-dot">
            <div class="user-marker-arrow"></div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });

      state.userMarker = L.marker(latLng, {
        icon: userIcon,
        zIndexOffset: 1000
      }).addTo(state.map);

      // Cercle de précision
      state.userAccuracyCircle = L.circle(latLng, {
        radius: accuracy || 20,
        color: '#3B82F6',
        fillColor: '#3B82F6',
        fillOpacity: 0.15,
        weight: 1,
        opacity: 0.5
      }).addTo(state.map);
    } else {
      // Mettre à jour la position
      state.userMarker.setLatLng(latLng);
      state.userAccuracyCircle.setLatLng(latLng);
      state.userAccuracyCircle.setRadius(accuracy || 20);
    }
  }

  /**
   * Centre la carte sur l'utilisateur
   */
  function centerOnUser(animate = true) {
    if (!state.userMarker) {
      console.warn('[Map] Position utilisateur non disponible');
      return;
    }

    const latLng = state.userMarker.getLatLng();
    state.map.setView(latLng, CONFIG.DEFAULT_ZOOM, {
      animate: animate,
      duration: 0.5
    });
  }

  // ─────────────────────────────────────────
  // MARKERS DES LIEUX
  // ─────────────────────────────────────────

  /**
   * Affiche les lieux sur la carte
   * @param {Array} places - Liste des lieux
   */
  function displayPlaces(places) {
    if (!state.placesLayer) return;

    // Nettoyer les markers existants
    state.placesLayer.clearLayers();

    places.forEach(place => {
      const marker = createPlaceMarker(place);
      if (marker) {
        marker.addTo(state.placesLayer);
      }
    });
  }

  /**
   * Crée un marker personnalisé pour un lieu
   */
  function createPlaceMarker(place) {
    const iconColors = {
      health: { bg: '#FEE2E2', color: '#DC2626', icon: '🏥' },
      security: { bg: '#DBEAFE', color: '#2563EB', icon: '🛡️' },
      admin: { bg: '#FEF3C7', color: '#D97706', icon: '🏛️' },
      transport: { bg: '#D1FAE5', color: '#059669', icon: '🚕' },
      leisure: { bg: '#E9D5FF', color: '#7C3AED', icon: '🎭' },
      religious: { bg: '#F1F5F9', color: '#475569', icon: '🕌' }
    };

    const style = iconColors[place.category] || iconColors.admin;

    const icon = L.divIcon({
      className: `place-marker place-marker-${place.category}`,
      html: `
        <div class="place-marker-container" style="background: ${style.bg}; border-color: ${style.color}">
          <span class="place-marker-icon">${style.icon}</span>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -20]
    });

    const marker = L.marker([place.lat, place.lng], { icon });

    // Popup avec bouton "S'y rendre"
    const popupContent = `
      <div class="place-popup">
        <h4 class="place-popup-name">${place.name}</h4>
        <p class="place-popup-category">${getCategoryLabel(place.category)}</p>
        <button class="btn btn-primary btn-sm btn-full place-popup-navigate" 
                onclick="App.navigateToPlace('${place.id}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z"/>
          </svg>
          S'y rendre
        </button>
      </div>
    `;

    marker.bindPopup(popupContent, {
      className: 'place-popup-container',
      closeButton: true,
      maxWidth: 250
    });

    // Stocker l'ID du lieu
    marker.placeId = place.id;

    return marker;
  }

  /**
   * Retourne le label d'une catégorie
   */
  function getCategoryLabel(category) {
    const labels = {
      health: 'Santé',
      security: 'Sécurité',
      admin: 'Administration',
      transport: 'Transport',
      leisure: 'Loisirs'
    };
    return labels[category] || 'Lieu';
  }

  /**
   * Filtre les markers par catégorie
   */
  function filterPlacesByCategory(category) {
    if (!state.placesLayer) return;

    state.placesLayer.eachLayer(marker => {
      const place = PlacesModule.getPlaceById(marker.placeId);
      if (!place) return;

      if (category === 'all' || place.category === category) {
        marker.setOpacity(1);
        if (marker._icon) marker._icon.style.display = 'block';
      } else {
        marker.setOpacity(0);
        if (marker._icon) marker._icon.style.display = 'none';
      }
    });
  }

  // ─────────────────────────────────────────
  // CONTRÔLES DE ZOOM
  // ─────────────────────────────────────────

  function zoomIn() {
    if (state.map) {
      state.map.zoomIn();
    }
  }

  function zoomOut() {
    if (state.map) {
      state.map.zoomOut();
    }
  }

  // ─────────────────────────────────────────
  // FLY TO (Animation vers une position)
  // ─────────────────────────────────────────

  function flyTo(lat, lng, zoom = CONFIG.DEFAULT_ZOOM) {
    if (state.map) {
      state.map.flyTo([lat, lng], zoom, {
        duration: 1,
        easeLinearity: 0.25
      });
    }
  }

  // ─────────────────────────────────────────
  // INVALIDATE SIZE (Après changement de vue)
  // ─────────────────────────────────────────

  function refresh() {
    if (state.map) {
      setTimeout(() => {
        state.map.invalidateSize();
        console.log('[Map] Dimensions rafraîchies (1)');
      }, 100);

      // Second appel de sécurité pour PWA
      setTimeout(() => {
        state.map.invalidateSize();
        console.log('[Map] Dimensions rafraîchies (2)');
      }, 500);
    }
  }

  // ─────────────────────────────────────────
  // API PUBLIQUE
  // ─────────────────────────────────────────

  return {
    init,
    updateUserPosition,
    centerOnUser,
    displayPlaces,
    filterPlacesByCategory,
    zoomIn,
    zoomOut,
    flyTo,
    refresh,

    // Getters
    getMap: () => state.map,
    isInitialized: () => state.isInitialized,
    getCenter: () => CONFIG.CENTER
  };

})();

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MapModule;
}
window.MapModule = MapModule;