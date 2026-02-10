/**
 * MODULE AUTHENTIFICATION
 * Gestion de la session utilisateur et Base de Données Locale
 */

const AuthModule = (function () {
    'use strict';

    // ─────────────────────────────────────────
    // ÉTAT
    // ─────────────────────────────────────────

    const state = {
        isAuthenticated: false,
        user: null,
        token: null,
        isLoading: false
    };

    const DB_KEY = 'camayenne_users_db';
    const SESSION_KEY = 'camayenne_auth_secure';

    // Base de données initiale (Seed)
    const INITIAL_DB = [
        {
            id: 'usr_001',
            email: 'user@camayenne.gn',
            passwordHash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8', // 'password'
            name: 'Utilisateur Test',
            role: 'user',
            preferences: { theme: 'system' }
        },
        {
            id: 'admin_001',
            email: 'admin@camayenne.gn',
            passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', // 'admin'
            name: 'Administrateur',
            role: 'admin',
            preferences: { theme: 'dark' }
        }
    ];

    // ─────────────────────────────────────────
    // GESTION DATABASE
    // ─────────────────────────────────────────

    function getDatabase() {
        const dbStr = localStorage.getItem(DB_KEY);
        if (!dbStr) {
            localStorage.setItem(DB_KEY, JSON.stringify(INITIAL_DB));
            return INITIAL_DB;
        }
        return JSON.parse(dbStr);
    }

    function saveToDatabase(newUser) {
        const db = getDatabase();
        db.push(newUser);
        localStorage.setItem(DB_KEY, JSON.stringify(db));
    }

    // ─────────────────────────────────────────
    // MÉTHODES PRIVÉES
    // ─────────────────────────────────────────

    // Simulation de hachage SHA-256
    async function hashPassword(password) {
        const msgBuffer = new TextEncoder().encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    function generateToken() {
        return 'tk_' + Math.random().toString(36).substr(2) + Date.now().toString(36);
    }

    function saveSession(user, token) {
        const sessionData = JSON.stringify({ user, token, expiry: Date.now() + 3600000 * 24 * 7 }); // 7 jours
        localStorage.setItem(SESSION_KEY, btoa(sessionData));
    }

    function clearSession() {
        localStorage.removeItem(SESSION_KEY);
    }

    // ─────────────────────────────────────────
    // API PUBLIQUE
    // ─────────────────────────────────────────

    async function login(email, password) {
        state.isLoading = true;
        await delay(600 + Math.random() * 400);

        try {
            const hash = await hashPassword(password);
            const db = getDatabase();
            const user = db.find(u => u.email === email && u.passwordHash === hash);

            if (!user) {
                throw new Error('Email ou mot de passe incorrect');
            }

            const token = generateToken();

            state.isAuthenticated = true;
            state.user = {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            };
            state.token = token;
            state.isLoading = false;

            saveSession(state.user, token);
            console.log('[Auth] Connexion réussie:', state.user.name);
            return state.user;

        } catch (error) {
            state.isLoading = false;
            throw error;
        }
    }

    async function register(name, email, password) {
        state.isLoading = true;
        await delay(800 + Math.random() * 500);

        try {
            const db = getDatabase();

            // Vérifier si email existe déjà
            if (db.find(u => u.email === email)) {
                throw new Error('Cet email est déjà utilisé');
            }

            const hash = await hashPassword(password);

            const newUser = {
                id: 'usr_' + Date.now().toString(36),
                email: email,
                passwordHash: hash,
                name: name,
                role: 'user',
                preferences: { theme: 'system' },
                createdAt: new Date().toISOString()
            };

            saveToDatabase(newUser);

            // Auto-login après inscription
            const token = generateToken();
            state.isAuthenticated = true;
            state.user = {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role
            };
            state.token = token;
            state.isLoading = false;

            saveSession(state.user, token);
            console.log('[Auth] Inscription réussie:', state.user.name);
            return state.user;

        } catch (error) {
            state.isLoading = false;
            throw error;
        }
    }

    async function resetPassword(email) {
        state.isLoading = true;
        await delay(1000 + Math.random() * 500);

        try {
            const db = getDatabase();
            const user = db.find(u => u.email === email);

            if (!user) {
                // Pour sécurité, on ne dit pas si l'email existe ou pas, mais pour la démo on peut être explicite ou non.
                // Simulons un succès même si l'email n'existe pas (bonnes pratiques), ou erreur pour démo ?
                // Allons pour le succès générique pour ne pas leaker les users.
            }

            console.log(`[Auth] Email de réinitialisation envoyé à ${email}`);
            state.isLoading = false;
            return true;
        } catch (error) {
            state.isLoading = false;
            throw error;
        }
    }

    async function logout() {
        state.isLoading = true;
        await delay(300);

        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        state.isLoading = false;

        clearSession();
        console.log('[Auth] Déconnexion');
    }

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
        getUser: () => state.user
    };

})();
