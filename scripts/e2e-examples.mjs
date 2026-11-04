import puppeteer from 'puppeteer';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const children = [];

function stopServers() {
  for (const child of children) {
    try {
      if (process.platform === 'win32') child.kill();
      else process.kill(-child.pid, 'SIGTERM');
    } catch {
      child.kill();
    }
  }
}

process.on('exit', stopServers);
process.on('SIGINT', () => {
  stopServers();
  process.exit(130);
});
process.on('SIGTERM', () => {
  stopServers();
  process.exit(143);
});

async function isUp(url) {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitFor(url, label, timeoutMs = 240000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isUp(url)) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`${label} did not become ready at ${url}`);
}

function startServer(cwd, args) {
  const child = spawn('npx', ['--no-install', ...args], {
    cwd,
    stdio: 'ignore',
    detached: process.platform !== 'win32',
  });
  children.push(child);
}

const results = [];
function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function newPage(browser, url) {
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('requestfailed', (req) => errors.push(`requestfailed: ${req.url()}`));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  return { page, errors };
}

async function clearAndType(page, selector, text) {
  await page.click(selector, { clickCount: 3 });
  await page.type(selector, text);
}

const VANILLA_URL = process.env.VANILLA_URL ?? 'http://localhost:5173/';
const REACT_URL = process.env.REACT_URL ?? 'http://localhost:5174/';
const ANGULAR_URL = process.env.ANGULAR_URL ?? 'http://localhost:4200/';
const useExistingServers = process.env.E2E_USE_EXISTING === '1';

if (
  !existsSync(path.join(root, 'dist/index.js')) ||
  !existsSync(path.join(root, 'dist/worker/search-worker.mjs'))
) {
  console.error('Build the library first: npx tsup (or yarn build).');
  process.exit(1);
}

if (!useExistingServers) {
  if (!(await isUp(VANILLA_URL))) {
    startServer(path.join(root, 'examples/vanilla-ts'), ['vite', '--port', '5173', '--strictPort']);
  }
  if (!(await isUp(REACT_URL))) {
    startServer(path.join(root, 'examples/vite-react'), ['vite', '--port', '5174', '--strictPort']);
  }
  if (!(await isUp(ANGULAR_URL))) {
    startServer(path.join(root, 'examples/angular'), ['ng', 'serve', '--port', '4200']);
  }
  await Promise.all([
    waitFor(VANILLA_URL, 'Vanilla example'),
    waitFor(REACT_URL, 'React example'),
    waitFor(ANGULAR_URL, 'Angular example'),
  ]);
}

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  // ── Vanilla ──────────────────────────────────────────────────
  {
    const { page, errors } = await newPage(browser, VANILLA_URL);
    await page.waitForSelector('#search-input', { timeout: 60000 });
    await page.waitForFunction(() => !document.querySelector('#results .loading'), {
      timeout: 120000,
    });
    const badge = await page
      .$eval('#worker-badge', (el) => el.textContent.trim())
      .catch(() => null);
    record('vanilla exposes worker badge', !!badge, badge ?? 'missing');
    record('vanilla runs on Web Worker', badge === 'Running on Web Worker', badge ?? 'missing');
    record(
      'vanilla shows subject index stats',
      /subject/.test(await page.$eval('#stats', (el) => el.textContent)),
    );

    await page.type('#search-input', 'الله');
    await page.waitForSelector('.verse-card', { timeout: 60000 });
    const info = await page.$eval('#results', (el) => el.innerText);
    record('vanilla exact search renders results', /Found\s+[1-9]/.test(info), info.split('\n')[0]);

    // Multi-term (v0.4.0 array overload).
    await page.click('#search-input', { clickCount: 3 });
    await page.type('#search-input', 'محمد يونس');
    await page.waitForFunction(
      () =>
        document.querySelector('#rank-option')?.classList.contains('rank-option--visible') &&
        /term\(s\)/.test(document.querySelector('#results')?.innerText ?? ''),
      { timeout: 60000 },
    );
    record('vanilla multi-term search renders merged metadata', true);

    // Range-scoped text search (v0.4.0) must use the string overload.
    await clearAndType(page, '#search-input', '1:1-4 العالمين');
    await page.waitForFunction(
      () => {
        const text = document.querySelector('#results')?.innerText ?? '';
        return /Found\s+1 matches/.test(text) && /الفاتحة/.test(text);
      },
      { timeout: 60000 },
    );
    record('vanilla range-scoped text search stays inside the range', true);
    record(
      'vanilla range query bypasses multi-term',
      !(await page.$eval('#rank-option', (el) => el.classList.contains('rank-option--visible'))),
    );

    // Boolean queries are auto-detected and must not be split into terms.
    await clearAndType(page, '#search-input', '+الله -الرحمن');
    await page.waitForFunction(
      () =>
        /Found\s+[1-9]/.test(document.querySelector('#results')?.innerText ?? '') &&
        !document.querySelector('#rank-option')?.classList.contains('rank-option--visible'),
      { timeout: 60000 },
    );
    record('vanilla boolean query bypasses multi-term', true);

    // Range/filter intersection (v0.4.0): 2:255 cannot be in sura 1.
    await page.$eval('#search-input', (el) => {
      el.value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.type('#sura-id', '1');
    await page.type('#search-input', '2:255');
    await page.waitForFunction(
      () => /No results found/.test(document.querySelector('#results')?.innerText ?? ''),
      { timeout: 60000 },
    );
    record('vanilla contradictory range/filter returns no results', true);
    await page.$eval('#sura-id', (el) => {
      el.value = '';
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Subject (v0.4.0 thematic layer).
    await page.click('#search-input', { clickCount: 3 });
    await page.type('#search-input', 'climate');
    await page.click('#subject');
    await page.waitForFunction(
      () => /Subject:\s*126/.test(document.querySelector('#results')?.innerText ?? ''),
      { timeout: 60000 },
    );
    record('vanilla subject search counts 126 subject verses', true);
    record('vanilla has no page errors', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  // ── React ────────────────────────────────────────────────────
  {
    const { page, errors } = await newPage(browser, REACT_URL);
    await page.waitForSelector('input[type="text"]', { timeout: 120000 });

    await page.type('input[type="text"]', 'الله');
    await page.waitForSelector('.verse-card', { timeout: 60000 });
    const count = await page.$eval('.results-count', (el) => el.innerText);
    record('react exact search renders results', /Found\s+[1-9]/.test(count), count);
    const badge = await page.$eval('.worker-badge', (el) => el.textContent.trim());
    record('react worker search works', badge === 'Running on Web Worker', badge);

    // Multi-term path (v0.4.0 array overload).
    await page.click('input[type="text"]', { clickCount: 3 });
    await page.type('input[type="text"]', 'محمد يونس');
    await page.waitForFunction(
      () =>
        /term/.test(document.body.innerText) &&
        /Found\s+[1-9]/.test(document.querySelector('.results-count')?.textContent ?? ''),
      { timeout: 60000 },
    );
    const multi = await page.$eval('.results-count', (el) => el.innerText);
    const multiTag = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.verse-card span'))
        .map((s) => s.textContent)
        .find((t) => /term|hit/.test(t)),
    );
    record('react multi-term search renders merged results', /Found\s+[1-9]/.test(multi), multi);
    record('react multi-term metadata present', !!multiTag, multiTag ?? 'missing');

    // Range-scoped text search (v0.4.0) must use the string overload.
    await clearAndType(page, 'input[type="text"]', '1:1-4 العالمين');
    await page.waitForFunction(
      () =>
        /Found\s+1 matches/.test(document.querySelector('.results-count')?.textContent ?? '') &&
        document.querySelectorAll('.verse-card').length === 1,
      { timeout: 60000 },
    );
    record('react range-scoped text search stays inside the range', true);
    record('react range query bypasses multi-term', (await page.$$('select')).length === 0);

    // Boolean queries are auto-detected and must not be split into terms.
    await clearAndType(page, 'input[type="text"]', '+الله -الرحمن');
    await page.waitForFunction(
      () => /Found\s+[1-9]/.test(document.querySelector('.results-count')?.textContent ?? ''),
      { timeout: 60000 },
    );
    record('react boolean query bypasses multi-term', (await page.$$('select')).length === 0);

    // Range/filter intersection (v0.4.0): 2:255 cannot be in sura 1.
    await clearAndType(page, 'input[type="text"]', '2:255');
    await page.click('input[type="number"]', { clickCount: 3 });
    await page.type('input[type="number"]', '1');
    await page.waitForFunction(
      () => /Found\s+0 matches/.test(document.querySelector('.results-count')?.textContent ?? ''),
      { timeout: 60000 },
    );
    record('react contradictory range/filter returns no results', true);
    await page.click('input[type="number"]', { clickCount: 3 });
    await page.keyboard.press('Backspace');

    // Subject (v0.4.0 thematic layer).
    await page.click('input[type="text"]', { clickCount: 3 });
    await page.type('input[type="text"]', 'climate');
    const subjectClicked = await page.evaluate(() => {
      const label = Array.from(document.querySelectorAll('label.option-item')).find((l) =>
        l.textContent.includes('Subject Search'),
      );
      const input = label?.querySelector('input[type="checkbox"]');
      if (!input) return false;
      input.click();
      return true;
    });
    record('react has Subject Search toggle', subjectClicked);
    await page.waitForFunction(() => /Subject:\s*126/.test(document.body.innerText), {
      timeout: 60000,
    });
    record('react subject search counts 126 subject verses', true);
    record('react has no page errors', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  // ── Angular ──────────────────────────────────────────────────
  {
    const { page, errors } = await newPage(browser, ANGULAR_URL);
    await page.waitForSelector('input#query', { timeout: 120000 });
    await page.waitForFunction(() => !document.querySelector('input#query').disabled, {
      timeout: 180000,
    });
    const badge = await page
      .$eval('.worker-badge', (el) => el.textContent.trim())
      .catch(() => null);
    record('angular loads and reports worker mode', !!badge, badge ?? 'missing');
    record('angular runs on Web Worker', badge === 'Running on Web Worker', badge ?? 'missing');
    record(
      'angular shows subject index stats',
      /subject/.test(await page.$eval('.index-stats', (el) => el.textContent)),
    );

    await page.type('input#query', 'الرحمن');
    await page.waitForSelector('ol.list li.item', { timeout: 60000 });
    const meta = await page.$eval('.counts', (el) => el.innerText);
    record('angular exact search renders results', /Total:\s*[1-9]/.test(meta), meta);
    record('angular highlights a token', (await page.$$('span[class^="highlight-"]')).length > 0);

    // Multi-term (v0.4.0 array overload).
    await page.click('input#query', { clickCount: 3 });
    await page.type('input#query', 'محمد يونس');
    await page.waitForFunction(
      () =>
        !!document.querySelector('select') &&
        /term\(s\)/.test(document.querySelector('.list')?.innerText ?? ''),
      { timeout: 60000 },
    );
    record('angular multi-term search renders merged metadata', true);

    // Range-scoped text search (v0.4.0) must use the string overload.
    await clearAndType(page, 'input#query', '1:1-4 العالمين');
    await page.waitForFunction(
      () =>
        !document.querySelector('select') &&
        /Total:\s*1\b/.test(document.querySelector('.counts')?.innerText ?? '') &&
        document.querySelectorAll('ol.list li.item').length === 1,
      { timeout: 60000 },
    );
    record('angular range-scoped text search stays inside the range', true);
    record('angular range query bypasses multi-term', (await page.$$('select')).length === 0);

    // Boolean queries are auto-detected and must not be split into terms.
    await clearAndType(page, 'input#query', '+الله -الرحمن');
    await page.waitForFunction(
      () =>
        !document.querySelector('select') &&
        /Total:\s*[1-9]/.test(document.querySelector('.counts')?.innerText ?? ''),
      { timeout: 60000 },
    );
    record('angular boolean query bypasses multi-term', true);

    // Range/filter intersection (v0.4.0): 2:255 cannot be in sura 1.
    await clearAndType(page, 'input#query', '2:255');
    await page.click('input[type="number"]', { clickCount: 3 });
    await page.type('input[type="number"]', '1');
    await page.waitForFunction(
      () => /Total:\s*0\b/.test(document.querySelector('.counts')?.innerText ?? ''),
      { timeout: 60000 },
    );
    record('angular contradictory range/filter returns no results', true);
    await page.click('input[type="number"]', { clickCount: 3 });
    await page.keyboard.press('Backspace');

    // Subject (v0.4.0 thematic layer).
    await page.click('input#query', { clickCount: 3 });
    await page.type('input#query', 'climate');
    await page.evaluate(() => {
      const label = Array.from(document.querySelectorAll('label.check')).find((l) =>
        l.textContent.includes('Subject'),
      );
      label?.querySelector('input[type="checkbox"]')?.click();
    });
    await page.waitForFunction(
      () => /Subject:\s*126/.test(document.querySelector('.counts')?.innerText ?? ''),
      { timeout: 60000 },
    );
    record('angular subject search counts 126 subject verses', true);
    record('angular has no page errors', errors.length === 0, errors.join(' | '));
    await page.close();
  }
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
stopServers();
await new Promise((resolve) => setTimeout(resolve, 300));
process.exit(failed.length ? 1 : 0);
