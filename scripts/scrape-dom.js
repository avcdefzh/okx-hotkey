#!/usr/bin/env node
/**
 * scrape-dom.js — Headless Chrome으로 OKX 거래 페이지 DOM 추출
 * puppeteer-core 사용 (설치된 Chrome 활용)
 */

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUTPUT_DIR = path.join(__dirname, '..', 'dom-dumps');

const PAGES = [
  { name: 'spot', url: 'https://www.okx.com/trade-spot/btc-usdt' },
  { name: 'futures', url: 'https://www.okx.com/trade-swap/btc-usdt-swap' },
];

async function extractDOM(page, name) {
  const waitSelectors = [
    'input[name="price"]',
    'input[name="size"]',
    'button[side="buy"]',
    '[class*="trade"]',
    '[class*="order"]',
  ];

  for (const sel of waitSelectors) {
    try {
      await page.waitForSelector(sel, { timeout: 5000 });
      console.log(`  [${name}] Found: ${sel}`);
    } catch {
      console.log(`  [${name}] Not found: ${sel}`);
    }
  }

  // Extra wait for React hydration
  await new Promise(r => setTimeout(r, 8000));

  const domData = await page.evaluate(() => {
    const results = {};

    function buildSelector(el) {
      if (el.id) return '#' + el.id;
      if (el.getAttribute('data-testid')) return '[data-testid="' + el.getAttribute('data-testid') + '"]';
      if (el.getAttribute('data-e2e')) return '[data-e2e="' + el.getAttribute('data-e2e') + '"]';
      if (el.name) return el.tagName.toLowerCase() + '[name="' + el.name + '"]';
      return '';
    }

    // 1. All inputs
    results.inputs = Array.from(document.querySelectorAll('input')).map(el => ({
      name: el.name, type: el.type, placeholder: el.placeholder,
      className: el.className.slice(0, 200), id: el.id,
      parentClass: (el.parentElement && el.parentElement.className) ? el.parentElement.className.slice(0, 200) : '',
      value: el.value,
      ariaLabel: el.getAttribute('aria-label'),
      dataTestId: el.getAttribute('data-testid'),
      dataE2e: el.getAttribute('data-e2e'),
      selector: buildSelector(el),
    }));

    // 2. All buttons
    results.buttons = Array.from(document.querySelectorAll('button')).map(el => ({
      text: el.textContent.trim().slice(0, 100), className: el.className.slice(0, 200),
      id: el.id, side: el.getAttribute('side'),
      ariaLabel: el.getAttribute('aria-label'),
      dataTestId: el.getAttribute('data-testid'),
      dataE2e: el.getAttribute('data-e2e'),
      disabled: el.disabled, selector: buildSelector(el),
    }));

    // 3. Elements with data-testid
    results.dataTestIds = Array.from(document.querySelectorAll('[data-testid]')).map(el => ({
      tag: el.tagName.toLowerCase(), testId: el.getAttribute('data-testid'),
      text: el.textContent.trim().slice(0, 80),
      className: el.className ? el.className.toString().slice(0, 150) : '',
    }));

    // 4. Elements with data-e2e
    results.dataE2e = Array.from(document.querySelectorAll('[data-e2e]')).map(el => ({
      tag: el.tagName.toLowerCase(), e2e: el.getAttribute('data-e2e'),
      text: el.textContent.trim().slice(0, 80),
    }));

    // 5. Order book
    results.orderBook = [];
    for (const sel of ['.order-book-box', '[class*="orderBook"]', '[class*="order-book"]', '[class*="depth"]']) {
      var el = document.querySelector(sel);
      if (el) results.orderBook.push({ selector: sel, childCount: el.children.length, outerHTML: el.outerHTML.slice(0, 3000) });
    }

    // 6. Trading panel / form areas
    results.tradingPanel = [];
    for (const sel of ['#leftPoForm', '#rightPoForm', '[class*="tradePanel"]', '[class*="trade-panel"]', '[class*="orderForm"]', '[class*="order-form"]', 'form']) {
      document.querySelectorAll(sel).forEach(function(el) {
        results.tradingPanel.push({ selector: sel, id: el.id, className: el.className ? el.className.toString().slice(0, 300) : '', childCount: el.children.length, innerHTML: el.innerHTML.slice(0, 5000) });
      });
    }

    // 7. Tabs
    results.tabs = Array.from(document.querySelectorAll('[role="tab"], [class*="tab"], [class*="Tab"]')).map(el => ({
      text: el.textContent.trim().slice(0, 60),
      className: el.className ? el.className.toString().slice(0, 200) : '',
      ariaSelected: el.getAttribute('aria-selected'),
      dataTestId: el.getAttribute('data-testid'),
      dataE2e: el.getAttribute('data-e2e'),
      role: el.getAttribute('role'),
    }));

    // 8. Positions
    results.positions = [];
    for (const sel of ['[class*="position"]', '[class*="Position"]', '[class*="holding"]']) {
      document.querySelectorAll(sel).forEach(function(el) {
        if (el.innerHTML.length < 10000) results.positions.push({ selector: sel, className: el.className ? el.className.toString().slice(0, 200) : '', text: el.textContent.trim().slice(0, 500) });
      });
    }

    // 9. Balance displays
    results.balances = [];
    for (const sel of ['.avail-display-container', '[class*="avail"]', '[class*="balance"]', '[class*="Balance"]']) {
      document.querySelectorAll(sel).forEach(function(el) {
        results.balances.push({ selector: sel, text: el.textContent.trim().slice(0, 200), className: el.className ? el.className.toString().slice(0, 200) : '', outerHTML: el.outerHTML.slice(0, 1000) });
      });
    }

    // 10. Top class patterns
    var classCount = {};
    document.querySelectorAll('*').forEach(function(el) {
      if (el.className && typeof el.className === 'string') {
        el.className.split(/\s+/).forEach(function(c) {
          if (c.length > 3 && c.length < 50) classCount[c] = (classCount[c] || 0) + 1;
        });
      }
    });
    results.topClasses = Object.entries(classCount).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 100).map(function(e) { return e[0] + ' (' + e[1] + ')'; });

    return results;
  });

  return domData;
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('Launching Chrome (headless)...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080', '--lang=en-US'],
  });

  for (const { name, url } of PAGES) {
    console.log('\nScraping ' + name + ': ' + url);
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      console.log('  Page loaded, waiting for React hydration...');
      const domData = await extractDOM(page, name);
      var outFile = path.join(OUTPUT_DIR, name + '-dom.json');
      fs.writeFileSync(outFile, JSON.stringify(domData, null, 2));
      console.log('  Saved to ' + outFile);
      var rawHtml = await page.content();
      fs.writeFileSync(path.join(OUTPUT_DIR, name + '-full.html'), rawHtml);
      console.log('  Full HTML saved');
    } catch (err) {
      console.error('  Error on ' + name + ':', err.message);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  console.log('\nDone!');
}

main().catch(function(err) { console.error('Fatal:', err); process.exit(1); });
