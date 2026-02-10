/**
 * MODULE ALERTES LOCALES
 * Gestion des alertes géolocalisées de Camayenne
 */

const AlertsModule = (function () {
  'use strict';

  // ─────────────────────────────────────────
  // ÉTAT
  // ─────────────────────────────────────────

  let state = {
    alerts: [],
    activeAlerts: [],
    nearbyAlerts: [],
    isLoaded: false
  };

  // ─────────────────────────────────────────
  // DONNÉES EMBARQUÉES (Fallback)
  // ─────────────────────────────────────────

  const EMBEDDED_ALERTS = [
    {
      id: "alert-default",
      type: "info",
      title: "Bienvenue à Camayenne",
      message: "Cette application vous aide à vous orienter dans le quartier Camayenne. Activez votre GPS pour une meilleure expérience.",
      location: {
        lat: 9.5370,
        lng: -13.6785,
        radius: 1000
      },
      startDate: "2024-01-01T00:00:00Z",
      endDate: "2024-12-31T23:59:59Z",
      priority: 0,
      active: true,
      source: "Camayenne Navigator"
    }
  ];

  // ─────────────────────────────────────────
  // TYPES D'ALERTES
  // ─────────────────────────────────────────

  const ALERT_TYPES = {
    info: {
      id: 'info',
      label: 'Information',
      icon: 'ℹ️',
      color: '#2563EB',
      bgColor: '#DBEAFE'
    },
    warning: {
      id: 'warning',
      label: 'Attention',
      icon: '⚠️',
      color: '#D97706',
      bgColor: '#FEF3C7'
    },
    danger: {
      id: 'danger',
      label: 'Urgent',
      icon: '🚨',
      color: '#DC2626',
      bgColor: '#FEE2E2'
    },
    success: {
      id: 'success',
      label: 'Bonne nouvelle',
      icon: '✅',
      color: '#059669',
      bgColor: '#D1FAE5'
    }
  };

  // ─────────────────────────────────────────
  // INITIALISATION
  // ─────────────────────────────────────────

  async function init() {
    try {
      const response = await fetch('data/alerts.json');
      if (response.ok) {
        const data = await response.json();
        state.alerts = data.alerts || [];
        console.log(`[Alerts] ${state.alerts.length} alertes chargées`);
      } else {
        throw new Error('JSON non disponible');
      }
    } catch (error) {
      console.warn('[Alerts] Utilisation des données embarquées:', error);
      state.alerts = EMBEDDED_ALERTS;
    }

    // Filtrer les alertes actives
    filterActiveAlerts();

    state.isLoaded = true;
    return state.activeAlerts;
  }

  // ─────────────────────────────────────────
  // FILTRAGE
  // ─────────────────────────────────────────

  function filterActiveAlerts() {
    const now = new Date();

    state.activeAlerts = state.alerts.filter(alert => {
      // Vérifier si l'alerte est active
      if (!alert.active) return false;

      // Vérifier les dates
      const startDate = new Date(alert.startDate);
      const endDate = new Date(alert.endDate);

      return now >= startDate && now <= endDate;
    });

    // Trier par priorité (plus haute en premier)
    state.activeAlerts.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  /**
   * Trouve les alertes à proximité de la position utilisateur
   */
  function findNearbyAlerts(userPosition) {
    if (!userPosition || !userPosition.lat || !userPosition.lng) {
      state.nearbyAlerts = [];
      return [];
    }

    state.nearbyAlerts = state.activeAlerts.filter(alert => {
      if (!alert.location) return false;

      const distance = GeolocationModule.calculateDistance(
        userPosition.lat, userPosition.lng,
        alert.location.lat, alert.location.lng
      );

      // Ajouter la distance à l'alerte
      alert.distance = distance;

      // Vérifier si dans le rayon
      return distance <= (alert.location.radius || 500);
    });

    return state.nearbyAlerts;
  }

  // ─────────────────────────────────────────
  // FORMATAGE
  // ─────────────────────────────────────────

  function formatAlert(alert) {
    const type = ALERT_TYPES[alert.type] || ALERT_TYPES.info;
    const now = new Date();
    const endDate = new Date(alert.endDate);
    const timeLeft = endDate - now;

    let timeLeftText = '';
    if (timeLeft > 0) {
      const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
      const daysLeft = Math.floor(hoursLeft / 24);

      if (daysLeft > 1) {
        timeLeftText = `${daysLeft} jours restants`;
      } else if (daysLeft === 1) {
        timeLeftText = '1 jour restant';
      } else if (hoursLeft > 1) {
        timeLeftText = `${hoursLeft}h restantes`;
      } else {
        timeLeftText = 'Se termine bientôt';
      }
    }

    return {
      ...alert,
      typeLabel: type.label,
      typeIcon: type.icon,
      typeColor: type.color,
      typeBgColor: type.bgColor,
      timeLeftText,
      distanceText: alert.distance ? formatDistance(alert.distance) : ''
    };
  }

  function formatDistance(meters) {
    if (meters < 100) return `${Math.round(meters)} m`;
    if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  }

  // ─────────────────────────────────────────
  // RENDU HTML
  // ─────────────────────────────────────────

  function renderAlertCard(alert, compact = false) {
    const formatted = formatAlert(alert);

    if (compact) {
      return `
        <div class="alert-card alert-${alert.type}" data-alert-id="${alert.id}">
          <div class="alert-icon">${formatted.typeIcon}</div>
          <div class="alert-content">
            <h4 class="alert-title">${alert.title}</h4>
            <p class="alert-message">${alert.message}</p>
            <div class="alert-meta">
              ${formatted.distanceText ? `<span>📍 ${formatted.distanceText}</span>` : ''}
              ${formatted.timeLeftText ? `<span>⏱️ ${formatted.timeLeftText}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }

    return `
      <article class="alert-card-full alert-${alert.type}" data-alert-id="${alert.id}">
        <div class="alert-card-header">
          <div class="alert-badge" style="background: ${formatted.typeBgColor}; color: ${formatted.typeColor}">
            <span>${formatted.typeIcon}</span>
            <span>${formatted.typeLabel}</span>
          </div>
          ${formatted.timeLeftText ? `
            <span class="alert-time">${formatted.timeLeftText}</span>
          ` : ''}
        </div>
        
        <h3 class="alert-card-title">${alert.title}</h3>
        <p class="alert-card-message">${alert.message}</p>
        
        <div class="alert-card-footer">
          ${alert.location?.description ? `
            <div class="alert-location">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
              <span>${alert.location.description}</span>
            </div>
          ` : ''}
          
          ${alert.source ? `
            <div class="alert-source">
              Source : ${alert.source}
            </div>
          ` : ''}
        </div>
      </article>
    `;
  }

  function renderAlertsList(container, alerts = null, compact = false) {
    const targetContainer = typeof container === 'string'
      ? document.getElementById(container)
      : container;

    if (!targetContainer) return;

    const alertsToRender = alerts || state.activeAlerts;

    if (alertsToRender.length === 0) {
      targetContainer.innerHTML = `
        <div class="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
          </svg>
          <p>Aucune alerte en cours</p>
          <span class="empty-state-hint">Le quartier est calme 😊</span>
        </div>
      `;
      return;
    }

    targetContainer.innerHTML = alertsToRender
      .map(alert => renderAlertCard(alert, compact))
      .join('');
  }

  function updateBadge() {
    const badge = document.getElementById('nav-alerts-badge');
    const countBadge = document.getElementById('alerts-count');
    const count = state.activeAlerts.length;

    if (badge) {
      if (count > 0) {
        badge.textContent = count > 9 ? '9+' : count;
        badge.hidden = false;
      } else {
        badge.hidden = true;
      }
    }

    if (countBadge) {
      countBadge.textContent = count;
    }
  }

  // ─────────────────────────────────────────
  // API PUBLIQUE
  // ─────────────────────────────────────────

  return {
    init,
    filterActiveAlerts,
    findNearbyAlerts,
    formatAlert,
    renderAlertCard,
    renderAlertsList,
    updateBadge,

    // Getters
    getAll: () => state.alerts,
    getActive: () => state.activeAlerts,
    getNearby: () => state.nearbyAlerts,
    getCount: () => state.activeAlerts.length,
    getTypes: () => ALERT_TYPES,
    isLoaded: () => state.isLoaded
  };

})();

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AlertsModule;
}
window.AlertsModule = AlertsModule;