// Usage : PLAYWRIGHT_CHROME=<chrome.exe> node design/split.mjs "App Beaute Hi-Fi.dc.html"  (depuis la racine, playwright-core installé)
// Découpe le fichier Claude Design en écrans : HTML + capture PNG par écran, et un index.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const DESIGN = new URL('.', import.meta.url).pathname.replace(/^/([A-Za-z]:)/, '$1');
const OUT = path.join(DESIGN, 'screens');
const CHROME = process.env.PLAYWRIGHT_CHROME;
const file = process.argv[2] ?? 'App Beaute Hi-Fi.dc.html';
const prefix = process.argv[3] ?? '';

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(CHROME ? { executablePath: CHROME, headless: true } : { channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.log('pageerror', String(e).slice(0, 120)));
await page.goto('file:///' + path.join(DESIGN, file).replace(/\\/g, '/'), { waitUntil: 'load' });
await page.waitForTimeout(2500);

const items = await page.evaluate(() => {
  const out = [];
  for (const sec of document.querySelectorAll('section.dv-sec')) {
    const secId = sec.id;
    const secName = sec.querySelector('.dv-sname')?.textContent?.trim() ?? '';
    const secSub = sec.querySelector('.dv-ssub')?.textContent?.trim() ?? '';
    out.push({ kind: 'section', secId, secName, secSub });
    let idx = 0;
    for (const el of sec.querySelectorAll('.sc, .brg')) {
      if (el.classList.contains('brg')) {
        out.push({ kind: 'bridge', secId, text: el.textContent.replace(/\s+/g, ' ').trim() });
        continue;
      }
      const cap = el.querySelector(':scope > .cap');
      const id = cap?.querySelector('i')?.textContent?.trim() ?? `S${idx}`;
      const title = cap ? Array.from(cap.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim() : '';
      const ph = el.querySelector(':scope > .ph');
      el.setAttribute('data-shot', `${secId}-${idx}`);
      out.push({ kind: 'screen', secId, idx, id, title, html: ph ? ph.outerHTML : el.outerHTML, sel: `[data-shot="${secId}-${idx}"] > .ph` });
      idx++;
    }
  }
  return out;
});

const index = [];
let shots = 0;
for (const it of items) {
  if (it.kind === 'section') index.push(`\n## ${it.secId} — ${it.secName}\n\n${it.secSub}\n`);
  else if (it.kind === 'bridge') index.push(`- (renvoi) ${it.text}`);
  else {
    const slug = (prefix + it.id).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
    fs.writeFileSync(path.join(OUT, `${slug}.html`), `<!-- ${it.id} · ${it.title} (${it.secId}) -->\n${it.html}\n`);
    const loc = page.locator(it.sel).first();
    try {
      await loc.scrollIntoViewIfNeeded();
      await loc.screenshot({ path: path.join(OUT, `${slug}.png`) });
      shots++;
    } catch (e) {
      console.log('shot failed', it.id, String(e).slice(0, 100));
    }
    index.push(`- **${it.id}** ${it.title} → \`screens/${slug}.html\` / \`screens/${slug}.png\``);
  }
}
fs.writeFileSync(path.join(DESIGN, prefix ? `${prefix}index.md` : 'index.md'), `# ${file}\n${index.join('\n')}\n`);
console.log('screens:', items.filter((i) => i.kind === 'screen').length, 'shots:', shots);
await browser.close();
