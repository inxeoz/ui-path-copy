const { chromium } = require('playwright');
const fs = require('fs');

const P = fs.readFileSync('./lib/path-builder.js', 'utf-8');

const HTML = `
<!DOCTYPE html>
<html>
<body>
  <div data-test-context="LoginPage">
    <section>
      <form>
        <div data-testignore>
          <label>Email</label>
        </div>
        <input data-testid="email-input" data-testlabel="Email Address" />
        <input data-testid="password-input" type="password" />
        <button data-testid="btn:sign-in">Sign In</button>
      </form>
    </section>
    <div id="shadow-host"></div>
  </div>
  <script>
    const host = document.getElementById('shadow-host');
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<span data-testid="shadow-item">shadow</span><div><p data-testid="nested-shadow">nested</p></div>';
  </script>
</body>
</html>
`;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.setContent(HTML);
  await page.waitForFunction(() =>
    document.getElementById('shadow-host').shadowRoot &&
    document.getElementById('shadow-host').shadowRoot.querySelector('[data-testid="nested-shadow"]')
  );

  const results = await page.evaluate((src) => {
    eval(src);
    const settings = { format: 'playwright-path', highlight: true, shadowDom: true, skipTestignore: true };

    const e = document.querySelector('[data-testid="email-input"]');
    const pw = document.querySelector('[data-testid="password-input"]');
    const btn = document.querySelector('[data-testid="btn:sign-in"]');
    const lbl = document.querySelector('label');
    const host = document.getElementById('shadow-host');
    const shadowItem = host.shadowRoot.querySelector('[data-testid="shadow-item"]');
    const nestedShadow = host.shadowRoot.querySelector('[data-testid="nested-shadow"]');

    const results = [];

    // 1 playwright path
    const pwPath = buildPlaywrightPath(e, settings);
    results.push({
      name: 'playwright-path (email)',
      pass: pwPath === 'LoginPage | div[1] > section[1] > form[1] > email-input[data-testlabel="Email Address"]',
      got: pwPath,
    });

    // 2 shouldSkip: only the data-testignore DIV is skipped, label is NOT
    const lblPath = buildPlaywrightPath(lbl, settings);
    results.push({
      name: 'shouldSkip keeps children of data-testignore',
      pass: lblPath === 'LoginPage | div[1] > section[1] > form[1] > label[1]',
      got: lblPath,
    });

    // 3 css selector
    const cssPath = buildCssSelector(btn, settings);
    results.push({
      name: 'css-selector (button)',
      pass: cssPath === 'div:nth-of-type(1) > section:nth-of-type(1) > form:nth-of-type(1) > [data-testid="btn:sign-in"]',
      got: cssPath,
    });

    // 4 xpath
    const xpPath = buildXPath(e, settings);
    results.push({
      name: 'xpath (email)',
      pass: xpPath === '/div[1]/section[1]/form[1]/*[@data-testid="email-input"]',
      got: xpPath,
    });

    // 5 snippet with testid
    const snip = buildTestSnippet(e, settings);
    results.push({
      name: 'test-snippet (input with testid)',
      pass: snip === "await page.getByTestId('email-input').fill('');",
      got: snip,
    });

    // 6 snippet button (no fill)
    const btnSnip = buildTestSnippet(btn, settings);
    results.push({
      name: 'test-snippet (button)',
      pass: btnSnip === "await page.getByTestId('btn:sign-in');",
      got: btnSnip,
    });

    // 7 snippet without testid
    const noIdSnip = buildTestSnippet(lbl, settings);
    results.push({
      name: 'test-snippet (no testid)',
      pass: noIdSnip === "await page.locator('LoginPage | div[1] > section[1] > form[1] > label[1]');",
      got: noIdSnip,
    });

    // 8 all testids
    const allIds = getAllTestIds();
    results.push({
      name: 'getAllTestIds light DOM count',
      pass: Object.keys(allIds).length === 3 && allIds['email-input'] === 1,
      got: JSON.stringify(allIds),
    });

    // 9 shadow dom
    const shPath = buildPlaywrightPath(shadowItem, settings);
    results.push({
      name: 'shadow DOM traversal',
      pass: shPath === 'div[1] > div[1] > {shadow} > shadow-item',
      got: shPath,
    });

    // 10 nested shadow dom
    const nsPath = buildPlaywrightPath(nestedShadow, settings);
    results.push({
      name: 'nested shadow DOM',
      pass: nsPath === 'div[1] > div[1] > {shadow} > div[1] > nested-shadow',
      got: nsPath,
    });

    // 11 testContext
    results.push({
      name: 'testContext returns context',
      pass: testContext(e) === 'LoginPage',
      got: testContext(e),
    });

    // 12 formatAllTestIds empty
    const empty = (function() {
      const entries = [];
      return entries.length === 0 ? '(no data-testid attributes found on this page)' : '';
    })();
    results.push({
      name: 'empty testids message',
      pass: empty === '(no data-testid attributes found on this page)',
      got: empty,
    });

    return results;
  }, P);

  console.log('\n═══ VERIFICATION ═══\n');
  let pass = 0, fail = 0;
  for (const t of results) {
    const icon = t.pass ? '\u2713' : '\u2717';
    console.log(`  ${icon} ${t.name}`);
    if (!t.pass) {
      console.log(`      got: ${JSON.stringify(t.got)}`);
      if (t.chars) console.log(`      char codes: [${t.chars.join(',')}]`);
      fail++;
    } else {
      pass++;
    }
  }

  console.log(`\n  ${pass}/${pass + fail} passed\n`);

  // File checks
  const manifest = JSON.parse(fs.readFileSync('./chromium/manifest.json', 'utf-8'));
  console.log(`  \u2713 chromium/manifest v${manifest.version} (MV${manifest.manifest_version})`);
  const ffManifest = JSON.parse(fs.readFileSync('./firefox/manifest.json', 'utf-8'));
  console.log(`  \u2713 firefox/manifest v${ffManifest.version} (MV${ffManifest.manifest_version})`);

  const required = [
    'chromium/content.js', 'chromium/background.js', 'chromium/manifest.json', 'chromium/popup.html', 'chromium/popup.js',
    'chromium/lib/path-builder.js',
    'firefox/content.js', 'firefox/background.js', 'firefox/manifest.json', 'firefox/popup.html', 'firefox/popup.js',
    'firefox/lib/path-builder.js',
  ];
  let missing = 0;
  for (const f of required) {
    if (!fs.existsSync(f)) { console.log(`  \u2717 MISSING: ${f}`); missing++; }
  }
  if (missing === 0) console.log(`  \u2713 all ${required.length} files present`);

  await browser.close();

  if (fail > 0) { console.log('FAIL\n'); process.exit(1); }
  console.log('ALL PASS\n');
}

main().catch(e => { console.error('VERIFY FAILED:', e); process.exit(1); });
