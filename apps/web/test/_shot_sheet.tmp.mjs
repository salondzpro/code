import { chromium } from 'playwright-core';
const exe = process.env.PLAYWRIGHT_CHROME || undefined;
const browser = await chromium.launch(exe ? { executablePath: exe, headless: true } : { channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const OUT = process.env.OUT;
try {
  await page.goto('https://salondz.onrender.com/s/salon-demo', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Salon Démo' }).waitFor({ timeout: 60_000 });
  await page.getByRole('tab', { name: 'Prestations' }).click();
  await page.getByRole('button', { name: /Coupe homme/ }).click();
  await page.getByRole('button', { name: /Coupe femme/ }).click();
  await page.getByRole('button', { name: /^Brushing/ }).click();
  await page.getByText('3 prestations').waitFor();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/public-sheet-bottom.png` });
  console.log('ok');
} catch (e) {
  console.log('ERR', String(e).split('\n')[0], page.url());
}
await browser.close();
