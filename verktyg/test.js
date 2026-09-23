/* Headless-test av sajten i riktig Chrome: skärmdumpar på desktop och mobil,
   plus alla konsolfel. Starta server.js först.

   node test.js [hero] [produkt] [sidor]    (inga argument = allt)
   Skärmdumparna hamnar i verktyg/shots/.

   Kräver: npm i puppeteer-core — använder den Chrome som redan är installerad. */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const BAS = 'http://localhost:8765/';
const UT = __dirname + '/shots/';
fs.mkdirSync(UT, { recursive: true });
const vila = (ms) => new Promise(r => setTimeout(r, ms));
const steg = process.argv.slice(2);
const kor = (n) => !steg.length || steg.includes(n);

(async () => {
  const webblasare = await puppeteer.launch({
    executablePath: process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--no-first-run']
  });
  const fel = [];
  async function sida(vy) {
    const p = await webblasare.newPage();
    await p.setViewport(vy);
    p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') fel.push(`[${m.type()}] ${p.url()} ${m.text()}`); });
    p.on('pageerror', e => fel.push(`[pageerror] ${p.url()} ${e.message}`));
    p.on('requestfailed', r => fel.push(`[requestfailed] ${r.url()} ${r.failure() && r.failure().errorText}`));
    return p;
  }
  const DESK = { width: 1440, height: 900, deviceScaleFactor: 1 };
  const MOB = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

  if (kor('hero')) {
    for (const [namn, vy] of [['desk', DESK], ['mob', MOB]]) {
      const p = await sida(vy);
      await p.goto(BAS + 'index.html', { waitUntil: 'load' });
      await p.waitForSelector('.hero.is-3d', { timeout: 20000 }).catch(() => fel.push('hero: is-3d kom aldrig (' + namn + ')'));
      await vila(2500);
      await p.screenshot({ path: UT + `hero-${namn}-0.png` });
      for (const y of [150, 350, 600, 900]) {
        await p.evaluate(y => window.scrollTo(0, y), y);
        await vila(1800);
        await p.screenshot({ path: UT + `hero-${namn}-${y}.png` });
      }
      await p.close();
    }
  }

  if (kor('produkt')) {
    for (const [namn, vy] of [['desk', DESK], ['mob', MOB]]) {
      const p = await sida(vy);
      await p.goto(BAS + 'produkten.html', { waitUntil: 'load' });
      await vila(600);
      await p.screenshot({ path: UT + `produkt-${namn}.png` });
      // byt till fodret i galleriet
      await p.click('.media__mini:nth-child(2)');
      await vila(700);
      await p.screenshot({ path: UT + `produkt-${namn}-foder.png` });
      await p.click('.media__mini:nth-child(1)');
      await vila(500);
      // klick på huvudbilden öppnar 3D
      await p.click('[data-galleri-huvud]');
      await p.waitForSelector('.v3d.is-klar', { timeout: 20000 }).catch(() => fel.push('visare: blev aldrig klar (' + namn + ')'));
      await vila(2500);
      await p.screenshot({ path: UT + `v3d-${namn}-start.png` });
      for (const v of ['sida', 'bak', 'insida', 'fram']) {
        await p.click(`[data-v3d-vy="${v}"]`);
        await vila(2200);
        await p.screenshot({ path: UT + `v3d-${namn}-${v}.png` });
      }
      // dra: snabbt svep, släpp — tröghet ska fortsätta rörelsen
      const b = await p.$('.v3d__scen');
      const r = await b.boundingBox();
      const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
      if (vy.hasTouch) {
        await p.touchscreen.touchStart(cx - 80, cy);
        for (let i = 1; i <= 8; i++) { await p.touchscreen.touchMove(cx - 80 + i * 20, cy + i * 4); await vila(16); }
        await p.touchscreen.touchEnd();
      } else {
        await p.mouse.move(cx - 120, cy);
        await p.mouse.down();
        for (let i = 1; i <= 8; i++) { await p.mouse.move(cx - 120 + i * 30, cy + i * 6); await vila(16); }
        await p.mouse.up();
      }
      await vila(120);
      await p.screenshot({ path: UT + `v3d-${namn}-drag1.png` });
      await vila(1500);
      await p.screenshot({ path: UT + `v3d-${namn}-drag2.png` });
      // Esc stänger och river scenen
      await p.keyboard.press('Escape');
      await vila(300);
      const kvar = await p.evaluate(() => ({ canvas: !!document.querySelector('.v3d canvas'), dold: document.querySelector('.v3d').hidden, scroll: getComputedStyle(document.body).overflow }));
      if (kvar.canvas || !kvar.dold || kvar.scroll === 'hidden') fel.push('visare: stängning lämnade kvar ' + JSON.stringify(kvar));
      // förstoringsknappen öppnar lightboxen
      await p.click('[data-forstora]');
      await vila(600);
      await p.screenshot({ path: UT + `lightbox-${namn}.png` });
      await p.keyboard.press('Escape');
      // lägg i varukorg
      await p.click('[data-lagg-i-korg]');
      await vila(400);
      await p.goto(BAS + 'kassa.html', { waitUntil: 'load' });
      await vila(600);
      await p.screenshot({ path: UT + `kassa-${namn}.png`, fullPage: true });
      const rader = await p.evaluate(() => document.querySelectorAll('.korgrad').length);
      if (!rader) fel.push('kassa: inga varukorgsrader (' + namn + ')');
      await p.close();
    }
  }

  if (kor('sidor')) {
    const p = await sida(DESK);
    for (const s of ['index.html', 'produkten.html', 'om.html', 'teamet.html', 'kontakt.html', 'kassa.html',
                     'kopvillkor.html', 'angerratt.html', 'integritetspolicy.html', 'finns-inte.html']) {
      await p.goto(BAS + s, { waitUntil: 'load' });
      await vila(900);
      const ok = await p.evaluate(() => ({ h1: (document.querySelector('h1') || {}).textContent, bredd: document.documentElement.scrollWidth, fonster: innerWidth }));
      if (ok.bredd > ok.fonster) fel.push(`${s}: horisontell scroll (${ok.bredd} > ${ok.fonster})`);
      console.log(s, '→', (ok.h1 || '').trim().slice(0, 40));
    }
    const m = await sida(MOB);
    for (const s of ['index.html', 'produkten.html', 'kassa.html', 'om.html']) {
      await m.goto(BAS + s, { waitUntil: 'load' });
      await vila(1500);
      const ok = await m.evaluate(() => ({ bredd: document.documentElement.scrollWidth, fonster: innerWidth }));
      if (ok.bredd > ok.fonster) fel.push(`mobil ${s}: horisontell scroll (${ok.bredd} > ${ok.fonster})`);
    }
    await m.screenshot({ path: UT + 'om-mob.png' });
  }

  console.log(fel.length ? 'FEL:\n' + fel.join('\n') : 'Inga fel.');
  await webblasare.close();
})();
