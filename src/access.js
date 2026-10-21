/* Optional access to sites (manifest optional_host_permissions), used to read page titles
   and to load icon images from servers that don't allow cross-origin requests.
   Requested once, the first time it's needed; a refusal is remembered and not asked again. */
(function (GT) {
  'use strict';

  const ORIGINS = ['http://*/*', 'https://*/*'];
  const DENIED_KEY = 'go-tab:host-access-denied';
  const perms = globalThis.chrome && chrome.permissions;
  let pending = null;

  const wasDenied = () => {
    try {
      return localStorage.getItem(DENIED_KEY) === '1';
    } catch {
      return false;
    }
  };

  GT.access = {
    /* Whether access is already granted. Never prompts. */
    async has() {
      if (!perms) return false;
      try {
        return await perms.contains({ origins: ORIGINS });
      } catch {
        return false;
      }
    },

    /* Call synchronously from a click or submit handler: Chrome only shows the prompt during
       a user gesture. Resolves immediately (no prompt) if already granted or refused before. */
    ensure() {
      if (!perms || wasDenied()) return GT.access.has();
      /* One prompt at a time: a title lookup and an icon load can both ask on the same submit. */
      pending ??= perms.request({ origins: ORIGINS }).then((granted) => {
        if (!granted) {
          try {
            localStorage.setItem(DENIED_KEY, '1');
          } catch {
            /* Then we may ask again next time; harmless. */
          }
        }
        return granted;
      }, () => false).finally(() => {
        pending = null;
      });
      return pending;
    }
  };
})(window.GT = window.GT || {});
