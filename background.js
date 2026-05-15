chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'copy-nav-path',
    title: 'Copy Navigation Path',
    contexts: ['all'],
  });
  chrome.contextMenus.create({
    id: 'copy-url-path',
    title: 'Copy URL + Path',
    contexts: ['all'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'copy-nav-path') {
    chrome.tabs.sendMessage(tab.id, { action: 'get-nav-path' }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('UI Path Copy:', chrome.runtime.lastError.message);
      }
    });
  }

  if (info.menuItemId === 'copy-url-path') {
    chrome.tabs.sendMessage(tab.id, { action: 'get-url-path' }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('UI Path Copy:', chrome.runtime.lastError.message);
      }
    });
  }
});
