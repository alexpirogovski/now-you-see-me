(() => {
  'use strict';

  const OVERLAY_ID = 'nyfm-avatar-overlay';
  const CLOSED_ATTRIBUTE = 'data-nyfm-avatar-closed';
  const AVATAR_ASSET = 'assets/placeholder.svg';
  const FALLBACK_ASSET = 'assets/placeholder.svg';
  const AVATAR_IMAGE_KEY = 'avatarImageDataUrl';
  const POSITION_X_KEY = 'avatarPositionXRatio';
  const POSITION_Y_KEY = 'avatarPositionYRatio';
  const POSITION_KEYS = [POSITION_X_KEY, POSITION_Y_KEY];

  function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
  }

  function getOverlayBounds(overlay) {
    const rect = overlay.getBoundingClientRect();

    return {
      rect,
      maxLeft: Math.max(0, window.innerWidth - rect.width),
      maxTop: Math.max(0, window.innerHeight - rect.height),
    };
  }

  function getValidRatio(value) {
    return typeof value === 'number' && Number.isFinite(value) ? clamp(value, 0, 1) : null;
  }

  function isValidAvatarDataUrl(value) {
    return typeof value === 'string' && /^data:image\/(png|jpeg|webp);base64,/i.test(value);
  }

  function setAvatarSource(avatar, source) {
    avatar.src = source || chrome.runtime.getURL(AVATAR_ASSET);
  }

  function addAvatarImageStorage(overlay, avatar) {
    function updateAvatar(value) {
      if (overlay.isConnected) {
        setAvatarSource(avatar, isValidAvatarDataUrl(value) ? value : '');
      }
    }

    chrome.storage.local.get(AVATAR_IMAGE_KEY, (stored) => {
      if (!chrome.runtime.lastError) {
        updateAvatar(stored[AVATAR_IMAGE_KEY]);
      }
    });

    function handleStorageChange(changes, areaName) {
      if (areaName === 'local' && AVATAR_IMAGE_KEY in changes) {
        updateAvatar(changes[AVATAR_IMAGE_KEY].newValue);
      }
    }

    chrome.storage.onChanged.addListener(handleStorageChange);

    return {
      remove() {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      },
    };
  }

  function addPositionPersistence(overlay) {
    let savedPosition = null;

    function applyPositionFromRatios(position) {
      const { maxLeft, maxTop } = getOverlayBounds(overlay);
      const left = clamp(position.xRatio * maxLeft, 0, maxLeft);
      const top = clamp(position.yRatio * maxTop, 0, maxTop);

      overlay.style.left = `${left}px`;
      overlay.style.top = `${top}px`;
      overlay.style.right = 'auto';
      overlay.style.bottom = 'auto';
    }

    function saveCurrentPosition() {
      const { rect, maxLeft, maxTop } = getOverlayBounds(overlay);
      // Ratios, unlike raw pixels, remain useful when the viewport changes.
      const position = {
        xRatio: maxLeft === 0 ? 0 : clamp(rect.left / maxLeft, 0, 1),
        yRatio: maxTop === 0 ? 0 : clamp(rect.top / maxTop, 0, 1),
      };

      savedPosition = position;
      chrome.storage.local.set({
        [POSITION_X_KEY]: position.xRatio,
        [POSITION_Y_KEY]: position.yRatio,
      });
    }

    function restoreSavedPosition() {
      chrome.storage.local.get(POSITION_KEYS, (stored) => {
        if (chrome.runtime.lastError || !overlay.isConnected) {
          return;
        }

        const xRatio = getValidRatio(stored[POSITION_X_KEY]);
        const yRatio = getValidRatio(stored[POSITION_Y_KEY]);

        if (xRatio === null || yRatio === null) {
          return;
        }

        savedPosition = { xRatio, yRatio };
        applyPositionFromRatios(savedPosition);
      });
    }

    function handleResize() {
      if (savedPosition !== null && overlay.isConnected) {
        applyPositionFromRatios(savedPosition);
      }
    }

    window.addEventListener('resize', handleResize);
    restoreSavedPosition();

    return {
      saveCurrentPosition,
      remove() {
        window.removeEventListener('resize', handleResize);
      },
    };
  }

  function addDragBehavior(overlay, dragHandle, onDragEnd) {
    let dragging = false;
    let pointerId = null;
    let offsetX = 0;
    let offsetY = 0;

    function stopDragging(event, savePosition) {
      if (!dragging || event.pointerId !== pointerId) {
        return;
      }

      const activePointerId = pointerId;
      dragging = false;
      pointerId = null;

      if (dragHandle.hasPointerCapture(activePointerId)) {
        dragHandle.releasePointerCapture(activePointerId);
      }

      if (savePosition) {
        onDragEnd();
      }
    }

    dragHandle.addEventListener('pointerdown', (event) => {
      if (!event.isPrimary || event.button !== 0) {
        return;
      }

      const rect = overlay.getBoundingClientRect();
      dragging = true;
      pointerId = event.pointerId;
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;

      // Switch from the default bottom placement to explicit viewport coordinates.
      overlay.style.left = `${rect.left}px`;
      overlay.style.top = `${rect.top}px`;
      overlay.style.bottom = 'auto';
      overlay.style.right = 'auto';

      dragHandle.setPointerCapture(pointerId);
      event.preventDefault();
    });

    dragHandle.addEventListener('pointermove', (event) => {
      if (!dragging || event.pointerId !== pointerId) {
        return;
      }

      const { rect, maxLeft, maxTop } = getOverlayBounds(overlay);
      const left = clamp(event.clientX - offsetX, 0, maxLeft);
      const top = clamp(event.clientY - offsetY, 0, maxTop);

      overlay.style.left = `${left}px`;
      overlay.style.top = `${top}px`;
      event.preventDefault();
    });

    dragHandle.addEventListener('pointerup', (event) => stopDragging(event, true));
    dragHandle.addEventListener('pointercancel', (event) => stopDragging(event, false));
    dragHandle.addEventListener('lostpointercapture', (event) => stopDragging(event, false));
  }

  function addAvatarOverlay() {
    if (
      document.getElementById(OVERLAY_ID) ||
      document.documentElement.hasAttribute(CLOSED_ATTRIBUTE)
    ) {
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;

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

    setAvatarSource(avatar);

    const dragHandle = document.createElement('button');
    dragHandle.className = 'nyfm-avatar-overlay__control nyfm-avatar-overlay__drag-handle';
    dragHandle.type = 'button';
    dragHandle.setAttribute('aria-label', 'Drag avatar');

    const closeButton = document.createElement('button');
    closeButton.className = 'nyfm-avatar-overlay__control nyfm-avatar-overlay__close-button';
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', 'Close avatar');
    closeButton.textContent = '×';

    overlay.appendChild(avatar);
    overlay.appendChild(dragHandle);
    overlay.appendChild(closeButton);
    document.body.appendChild(overlay);

    const positionPersistence = addPositionPersistence(overlay);
    const avatarImageStorage = addAvatarImageStorage(overlay, avatar);

    closeButton.addEventListener('click', () => {
      document.documentElement.setAttribute(CLOSED_ATTRIBUTE, '');
      positionPersistence.remove();
      avatarImageStorage.remove();
      overlay.remove();
    });

    addDragBehavior(overlay, dragHandle, positionPersistence.saveCurrentPosition);
  }

  if (document.body) {
    addAvatarOverlay();
  } else {
    document.addEventListener('DOMContentLoaded', addAvatarOverlay, { once: true });
  }
})();
