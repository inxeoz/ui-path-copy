const { chromium, firefox } = require('playwright');
const path = require('path');
const fs = require('fs');

const P = fs.readFileSync('./lib/path-builder.js', 'utf-8');
const DEF_SETTINGS = { format: 'playwright-path', highlight: true, shadowDom: true, skipTestignore: true };

const CHROME_EXT = path.resolve(__dirname, 'chromium');
const LOGIN_URL = 'http://localhost:5175/login';

async function testChrome() {
  console.log('\n═══ CHROME EXTENSION TEST ═══');
  const context = await chromium.launchPersistentContext('/tmp/chrome-ext-profile', {
    headless: false,
    args: [
      `--disable-extensions-except=${CHROME_EXT}`,
      `--load-extension=${CHROME_EXT}`,
    ],
  });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);

  const page = await context.newPage();
  page.on('console', msg => {
    if (msg.text().includes('CMTS')) console.log(`  [chrome] ${msg.text()}`);
  });

  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1500);

  const el = await page.evaluate((src) => {
    eval(src);
    const settings = { format: 'playwright-path', highlight: true, shadowDom: true, skipTestignore: true };
    const e = document.querySelector('[data-testid]');
    return e ? { testId: e.getAttribute('data-testid'), path: formatPath(e, settings) } : null;
  }, P);
  console.log('  element:', JSON.stringify(el));

  if (el) {
    await page.evaluate((tid) => {
      document.querySelector(`[data-testid="${tid}"]`)
        .dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    }, el.testId);
    await page.waitForTimeout(300);

    const [sw] = context.serviceWorkers();
    if (sw) {
      await sw.evaluate(() => new Promise((resolve) => {
        chrome.tabs.query({ active: true }, (tabs) => {
          if (!tabs[0]) { resolve(); return; }
          chrome.tabs.sendMessage(tabs[0].id, { action: 'get-nav-path' }, resolve);
        });
      }));
    }
    await page.waitForTimeout(500);

    const clip = await page.evaluate(() => navigator.clipboard.readText().catch(e => 'READ_ERR: ' + e.message));
    console.log('  clipboard:', JSON.stringify(clip));
    console.log('  expected: ', JSON.stringify(el.path));
    console.log('  result:   ', clip === el.path ? '✓ MATCH' : '✗ MISMATCH');
  }
  await context.close();
}

async function testFirefox() {
  console.log('\n═══ FIREFOX — simulating executeScript clipboard approach ═══');
  const browser = await firefox.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('console', msg => {
    if (['error', 'warning'].includes(msg.type()) || msg.text().includes('CMTS'))
      console.log(`  [ff ${msg.type()}] ${msg.text()}`);
  });

  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1500);

  const allTestIds = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid]')).map(e => e.getAttribute('data-testid'))
  );
  console.log('  data-testid elements:', allTestIds);

  const el = await page.evaluate((src) => {
    eval(src);
    const settings = { format: 'playwright-path', highlight: true, shadowDom: true, skipTestignore: true };
    const e = document.querySelector('[data-testid]');
    return e ? { testId: e.getAttribute('data-testid'), path: formatPath(e, settings) } : null;
  }, P);
  console.log('  buildPath result:', JSON.stringify(el));

  if (!el) { await browser.close(); return; }

  const clipResult = await page.evaluate((pathVal) => {
    const escaped = JSON.stringify(pathVal);
    const injected = `(function(p) {
      var ta = document.createElement('textarea');
      ta.value = p;
      ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    })(${escaped});`;

    const ok = eval(injected);
    return { execCommandResult: ok };
  }, el.path);
  console.log('  executeScript clipboard inject:', JSON.stringify(clipResult));

  const clipRead = await page.evaluate(() =>
    navigator.clipboard.readText().catch(e => 'READ_ERR: ' + e.message)
  );
  console.log('  clipboard read back:', JSON.stringify(clipRead));

  const navClipResult = await page.evaluate(async (text) => {
    try {
      await navigator.clipboard.writeText(text + '__nav');
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }, el.path);
  console.log('  navigator.clipboard.writeText:', JSON.stringify(navClipResult));

  const clipRead2 = await page.evaluate(() =>
    navigator.clipboard.readText().catch(e => 'READ_ERR: ' + e.message)
  );
  console.log('  clipboard read back (2):     ', JSON.stringify(clipRead2));

  if (clipResult.execCommandResult) {
    console.log('  ✓ execCommand worked — Firefox executeScript approach WILL work');
  } else {
    console.log('  ✗ execCommand returned false — need navigator.clipboard fallback');
  }

  await browser.close();
}

(async () => {
  try { await testChrome(); } catch (e) { console.error('Chrome FAILED:', e.message); }
  try { await testFirefox(); } catch (e) { console.error('Firefox FAILED:', e.message); }
  console.log('\n═══ DONE ═══');
})();
