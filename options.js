(() => {
  'use strict';

  const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
  const SUPPORTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
  const PLACEHOLDER_URL = chrome.runtime.getURL('assets/placeholder.svg');
  const ANSWERING_AVATAR_IMAGE_KEY = 'answeringAvatarImageDataUrl';
  const THINKING_AVATAR_IMAGE_KEY = 'thinkingAvatarImageDataUrl';
  const ANSWERING_MIGRATION_KEY = 'answeringAvatarMigrationComplete';

  function isValidAvatarDataUrl(value) {
    return typeof value === 'string' && /^data:image\/(png|jpeg|webp);base64,/i.test(value);
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

  function migrateLegacyAnsweringAvatar(callback) {
    chrome.storage.local.get(
      [ANSWERING_AVATAR_IMAGE_KEY, THINKING_AVATAR_IMAGE_KEY, ANSWERING_MIGRATION_KEY],
      (stored) => {
        if (chrome.runtime.lastError || stored[ANSWERING_MIGRATION_KEY] === true) {
          callback();
          return;
        }

        const answeringAvatar = stored[ANSWERING_AVATAR_IMAGE_KEY];
        const legacyAvatar = stored[THINKING_AVATAR_IMAGE_KEY];
        if (isValidAvatarDataUrl(answeringAvatar) || !isValidAvatarDataUrl(legacyAvatar)) {
          chrome.storage.local.set({ [ANSWERING_MIGRATION_KEY]: true }, callback);
          return;
        }

        chrome.storage.local.set(
          {
            [ANSWERING_AVATAR_IMAGE_KEY]: legacyAvatar,
            [ANSWERING_MIGRATION_KEY]: true,
          },
          () => {
            if (!chrome.runtime.lastError) {
              chrome.storage.local.remove(THINKING_AVATAR_IMAGE_KEY, callback);
              return;
            }

            callback();
          }
        );
      }
    );
  }

  function bindAvatarSetting(config) {
    const fileInput = document.getElementById(config.fileInputId);
    const preview = document.getElementById(config.previewId);
    const saveButton = document.getElementById(config.saveButtonId);
    const resetButton = document.getElementById(config.resetButtonId);
    const status = document.getElementById(config.statusId);
    let selectedFile = null;
    let previewObjectUrl = null;

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

    function loadSavedAvatar() {
      chrome.storage.local.get(config.storageKey, (stored) => {
        if (chrome.runtime.lastError) {
          setStatus('Could not load the saved avatar.', 'error');
          showPreview();
          return;
        }

        const savedAvatar = stored[config.storageKey];
        showPreview(isValidAvatarDataUrl(savedAvatar) ? savedAvatar : '');
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
      reader.addEventListener('error', () => setStatus('Could not read that image.', 'error'));
      reader.addEventListener('load', () => {
        const dataUrl = reader.result;
        if (!isValidAvatarDataUrl(dataUrl)) {
          setStatus('Could not read a supported image.', 'error');
          return;
        }

        // Image Data URLs stay in local storage because they exceed sync storage quotas.
        chrome.storage.local.set({ [config.storageKey]: dataUrl }, () => {
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
      chrome.storage.local.remove(config.storageKey, () => {
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
  }

  migrateLegacyAnsweringAvatar(() => {
    bindAvatarSetting({
      storageKey: 'avatarImageDataUrl',
      fileInputId: 'idle-avatar-file',
      previewId: 'idle-avatar-preview',
      saveButtonId: 'save-idle-avatar',
      resetButtonId: 'reset-idle-avatar',
      statusId: 'idle-avatar-status',
    });

    bindAvatarSetting({
      storageKey: THINKING_AVATAR_IMAGE_KEY,
      fileInputId: 'thinking-avatar-file',
      previewId: 'thinking-avatar-preview',
      saveButtonId: 'save-thinking-avatar',
      resetButtonId: 'reset-thinking-avatar',
      statusId: 'thinking-avatar-status',
    });

    bindAvatarSetting({
      storageKey: ANSWERING_AVATAR_IMAGE_KEY,
      fileInputId: 'answering-avatar-file',
      previewId: 'answering-avatar-preview',
      saveButtonId: 'save-answering-avatar',
      resetButtonId: 'reset-answering-avatar',
      statusId: 'answering-avatar-status',
    });
  });
})();
