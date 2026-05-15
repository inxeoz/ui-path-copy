chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'copy-nav-path',
    title: 'Copy Navigation Path',
    contexts: ['all'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'copy-nav-path') return;

  chrome.tabs.sendMessage(tab.id, { action: 'get-nav-path' }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn('CMTS Navigator: no content script response', chrome.runtime.lastError.message);
      return;
    }
  });
});
