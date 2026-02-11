/**
 * MODULE AUTHENTIFICATION — CLOUD (SUPABASE)
 * Gestion de la session utilisateur persistante
 */

const AuthModule = (function () {
    'use strict';

    console.log('[Auth] Version CLOUD 1.0 chargée');

    // ─────────────────────────────────────────
    // CONFIGURATION SUPABASE
    // ─────────────────────────────────────────

    // URL du projet fournie par l'utilisateur
    const SUPABASE_URL = 'https://faqutkkvxdgqzdnxkmfw.supabase.co';

    // Clé "anon" "public" autorisée pour le navigateur
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhcXV0a2t2eGRncXpkbnhrbWZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MzQ4NzQsImV4cCI6MjA4NjQxMDg3NH0.y2RfkGE19zO7KxxI8onG53W5AcZmCTF7q1qBzISUQCA';

    let supabase = null;

    // Initialisation sécurisée du client
    try {
        if (window.supabase) {
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            console.log('[Auth] Client Supabase initialisé');
        } else {
            console.error('[Auth] SDK Supabase non trouvé dans window');
        }
    } catch (e) {
        console.error('[Auth] Erreur initialisation client:', e.message);
    }

    // ─────────────────────────────────────────
    // ÉTAT
    // ─────────────────────────────────────────

    const state = {
        isAuthenticated: false,
        user: null,
        token: null,
        isLoading: false
    };

    const SESSION_KEY = 'camayenne_auth_secure';

    // ─────────────────────────────────────────
    // MÉTHODES PRIVÉES
    // ─────────────────────────────────────────

    function saveSession(user, token) {
        const sessionData = JSON.stringify({
            user,
            token,
            expiry: Date.now() + 3600000 * 24 * 7 // 7 jours
        });
        localStorage.setItem(SESSION_KEY, btoa(sessionData));
    }

    function clearSession() {
        localStorage.removeItem(SESSION_KEY);
    }

    // ─────────────────────────────────────────
    // API PUBLIQUE
    // ─────────────────────────────────────────

    /**
     * Connexion via Supabase Auth
     */
    async function login(email, password) {
        if (!supabase) throw new Error('Client Supabase non configuré');

        state.isLoading = true;
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            state.isAuthenticated = true;
            state.user = {
                id: data.user.id,
                name: data.user.user_metadata.full_name || data.user.email.split('@')[0],
                email: data.user.email,
                role: 'user'
            };
            state.token = data.session.access_token;
            state.isLoading = false;

            saveSession(state.user, state.token);
            console.log('[Auth] Connexion cloud réussie:', state.user.name);
            return state.user;

        } catch (error) {
            state.isLoading = false;
            console.error('[Auth] Erreur login:', error.message);
            throw error;
        }
    }

    /**
     * Inscription via Supabase Auth
     */
    async function register(name, email, password) {
        if (!supabase) throw new Error('Client Supabase non configuré');

        state.isLoading = true;
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: name
                    }
                }
            });

            if (error) throw error;

            state.isAuthenticated = true;
            state.user = {
                id: data.user.id,
                name: name,
                email: email,
                role: 'user'
            };
            state.token = data.session?.access_token || null;
            state.isLoading = false;

            if (state.token) {
                saveSession(state.user, state.token);
            }

            console.log('[Auth] Inscription cloud réussie');
            return state.user;

        } catch (error) {
            state.isLoading = false;
            console.error('[Auth] Erreur register:', error.message);
            throw error;
        }
    }

    /**
     * Mot de passe oublié
     */
    async function resetPassword(email) {
        if (!supabase) throw new Error('Client Supabase non configuré');

        state.isLoading = true;
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email);
            if (error) throw error;
            state.isLoading = false;
            return true;
        } catch (error) {
            state.isLoading = false;
            throw error;
        }
    }

    /**
     * Déconnexion
     */
    async function logout() {
        if (supabase) {
            await supabase.auth.signOut();
        }
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        clearSession();
        console.log('[Auth] Déconnexion cloud');
    }

    /**
     * Vérification de la session au démarrage
     */
    function checkSession() {
        try {
            const encrypted = localStorage.getItem(SESSION_KEY);
            if (!encrypted) return false;

            const data = JSON.parse(atob(encrypted));

            if (Date.now() > data.expiry) {
                clearSession();
                return false;
            }

            state.isAuthenticated = true;
            state.user = data.user;
            state.token = data.token;

            return true;

        } catch (e) {
            clearSession();
            return false;
        }
    }

    return {
        login,
        logout,
        register,
        resetPassword,
        checkSession,
        isAuthenticated: () => state.isAuthenticated,
        getUser: () => state.user,
        getSupabase: () => supabase
    };

})();

// Export global pour le navigateur
window.AuthModule = AuthModule;
