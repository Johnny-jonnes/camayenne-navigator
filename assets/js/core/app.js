/**
 * MODULE APPLICATION PRINCIPAL
 * Orchestration, routeur, événements
 */

const App = (function () {
  'use strict';

  // ─────────────────────────────────────────
  // ÉTAT GLOBAL
  // ─────────────────────────────────────────

  const state = {
    currentPage: 'home',
    isInitialized: false,
    isOnline: navigator.onLine,
    userPosition: null,
    isLoading: true
  };

  // ─────────────────────────────────────────
  // INITIALISATION
  // ─────────────────────────────────────────

  async function init() {
    console.log('[App] Initialisation...');

    try {
      // 1. Initialiser l'Auth (Priorité absolue)
      initAuth();

      // 2. Initialiser les modules de base
      await initModules();

      // 3. Configurer les événements
      setupEventListeners();
      setupAuthEventListeners();

      // 4. Initialiser le routeur
      initRouter();

      // 5. Démarrer la géolocalisation
      await startGeolocation();

      // 6. Charger les données
      await loadData();

      // 7. Initialiser la carte
      initMap();

      // 8. Masquer le splash screen
      hideSplashScreen();

      state.isInitialized = true;
      console.log('[App] Initialisation terminée');

    } catch (error) {
      console.error('[App] Erreur initialisation:', error);
      showError('Erreur lors du chargement de l\'application');
    }
  }

  function initAuth() {
    // Vérifier la session existante
    if (AuthModule.checkSession()) {
      unlockApp(AuthModule.getUser());
    } else {
      lockApp();
    }
  }

  function lockApp() {
    const app = document.getElementById('app');
    if (app) {
      app.hidden = true;
      app.classList.add('hidden');
      app.style.display = 'none';
    }

    const authOverlay = document.getElementById('auth-modal-overlay');
    if (authOverlay) {
      authOverlay.classList.add('active');
      authOverlay.style.pointerEvents = 'auto';
    }

    document.body.classList.add('auth-locked');
  }

  function unlockApp(user) {
    const app = document.getElementById('app');
    if (app) {
      app.hidden = false;
      app.classList.remove('hidden');
      app.style.display = 'flex';
    }

    try {
      updateAuthUI(user);
    } catch (err) {
      console.error('[App] Erreur lors de la mise à jour UI:', err);
    } finally {
      const authOverlay = document.getElementById('auth-modal-overlay');
      if (authOverlay) authOverlay.classList.remove('active');
      document.body.classList.remove('auth-locked');
      console.log('[App] Application déverrouillée');
    }
  }

  function updateAuthUI(user) {
    console.log('[App] Mise à jour UI Auth pour:', user ? user.name : 'Déconnecté');
    const loggedOutSection = document.getElementById('user-logged-out');
    const loggedInSection = document.getElementById('user-logged-in');

    if (user) {
      if (loggedOutSection) loggedOutSection.hidden = true;
      if (loggedInSection) {
        loggedInSection.hidden = false;
        loggedInSection.style.display = 'flex';

        const userName = document.getElementById('user-name');
        const userAvatar = document.getElementById('user-avatar');
        const userRole = document.getElementById('user-role');
        const userInitials = document.getElementById('user-initials');

        if (userName) userName.textContent = user.name || 'Utilisateur';
        if (userRole) userRole.textContent = user.role === 'admin' ? 'Administrateur' : 'Membre';
        if (userInitials) userInitials.textContent = (user.name || 'U').charAt(0).toUpperCase();
      }
    } else {
      if (loggedOutSection) {
        loggedOutSection.hidden = false;
        loggedOutSection.style.display = 'flex';
      }
      if (loggedInSection) loggedInSection.hidden = true;
    }
  }

  async function initModules() {
    // Initialiser le module de géolocalisation
    GeolocationModule.init({
      onPositionUpdate: handlePositionUpdate,
      onZoneChange: handleZoneChange,
      onError: handleGeolocationError
    });
  }

  // ─────────────────────────────────────────
  // AUTHENTIFICATION
  // ─────────────────────────────────────────

  function setupAuthEventListeners() {
    // Boutons UI
    const btnOpenLogin = document.getElementById('btn-open-login');
    const btnLogout = document.getElementById('btn-logout');
    const authOverlay = document.getElementById('auth-modal-overlay');

    // Tabs Login/Register
    const tabs = document.querySelectorAll('.auth-tab');
    console.log('[Auth] Found tabs:', tabs.length);

    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        console.log('[Auth] Tab clicked:', e.target.dataset.tab);
        const target = e.target.dataset.tab;

        // Update Tabs
        tabs.forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');

        // Update Forms
        // On retire 'active' partout
        document.querySelectorAll('.auth-form').forEach(f => {
          f.classList.remove('active');
          f.style.display = ''; // Nettoyer les styles inline résiduels au cas où
        });

        // On active la cible
        const targetForm = document.getElementById(`auth-form-${target}`);
        if (targetForm) {
          console.log('[Auth] Activating form:', target);
          targetForm.classList.add('active');
        } else {
          console.error('[Auth] Target form not found:', target);
        }
      });
    });

    if (btnOpenLogin) {
      btnOpenLogin.addEventListener('click', () => {
        authOverlay.classList.add('active');
      });
    }

    if (btnLogout) {
      btnLogout.addEventListener('click', handleLogout);
    }

    // Fermeture du modal au clic extérieur
    if (authOverlay) {
      authOverlay.addEventListener('click', (e) => {
        if (e.target === authOverlay) {
          authOverlay.classList.remove('active');
        }
      });
    }

    // Soumission du formulaire Connexion
    const loginForm = document.getElementById('auth-form-login');
    if (loginForm) {
      loginForm.addEventListener('submit', handleLogin);
    }

    // Soumission du formulaire Inscription
    const registerForm = document.getElementById('auth-form-register');
    if (registerForm) {
      registerForm.addEventListener('submit', handleRegister);
    }

    // Gestion Mot de passe oublié
    const linkForgot = document.getElementById('link-forgot-password');
    const formLogin = document.getElementById('auth-form-login');
    const formReset = document.getElementById('auth-form-reset');
    const btnBackLogin = document.getElementById('btn-back-to-login');
    const formRegister = document.getElementById('auth-form-register');
    const tabsContainer = document.querySelector('.auth-tabs');

    if (linkForgot) {
      linkForgot.addEventListener('click', (e) => {
        e.preventDefault();
        // Masquer les autres
        formLogin.classList.remove('active');
        formRegister.classList.remove('active');

        // Afficher Reset
        formReset.classList.add('active');

        // Cacher les tabs
        if (tabsContainer) tabsContainer.style.display = 'none';
      });
    }

    if (btnBackLogin) {
      btnBackLogin.addEventListener('click', () => {
        formReset.classList.remove('active');

        // Réafficher Login par défaut
        formLogin.classList.add('active');

        // Réafficher les tabs
        if (tabsContainer) tabsContainer.style.display = 'flex';

        // Reset l'état visuel des tabs
        tabs.forEach(t => t.classList.remove('active'));
        const loginTab = document.querySelector('.auth-tab[data-tab="login"]');
        if (loginTab) loginTab.classList.add('active');
      });
    }

    if (formReset) {
      formReset.addEventListener('submit', handleResetPassword);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();

    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const errorMsg = document.getElementById('auth-error');
    const errorText = document.getElementById('auth-error-text');

    // Reset UI
    errorMsg.style.display = 'none';
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    try {
      const user = await AuthModule.login(emailInput.value, passwordInput.value);

      // Succès
      unlockApp(user);

      ToastModule.show({
        type: 'success',
        title: 'Connexion réussie',
        message: `Ravi de vous revoir, ${user.name}`
      });

    } catch (error) {
      // Erreur
      errorMsg.style.display = 'flex';
      errorText.textContent = error.message;

      // Animation shake
      errorMsg.style.animation = 'none';
      errorMsg.offsetHeight; /* trigger reflow */
      errorMsg.style.animation = null;

    } finally {
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
    }
  }

  async function handleRegister(e) {
    e.preventDefault();

    const nameInput = document.getElementById('register-name');
    const emailInput = document.getElementById('register-email');
    const passwordInput = document.getElementById('register-password');
    const confirmInput = document.getElementById('register-confirm-password');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const errorMsg = document.getElementById('auth-error');
    const errorText = document.getElementById('auth-error-text');

    // Validation Mot de passe
    if (passwordInput.value !== confirmInput.value) {
      errorMsg.style.display = 'flex';
      errorText.textContent = 'Les mots de passe ne correspondent pas.';
      return;
    }

    // Reset UI
    errorMsg.style.display = 'none';
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    try {
      const user = await AuthModule.register(nameInput.value, emailInput.value, passwordInput.value);
      unlockApp(user);

      ToastModule.show({
        type: 'success',
        title: 'Bienvenue !',
        message: `Votre compte a été créé avec succès.`
      });

    } catch (error) {
      errorMsg.style.display = 'flex';
      errorText.textContent = error.message;
    } finally {
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    const emailInput = document.getElementById('reset-email');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    try {
      await AuthModule.resetPassword(emailInput.value);

      ToastModule.show({
        type: 'success',
        title: 'Email envoyé',
        message: 'Vérifiez votre boîte de réception pour réinitialiser le mot de passe.'
      });

      // Retour au login
      setTimeout(() => {
        document.getElementById('btn-back-to-login').click();
      }, 2000);

    } catch (error) {
      ToastModule.show({
        type: 'error',
        title: 'Erreur',
        message: 'Impossible d\'envoyer l\'email.'
      });
    } finally {
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
    }
  }

  async function handleLogout() {
    await AuthModule.logout();
    updateAuthUI(null);
    lockApp(); // Verrouiller l'app après déconnexion
    ToastModule.show({
      type: 'info',
      title: 'Déconnexion',
      message: 'À bientôt !'
    });
  }



  // ─────────────────────────────────────────
  // GÉOLOCALISATION
  // ─────────────────────────────────────────

  async function startGeolocation() {
    updateSplashStatus('Localisation en cours...');

    try {
      const position = await GeolocationModule.getCurrentPosition();
      state.userPosition = position;
      handlePositionUpdate(position);
    } catch (error) {
      console.error('[App] Erreur critique de géolocalisation:', error);

      ToastModule.show({
        type: 'error',
        title: 'Position indisponible',
        message: 'Impossible de déterminer votre position réelle.'
      });

      handleGeolocationError(error);
    }
  }

  function handlePositionUpdate(position) {
    state.userPosition = position;

    // Mettre à jour l'affichage de la position
    updatePositionDisplay(position);

    // Mettre à jour la carte si initialisée
    if (MapModule.isInitialized()) {
      MapModule.updateUserPosition(position);
    }

    // Mettre à jour les distances des lieux
    PlacesModule.updateDistances();

    // Chercher les alertes à proximité
    AlertsModule.findNearbyAlerts(position);
  }

  function handleZoneChange(isInZone) {
    const warning = document.getElementById('out-of-zone-warning');

    if (warning) {
      warning.hidden = isInZone;
    }

    if (!isInZone) {
      ToastModule.show({
        type: 'warning',
        title: 'Hors zone',
        message: 'Vous êtes en dehors de Camayenne'
      });
    }
  }

  function handleGeolocationError(error) {
    console.warn('[App] Erreur géolocalisation:', error);

    ToastModule.show({
      type: 'error',
      title: 'Position indisponible',
      message: error.message
    });

    // Afficher un message dans le hero
    const addressElement = document.getElementById('position-address');
    if (addressElement) {
      addressElement.textContent = 'Position non disponible';
    }
  }

  function updatePositionDisplay(position) {
    const addressElement = document.getElementById('position-address');
    const shareBtn = document.getElementById('btn-share-position');
    const mapBtn = document.getElementById('btn-view-on-map');

    if (!addressElement) return;

    // Générer l'adresse humaine
    const address = AddressModule.generateAddress(position);

    // Afficher l'adresse
    addressElement.textContent = address.main;

    // Cacher le label statique "Tu es à" si l'adresse dynamique 
    // commence déjà par "Tu es à" pour éviter "Tu es à Tu es à..."
    const heroLabel = document.getElementById('position-hero-label');
    if (heroLabel) {
      const alreadyHasPrefix = address.main.toLowerCase().startsWith('tu es à');
      heroLabel.hidden = alreadyHasPrefix || address.isOutOfZone || !address.isValid;
    }

    // Activer les boutons (toujours activés pour le démo/test)
    if (shareBtn) shareBtn.disabled = false;
    if (mapBtn) mapBtn.disabled = false;

    // Afficher l'avertissement hors zone si nécessaire
    const warning = document.getElementById('out-of-zone-warning');
    if (warning) {
      warning.hidden = !address.isOutOfZone;
    }
  }

  // ─────────────────────────────────────────
  // CHARGEMENT DES DONNÉES
  // ─────────────────────────────────────────

  async function loadData() {
    updateSplashStatus('Chargement des données...');

    // Charger les lieux et alertes en parallèle
    await Promise.all([
      PlacesModule.init(),
      AlertsModule.init()
    ]);

    // Mettre à jour les badges et listes
    const active = AlertsModule.getActive();
    AlertsModule.updateBadge();
    AlertsModule.renderAlertsList('alerts-container', active.slice(0, 3), true);
  }

  // ─────────────────────────────────────────
  // CARTE
  // ─────────────────────────────────────────

  function initMap() {
    // La carte sera initialisée au premier accès à la page
    // pour optimiser le temps de chargement initial
  }

  function ensureMapInitialized() {
    if (!MapModule.isInitialized()) {
      MapModule.init('map-container');

      // Afficher les lieux sur la carte
      MapModule.displayPlaces(PlacesModule.getAll());

      // Mettre à jour la position utilisateur
      if (state.userPosition) {
        MapModule.updateUserPosition(state.userPosition);
      }
    }
  }

  // ─────────────────────────────────────────
  // ROUTEUR
  // ─────────────────────────────────────────

  function initRouter() {
    // Gérer le hash initial
    handleRoute(window.location.hash || '#home');

    // Écouter les changements de hash
    window.addEventListener('hashchange', () => {
      handleRoute(window.location.hash);

      // Rafraîchir la carte si on arrive sur la page map
      if (window.location.hash === '#map') {
        setTimeout(() => {
          MapModule.refresh();
        }, 300);
      }
    });
  }

  function handleRoute(hash) {
    // Extraire le nom de la page du hash
    const pageName = hash.replace('#', '').split('?')[0] || 'home';

    navigateTo(pageName);
  }

  function navigateTo(pageName) {
    const pages = document.querySelectorAll('.page');
    const navItems = document.querySelectorAll('.nav-item');

    // Masquer toutes les pages
    pages.forEach(page => {
      page.classList.remove('active');
    });

    // Désactiver tous les items de nav
    navItems.forEach(item => {
      item.classList.remove('active');
    });

    // Afficher la page cible
    const targetPage = document.getElementById(`page-${pageName}`);
    if (targetPage) {
      targetPage.classList.add('active');
      state.currentPage = pageName;

      // Actions spécifiques par page
      onPageEnter(pageName);
    }

    // Activer l'item de nav correspondant
    const targetNav = document.querySelector(`.nav-item[data-nav="${pageName}"]`);
    if (targetNav) {
      targetNav.classList.add('active');
    }
  }

  function onPageEnter(pageName) {
    switch (pageName) {
      case 'map':
        ensureMapInitialized();
        MapModule.refresh();
        break;

      case 'places':
        PlacesModule.renderPlacesList();
        break;

      case 'alerts':
        AlertsModule.renderAlertsList('alerts-full-list');
        break;
    }
  }

  // ─────────────────────────────────────────
  // ÉVÉNEMENTS
  // ─────────────────────────────────────────

  function setupEventListeners() {
    // Navigation bottom bar
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.dataset.nav;
        window.location.hash = page;
      });
    });

    // Bouton actualiser position
    const refreshBtn = document.getElementById('btn-refresh-position');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.classList.add('loading');
        try {
          const position = await GeolocationModule.getCurrentPosition();
          handlePositionUpdate(position);
          ToastModule.show({
            type: 'success',
            title: 'Position mise à jour',
            message: 'Votre position a été actualisée'
          });
        } catch (error) {
          handleGeolocationError(error);
        } finally {
          refreshBtn.classList.remove('loading');
        }
      });
    }

    // Bouton partager position
    const shareBtn = document.getElementById('btn-share-position');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        console.log('[App] Clic sur Partager');
        showShareModal();
      });
    }

    // Bouton voir sur la carte
    const mapBtn = document.getElementById('btn-view-on-map');
    if (mapBtn) {
      mapBtn.addEventListener('click', () => {
        console.log('[App] Clic sur Voir sur la carte');
        window.location.hash = 'map';
        setTimeout(() => {
          MapModule.centerOnUser();
        }, 300);
      });
    }

    // Bouton centrer sur utilisateur (carte)
    const centerBtn = document.getElementById('btn-center-user');
    if (centerBtn) {
      centerBtn.addEventListener('click', () => {
        MapModule.centerOnUser();
      });
    }

    // Boutons zoom
    const zoomInBtn = document.getElementById('btn-zoom-in');
    const zoomOutBtn = document.getElementById('btn-zoom-out');
    if (zoomInBtn) zoomInBtn.addEventListener('click', () => MapModule.zoomIn());
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => MapModule.zoomOut());

    // Recherche de lieux
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('btn-clear-search');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value;
        PlacesModule.search(query);
        PlacesModule.renderPlacesList();
        if (clearSearchBtn) {
          clearSearchBtn.hidden = query.length === 0;
        }
      });
    }

    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        PlacesModule.clearFilters();
        PlacesModule.renderPlacesList();
        clearSearchBtn.hidden = true;
      });
    }

    // Filtres de catégories
    document.querySelectorAll('.category-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        // Mettre à jour l'état actif
        document.querySelectorAll('.category-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Appliquer le filtre
        const category = btn.dataset.filter;
        PlacesModule.filterByCategory(category);
        PlacesModule.renderPlacesList();

        // Mettre à jour la carte
        MapModule.filterPlacesByCategory(category);
      });
    });

    // Accès rapide (page accueil)
    document.querySelectorAll('.quick-access-item').forEach(item => {
      item.addEventListener('click', () => {
        const category = item.dataset.category;

        // Naviguer vers les lieux avec le filtre
        window.location.hash = 'places';

        setTimeout(() => {
          // Activer le filtre
          document.querySelectorAll('.category-filter').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === category);
          });

          PlacesModule.filterByCategory(category);
          PlacesModule.renderPlacesList();
        }, 100);
      });
    });

    // Fermer le bottom sheet de détail
    const closeDetailBtn = document.getElementById('btn-close-place-detail');
    const detailOverlay = document.getElementById('place-detail-overlay');

    if (closeDetailBtn) {
      closeDetailBtn.addEventListener('click', closePlaceDetail);
    }
    if (detailOverlay) {
      detailOverlay.addEventListener('click', closePlaceDetail);
    }

    // Modal de partage
    const closeShareBtn = document.getElementById('btn-close-share-modal');
    const shareOverlay = document.getElementById('share-modal-overlay');
    const copyAddressBtn = document.getElementById('btn-copy-address');

    if (closeShareBtn) closeShareBtn.addEventListener('click', closeShareModal);
    if (shareOverlay) shareOverlay.addEventListener('click', closeShareModal);
    if (copyAddressBtn) {
      copyAddressBtn.addEventListener('click', copyAddressToClipboard);
    }

    // VOIR PROFIL
    const btnViewProfile = document.getElementById('btn-view-profile');
    const btnCloseProfile = document.getElementById('btn-close-profile');
    const profileOverlay = document.getElementById('profile-detail-overlay');

    if (btnViewProfile) {
      btnViewProfile.addEventListener('click', showUserProfile);
    }
    if (btnCloseProfile) {
      btnCloseProfile.addEventListener('click', closeUserProfile);
    }
    if (profileOverlay) {
      profileOverlay.addEventListener('click', closeUserProfile);
    }

    const whatsappShareBtn = document.getElementById('btn-whatsapp-share');
    if (whatsappShareBtn) {
      whatsappShareBtn.addEventListener('click', shareOnWhatsApp);
    }

    // Statut en ligne/hors ligne
    window.addEventListener('online', () => {
      state.isOnline = true;
      updateOnlineStatus();
    });

    window.addEventListener('offline', () => {
      state.isOnline = false;
      updateOnlineStatus();
    });

    // Légende carte
    const legendToggle = document.querySelector('.map-legend-toggle');
    if (legendToggle) {
      legendToggle.addEventListener('click', () => {
        const expanded = legendToggle.getAttribute('aria-expanded') === 'true';
        legendToggle.setAttribute('aria-expanded', !expanded);
      });
    }
  }

  // ─────────────────────────────────────────
  // ACTIONS PUBLIQUES
  // ─────────────────────────────────────────

  function showPlaceDetail(placeId) {
    const place = PlacesModule.getPlaceById(placeId);
    if (!place) return;

    const sheet = document.getElementById('place-detail-sheet');
    const overlay = document.getElementById('place-detail-overlay');
    const title = document.getElementById('place-detail-title');
    const body = document.getElementById('place-detail-body');

    if (title) title.textContent = place.name;
    if (body) body.innerHTML = PlacesModule.renderPlaceDetail(placeId);

    if (sheet) sheet.classList.add('active');
    if (overlay) overlay.classList.add('active');
  }

  function closePlaceDetail() {
    const sheet = document.getElementById('place-detail-sheet');
    const overlay = document.getElementById('place-detail-overlay');

    if (sheet) sheet.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
  }

  function navigateToPlace(placeId) {
    const place = PlacesModule.getPlaceById(placeId);
    if (!place) {
      ToastModule.show({
        type: 'error',
        title: 'Erreur',
        message: 'Lieu non trouvé'
      });
      return;
    }

    if (!state.userPosition) {
      ToastModule.show({
        type: 'warning',
        title: 'Position requise',
        message: 'Activez la géolocalisation pour la navigation'
      });
      return;
    }

    // Fermer le détail si ouvert
    closePlaceDetail();

    // Naviguer vers la carte
    window.location.hash = 'map';

    setTimeout(() => {
      ensureMapInitialized();

      // Calculer et afficher l'itinéraire
      RoutingModule.calculateRoute(
        { lat: state.userPosition.lat, lng: state.userPosition.lng },
        { lat: place.lat, lng: place.lng },
        { placeName: place.name }
      ).catch(err => {
        console.warn('[App] Erreur de routage:', err);
      });
    }, 300);
  }

  function showOnMap(placeId) {
    const place = PlacesModule.getPlaceById(placeId);
    if (!place) return;

    closePlaceDetail();
    window.location.hash = 'map';

    setTimeout(() => {
      ensureMapInitialized();
      MapModule.flyTo(place.lat, place.lng, 17);
    }, 300);
  }

  // ─────────────────────────────────────────
  // MODALES
  // ─────────────────────────────────────────

  function showShareModal() {
    console.log('[App] Tentative d\'ouverture du modal de partage. Position actuelle:', state.userPosition);

    if (!state.userPosition) {
      console.warn('[App] Impossible de partager : position non définie');
      ToastModule.show({
        type: 'warning',
        title: 'Position inconnue',
        message: 'Attendez que votre position soit détectée'
      });
      return;
    }

    const modal = document.getElementById('share-modal');
    const overlay = document.getElementById('share-modal-overlay');
    const addressText = document.getElementById('share-address-text');

    const shareInfo = AddressModule.generateShareText(state.userPosition);
    if (addressText && shareInfo) {
      addressText.textContent = shareInfo.fullText;
    }

    if (modal && overlay) {
      modal.classList.add('active');
      overlay.classList.add('active');
      console.log('[App] Modal de partage affiché');
    } else {
      console.error('[App] Éléments du modal de partage introuvables');
    }
  }
  function closeShareModal() {
    const modal = document.getElementById('share-modal');
    const overlay = document.getElementById('share-modal-overlay');

    if (modal) modal.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
  }

  function showUserProfile() {
    const user = AuthModule.getUser();
    if (!user) return;

    const sheet = document.getElementById('profile-detail-sheet');
    const overlay = document.getElementById('profile-detail-overlay');
    const body = document.getElementById('profile-detail-body');

    if (body) {
      body.innerHTML = `
        <div class="profile-view">
          <div class="profile-header-main">
            <div class="profile-avatar-large">
              <span>${(user.name || 'U').charAt(0).toUpperCase()}</span>
            </div>
            <h4 class="profile-name-title">${user.name}</h4>
            <span class="badge badge-primary">${user.role === 'admin' ? 'Administrateur' : 'Membre'}</span>
          </div>
          
          <div class="profile-info-grid">
            <div class="profile-info-item">
              <label>Identifiant</label>
              <div class="profile-info-value">#${user.id}</div>
            </div>
            <div class="profile-info-item">
              <label>Adresse Email</label>
              <div class="profile-info-value">${user.email}</div>
            </div>
          </div>

          <div class="profile-actions-view">
            <button id="btn-logout-alt" class="btn btn-outline-danger w-100">
               Se déconnecter
            </button>
          </div>
        </div>
      `;

      // Event listener pour le logout dans le profil
      const btnLogoutAlt = body.querySelector('#btn-logout-alt');
      if (btnLogoutAlt) {
        btnLogoutAlt.addEventListener('click', () => {
          closeUserProfile();
          handleLogout();
        });
      }
    }

    if (sheet) sheet.classList.add('active');
    if (overlay) overlay.classList.add('active');
  }

  function closeUserProfile() {
    const sheet = document.getElementById('profile-detail-sheet');
    const overlay = document.getElementById('profile-detail-overlay');

    if (sheet) sheet.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
  }

  async function copyAddressToClipboard() {
    const addressText = document.getElementById('share-address-text');
    if (!addressText) return;

    try {
      await navigator.clipboard.writeText(addressText.textContent);

      ToastModule.show({
        type: 'success',
        title: 'Copié !',
        message: 'Adresse copiée dans le presse-papiers'
      });

      closeShareModal();
    } catch (error) {
      ToastModule.show({
        type: 'error',
        title: 'Erreur',
        message: 'Impossible de copier l\'adresse'
      });
    }
  }

  function shareOnWhatsApp() {
    const addressText = document.getElementById('share-address-text');
    if (!addressText) return;

    const text = encodeURIComponent(`Ma position à Camayenne : ${addressText.textContent}`);
    const whatsappUrl = `https://wa.me/?text=${text}`;

    window.open(whatsappUrl, '_blank');
    closeShareModal();
  }

  // ─────────────────────────────────────────
  // UI HELPERS
  // ─────────────────────────────────────────

  function updateOnlineStatus() {
    const indicator = document.getElementById('btn-offline-indicator');
    if (!indicator) return;

    const dot = indicator.querySelector('.status-dot');
    const text = indicator.querySelector('.status-text');

    if (state.isOnline) {
      dot?.classList.remove('offline');
      dot?.classList.add('online');
      if (text) text.textContent = 'En ligne';
    } else {
      dot?.classList.remove('online');
      dot?.classList.add('offline');
      if (text) text.textContent = 'Hors ligne';

      ToastModule.show({
        type: 'warning',
        title: 'Mode hors ligne',
        message: 'Certaines fonctionnalités peuvent être limitées'
      });
    }
  }

  function updateSplashStatus(message) {
    const statusEl = document.querySelector('.splash-status');
    if (statusEl) {
      statusEl.textContent = message;
    }
  }

  function hideSplashScreen() {
    const splash = document.getElementById('splash-screen');
    const app = document.getElementById('app');

    if (splash) {
      splash.style.pointerEvents = 'none';
      splash.classList.add('fade-out');

      setTimeout(() => {
        splash.style.display = 'none';
        splash.remove();
      }, 500);
    }

    // N'afficher l'application QUE si l'utilisateur est connecté
    if (app) {
      if (AuthModule.isAuthenticated()) {
        unlockApp(AuthModule.getUser());
      } else {
        lockApp();
      }
    }
  }

  function forceShowApp() {
    console.log('[App] Force show app triggered');
    hideSplashScreen();
  }

  function showError(message) {
    const splash = document.getElementById('splash-screen');
    if (splash) {
      splash.innerHTML = `
        <div class="splash-error">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <h2>Erreur</h2>
          <p>${message}</p>
          <button class="btn btn-primary" onclick="location.reload()">Réessayer</button>
        </div>
      `;
    }
  }

  // ─────────────────────────────────────────
  // API PUBLIQUE
  // ─────────────────────────────────────────

  return {
    // Navigation
    navigateTo,
    navigateToPlace,
    showOnMap,

    // Détails lieu
    showPlaceDetail,
    closePlaceDetail,

    // Profil
    showUserProfile,
    closeUserProfile,

    // Partage
    showShareModal,
    closeShareModal,

    // Initialisation
    init,

    // État
    getState: () => ({ ...state }),
    isOnline: () => state.isOnline,
    getCurrentPage: () => state.currentPage
  };

})();

// Rendre App disponible globalement
window.App = App;

// Timeout de secours : si après 5 secondes l'app n'est pas initialisée, forcer l'affichage
setTimeout(() => {
  const splash = document.getElementById('splash-screen');
  if (splash && !splash.classList.contains('fade-out')) {
    console.warn('[App] Timeout de secours - Forçage de l\'affichage de l\'application');
    // Appeler la fonction globale ou via App
    const splashEl = document.getElementById('splash-screen');
    const appEl = document.getElementById('app');
    if (splashEl) {
      splashEl.style.pointerEvents = 'none';
      splashEl.classList.add('fade-out');
      setTimeout(() => {
        splashEl.style.display = 'none';
        splashEl.remove();
      }, 500);
    }
    if (appEl) {
      if (window.AuthModule && window.AuthModule.isAuthenticated()) {
        appEl.hidden = false;
        appEl.style.display = 'flex';
      } else {
        const authOverlay = document.getElementById('auth-modal-overlay');
        if (authOverlay) authOverlay.classList.add('active');
      }
    }
  }
}, 5000);

// Initialiser automatiquement l'application lorsque le DOM est prêt
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    try {
      App.init();
    } catch (error) {
      console.error('[App] Erreur critique lors de l\'initialisation:', error);
    }
  });
} else {
  try {
    App.init();
  } catch (error) {
    console.error('[App] Erreur critique lors de l\'initialisation:', error);
  }
}