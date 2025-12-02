const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    try { console.log('PAGE LOG:', msg.type(), msg.text()); } catch(e) { console.log('PAGE LOG:', msg.text()); }
  });
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));

  const base = 'http://localhost:1420';
  console.log('Navigating to', base);
  await page.goto(base + '/compendium', { waitUntil: 'domcontentloaded', timeout: 10000 });

  // Wait for compendium heading
  await page.waitForSelector('text=Compendium', { timeout: 5000 });

  // Click Spells tab (if present)
  try {
    const spellsTab = page.locator('button:has-text("Spells")');
    if (await spellsTab.count() > 0) {
      await spellsTab.first().click();
      console.log('Clicked Spells tab');
    }
  } catch (e) {
    console.log('Could not click Spells tab', e && e.message);
  }

  // Wait briefly for list to render
  await page.waitForTimeout(600);

  // Find clickable items (our list uses div[role="button"]) or fallback to .p-2
  let itemLocator = page.locator('div[role="button"]');
  if (await itemLocator.count() === 0) {
    itemLocator = page.locator('.p-2');
  }

  const count = await itemLocator.count();
  console.log('Found item controls count:', count);
  const texts = [];
  for (let i = 0; i < Math.min(count, 6); i++) {
    try {
      const txt = await itemLocator.nth(i).innerText();
      texts.push(txt.trim().split('\n')[0]);
    } catch (e) { texts.push('[error reading text]'); }
  }
  console.log('First items:', texts.slice(0,6));

  // Click the first item
  if (count > 0) {
    try {
      await itemLocator.first().click();
      console.log('Clicked first item');
    } catch (e) {
      console.log('Failed to click first item:', e && e.message);
    }
  }

  // Wait for details panel update and capture screenshot
  await page.waitForTimeout(800);
  const shotPath = 'headless-screenshot.png';
  await page.screenshot({ path: shotPath, fullPage: true });
  console.log('Saved screenshot to', shotPath);

  // Save page HTML snapshot
  const html = await page.content();
  fs.writeFileSync('headless-page.html', html);
  console.log('Saved HTML snapshot to headless-page.html');

  await browser.close();
  console.log('Headless test completed');
})();
