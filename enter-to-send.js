(() => {
  'use strict';

  const DEBUG_ENTER_TO_SEND = false;
  const INSTALLATION_ATTRIBUTE = 'data-nyfm-enter-to-send-installed';
  const STOP_BUTTON_SELECTOR = 'button[aria-label="Stop"]';
  const FALLBACK_SEND_BUTTON_SELECTOR = [
    'button[data-testid="send-button"]:not(:disabled)',
    'button[aria-label="Send"]:not(:disabled)',
    'button[aria-label="Send message"]:not(:disabled)',
    'button[aria-label="Send prompt"]:not(:disabled)',
  ].join(', ');

  function debugLog(...argumentsList) {
    if (DEBUG_ENTER_TO_SEND) {
      console.debug('[Enter to Send]', ...argumentsList);
    }
  }

  function getEditableHost(target) {
    if (!(target instanceof Element)) {
      return null;
    }

    if (target.matches('textarea')) {
      return target;
    }

    return target.closest('[contenteditable="true"], [contenteditable="plaintext-only"]');
  }

  function findEnabledSubmitButton(context) {
    return context.querySelector('button[type="submit"]:not(:disabled)');
  }

  function findFallbackSendButton(context) {
    return context.querySelector(FALLBACK_SEND_BUTTON_SELECTOR);
  }

  function findComposerContext(editable) {
    const form = editable.closest('form');
    if (form) {
      const submitButton = findEnabledSubmitButton(form);
      if (submitButton) {
        return { form, sendButton: submitButton, reason: 'form submit button' };
      }

      const formSendButton = findFallbackSendButton(form);
      if (formSendButton) {
        return { form, sendButton: formSendButton, reason: 'form send button' };
      }

      return { form, sendButton: null, reason: 'form without enabled send button' };
    }

    let nearbyAncestor = editable.parentElement;
    for (let depth = 0; nearbyAncestor && nearbyAncestor !== document.body && depth < 5; depth += 1) {
      const sendButton = findFallbackSendButton(nearbyAncestor);
      if (sendButton) {
        return { form: null, sendButton, reason: 'nearby send button' };
      }

      nearbyAncestor = nearbyAncestor.parentElement;
    }

    return null;
  }

  function hasMeaningfulText(editable) {
    const text = editable instanceof HTMLTextAreaElement ? editable.value : editable.innerText;
    return Boolean(text && text.trim());
  }

  function suppressOriginalEnter(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  function forwardAsCtrlEnter(editable) {
    const syntheticEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      ctrlKey: true,
      shiftKey: false,
      altKey: false,
      metaKey: false,
      bubbles: true,
      cancelable: true,
      composed: true,
    });

    return editable.dispatchEvent(syntheticEvent);
  }

  function isBareEnter(event) {
    return (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      !event.isComposing &&
      event.keyCode !== 229 &&
      !event.repeat
    );
  }

  function handleKeydown(event) {
    if (event.key !== 'Enter') {
      return;
    }

    if (!isBareEnter(event)) {
      debugLog('Enter ignored: modifier, IME, or repeat');
      return;
    }

    debugLog('Bare Enter detected');
    const editable = getEditableHost(event.target);
    if (!editable) {
      debugLog('Enter ignored: target is not an editable host');
      return;
    }

    debugLog('Editable host:', editable.tagName, editable.getAttribute('contenteditable'));
    const composer = findComposerContext(editable);
    if (!composer) {
      debugLog('Enter ignored: composer context not found');
      return;
    }

    if (composer.sendButton) {
      debugLog('Enter-to-Send: sending via Send button', composer.reason);
      suppressOriginalEnter(event);
      composer.sendButton.click();
      return;
    }

    const generationActive = Boolean(document.querySelector(STOP_BUTTON_SELECTOR));
    if (!composer.form) {
      debugLog('Generation fallback unavailable: no composer form');
      return;
    }

    if (!generationActive) {
      debugLog('Generation fallback unavailable: Stop button not found');
      return;
    }

    if (!hasMeaningfulText(editable)) {
      debugLog('Generation fallback unavailable: composer is empty');
      return;
    }

    debugLog('Enter-to-Send: forwarding as synthetic Ctrl+Enter');
    suppressOriginalEnter(event);
    const wasNotCancelled = forwardAsCtrlEnter(editable);
    if (!wasNotCancelled) {
      debugLog('Synthetic Ctrl+Enter was cancelled');
    }
  }

  if (document.documentElement.hasAttribute(INSTALLATION_ATTRIBUTE)) {
    return;
  }

  document.documentElement.setAttribute(INSTALLATION_ATTRIBUTE, '');
  document.addEventListener('keydown', handleKeydown, true);
})();
