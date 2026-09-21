(() => {
  'use strict';

  const OVERLAY_ID = 'nyfm-avatar-overlay';
  const CLOSED_ATTRIBUTE = 'data-nyfm-avatar-closed';
  const AVATAR_ASSET = 'assets/placeholder.svg';
  const FALLBACK_ASSET = 'assets/placeholder.svg';
  const AVATAR_IMAGE_KEY = 'avatarImageDataUrl';
  const ANSWERING_AVATAR_IMAGE_KEY = 'answeringAvatarImageDataUrl';
  const THINKING_AVATAR_IMAGE_KEY = 'thinkingAvatarImageDataUrl';
  const ANSWERING_MIGRATION_KEY = 'answeringAvatarMigrationComplete';
  const POSITION_X_KEY = 'avatarPositionXRatio';
  const POSITION_Y_KEY = 'avatarPositionYRatio';
  const POSITION_KEYS = [POSITION_X_KEY, POSITION_Y_KEY];
  const AvatarState = Object.freeze({
    IDLE: 'idle',
    THINKING: 'thinking',
    ANSWERING: 'answering',
  });
  const DEBUG = false;
  const STATE_EVALUATION_DELAY_MS = 100;
  const STOP_BUTTON_SELECTOR = 'button[aria-label="Stop"]';
  const THINKING_BUTTON_SELECTOR = 'button[aria-expanded]';
  const PULSING_THINKING_INDICATOR_SELECTOR = '.pulsing-dot';
  const STATE_CONTROL_SELECTOR = [
    THINKING_BUTTON_SELECTOR,
    STOP_BUTTON_SELECTOR,
    PULSING_THINKING_INDICATOR_SELECTOR,
  ].join(', ');

  function debugLog(...argumentsList) {
    if (DEBUG) {
      console.debug('[Avatar Overlay]', ...argumentsList);
    }
  }

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

  function addAvatarStateMachine(overlay, avatar) {
    let activeState = null;
    let idleAvatarDataUrl = '';
    let thinkingAvatarDataUrl = '';
    let answeringAvatarDataUrl = '';

    function migrateLegacyAnsweringAvatar(migrationComplete) {
      if (migrationComplete) {
        return;
      }

      if (
        isValidAvatarDataUrl(answeringAvatarDataUrl) ||
        !isValidAvatarDataUrl(thinkingAvatarDataUrl)
      ) {
        chrome.storage.local.set({ [ANSWERING_MIGRATION_KEY]: true });
        return;
      }

      answeringAvatarDataUrl = thinkingAvatarDataUrl;
      thinkingAvatarDataUrl = '';
      chrome.storage.local.set(
        {
          [ANSWERING_AVATAR_IMAGE_KEY]: answeringAvatarDataUrl,
          [ANSWERING_MIGRATION_KEY]: true,
        },
        () => {
          if (!chrome.runtime.lastError) {
            chrome.storage.local.remove(THINKING_AVATAR_IMAGE_KEY);
          }
        }
      );
    }

    function getSourceForState(state) {
      if (state === AvatarState.THINKING) {
        if (isValidAvatarDataUrl(thinkingAvatarDataUrl)) {
          return thinkingAvatarDataUrl;
        }

        if (isValidAvatarDataUrl(answeringAvatarDataUrl)) {
          return answeringAvatarDataUrl;
        }
      }

      if (state === AvatarState.ANSWERING && isValidAvatarDataUrl(answeringAvatarDataUrl)) {
        return answeringAvatarDataUrl;
      }

      if (isValidAvatarDataUrl(idleAvatarDataUrl)) {
        return idleAvatarDataUrl;
      }

      return '';
    }

    function setAvatarState(state, force = false, reason = '') {
      if (!overlay.isConnected || (!force && state === activeState)) {
        return;
      }

      const stateChanged = state !== activeState;
      activeState = state;
      const source = getSourceForState(state);
      const resolvedSource = source || chrome.runtime.getURL(AVATAR_ASSET);

      if (avatar.src !== resolvedSource) {
        setAvatarSource(avatar, source);
      }

      if (stateChanged) {
        debugLog(
          state === AvatarState.THINKING
            ? `Avatar state -> THINKING (reason: ${reason || 'thinking-control'})`
            : state === AvatarState.ANSWERING
              ? 'Avatar state -> ANSWERING (reason: stop-button)'
              : 'Avatar state -> IDLE'
        );
      }
    }

    chrome.storage.local.get(
      [
        AVATAR_IMAGE_KEY,
        THINKING_AVATAR_IMAGE_KEY,
        ANSWERING_AVATAR_IMAGE_KEY,
        ANSWERING_MIGRATION_KEY,
      ],
      (stored) => {
        if (chrome.runtime.lastError || !overlay.isConnected) {
          return;
        }

        idleAvatarDataUrl = stored[AVATAR_IMAGE_KEY];
        answeringAvatarDataUrl = stored[ANSWERING_AVATAR_IMAGE_KEY];
        thinkingAvatarDataUrl = stored[THINKING_AVATAR_IMAGE_KEY];
        migrateLegacyAnsweringAvatar(stored[ANSWERING_MIGRATION_KEY] === true);
        setAvatarState(activeState || AvatarState.IDLE, true);
      }
    );

    function handleStorageChange(changes, areaName) {
      if (areaName !== 'local') {
        return;
      }

      if (AVATAR_IMAGE_KEY in changes) {
        idleAvatarDataUrl = changes[AVATAR_IMAGE_KEY].newValue;
      }

      if (THINKING_AVATAR_IMAGE_KEY in changes) {
        thinkingAvatarDataUrl = changes[THINKING_AVATAR_IMAGE_KEY].newValue;
      }

      if (ANSWERING_AVATAR_IMAGE_KEY in changes) {
        answeringAvatarDataUrl = changes[ANSWERING_AVATAR_IMAGE_KEY].newValue;
      }

      if (ANSWERING_MIGRATION_KEY in changes) {
        migrateLegacyAnsweringAvatar(changes[ANSWERING_MIGRATION_KEY].newValue === true);
      }

      if (
        AVATAR_IMAGE_KEY in changes ||
        THINKING_AVATAR_IMAGE_KEY in changes ||
        ANSWERING_AVATAR_IMAGE_KEY in changes ||
        ANSWERING_MIGRATION_KEY in changes
      ) {
        setAvatarState(activeState || AvatarState.IDLE, true);
      }
    }

    chrome.storage.onChanged.addListener(handleStorageChange);
    setAvatarState(AvatarState.IDLE);

    return {
      setAvatarState,
      remove() {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      },
    };
  }

  function addAvatarStateDetection(overlay, setAvatarState) {
    let evaluationTimer = null;

    function scheduleStateEvaluation(delay = STATE_EVALUATION_DELAY_MS) {
      if (evaluationTimer !== null) {
        return;
      }

      evaluationTimer = window.setTimeout(() => {
        evaluationTimer = null;
        evaluateState();
      }, delay);
    }

    function evaluateState() {
      if (!overlay.isConnected) {
        return;
      }

      if (hasPulsingThinkingIndicator()) {
        setAvatarState(AvatarState.THINKING, false, 'pulsing-dot');
        return;
      }

      const thinkingControl = hasThinkingControl();
      const hasStopButton = Boolean(document.querySelector(STOP_BUTTON_SELECTOR));

      if (thinkingControl) {
        setAvatarState(AvatarState.THINKING, false, 'thinking-control');
        return;
      }

      if (DEBUG && hasStopButton) {
        const candidates = Array.from(document.querySelectorAll(THINKING_BUTTON_SELECTOR))
          .filter((button) => button.innerText.includes('Thinking'))
          .map((button) => ({
            tag: button.tagName,
            text: button.innerText,
            ariaExpanded: button.getAttribute('aria-expanded'),
          }));

        if (candidates.length > 0) {
          debugLog('Thinking control candidates did not match:', candidates);
        }
      }

      setAvatarState(
        hasStopButton ? AvatarState.ANSWERING : AvatarState.IDLE,
        false,
        hasStopButton ? 'stop-button' : ''
      );
    }

    function hasPulsingThinkingIndicator() {
      const candidates = Array.from(
        document.querySelectorAll(PULSING_THINKING_INDICATOR_SELECTOR)
      );
      const visibleCandidates = candidates.map((candidate) => {
        const computedStyle = window.getComputedStyle(candidate);
        const visible =
          !candidate.hidden &&
          candidate.getClientRects().length > 0 &&
          computedStyle.display !== 'none' &&
          computedStyle.visibility !== 'hidden';

        return { candidate, visible };
      });

      if (DEBUG && candidates.length > 0) {
        debugLog(
          'Pulsing thinking indicator candidates:',
          visibleCandidates.map(({ candidate, visible }) => ({
            visible,
            clientWidth: candidate.clientWidth,
            clientHeight: candidate.clientHeight,
            className: candidate.className,
          }))
        );
      }

      return visibleCandidates.some(({ visible }) => visible);
    }

    function hasThinkingControl() {
      return Array.from(document.querySelectorAll(THINKING_BUTTON_SELECTOR)).some((button) => {
        const words = button.innerText.trim().split(/\s+/).filter(Boolean);
        return words.length > 0 && words.every((word) => word === 'Thinking');
      });
    }

    function mutationMayAffectStateControls(mutations) {
      return mutations.some((mutation) => {
        if (mutation.type === 'attributes') {
          return true;
        }

        const target =
          mutation.target.nodeType === Node.ELEMENT_NODE
            ? mutation.target
            : mutation.target.parentElement;
        if (target && target.closest(THINKING_BUTTON_SELECTOR)) {
          return true;
        }

        return Array.from(mutation.addedNodes).concat(Array.from(mutation.removedNodes)).some(
          (node) =>
            node.nodeType === Node.ELEMENT_NODE &&
            (node.matches(STATE_CONTROL_SELECTOR) || node.querySelector(STATE_CONTROL_SELECTOR))
        );
      });
    }

    const observer = new MutationObserver((mutations) => {
      if (mutationMayAffectStateControls(mutations)) {
        scheduleStateEvaluation();
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-label', 'aria-expanded', 'class', 'hidden', 'style'],
    });
    scheduleStateEvaluation(0);

    return {
      remove() {
        observer.disconnect();
        if (evaluationTimer !== null) {
          window.clearTimeout(evaluationTimer);
        }
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
    const avatarStateMachine = addAvatarStateMachine(overlay, avatar);
    const avatarStateDetection = addAvatarStateDetection(
      overlay,
      avatarStateMachine.setAvatarState
    );

    closeButton.addEventListener('click', () => {
      document.documentElement.setAttribute(CLOSED_ATTRIBUTE, '');
      positionPersistence.remove();
      avatarStateMachine.remove();
      avatarStateDetection.remove();
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
