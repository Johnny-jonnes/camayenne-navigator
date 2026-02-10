/**
 * GESTIONNAIRE D'ÉTAT GLOBAL
 * Pattern simple de gestion d'état réactif
 */

const StateManager = (function () {
  'use strict';

  // ─────────────────────────────────────────
  // ÉTAT INITIAL
  // ─────────────────────────────────────────

  const initialState = {
    // Application
    isInitialized: false,
    isLoading: true,
    currentPage: 'home',

    // Connexion
    isOnline: navigator.onLine,

    // Position utilisateur
    userPosition: null,
    isInCamayenne: false,
    nearestLandmark: null,

    // Données
    places: [],
    alerts: [],

    // Navigation
    activeRoute: null,
    isNavigating: false,

    // UI
    activeModal: null,
    activeSheet: null,

    // Filtres
    placesFilter: 'all',
    searchQuery: ''
  };

  // ─────────────────────────────────────────
  // ÉTAT COURANT
  // ─────────────────────────────────────────

  let state = { ...initialState };
  let listeners = new Map();
  let middleware = [];

  // ─────────────────────────────────────────
  // GETTERS
  // ─────────────────────────────────────────

  /**
   * Récupère l'état complet ou une partie
   */
  function getState(path = null) {
    if (!path) return { ...state };

    return path.split('.').reduce((obj, key) => {
      return obj && obj[key] !== undefined ? obj[key] : undefined;
    }, state);
  }

  // ─────────────────────────────────────────
  // SETTERS
  // ─────────────────────────────────────────

  /**
   * Met à jour l'état
   */
  function setState(updates, silent = false) {
    const prevState = { ...state };

    // Appliquer les mises à jour
    if (typeof updates === 'function') {
      state = { ...state, ...updates(state) };
    } else {
      state = { ...state, ...updates };
    }

    // Exécuter les middleware
    middleware.forEach(mw => mw(prevState, state, updates));

    // Notifier les listeners si pas silencieux
    if (!silent) {
      notifyListeners(prevState, state);
    }

    return state;
  }

  /**
   * Met à jour une propriété imbriquée
   */
  function setNestedState(path, value) {
    const keys = path.split('.');
    const updates = {};
    let current = updates;

    keys.forEach((key, index) => {
      if (index === keys.length - 1) {
        current[key] = value;
      } else {
        current[key] = { ...getState(keys.slice(0, index + 1).join('.')) };
        current = current[key];
      }
    });

    setState(updates);
  }

  /**
   * Réinitialise l'état
   */
  function resetState() {
    setState(initialState);
  }

  // ─────────────────────────────────────────
  // SUBSCRIPTIONS
  // ─────────────────────────────────────────

  /**
   * S'abonne aux changements d'état
   */
  function subscribe(key, callback) {
    if (!listeners.has(key)) {
      listeners.set(key, new Set());
    }
    listeners.get(key).add(callback);

    // Retourne une fonction pour se désabonner
    return () => {
      listeners.get(key).delete(callback);
      if (listeners.get(key).size === 0) {
        listeners.delete(key);
      }
    };
  }

  /**
   * S'abonne à tout changement
   */
  function subscribeAll(callback) {
    return subscribe('*', callback);
  }

  /**
   * Notifie les listeners des changements
   */
  function notifyListeners(prevState, newState) {
    // Trouver les clés qui ont changé
    const changedKeys = Object.keys(newState).filter(key =>
      prevState[key] !== newState[key]
    );

    // Notifier les listeners spécifiques
    changedKeys.forEach(key => {
      if (listeners.has(key)) {
        listeners.get(key).forEach(callback => {
          callback(newState[key], prevState[key], key);
        });
      }
    });

    // Notifier les listeners globaux
    if (listeners.has('*') && changedKeys.length > 0) {
      listeners.get('*').forEach(callback => {
        callback(newState, prevState, changedKeys);
      });
    }
  }

  // ─────────────────────────────────────────
  // MIDDLEWARE
  // ─────────────────────────────────────────

  /**
   * Ajoute un middleware
   */
  function addMiddleware(mw) {
    middleware.push(mw);
    return () => {
      middleware = middleware.filter(m => m !== mw);
    };
  }

  // ─────────────────────────────────────────
  // MIDDLEWARE PAR DÉFAUT : LOGGER
  // ─────────────────────────────────────────

  const loggerMiddleware = (prevState, newState, updates) => {
    // Vérification sécurisée de l'environnement
    const isDev = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development';

    if (isDev) {
      console.group('[State] Mise à jour');
      console.log('Précédent:', prevState);
      console.log('Nouveau:', newState);
      console.log('Changements:', updates);
      console.groupEnd();
    }
  };

  // ─────────────────────────────────────────
  // MIDDLEWARE : PERSISTANCE
  // ─────────────────────────────────────────

  const persistenceMiddleware = (prevState, newState, updates) => {
    // Sauvegarder certaines parties de l'état dans localStorage
    const persistKeys = ['placesFilter', 'searchQuery'];

    persistKeys.forEach(key => {
      if (updates[key] !== undefined) {
        Utils.storage.set(`state_${key}`, newState[key]);
      }
    });
  };

  // ─────────────────────────────────────────
  // INITIALISATION
  // ─────────────────────────────────────────

  function init() {
    // Ajouter les middleware
    // addMiddleware(loggerMiddleware); // Décommenter pour debug
    addMiddleware(persistenceMiddleware);

    // Restaurer l'état persisté
    const persistKeys = ['placesFilter', 'searchQuery'];
    const restoredState = {};

    persistKeys.forEach(key => {
      const value = Utils.storage.get(`state_${key}`);
      if (value !== null) {
        restoredState[key] = value;
      }
    });

    if (Object.keys(restoredState).length > 0) {
      setState(restoredState, true);
    }

    console.log('[State] Manager initialisé');
  }

  // ─────────────────────────────────────────
  // ACTIONS PRÉDÉFINIES
  // ─────────────────────────────────────────

  const actions = {
    setLoading(isLoading) {
      setState({ isLoading });
    },

    setOnline(isOnline) {
      setState({ isOnline });
    },

    setUserPosition(position) {
      setState({
        userPosition: position,
        isInCamayenne: position?.isInCamayenne || false,
        nearestLandmark: position?.nearestLandmark || null
      });
    },

    setPlaces(places) {
      setState({ places });
    },

    setAlerts(alerts) {
      setState({ alerts });
    },

    setCurrentPage(page) {
      setState({ currentPage: page });
    },

    setPlacesFilter(filter) {
      setState({ placesFilter: filter });
    },

    setSearchQuery(query) {
      setState({ searchQuery: query });
    },

    startNavigation(route) {
      setState({
        activeRoute: route,
        isNavigating: true
      });
    },

    stopNavigation() {
      setState({
        activeRoute: null,
        isNavigating: false
      });
    },

    openModal(modalId) {
      setState({ activeModal: modalId });
    },

    closeModal() {
      setState({ activeModal: null });
    },

    openSheet(sheetId) {
      setState({ activeSheet: sheetId });
    },

    closeSheet() {
      setState({ activeSheet: null });
    }
  };

  // Initialiser au chargement
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ─────────────────────────────────────────
  // API PUBLIQUE
  // ─────────────────────────────────────────

  return {
    getState,
    setState,
    setNestedState,
    resetState,
    subscribe,
    subscribeAll,
    addMiddleware,
    actions
  };

})();

// Rendre disponible globalement
window.StateManager = StateManager;