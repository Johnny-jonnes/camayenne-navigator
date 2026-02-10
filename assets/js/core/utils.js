/**
 * UTILITAIRES GLOBAUX
 * Fonctions helper réutilisables
 */

const Utils = (function() {
  'use strict';

  // ─────────────────────────────────────────
  // MANIPULATION DU DOM
  // ─────────────────────────────────────────
  
  /**
   * Sélecteur simplifié
   */
  function $(selector, context = document) {
    return context.querySelector(selector);
  }

  function $$(selector, context = document) {
    return Array.from(context.querySelectorAll(selector));
  }

  /**
   * Crée un élément avec des attributs
   */
  function createElement(tag, attributes = {}, children = []) {
    const element = document.createElement(tag);
    
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'className') {
        element.className = value;
      } else if (key === 'innerHTML') {
        element.innerHTML = value;
      } else if (key === 'textContent') {
        element.textContent = value;
      } else if (key.startsWith('on') && typeof value === 'function') {
        element.addEventListener(key.substring(2).toLowerCase(), value);
      } else if (key === 'dataset') {
        Object.entries(value).forEach(([dataKey, dataValue]) => {
          element.dataset[dataKey] = dataValue;
        });
      } else {
        element.setAttribute(key, value);
      }
    });

    children.forEach(child => {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else if (child instanceof Node) {
        element.appendChild(child);
      }
    });

    return element;
  }

  /**
   * Affiche/masque un élément
   */
  function show(element) {
    if (typeof element === 'string') element = $(element);
    if (element) element.hidden = false;
  }

  function hide(element) {
    if (typeof element === 'string') element = $(element);
    if (element) element.hidden = true;
  }

  function toggle(element, force) {
    if (typeof element === 'string') element = $(element);
    if (element) element.hidden = force !== undefined ? !force : !element.hidden;
  }

  // ─────────────────────────────────────────
  // FORMATAGE
  // ─────────────────────────────────────────
  
  /**
   * Formate une distance en texte lisible
   */
  function formatDistance(meters) {
    if (meters == null || isNaN(meters)) return '';
    
    if (meters < 10) return 'ici';
    if (meters < 50) return 'quelques pas';
    if (meters < 100) return '~50 m';
    if (meters < 1000) return `${Math.round(meters / 50) * 50} m`;
    
    const km = meters / 1000;
    if (km < 10) return `${km.toFixed(1)} km`;
    return `${Math.round(km)} km`;
  }

  /**
   * Formate une durée en texte lisible
   */
  function formatDuration(seconds) {
    if (seconds == null || isNaN(seconds)) return '';
    
    const minutes = Math.round(seconds / 60);
    
    if (minutes < 1) return '< 1 min';
    if (minutes === 1) return '1 min';
    if (minutes < 60) return `${minutes} min`;
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (remainingMinutes === 0) return `${hours}h`;
    return `${hours}h ${remainingMinutes}min`;
  }

  /**
   * Formate un temps de marche à partir d'une distance
   */
  function formatWalkingTime(meters) {
    // Vitesse moyenne : 5 km/h = 83 m/min
    const minutes = Math.round(meters / 80);
    return formatDuration(minutes * 60);
  }

  /**
   * Formate une date relative
   */
  function formatRelativeTime(date) {
    const now = new Date();
    const target = new Date(date);
    const diffMs = target - now;
    const diffMins = Math.round(diffMs / 60000);
    const diffHours = Math.round(diffMs / 3600000);
    const diffDays = Math.round(diffMs / 86400000);

    if (diffMs < 0) {
      // Passé
      if (diffMins > -60) return `il y a ${Math.abs(diffMins)} min`;
      if (diffHours > -24) return `il y a ${Math.abs(diffHours)}h`;
      if (diffDays > -7) return `il y a ${Math.abs(diffDays)} jours`;
      return target.toLocaleDateString('fr-FR');
    } else {
      // Futur
      if (diffMins < 60) return `dans ${diffMins} min`;
      if (diffHours < 24) return `dans ${diffHours}h`;
      if (diffDays < 7) return `dans ${diffDays} jours`;
      return target.toLocaleDateString('fr-FR');
    }
  }

  /**
   * Formate un numéro de téléphone
   */
  function formatPhone(phone) {
    if (!phone) return '';
    // Supprimer tout sauf les chiffres et le +
    return phone.replace(/[^\d+]/g, '');
  }

  // ─────────────────────────────────────────
  // VALIDATION
  // ─────────────────────────────────────────
  
  /**
   * Vérifie si une coordonnée est valide
   */
  function isValidCoordinate(lat, lng) {
    return (
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      !isNaN(lat) &&
      !isNaN(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    );
  }

  /**
   * Vérifie si un objet est vide
   */
  function isEmpty(obj) {
    if (obj == null) return true;
    if (Array.isArray(obj)) return obj.length === 0;
    if (typeof obj === 'object') return Object.keys(obj).length === 0;
    if (typeof obj === 'string') return obj.trim().length === 0;
    return false;
  }

  // ─────────────────────────────────────────
  // DEBOUNCE & THROTTLE
  // ─────────────────────────────────────────
  
  /**
   * Debounce : exécute la fonction après un délai sans appel
   */
  function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Throttle : limite la fréquence d'exécution
   */
  function throttle(func, limit = 300) {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // ─────────────────────────────────────────
  // STOCKAGE LOCAL
  // ─────────────────────────────────────────
  
  const storage = {
    get(key, defaultValue = null) {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
      } catch (e) {
        console.warn('[Storage] Erreur lecture:', key, e);
        return defaultValue;
      }
    },

    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        console.warn('[Storage] Erreur écriture:', key, e);
        return false;
      }
    },

    remove(key) {
      try {
        localStorage.removeItem(key);
        return true;
      } catch (e) {
        return false;
      }
    },

    clear() {
      try {
        localStorage.clear();
        return true;
      } catch (e) {
        return false;
      }
    }
  };

  // ─────────────────────────────────────────
  // GÉOMÉTRIE
  // ─────────────────────────────────────────
  
  /**
   * Convertit des degrés en radians
   */
  function toRadians(degrees) {
    return degrees * Math.PI / 180;
  }

  /**
   * Convertit des radians en degrés
   */
  function toDegrees(radians) {
    return radians * 180 / Math.PI;
  }

  /**
   * Calcule la distance entre deux points (Haversine)
   */
  function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Rayon de la Terre en mètres
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);
    
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Calcule le bearing entre deux points
   */
  function calculateBearing(lat1, lng1, lat2, lng2) {
    const dLng = toRadians(lng2 - lng1);
    const lat1Rad = toRadians(lat1);
    const lat2Rad = toRadians(lat2);

    const y = Math.sin(dLng) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);

    let bearing = Math.atan2(y, x);
    bearing = toDegrees(bearing);
    return (bearing + 360) % 360;
  }

  // ─────────────────────────────────────────
  // DIVERS
  // ─────────────────────────────────────────
  
  /**
   * Génère un ID unique
   */
  function generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Copie du texte dans le presse-papiers
   */
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      // Fallback pour les anciens navigateurs
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      
      try {
        document.execCommand('copy');
        return true;
      } catch (e) {
        return false;
      } finally {
        document.body.removeChild(textarea);
      }
    }
  }

  /**
   * Attend un délai
   */
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Exécute une fonction de manière sécurisée
   */
  function safeExecute(fn, fallback = null) {
    try {
      const result = fn();
      return result instanceof Promise 
        ? result.catch(() => fallback)
        : result;
    } catch (error) {
      console.warn('[Utils] Erreur exécution:', error);
      return fallback;
    }
  }

  /**
   * Détecte le type d'appareil
   */
  function getDeviceInfo() {
    const ua = navigator.userAgent;
    return {
      isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua),
      isIOS: /iPad|iPhone|iPod/.test(ua),
      isAndroid: /Android/.test(ua),
      isSafari: /^((?!chrome|android).)*safari/i.test(ua),
      isStandalone: window.matchMedia('(display-mode: standalone)').matches || 
                    window.navigator.standalone === true
    };
  }

  /**
   * Vérifie le support des fonctionnalités
   */
  function checkSupport() {
    return {
      geolocation: 'geolocation' in navigator,
      serviceWorker: 'serviceWorker' in navigator,
      indexedDB: 'indexedDB' in window,
      notifications: 'Notification' in window,
      clipboard: 'clipboard' in navigator,
      share: 'share' in navigator,
      vibration: 'vibrate' in navigator
    };
  }

  // ─────────────────────────────────────────
  // API PUBLIQUE
  // ─────────────────────────────────────────
  
  return {
    // DOM
    $,
    $$,
    createElement,
    show,
    hide,
    toggle,
    
    // Formatage
    formatDistance,
    formatDuration,
    formatWalkingTime,
    formatRelativeTime,
    formatPhone,
    
    // Validation
    isValidCoordinate,
    isEmpty,
    
    // Timing
    debounce,
    throttle,
    sleep,
    
    // Storage
    storage,
    
    // Géométrie
    toRadians,
    toDegrees,
    calculateDistance,
    calculateBearing,
    
    // Divers
    generateId,
    copyToClipboard,
    safeExecute,
    getDeviceInfo,
    checkSupport
  };

})();

// Rendre disponible globalement
window.Utils = Utils;