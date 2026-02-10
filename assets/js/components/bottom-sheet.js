/**
 * COMPOSANT BOTTOM SHEET
 * Panneau coulissant iOS-style
 */

const BottomSheetModule = (function() {
  'use strict';

  // ─────────────────────────────────────────
  // ÉTAT
  // ─────────────────────────────────────────
  
  let activeSheet = null;
  let startY = 0;
  let currentY = 0;
  let isDragging = false;

  // ─────────────────────────────────────────
  // INITIALISATION
  // ─────────────────────────────────────────
  
  function init() {
    // Ajouter les listeners de drag sur tous les bottom sheets
    document.querySelectorAll('.bottom-sheet').forEach(sheet => {
      setupDrag(sheet);
    });
    
    console.log('[BottomSheet] Module initialisé');
  }

  // ─────────────────────────────────────────
  // GESTION DU DRAG
  // ─────────────────────────────────────────
  
  function setupDrag(sheet) {
    const handle = sheet.querySelector('.bottom-sheet-handle');
    if (!handle) return;

    handle.addEventListener('touchstart', (e) => {
      startDrag(e, sheet);
    }, { passive: true });

    handle.addEventListener('mousedown', (e) => {
      startDrag(e, sheet);
    });
  }

  function startDrag(e, sheet) {
    isDragging = true;
    activeSheet = sheet;
    startY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
    currentY = startY;
    
    sheet.style.transition = 'none';
    
    document.addEventListener('touchmove', onDrag, { passive: false });
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('touchend', endDrag);
    document.addEventListener('mouseup', endDrag);
  }

  function onDrag(e) {
    if (!isDragging || !activeSheet) return;
    
    e.preventDefault();
    currentY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
    const deltaY = currentY - startY;
    
    // Ne permettre que le glissement vers le bas
    if (deltaY > 0) {
      activeSheet.style.transform = `translateY(${deltaY}px)`;
    }
  }

  function endDrag() {
    if (!isDragging || !activeSheet) return;
    
    isDragging = false;
    const deltaY = currentY - startY;
    
    activeSheet.style.transition = '';
    activeSheet.style.transform = '';
    
    // Fermer si glissé de plus de 100px
    if (deltaY > 100) {
      close(activeSheet.id);
    }
    
    document.removeEventListener('touchmove', onDrag);
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('touchend', endDrag);
    document.removeEventListener('mouseup', endDrag);
    
    activeSheet = null;
  }

  // ─────────────────────────────────────────
  // API PUBLIQUE
  // ─────────────────────────────────────────
  
  function open(sheetId, content = null) {
    const sheet = document.getElementById(sheetId);
    const overlay = document.getElementById(`${sheetId.replace('-sheet', '-overlay')}`);
    
    if (!sheet) {
      console.warn('[BottomSheet] Sheet non trouvé:', sheetId);
      return;
    }
    
    // Injecter le contenu si fourni
    if (content) {
      const body = sheet.querySelector('.bottom-sheet-body');
      if (body) {
        body.innerHTML = content;
      }
    }
    
    // Ouvrir
    sheet.classList.add('active');
    if (overlay) overlay.classList.add('active');
    
    // Empêcher le scroll du body
    document.body.style.overflow = 'hidden';
    
    // Mettre à jour l'état global
    if (typeof StateManager !== 'undefined') {
      StateManager.actions.openSheet(sheetId);
    }
  }

  function close(sheetId) {
    const sheet = document.getElementById(sheetId);
    const overlay = document.getElementById(`${sheetId.replace('-sheet', '-overlay')}`);
    
    if (sheet) sheet.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
    
    // Restaurer le scroll
    document.body.style.overflow = '';
    
    // Mettre à jour l'état global
    if (typeof StateManager !== 'undefined') {
      StateManager.actions.closeSheet();
    }
  }

  function setTitle(sheetId, title) {
    const sheet = document.getElementById(sheetId);
    if (!sheet) return;
    
    const titleEl = sheet.querySelector('.bottom-sheet-title');
    if (titleEl) {
      titleEl.textContent = title;
    }
  }

  function setContent(sheetId, content) {
    const sheet = document.getElementById(sheetId);
    if (!sheet) return;
    
    const body = sheet.querySelector('.bottom-sheet-body');
    if (body) {
      body.innerHTML = content;
    }
  }

  // Initialiser au chargement
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    init,
    open,
    close,
    setTitle,
    setContent
  };

})();

window.BottomSheetModule = BottomSheetModule;