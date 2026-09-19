(() => {
  'use strict';

  const AVATAR_IMAGE_KEY = 'avatarImageDataUrl';
  const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
  const SUPPORTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
  const PLACEHOLDER_URL = chrome.runtime.getURL('assets/placeholder.svg');

  const fileInput = document.getElementById('avatar-file');
  const preview = document.getElementById('avatar-preview');
  const saveButton = document.getElementById('save-avatar');
  const resetButton = document.getElementById('reset-avatar');
  const status = document.getElementById('status');
  let selectedFile = null;
  let previewObjectUrl = null;

  function isValidAvatarDataUrl(value) {
    return typeof value === 'string' && /^data:image\/(png|jpeg|webp);base64,/i.test(value);
  }

  function setStatus(message, kind = '') {
    status.textContent = message;
    status.className = `status ${kind}`.trim();
  }

  function clearPreviewObjectUrl() {
    if (previewObjectUrl !== null) {
      URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = null;
    }
  }

  function showPreview(source) {
    preview.src = source || PLACEHOLDER_URL;
  }

  function validateFile(file) {
    if (!file) {
      return 'Choose an image before saving.';
    }

    if (!SUPPORTED_TYPES.has(file.type)) {
      return 'Choose a PNG, JPEG, or WebP image.';
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return 'The image must be 5 MB or smaller.';
    }

    return '';
  }

  function loadSavedAvatar() {
    chrome.storage.local.get(AVATAR_IMAGE_KEY, (stored) => {
      if (chrome.runtime.lastError) {
        setStatus('Could not load the saved avatar.', 'error');
        showPreview();
        return;
      }

      showPreview(isValidAvatarDataUrl(stored[AVATAR_IMAGE_KEY]) ? stored[AVATAR_IMAGE_KEY] : '');
    });
  }

  fileInput.addEventListener('change', () => {
    clearPreviewObjectUrl();
    selectedFile = fileInput.files[0] || null;
    const error = validateFile(selectedFile);

    if (error) {
      selectedFile = null;
      setStatus(error, 'error');
      loadSavedAvatar();
      return;
    }

    previewObjectUrl = URL.createObjectURL(selectedFile);
    showPreview(previewObjectUrl);
    setStatus('Preview ready. Save to use this avatar.');
  });

  saveButton.addEventListener('click', () => {
    const error = validateFile(selectedFile);

    if (error) {
      setStatus(error, 'error');
      return;
    }

    const reader = new FileReader();

    reader.addEventListener('error', () => {
      setStatus('Could not read that image.', 'error');
    });

    reader.addEventListener('load', () => {
      const dataUrl = reader.result;

      if (!isValidAvatarDataUrl(dataUrl)) {
        setStatus('Could not read a supported image.', 'error');
        return;
      }

      // Avatar Data URLs stay in local storage because image data is too large for sync quotas.
      chrome.storage.local.set({ [AVATAR_IMAGE_KEY]: dataUrl }, () => {
        if (chrome.runtime.lastError) {
          setStatus('Could not save the avatar. Try a smaller image.', 'error');
          return;
        }

        clearPreviewObjectUrl();
        showPreview(dataUrl);
        setStatus('Avatar saved.', 'success');
      });
    });

    reader.readAsDataURL(selectedFile);
  });

  resetButton.addEventListener('click', () => {
    chrome.storage.local.remove(AVATAR_IMAGE_KEY, () => {
      if (chrome.runtime.lastError) {
        setStatus('Could not reset the avatar.', 'error');
        return;
      }

      clearPreviewObjectUrl();
      selectedFile = null;
      fileInput.value = '';
      showPreview();
      setStatus('Using the default avatar.', 'success');
    });
  });

  loadSavedAvatar();
})();
