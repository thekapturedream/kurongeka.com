import { chromium } from '@playwright/test';
const B = 'http://localhost:4321';
const pages = [
  ['home', '/'], ['contact', '/contact'], ['tools', '/tools'],
  ['website-check', '/tools/website-check?url=thekapture.com'], ['domain-check', '/tools/domain-check?name=Tendai%27s%20Kitchen'],
  ['brand-colours', '/tools/brand-colours'], ['email-signature', '/tools/email-signature'],
  ['login', '/account/login'], ['register', '/account/register'], ['directory-apply', '/directory/apply'],
];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
for (const [w, h, tag] of [[1280, 900, 'desktop'], [390, 844, 'mobile']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  for (const [name, path] of pages) {
    await page.goto(B + path, { waitUntil: 'networkidle' });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    await page.screenshot({ path: '/tmp/claude-0/-home-user-kurongeka-com/c28b7e8b-d678-5acd-b875-5d01abae33a6/scratchpad/shots/' + tag + '-' + name + '.png', fullPage: true });
    console.log(tag, name, 'overflow', overflow);
  }
  await ctx.close();
}
await browser.close();
