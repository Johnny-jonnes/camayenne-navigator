# 🗺️ Camayenne Navigator

**Application PWA de géolocalisation et navigation pour le quartier Camayenne, Dixinn, Conakry, Guinée.**

---

## 📋 Description

Camayenne Navigator est une Progressive Web App (PWA) permettant aux résidents et visiteurs du quartier Camayenne de :

- 📍 **Se localiser** avec une adresse humaine et contextuelle
- 🗺️ **Explorer** une carte interactive limitée au quartier
- 🚶 **Naviguer** vers les lieux essentiels sans quitter l'application
- ⚠️ **Recevoir** des alertes locales géolocalisées
- 📴 **Utiliser** l'app en mode hors connexion

---

## 🚀 Déploiement

### Prérequis

- Serveur web avec HTTPS (obligatoire pour PWA)
- Aucune base de données requise
- Aucun backend nécessaire

### Options de déploiement

#### Option 1 : GitHub Pages (Gratuit)

```bash
# 1. Créer un repo GitHub
# 2. Pousser le code
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/votre-user/camayenne-navigator.git
git push -u origin main

# 3. Activer GitHub Pages dans Settings > Pages
# 4. Sélectionner la branche "main" et le dossier "/" (root)