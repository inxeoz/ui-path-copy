chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'copy-nav-path', title: 'Copy Path', contexts: ['all'] });
  chrome.contextMenus.create({ id: 'copy-url-path', title: 'Copy URL + Path', contexts: ['all'] });
  chrome.contextMenus.create({ id: 'separator-1', type: 'separator', contexts: ['all'] });
  chrome.contextMenus.create({ id: 'copy-all-testids', title: 'Copy All testids on Page', contexts: ['all'] });
  chrome.contextMenus.create({ id: 'toggle-inspector', title: 'Toggle Inspector Mode', contexts: ['all'] });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const action = {
    'copy-nav-path': 'get-nav-path',
    'copy-url-path': 'get-url-path',
    'copy-all-testids': 'get-all-testids',
    'toggle-inspector': 'toggle-inspector',
  }[info.menuItemId];
  if (action) {
    chrome.tabs.sendMessage(tab.id, { action }, () => {
      if (chrome.runtime.lastError) console.warn('UI Path Copy:', chrome.runtime.lastError.message);
    });
  }
});
