browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({ id: 'copy-nav-path', title: 'Copy Path', contexts: ['all'] });
  browser.contextMenus.create({ id: 'copy-url-path', title: 'Copy URL + Path', contexts: ['all'] });
  browser.contextMenus.create({ id: 'separator-1', type: 'separator', contexts: ['all'] });
  browser.contextMenus.create({ id: 'copy-all-testids', title: 'Copy All testids on Page', contexts: ['all'] });
  browser.contextMenus.create({ id: 'toggle-inspector', title: 'Toggle Inspector Mode', contexts: ['all'] });
});

function injectClipboard(tabId, text) {
  const escaped = JSON.stringify(text);
  return browser.tabs.executeScript(tabId, {
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
        var preview = p.length > 120 ? p.substring(0, 120) + '\\u2026' : p;
        console.log('%cUI Path Copy%c Copied: ' + preview,
          'background:#1E3A5F;color:#FFD700;padding:2px 6px;border-radius:4px;font-weight:700;',
          'color:#0f172a;');
      }
    })(${escaped});`,
  });
}

browser.contextMenus.onClicked.addListener((info, tab) => {
  const actionMap = {
    'copy-nav-path': 'get-nav-path',
    'copy-url-path': 'get-url-path',
    'copy-all-testids': 'get-all-testids',
    'toggle-inspector': 'toggle-inspector',
  };
  const action = actionMap[info.menuItemId];
  if (!action) return;

  browser.tabs.sendMessage(tab.id, { action })
    .then(response => {
      if (!response || response.error) return;
      return injectClipboard(tab.id, response.path);
    })
    .catch(err => console.warn('UI Path Copy:', err.message));
});

browser.runtime.onMessage.addListener((msg, sender) => {
  if (msg.action === 'inspector-copy') {
    return injectClipboard(sender.tab.id, msg.path);
  }
});
