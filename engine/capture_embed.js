// node capture_embed.js <html> <out.png> <seconds>   screenshot the player area of a Channel 9 page at a time offset
const { chromium } = require('playwright');
(async () => {
  const [file, out, at, three] = process.argv.slice(2); // three: optional local three.min.js (when the CDN is unreachable)
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1 });
  if (three) await p.route('**/three.min.js', (r) => r.fulfill({ path: three, contentType: 'application/javascript' }));
  await p.goto('file://' + require('path').resolve(file));
  await p.waitForTimeout(1500);
  await p.click('#go').catch(() => {});
  await p.waitForTimeout(1500);
  await p.evaluate((t) => { const s = document.querySelector('#seek'); s.value = t; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); }, at);
  await p.waitForTimeout(2500);
  await p.evaluate(() => { const c = document.querySelector('#ctl'); if (c) c.classList.add('hide'); });
  await p.locator('#tv').screenshot({ path: out, timeout: 120000, animations: 'allow' });
  await b.close();
})();
