let lastRightClicked = null;

document.addEventListener('contextmenu', (e) => {
  lastRightClicked = e.target;
}, true);

function buildPath(el) {
  const segments = [];
  let current = el;

  while (current && current !== document.documentElement && current !== document.body) {
    const testId = current.getAttribute('data-testid');
    if (testId) {
      segments.unshift(testId);
    } else {
      const tag = current.tagName.toLowerCase();
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName);
        const idx = siblings.indexOf(current) + 1;
        segments.unshift(`${tag}[${idx}]`);
      } else {
        segments.unshift(tag);
      }
    }
    current = current.parentElement;
  }

  return segments.join(' > ');
}

// Content script only builds and returns the path.
// Clipboard write is handled by background.js via tabs.executeScript
// so the clipboardWrite permission applies in the focused tab context.
browser.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'get-nav-path') {
    if (!lastRightClicked) {
      alert('UI Path Copy: right-click an element first, then use "Copy Navigation Path".');
      return Promise.resolve({ error: 'no element right-clicked' });
    }
    const path = buildPath(lastRightClicked);
    lastRightClicked = null;
    return Promise.resolve({ path });
  }

  if (msg.action === 'get-url-path') {
    if (!lastRightClicked) {
      alert('UI Path Copy: right-click an element first, then use "Copy URL + Path".');
      return Promise.resolve({ error: 'no element right-clicked' });
    }
    const path = buildPath(lastRightClicked);
    lastRightClicked = null;
    return Promise.resolve({ path, url: location.href });
  }
});
