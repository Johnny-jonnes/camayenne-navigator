/**
 * SCRIPT DE GÉNÉRATION DES ICÔNES PWA
 * Exécuter avec Node.js après installation de sharp:
 * npm install sharp
 * node scripts/generate-icons.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, '../assets/icons');
const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

// SVG source de l'icône
const SVG_ICON = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="102" fill="url(#gradient)"/>
  <path d="M256 96C185.3 96 128 153.3 128 224C128 320 256 416 256 416C256 416 384 320 384 224C384 153.3 326.7 96 256 96Z" fill="white"/>
  <circle cx="256" cy="224" r="56" fill="#2563EB"/>
  <defs>
    <linearGradient id="gradient" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop stop-color="#3B82F6"/>
      <stop offset="1" stop-color="#1D4ED8"/>
    </linearGradient>
  </defs>
</svg>
`;

// SVG pour icône maskable (avec padding)
const SVG_MASKABLE = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="url(#gradient)"/>
  <path d="M256 128C198.6 128 152 174.6 152 232C152 312 256 392 256 392C256 392 360 312 360 232C360 174.6 313.4 128 256 128Z" fill="white"/>
  <circle cx="256" cy="232" r="44" fill="#2563EB"/>
  <defs>
    <linearGradient id="gradient" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop stop-color="#3B82F6"/>
      <stop offset="1" stop-color="#1D4ED8"/>
    </linearGradient>
  </defs>
</svg>
`;

async function generateIcons() {
  // Créer le dossier si nécessaire
  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }

  // Générer les icônes standard
  for (const size of SIZES) {
    await sharp(Buffer.from(SVG_ICON))
      .resize(size, size)
      .png()
      .toFile(path.join(ICONS_DIR, `icon-${size}.png`));
    
    console.log(`✓ Généré: icon-${size}.png`);
  }

  // Générer l'icône Apple Touch
  await sharp(Buffer.from(SVG_ICON))
    .resize(180, 180)
    .png()
    .toFile(path.join(ICONS_DIR, 'apple-touch-icon.png'));
  
  console.log('✓ Généré: apple-touch-icon.png');

  // Générer favicon 32x32
  await sharp(Buffer.from(SVG_ICON))
    .resize(32, 32)
    .png()
    .toFile(path.join(ICONS_DIR, 'favicon-32.png'));
  
  console.log('✓ Généré: favicon-32.png');

  // Générer badge pour notifications
  await sharp(Buffer.from(SVG_ICON))
    .resize(72, 72)
    .png()
    .toFile(path.join(ICONS_DIR, 'badge-72.png'));
  
  console.log('✓ Généré: badge-72.png');

  // Icônes de raccourcis
  const shortcutIcons = [
    { name: 'shortcut-position', color: '#2563EB' },
    { name: 'shortcut-map', color: '#059669' },
    { name: 'shortcut-emergency', color: '#DC2626' }
  ];

  console.log('\n✓ Génération terminée!');
}

generateIcons().catch(console.error);