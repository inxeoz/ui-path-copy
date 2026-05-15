browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: 'copy-nav-path',
    title: 'Copy Navigation Path',
    contexts: ['all'],
  });
});

browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'copy-nav-path') return;

  browser.tabs.sendMessage(tab.id, { action: 'get-nav-path' })
    .then((response) => {
      if (!response || !response.path) return;

      const path = response.path;
      const escaped = JSON.stringify(path);

      // Inject clipboard write into the active tab via executeScript.
      // clipboardWrite permission applies here, and the page has focus
      // because the context menu just closed — execCommand works reliably.
      return browser.tabs.executeScript(tab.id, {
        code: `(function(p) {
          var ta = document.createElement('textarea');
          ta.value = p;
          ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;';
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          var ok = document.execCommand('copy');
          document.body.removeChild(ta);
          if (ok) {
            var count = p.split(' > ').length;
            var preview = p.length > 80 ? p.substring(0, 80) + '...' : p;
            console.log(
              '%cCMTS Navigator%c Copied ' + count + '-segment path: ' + preview,
              'background:#1E3A5F;color:#FFD700;padding:2px 6px;border-radius:4px;font-weight:700;',
              'color:#0f172a;'
            );
          } else {
            alert('CMTS Navigator: execCommand copy failed.');
          }
        })(${escaped});`,
      });
    })
    .catch((err) => {
      console.warn('CMTS Navigator:', err.message);
    });
});
