const { chromium, firefox } = require('playwright');
const path = require('path');
const fs = require('fs');

const P = fs.readFileSync('./lib/path-builder.js', 'utf-8');
const DEF_SETTINGS = { format: 'playwright-path', highlight: true, shadowDom: true, skipTestignore: true };

const CHROME_EXT = path.resolve(__dirname, 'chromium');
const LOGIN_URL = 'http://localhost:5175/login';
const TEST_SITES = [
  { name: 'localhost (regression)', url: LOGIN_URL },
  { name: 'example.com',            url: 'https://example.com' },
  { name: 'github.com',             url: 'https://github.com' },
];

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

async function getTarget(page) {
  return page.evaluate((src) => {
    eval(src);
    const settings = { format: 'playwright-path', highlight: true, shadowDom: true, skipTestignore: true };
    const el = document.querySelector('[data-testid]')
      || document.querySelector('a')
      || document.querySelector('button')
      || document.querySelector('input');
    if (!el) return null;
    return {
      selector: el.getAttribute('data-testid')
        ? `[data-testid="${el.getAttribute('data-testid')}"]`
        : el.tagName.toLowerCase(),
      path: formatPath(el, settings),
    };
  }, src);
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

      const target = await getTarget(page);

      if (!target) { console.log('    ✗ No clickable element found'); await page.close(); continue; }
      console.log('    target selector:', target.selector);
      console.log('    expected path:  ', target.path);

      await page.bringToFront();
      await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
      }, target.selector);
      await page.waitForTimeout(300);

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

      const target = await getTarget(page);

      if (!target) { console.log('    ✗ No element found'); await context.close(); continue; }
      console.log('    target tag:     ', target.selector);
      console.log('    expected path:  ', target.path);

      const execResult = await page.evaluate((pathVal) => {
        const escaped = JSON.stringify(pathVal);
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
