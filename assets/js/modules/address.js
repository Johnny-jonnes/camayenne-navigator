/**
 * MODULE ADRESSE HUMAINE
 * Génère des descriptions de position compréhensibles
 * 
 * Exemple: "Tu es à Camayenne, à environ 150 m derrière l'hôpital Donka"
 */

const AddressModule = (function () {
  'use strict';

  // ─────────────────────────────────────────
  // TEMPLATES DE PHRASES
  // ─────────────────────────────────────────

  const TEMPLATES = {
    // Très proche (< 50m)
    veryClose: [
      "Tu es juste à côté de {landmark}",
      "Tu es devant {landmark}",
      "Tu es à {landmark}"
    ],

    // Proche (50-150m)
    close: [
      "Tu es à environ {distance} de {landmark}",
      "Tu es à {distance} {direction} {landmark}",
      "Tu te trouves près de {landmark}, à {distance}"
    ],

    // Moyen (150-400m)
    medium: [
      "Tu es à Camayenne, à environ {distance} {direction} {landmark}",
      "Tu es à {distance} {direction} {landmark}",
      "Tu te trouves à Camayenne, {direction} {landmark} ({distance})"
    ],

    // Loin (> 400m)
    far: [
      "Tu es à Camayenne, dans le secteur {direction} {landmark}",
      "Tu es à Camayenne, à environ {distance} {direction} {landmark}",
      "Tu te trouves à Camayenne, côté {directionSimple}"
    ],

    // Hors zone
    outOfZone: [
      "Tu es en dehors de Camayenne",
      "Tu n'es pas dans la zone de Camayenne",
      "Position hors du quartier Camayenne"
    ],

    // Position inconnue
    unknown: [
      "Position en cours de détermination...",
      "Localisation en cours...",
      "Recherche de ta position..."
    ]
  };

  // Prépositions directionnelles en français
  const DIRECTION_PREPOSITIONS = {
    'nord': { simple: 'Nord', full: 'au nord de', behind: 'derrière' },
    'nord-est': { simple: 'Nord-Est', full: 'au nord-est de', behind: 'derrière' },
    'est': { simple: 'Est', full: 'à l\'est de', behind: 'derrière' },
    'sud-est': { simple: 'Sud-Est', full: 'au sud-est de', behind: 'devant' },
    'sud': { simple: 'Sud', full: 'au sud de', behind: 'devant' },
    'sud-ouest': { simple: 'Sud-Ouest', full: 'au sud-ouest de', behind: 'devant' },
    'ouest': { simple: 'Ouest', full: 'à l\'ouest de', behind: 'à côté de' },
    'nord-ouest': { simple: 'Nord-Ouest', full: 'au nord-ouest de', behind: 'derrière' }
  };

  // ─────────────────────────────────────────
  // GÉNÉRATION D'ADRESSE
  // ─────────────────────────────────────────

  /**
   * Génère une adresse humaine à partir d'une position
   * @param {Object} position - {lat, lng, isInCamayenne, nearestLandmark, distanceToLandmark}
   * @returns {Object} Adresse formatée avec variantes
   */
  function generateAddress(position) {
    // Cas : Position non disponible
    if (!position || !position.lat || !position.lng) {
      return {
        main: pickRandom(TEMPLATES.unknown),
        short: "Position inconnue",
        detailed: "Votre position n'a pas pu être déterminée.",
        isValid: false
      };
    }

    // Cas : Hors zone Camayenne
    if (!position.isInCamayenne) {
      return {
        main: pickRandom(TEMPLATES.outOfZone),
        short: "Hors Camayenne",
        detailed: "Vous êtes actuellement en dehors du quartier Camayenne. L'application est optimisée pour ce quartier uniquement.",
        isValid: false,
        isOutOfZone: true
      };
    }

    // Cas : Pas de repère trouvé
    if (!position.nearestLandmark) {
      return {
        main: "Tu es à Camayenne",
        short: "Camayenne",
        detailed: "Tu te trouves dans le quartier Camayenne, commune de Dixinn.",
        isValid: true
      };
    }

    // Cas normal : Générer l'adresse contextuelle
    const landmark = position.nearestLandmark;
    const distance = position.distanceToLandmark ||
      GeolocationModule.calculateDistance(position.lat, position.lng, landmark.lat, landmark.lng);

    // Calculer la direction
    const bearing = GeolocationModule.calculateBearing(landmark.lat, landmark.lng, position.lat, position.lng);
    const direction = GeolocationModule.bearingToCardinal(bearing);

    // Formater la distance
    const distanceText = formatDistance(distance);

    // Sélectionner le template selon la distance
    let template;
    if (distance < 50) {
      template = pickRandom(TEMPLATES.veryClose);
    } else if (distance < 150) {
      template = pickRandom(TEMPLATES.close);
    } else if (distance < 400) {
      template = pickRandom(TEMPLATES.medium);
    } else {
      template = pickRandom(TEMPLATES.far);
    }

    // Construire l'adresse principale
    const directionInfo = DIRECTION_PREPOSITIONS[direction.name] || DIRECTION_PREPOSITIONS['nord'];

    const main = template
      .replace('{landmark}', landmark.shortName)
      .replace('{distance}', distanceText)
      .replace('{direction}', directionInfo.full)
      .replace('{directionSimple}', directionInfo.simple);

    // Version courte
    const short = `${distanceText} de ${landmark.shortName}`;

    // Version détaillée
    const detailed = `Tu es à Camayenne, commune de Dixinn, Conakry. ` +
      `Tu te trouves à environ ${distanceText} ${directionInfo.full} ${landmark.name}. ` +
      `Précision GPS : ${Math.round(position.accuracy || 10)} mètres.`;

    // Version partageable
    const shareable = `📍 Je suis à Camayenne (Dixinn, Conakry) — ${distanceText} ${directionInfo.full} ${landmark.shortName}`;

    return {
      main,
      short,
      detailed,
      shareable,
      isValid: true,
      landmark: landmark.shortName,
      distance: Math.round(distance),
      direction: direction.name,
      coordinates: {
        lat: position.lat,
        lng: position.lng
      }
    };
  }

  /**
   * Génère une adresse simplifiée (pour affichage compact)
   */
  function generateShortAddress(position) {
    if (!position || !position.isInCamayenne) {
      return "Hors zone";
    }

    if (!position.nearestLandmark) {
      return "Camayenne";
    }

    const distance = formatDistance(position.distanceToLandmark);
    return `${distance} de ${position.nearestLandmark.shortName}`;
  }

  /**
   * Génère une description pour la navigation vers un lieu
   */
  function generateNavigationDescription(fromPosition, toPlace) {
    if (!fromPosition || !toPlace) {
      return "Destination";
    }

    const distance = GeolocationModule.calculateDistance(
      fromPosition.lat, fromPosition.lng,
      toPlace.lat, toPlace.lng
    );

    const distanceText = formatDistance(distance);
    const duration = estimateWalkingTime(distance);

    return {
      destination: toPlace.name,
      distance: distanceText,
      duration: duration,
      description: `${toPlace.name} — ${distanceText} (${duration} à pied)`
    };
  }

  // ─────────────────────────────────────────
  // UTILITAIRES
  // ─────────────────────────────────────────

  /**
   * Formate une distance en texte lisible
   */
  function formatDistance(meters) {
    if (meters < 50) {
      return "quelques pas";
    } else if (meters < 100) {
      return "environ 50 m";
    } else if (meters < 200) {
      return `environ ${Math.round(meters / 50) * 50} m`;
    } else if (meters < 1000) {
      return `environ ${Math.round(meters / 100) * 100} m`;
    } else {
      const km = meters / 1000;
      return `environ ${km.toFixed(1)} km`;
    }
  }

  /**
   * Estime le temps de marche
   */
  function estimateWalkingTime(meters) {
    // Vitesse moyenne à pied : ~5 km/h = ~83 m/min
    const WALKING_SPEED = 80; // mètres par minute
    const minutes = Math.round(meters / WALKING_SPEED);

    if (minutes < 1) {
      return "moins d'1 min";
    } else if (minutes === 1) {
      return "1 min";
    } else if (minutes < 60) {
      return `${minutes} min`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (remainingMinutes === 0) {
        return `${hours}h`;
      }
      return `${hours}h ${remainingMinutes}min`;
    }
  }

  /**
   * Sélectionne un élément aléatoire d'un tableau
   */
  function pickRandom(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * Génère le texte pour le partage
   */
  function generateShareText(position) {
    const address = generateAddress(position);

    if (!address.isValid) {
      return null;
    }

    return {
      text: address.shareable,
      fullText: `${address.shareable}\n\n` +
        `📌 Coordonnées: ${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}\n` +
        `🗺️ Quartier Camayenne, Dixinn, Conakry, Guinée`
    };
  }

  // ─────────────────────────────────────────
  // API PUBLIQUE
  // ─────────────────────────────────────────

  return {
    generateAddress,
    generateShortAddress,
    generateNavigationDescription,
    generateShareText,
    formatDistance,
    estimateWalkingTime
  };

})();

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AddressModule;
}
window.AddressModule = AddressModule;