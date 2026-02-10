/**
 * MODULE LIEUX ESSENTIELS
 * Gestion des lieux catégorisés de Camayenne
 */

const PlacesModule = (function () {
  'use strict';

  // ─────────────────────────────────────────
  // ÉTAT
  // ─────────────────────────────────────────

  let state = {
    places: [],
    filteredPlaces: [],
    currentFilter: 'all',
    searchQuery: '',
    isLoaded: false
  };

  // ─────────────────────────────────────────
  // DONNÉES EMBARQUÉES (Fallback offline)
  // ─────────────────────────────────────────

  const EMBEDDED_PLACES = [
    {
      id: "donka-hospital",
      name: "Hôpital National Donka",
      shortName: "Hôpital Donka",
      category: "health",
      lat: 9.5376,
      lng: -13.6827,
      phone: "+224 622 00 00 00",
      hours: "24h/24",
      importance: 1
    },
    {
      id: "commissariat-dixinn",
      name: "Commissariat Central de Dixinn",
      shortName: "Commissariat Dixinn",
      category: "security",
      lat: 9.5390,
      lng: -13.6815,
      phone: "117",
      hours: "24h/24",
      importance: 1
    },
    {
      id: "protection-civile",
      name: "Protection Civile (Pompiers)",
      shortName: "Protection Civile",
      category: "security",
      lat: 9.5405,
      lng: -13.6790,
      phone: "118",
      hours: "24h/24",
      importance: 1
    },
    {
      id: "mairie-dixinn",
      name: "Mairie de Dixinn",
      shortName: "Mairie Dixinn",
      category: "admin",
      lat: 9.5511,
      lng: -13.6731,
      hours: "8h-16h",
      importance: 1
    },
    {
      id: "universite-uganc",
      name: "Université Gamal Abdel Nasser",
      shortName: "Université UGANC",
      category: "admin",
      lat: 9.5444,
      lng: -13.6764,
      hours: "8h-18h",
      importance: 1
    },
    {
      id: "gare-routiere-madina",
      name: "Gare Routière Camayenne",
      shortName: "Gare Routière",
      category: "transport",
      lat: 9.5348,
      lng: -13.6825,
      hours: "5h-22h",
      importance: 1
    },
    {
      id: "stade-28-septembre",
      name: "Stade du 28 Septembre",
      shortName: "Stade 28 Septembre",
      category: "leisure",
      lat: 9.5458,
      lng: -13.6729,
      importance: 1
    },
    {
      id: "marche-camayenne",
      name: "Marché de Camayenne",
      shortName: "Marché Camayenne",
      category: "leisure",
      lat: 9.5327,
      lng: -13.6908,
      hours: "6h-19h",
      importance: 1
    },
    {
      id: "grande-mosquee",
      name: "Grande Mosquée de Camayenne",
      shortName: "Grande Mosquée",
      category: "religious",
      lat: 9.5350,
      lng: -13.6878,
      hours: "5h-22h",
      importance: 1
    }
  ];

  // ─────────────────────────────────────────
  // CATÉGORIES
  // ─────────────────────────────────────────

  const CATEGORIES = {
    health: {
      id: 'health',
      label: 'Santé',
      icon: '🏥',
      color: '#DC2626',
      bgColor: '#FEE2E2'
    },
    security: {
      id: 'security',
      label: 'Sécurité',
      icon: '🛡️',
      color: '#2563EB',
      bgColor: '#DBEAFE'
    },
    admin: {
      id: 'admin',
      label: 'Administration',
      icon: '🏛️',
      color: '#D97706',
      bgColor: '#FEF3C7'
    },
    transport: {
      id: 'transport',
      label: 'Transport',
      icon: '🚕',
      color: '#059669',
      bgColor: '#D1FAE5'
    },
    leisure: {
      id: 'leisure',
      label: 'Loisirs',
      icon: '🎭',
      color: '#7C3AED',
      bgColor: '#E9D5FF'
    },
    religious: {
      id: 'religious',
      label: 'Religieux',
      icon: '🕌',
      color: '#475569',
      bgColor: '#F1F5F9'
    }
  };

  // ─────────────────────────────────────────
  // INITIALISATION
  // ─────────────────────────────────────────

  async function init() {
    try {
      // Tenter de charger depuis le fichier JSON
      const response = await fetch('data/places.json');
      if (response.ok) {
        const data = await response.json();
        state.places = data.places || [];
        console.log(`[Places] ${state.places.length} lieux chargés depuis JSON`);
      } else {
        throw new Error('JSON non disponible');
      }
    } catch (error) {
      // Fallback sur les données embarquées
      console.warn('[Places] Utilisation des données embarquées:', error);
      state.places = EMBEDDED_PLACES;
    }

    // Calculer les distances si position disponible
    updateDistances();

    state.filteredPlaces = [...state.places];
    state.isLoaded = true;

    return state.places;
  }

  // ─────────────────────────────────────────
  // MISE À JOUR DES DISTANCES
  // ─────────────────────────────────────────

  function updateDistances() {
    const position = GeolocationModule.getCurrentState();
    if (!position) return;

    state.places.forEach(place => {
      place.distance = GeolocationModule.calculateDistance(
        position.lat, position.lng,
        place.lat, place.lng
      );
    });

    // Trier par distance
    state.places.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
    applyFilters();
  }

  // ─────────────────────────────────────────
  // FILTRAGE
  // ─────────────────────────────────────────

  function filterByCategory(category) {
    state.currentFilter = category;
    applyFilters();
    return state.filteredPlaces;
  }

  function search(query) {
    state.searchQuery = query.toLowerCase().trim();
    applyFilters();
    return state.filteredPlaces;
  }

  function applyFilters() {
    let filtered = [...state.places];

    // Filtre par catégorie
    if (state.currentFilter !== 'all') {
      filtered = filtered.filter(p => p.category === state.currentFilter);
    }

    // Filtre par recherche
    if (state.searchQuery) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(state.searchQuery) ||
        p.shortName?.toLowerCase().includes(state.searchQuery) ||
        p.category.toLowerCase().includes(state.searchQuery)
      );
    }

    state.filteredPlaces = filtered;
  }

  function clearFilters() {
    state.currentFilter = 'all';
    state.searchQuery = '';
    state.filteredPlaces = [...state.places];
  }

  // ─────────────────────────────────────────
  // GETTERS
  // ─────────────────────────────────────────

  function getPlaceById(id) {
    return state.places.find(p => p.id === id);
  }

  function getPlacesByCategory(category) {
    return state.places.filter(p => p.category === category);
  }

  function getNearestPlaces(limit = 5) {
    return state.places
      .filter(p => p.distance !== undefined)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);
  }

  function getEmergencyPlaces() {
    return state.places.filter(p =>
      p.category === 'health' || p.category === 'security'
    ).sort((a, b) => (a.distance || 0) - (b.distance || 0));
  }

  // ─────────────────────────────────────────
  // FORMATAGE POUR AFFICHAGE
  // ─────────────────────────────────────────

  function formatDistance(meters) {
    if (!meters && meters !== 0) return '';
    if (meters < 100) return `${Math.round(meters)} m`;
    if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  }

  function formatPlaceForList(place) {
    const category = CATEGORIES[place.category] || CATEGORIES.admin;

    return {
      ...place,
      categoryLabel: category.label,
      categoryIcon: category.icon,
      categoryColor: category.color,
      categoryBgColor: category.bgColor,
      distanceText: formatDistance(place.distance),
      walkingTime: estimateWalkingTime(place.distance)
    };
  }

  function estimateWalkingTime(meters) {
    if (!meters) return '';
    const minutes = Math.round(meters / 80);
    if (minutes < 1) return '< 1 min';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h${remainingMinutes > 0 ? ` ${remainingMinutes}min` : ''}`;
  }

  // ─────────────────────────────────────────
  // RENDU HTML
  // ─────────────────────────────────────────

  function renderPlaceCard(place) {
    const formatted = formatPlaceForList(place);

    return `
      <article class="place-card" data-place-id="${place.id}" onclick="App.showPlaceDetail('${place.id}')">
        <div class="place-card-icon ${place.category}">
          <span>${formatted.categoryIcon}</span>
        </div>
        <div class="place-card-content">
          <h4 class="place-card-name">${place.name}</h4>
          <div class="place-card-distance">
            ${formatted.distanceText ? `
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
              <span>${formatted.distanceText}</span>
              ${formatted.walkingTime ? `<span class="separator">•</span><span>${formatted.walkingTime} à pied</span>` : ''}
            ` : `<span>${formatted.categoryLabel}</span>`}
          </div>
        </div>
        <button class="place-card-action btn btn-icon btn-primary" 
                onclick="event.stopPropagation(); App.navigateToPlace('${place.id}')"
                title="S'y rendre">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z"/>
          </svg>
        </button>
      </article>
    `;
  }

  function renderPlacesList(places = null) {
    const listContainer = document.getElementById('places-list');
    if (!listContainer) return;

    const placesToRender = places || state.filteredPlaces;

    if (placesToRender.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
          </svg>
          <p>Aucun lieu trouvé</p>
          <span class="empty-state-hint">Essayez de modifier vos filtres</span>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = placesToRender
      .map(place => renderPlaceCard(place))
      .join('');
  }

  function renderPlaceDetail(placeId) {
    const place = getPlaceById(placeId);
    if (!place) return '';

    const formatted = formatPlaceForList(place);

    return `
      <div class="place-detail">
        <div class="place-detail-header">
          <div class="place-detail-icon ${place.category}">
            <span>${formatted.categoryIcon}</span>
          </div>
          <span class="place-detail-category">${formatted.categoryLabel}</span>
        </div>

        <div class="place-detail-info">
          ${place.address ? `
            <div class="place-detail-row">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                <circle cx="12" cy="9" r="2.5"/>
              </svg>
              <span>${place.address}</span>
            </div>
          ` : ''}

          ${formatted.distanceText ? `
            <div class="place-detail-row">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
              </svg>
              <span>${formatted.distanceText} • ${formatted.walkingTime} à pied</span>
            </div>
          ` : ''}

          ${place.phone ? `
            <div class="place-detail-row">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
              </svg>
              <a href="tel:${place.phone}" class="place-detail-link">${place.phone}</a>
            </div>
          ` : ''}

          ${place.hours ? `
            <div class="place-detail-row">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              <span>${place.hours}</span>
            </div>
          ` : ''}
        </div>

        ${place.description ? `
          <p class="place-detail-description">${place.description}</p>
        ` : ''}

        ${place.services && place.services.length > 0 ? `
          <div class="place-detail-services">
            <h5>Services disponibles</h5>
            <div class="services-list">
              ${place.services.map(s => `<span class="service-tag">${s}</span>`).join('')}
            </div>
          </div>
        ` : ''}

        <div class="place-detail-actions">
          <button class="btn btn-primary btn-full btn-lg" onclick="App.navigateToPlace('${place.id}')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z"/>
            </svg>
            S'y rendre
          </button>
          
          <button class="btn btn-secondary btn-full" onclick="App.showOnMap('${place.id}')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
              <line x1="8" y1="2" x2="8" y2="18"/>
              <line x1="16" y1="6" x2="16" y2="22"/>
            </svg>
            Voir sur la carte
          </button>
        </div>
      </div>
    `;
  }

  // ─────────────────────────────────────────
  // API PUBLIQUE
  // ─────────────────────────────────────────

  return {
    init,
    updateDistances,
    filterByCategory,
    search,
    clearFilters,
    getPlaceById,
    getPlacesByCategory,
    getNearestPlaces,
    getEmergencyPlaces,
    formatPlaceForList,
    renderPlaceCard,
    renderPlacesList,
    renderPlaceDetail,

    // Getters
    getAll: () => state.places,
    getFiltered: () => state.filteredPlaces,
    getCurrentFilter: () => state.currentFilter,
    getCategories: () => CATEGORIES,
    isLoaded: () => state.isLoaded
  };

})();

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PlacesModule;
}
window.PlacesModule = PlacesModule;