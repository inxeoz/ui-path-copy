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

function copyToClipboard(text) {
  return new Promise((resolve, reject) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(resolve).catch(() => fallbackCopy(text, resolve, reject));
    } else {
      fallbackCopy(text, resolve, reject);
    }
  });
}

function fallbackCopy(text, resolve, reject) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '-9999px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    document.execCommand('copy');
    resolve();
  } catch {
    reject();
  }
  document.body.removeChild(textarea);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action !== 'get-nav-path') return;

  if (!lastRightClicked) {
    alert('CMTS Navigator: right-click an element first, then use "Copy Navigation Path".');
    return;
  }

  const path = buildPath(lastRightClicked);
  lastRightClicked = null;

  copyToClipboard(path).then(() => {
    const count = path.split(' > ').length;
    const preview = path.length > 80 ? path.substring(0, 80) + '...' : path;
    console.log(`%cCMTS Navigator%c Copied ${count}-segment path: ${preview}`,
      'background:#1E3A5F;color:#FFD700;padding:2px 6px;border-radius:4px;font-weight:700;',
      'color:#0f172a;');
  }).catch(() => {
    alert('CMTS Navigator: failed to copy to clipboard. Check extension permissions.');
  });
});
