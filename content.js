(() => {
  'use strict';

  const OVERLAY_ID = 'nyfm-avatar-overlay';
  const AVATAR_ASSET = 'assets/placeholder.svg';
  const FALLBACK_ASSET = 'assets/placeholder.svg';

  function addAvatarOverlay() {
    if (document.getElementById(OVERLAY_ID)) {
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.setAttribute('aria-hidden', 'true');

    const avatar = document.createElement('img');
    avatar.className = 'nyfm-avatar-overlay__image';
    avatar.alt = '';

    avatar.addEventListener('error', () => {
      const fallbackUrl = chrome.runtime.getURL(FALLBACK_ASSET);

      if (avatar.src !== fallbackUrl) {
        avatar.src = fallbackUrl;
      } else {
        overlay.remove();
      }
    });

    avatar.src = chrome.runtime.getURL(AVATAR_ASSET);

    overlay.appendChild(avatar);
    document.body.appendChild(overlay);
  }

  if (document.body) {
    addAvatarOverlay();
  } else {
    document.addEventListener('DOMContentLoaded', addAvatarOverlay, { once: true });
  }
})();
