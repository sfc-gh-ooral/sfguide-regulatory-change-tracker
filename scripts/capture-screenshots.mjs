// Captures the guide screenshots from the hosted Sample-mode example, plus 960x600 catalog cards.
// Usage: npm run build:example, serve docs/ so /sfguide-regulatory-change-tracker/ maps to it
// (for example a symlink plus `python3 -m http.server 8817`), then `node scripts/capture-screenshots.mjs`.
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const BASE = process.env.APP_URL ?? 'http://127.0.0.1:8817/sfguide-regulatory-change-tracker/try';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

async function shot(name, path, prep) {
  await page.goto(`${BASE}${path}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200);
  if (prep) await prep();
  await page.screenshot({ path: `docs/images/${name}.png` });
  console.log('captured', name);
}

await shot('01-change-inbox', '/');
await shot('02-notice-deadline', '/notice/?id=RCN-2026-004', async () => {
  await page.getByRole('button', { name: 'Re-assess' }).click();
  await page.waitForSelector('text=Fresh assessment', { timeout: 20000 });
});
await shot('03-obligation-map-gaps', '/map/', async () => {
  await page.getByLabel('Filter obligations').selectOption('gaps');
  await page.waitForTimeout(400);
});
await shot('04-gap-tracker', '/gaps/?id=GAP-0202');
await shot('05-ask-rulebook', '/ask/', async () => {
  await page.getByRole('button', { name: 'How long must we keep complaint records, and do our policies agree?' }).click();
  await page.waitForSelector('text=Sample AI response', { timeout: 30000 });
  await page.waitForTimeout(500);
});
await shot('06-not-applicable', '/notice/?id=RCN-2026-016');
await browser.close();

// Catalog cards: 960x600 JPEG, dashboard first.
const cards = ['01-change-inbox', '03-obligation-map-gaps', '02-notice-deadline', '04-gap-tracker', '05-ask-rulebook', '06-not-applicable'];
cards.forEach((c, i) => {
  const out = `docs/catalog/regulatory-change-tracker-${i + 1}.jpg`;
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '55', '-z', '600', '960', `docs/images/${c}.png`, '--out', out], { stdio: 'ignore' });
});
console.log('catalog cards written');
