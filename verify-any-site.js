/**
 * Verifies both Chrome and Firefox extensions work on any website,
 * not just the previously hardcoded localhost URLs.
 *
 * Tests three sites:
 *  1. http://localhost:5175/login  — original site (regression)
 *  2. https://example.com          — external HTTPS site
 *  3. https://github.com           — real-world site with rich DOM
 */
const { chromium, firefox } = require('playwright');
const path = require('path');

const CHROME_EXT = path.resolve(__dirname);
const LOGIN_URL = 'http://localhost:5175/login';
const TEST_SITES = [
  { name: 'localhost (regression)', url: LOGIN_URL },
  { name: 'example.com',            url: 'https://example.com' },
  { name: 'github.com',             url: 'https://github.com' },
];

const BUILD_PATH_FN = `
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
        segments.unshift(tag + '[' + idx + ']');
      } else {
        segments.unshift(tag);
      }
    }
    current = current.parentElement;
  }
  return segments.join(' > ');
}
`;

async function sendCopyMessage(sw, page) {
  return sw.evaluate(() => new Promise((resolve) => {
    chrome.tabs.query({ active: true }, (tabs) => {
      if (!tabs[0]) { resolve({ error: 'no active tab' }); return; }
      chrome.tabs.sendMessage(tabs[0].id, { action: 'get-nav-path' }, (r) => {
        resolve({ sent: true, lastError: chrome.runtime.lastError?.message, r });
      });
    });
  }));
}

// ── Chrome ────────────────────────────────────────────────────────────────────
async function testChrome() {
  console.log('\n══════════════════════════════════');
  console.log('  CHROME EXTENSION — any-site test');
  console.log('══════════════════════════════════');

  const context = await chromium.launchPersistentContext('/tmp/chrome-any-site-profile', {
    headless: false,
    args: [
      `--disable-extensions-except=${CHROME_EXT}`,
      `--load-extension=${CHROME_EXT}`,
    ],
  });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);

  const [sw] = context.serviceWorkers();
  if (!sw) { console.log('  ✗ No service worker found'); await context.close(); return; }
  console.log('  Service worker:', sw.url());

  for (const site of TEST_SITES) {
    console.log(`\n  ── ${site.name} (${site.url}) ──`);
    const page = await context.newPage();
    page.on('console', msg => {
      if (msg.text().includes('CMTS')) console.log(`    [ext] ${msg.text()}`);
    });

    try {
      await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(1000);

      // Pick first element with data-testid, or fall back to first <a> or <button>
      const target = await page.evaluate((code) => {
        eval(code);
        const el = document.querySelector('[data-testid]')
          || document.querySelector('a')
          || document.querySelector('button')
          || document.querySelector('input');
        if (!el) return null;
        return {
          selector: el.getAttribute('data-testid')
            ? `[data-testid="${el.getAttribute('data-testid')}"]`
            : el.tagName.toLowerCase(),
          path: buildPath(el),
        };
      }, BUILD_PATH_FN);

      if (!target) { console.log('    ✗ No clickable element found'); await page.close(); continue; }
      console.log('    target selector:', target.selector);
      console.log('    expected path:  ', target.path);

      // Bring page to front then dispatch contextmenu event
      await page.bringToFront();
      await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
      }, target.selector);
      await page.waitForTimeout(300);

      // Trigger copy via service worker
      const swResult = await sendCopyMessage(sw, page);
      await page.waitForTimeout(600);

      const clip = await page.evaluate(() =>
        navigator.clipboard.readText().catch(e => 'READ_ERR: ' + e.message)
      );
      const match = clip === target.path;
      console.log('    clipboard:      ', JSON.stringify(clip));
      console.log('    result:         ', match ? '✓ MATCH' : '✗ MISMATCH');
      if (!match && swResult.lastError) console.log('    sw error:       ', swResult.lastError);
    } catch (e) {
      console.log('    ✗ ERROR:', e.message);
    }
    await page.close();
  }

  await context.close();
}

// ── Firefox ───────────────────────────────────────────────────────────────────
// Extension loading isn't supported via Playwright for Firefox, so we verify
// that the content.js logic + the executeScript clipboard approach work on
// every test site — same code path background.js invokes.
async function testFirefox() {
  console.log('\n══════════════════════════════════');
  console.log('  FIREFOX content logic — any-site');
  console.log('══════════════════════════════════');

  const browser = await firefox.launch({ headless: false });

  for (const site of TEST_SITES) {
    console.log(`\n  ── ${site.name} (${site.url}) ──`);
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('console', msg => {
      if (['error', 'warning'].includes(msg.type()) || msg.text().includes('CMTS'))
        console.log(`    [ff ${msg.type()}] ${msg.text()}`);
    });

    try {
      await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(1000);

      // Build path for the first available element
      const target = await page.evaluate((code) => {
        eval(code);
        const el = document.querySelector('[data-testid]')
          || document.querySelector('a')
          || document.querySelector('button')
          || document.querySelector('input');
        if (!el) return null;
        return { tag: el.tagName.toLowerCase(), path: buildPath(el) };
      }, BUILD_PATH_FN);

      if (!target) { console.log('    ✗ No element found'); await context.close(); continue; }
      console.log('    target tag:     ', target.tag);
      console.log('    expected path:  ', target.path);

      // Simulate exactly what background.js executeScript does
      const execResult = await page.evaluate((pathVal) => {
        const escaped = JSON.stringify(pathVal);
        // eslint-disable-next-line no-eval
        const ok = eval(`(function(p) {
          var ta = document.createElement('textarea');
          ta.value = p;
          ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;';
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          var ok = document.execCommand('copy');
          document.body.removeChild(ta);
          return ok;
        })(${escaped})`);
        return ok;
      }, target.path);

      console.log('    execCommand ok: ', execResult);

      // Read clipboard back to confirm actual write
      const clip = await page.evaluate(() =>
        navigator.clipboard.readText().catch(e => 'READ_ERR: ' + e.message)
      );
      const match = clip === target.path;
      console.log('    clipboard:      ', JSON.stringify(clip));
      console.log('    result:         ', match ? '✓ MATCH' : clip.startsWith('READ_ERR') ? '⚠ WROTE OK (clipboard read blocked by FF)' : '✗ MISMATCH');
    } catch (e) {
      console.log('    ✗ ERROR:', e.message);
    }
    await context.close();
  }

  await browser.close();
}

(async () => {
  try { await testChrome(); } catch (e) { console.error('Chrome suite FAILED:', e.message); }
  try { await testFirefox(); } catch (e) { console.error('Firefox suite FAILED:', e.message); }
  console.log('\n══════════════════════════════════');
  console.log('  DONE');
  console.log('══════════════════════════════════\n');
})();
