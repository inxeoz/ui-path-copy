const api = typeof browser !== 'undefined' ? browser : chrome;

document.addEventListener('DOMContentLoaded', async () => {
  const defaults = { format: 'playwright-path', highlight: true, shadowDom: true, skipTestignore: true };
  const settings = await api.storage.sync.get(defaults);

  const $ = id => document.getElementById(id);

  $('format').value = settings.format;
  $('highlight').checked = settings.highlight;
  $('shadowDom').checked = settings.shadowDom;
  $('skipTestignore').checked = settings.skipTestignore;

  $('format').addEventListener('change', e => api.storage.sync.set({ format: e.target.value }));
  $('highlight').addEventListener('change', e => api.storage.sync.set({ highlight: e.target.checked }));
  $('shadowDom').addEventListener('change', e => api.storage.sync.set({ shadowDom: e.target.checked }));
  $('skipTestignore').addEventListener('change', e => api.storage.sync.set({ skipTestignore: e.target.checked }));

  $('copyAll').addEventListener('click', async () => {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    api.tabs.sendMessage(tab.id, { action: 'get-all-testids' });
    window.close();
  });

  $('toggleInspector').addEventListener('click', async () => {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    api.tabs.sendMessage(tab.id, { action: 'toggle-inspector' });
    window.close();
  });
});
