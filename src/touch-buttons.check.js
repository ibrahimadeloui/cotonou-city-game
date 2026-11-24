import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

const PORT = 5211;
const URL = `http://127.0.0.1:${PORT}`;
const CHROME = process.env.CHROME_PATH || '/usr/local/bin/google-chrome';

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function startServer() {
  const child = spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
    { cwd: path.resolve(ROOT, '..'), stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let logs = '';
  child.stdout.on('data', (chunk) => { logs += chunk; });
  child.stderr.on('data', (chunk) => { logs += chunk; });
  return { child, ready: waitForReady(child, () => logs) };
}

function waitForReady(child, readLogs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Vite n'a pas démarré.\n${readLogs()}`)), 20000);
    const poll = setInterval(() => {
      fetch(URL).then((res) => {
        if (res.ok) {
          clearTimeout(timer);
          clearInterval(poll);
          resolve();
        }
      }).catch(() => {});
    }, 200);
    child.once('exit', (code) => {
      clearTimeout(timer);
      clearInterval(poll);
      reject(new Error(`Vite s'est arrêté (${code}).\n${readLogs()}`));
    });
  });
}

async function tap(page, selector) {
  const locator = page.locator(selector);
  await locator.waitFor({ state: 'visible', timeout: 8000 });
  const box = await locator.boundingBox();
  assert(box && box.width > 8 && box.height > 8, `${selector} n'a pas de zone tactile`);
  await locator.tap();
}

async function actions(page) {
  return page.evaluate(() => window.__cotonou.actions);
}

async function exercise(page, label) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.getElementById('loader')?.classList.contains('hidden'), { timeout: 20000 });

  await tap(page, '#play');
  await page.waitForFunction(() => window.__cotonou.started, { timeout: 5000 });
  assert((await actions(page)).includes('play'), `${label}: Entrer dans la ville`);

  await page.waitForFunction(() => !document.getElementById('brief').classList.contains('hidden'));
  await tap(page, '#brief-go');
  await page.waitForFunction(() => document.getElementById('brief').classList.contains('hidden'));
  await page.waitForFunction(() => !/disponible/i.test(document.getElementById('mission-kicker').textContent));
  assert((await actions(page)).includes('brief'), `${label}: C'est parti`);
  await page.waitForFunction(() => window.__cotonou.chevrons() > 2, { timeout: 4000 });
  const dot = await page.evaluate(() => window.__cotonou.chevronDot());
  assert(dot > 0, `${label}: les chevrons pointent à l'envers (${dot})`);

  const dismiss = page.locator('#install-dismiss');
  if (await dismiss.isVisible()) await dismiss.tap();
  const install = page.locator('#install-go');
  if (await install.isVisible()) await install.tap();

  const beforePunch = await page.evaluate(() => window.__cotonou.punches);
  await tap(page, '#btn-punch');
  await page.waitForFunction((n) => window.__cotonou.punches > n, beforePunch);
  assert((await actions(page)).includes('punch'), `${label}: Frapper`);

  const beforeDodge = await page.evaluate(() => window.__cotonou.dodges);
  await tap(page, '#btn-dodge');
  await page.waitForFunction((n) => window.__cotonou.dodges > n, beforeDodge);
  assert((await actions(page)).includes('dodge'), `${label}: Esquive`);

  const run = await page.locator('#btn-run').boundingBox();
  const client = await page.context().newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: run.x + run.width / 2, y: run.y + run.height / 2, id: 1 }],
  });
  await page.waitForTimeout(120);
  assert(await page.evaluate(() => window.__cotonou.runHeld), `${label}: Courir reste enfoncé`);
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForFunction(() => window.__cotonou.actions.includes('jump'));

  await tap(page, '#avatar');
  await page.waitForFunction(() => window.__cotonou.actions.includes('selfie'));

  await tap(page, '#btn-horn');
  await page.waitForFunction(() => window.__cotonou.actions.includes('horn'));

  await tap(page, '#btn-vehicle');
  await page.waitForFunction(() => window.__cotonou.vehicle, { timeout: 4000 });
  assert((await actions(page)).includes('enter'), `${label}: Monter`);
  assert(await page.locator('#btn-gas').isVisible(), `${label}: pédale en voiture`);
  await tap(page, '#btn-exit');
  await page.waitForFunction(() => !window.__cotonou.vehicle);
  assert((await actions(page)).includes('exit'), `${label}: Sortir`);

  const foe = await page.evaluate(() => window.__cotonou.focusNearest());
  assert(foe != null, `${label}: aucun passant à frapper`);
  await page.waitForTimeout(300);
  await tap(page, '#btn-punch');
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => window.__cotonou.focusState());
  assert(after && after.hp < foe, `${label}: la vie du passant ne baisse pas (${foe} → ${JSON.stringify(after)})`);
  await page.evaluate(() => window.__cotonou.setStars(0));

  const origin = await page.evaluate(() => ({ x: window.__cotonou.x, punches: window.__cotonou.punches }));
  const joy = await page.locator('#joystick').boundingBox();
  const punch = await page.locator('#btn-punch').boundingBox();
  const jx = joy.x + joy.width / 2;
  const jy = joy.y + joy.height / 2;
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: jx, y: jy, id: 1 }],
  });
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: jx, y: jy - 70, id: 1 }],
  });
  await page.waitForTimeout(180);
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: jx, y: jy - 70, id: 1 },
      { x: punch.x + punch.width / 2, y: punch.y + punch.height / 2, id: 2 },
    ],
  });
  await page.waitForTimeout(700);
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const moved = await page.evaluate(() => ({ x: window.__cotonou.x, punches: window.__cotonou.punches }));
  assert(moved.punches > origin.punches, `${label}: Frapper pendant le joystick`);
  assert(Math.abs(moved.x - origin.x) > 0.2, `${label}: le joystick ne déplace pas en multi-touch`);

  await tap(page, '#btn-pause');
  await page.waitForFunction(() => !document.getElementById('pause').classList.contains('hidden'));
  const outfit = await page.locator('#btn-outfit').innerText();
  await tap(page, '#btn-outfit');
  await page.waitForFunction((previous) => document.getElementById('btn-outfit').textContent !== previous, outfit);
  const density = await page.locator('#btn-density').innerText();
  await tap(page, '#btn-density');
  await page.waitForFunction((previous) => document.getElementById('btn-density').textContent !== previous, density);
  await page.locator('#brightness').evaluate((el) => {
    el.value = '1.6';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForFunction(() => Math.abs(window.__cotonou.exposure - 1.6) < 0.02);
  const stored = await page.evaluate(() => localStorage.getItem('cotonou-brightness'));
  assert(Math.abs(Number(stored) - 1.6) < 0.02, `${label}: luminosité non sauvée`);
  const steerLabel = await page.locator('#btn-steer-mode').innerText();
  await tap(page, '#btn-steer-mode');
  await page.waitForFunction((previous) => document.getElementById('btn-steer-mode').textContent !== previous, steerLabel);
  await tap(page, '#resume');
  await page.waitForFunction(() => document.getElementById('pause').classList.contains('hidden'));
  assert((await actions(page)).includes('resume'), `${label}: Reprendre`);

  await assertFluid(page, label);
  await driveLayout(page, label, 'suv');
  await driveLayout(page, label, 'zem');
}

async function assertFluid(page, label) {
  await page.evaluate(() => window.__cotonou.resetYawStep());
  const origin = await page.evaluate(() => window.__cotonou.knob());
  const joy = await page.locator('#joystick').boundingBox();
  assert(joy, `${label}: joystick invisible`);
  const client = await page.context().newCDPSession(page);
  const cx = joy.x + joy.width / 2;
  const cy = joy.y + joy.height / 2;
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: cx, y: cy, id: 7 }],
  });
  let prev = await page.evaluate(() => window.__cotonou.knob());
  let maxJump = 0;
  for (let i = 1; i <= 6; i += 1) {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: cx + i * 6, y: cy, id: 7 }],
    });
    await page.waitForTimeout(45);
    const knob = await page.evaluate(() => window.__cotonou.knob());
    maxJump = Math.max(maxJump, Math.hypot(knob.x - prev.x, knob.y - prev.y));
    assert(Math.abs(knob.left - origin.left) < 1.5 && Math.abs(knob.top - origin.top) < 1.5, `${label}: le joystick se recentre en glissant`);
    prev = knob;
  }
  await page.waitForTimeout(320);
  const step = await page.evaluate(() => window.__cotonou.maxYawStep);
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert(maxJump < 22, `${label}: le bouton du joystick saute (${maxJump.toFixed(1)} px)`);
  assert(step < 0.36, `${label}: la rotation dépasse le plafond (${step.toFixed(3)} rad/frame)`);
}

async function driveLayout(page, label, type) {
  const entered = await page.evaluate((kind) => window.__cotonou.enterType(kind), type);
  assert(entered, `${label}: monter ${type}`);
  await page.waitForFunction(() => document.body.dataset.drive === '1');
  assert(await page.locator('#btn-punch').isHidden(), `${label}: Frapper reste visible en ${type}`);
  assert(await page.locator('#btn-gas').isVisible(), `${label}: accélérateur ${type}`);
  assert(await page.locator('#btn-brake').isVisible(), `${label}: frein ${type}`);
  assert(await page.locator('#btn-exit').isVisible(), `${label}: sortir ${type}`);
  await page.evaluate((mode) => window.__cotonou.setSteer(mode), type === 'zem' ? 'buttons' : 'stick');
  await page.waitForFunction((mode) => document.body.dataset.steer === mode, type === 'zem' ? 'buttons' : 'stick');
  const gas = await page.locator('#btn-gas').boundingBox();
  const steer = await page.locator(type === 'zem' ? '#btn-steer-right' : '#joystick').boundingBox();
  assert(gas && steer, `${label}: pédale ou direction ${type}`);
  const client = await page.context().newCDPSession(page);
  const steerX = type === 'zem' ? steer.x + steer.width / 2 : steer.x + steer.width / 2 + 50;
  const steerY = steer.y + steer.height / 2;
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: gas.x + gas.width / 2, y: gas.y + gas.height / 2, id: 1 },
      { x: steerX, y: steerY, id: 2 },
    ],
  });
  await page.waitForTimeout(650);
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const speed = await page.evaluate(() => window.__cotonou.speedKmh());
  assert(speed > 6, `${label}: ${type} n'accélère pas (${speed.toFixed(1)} km/h)`);
  await page.locator('#btn-exit').tap();
  await page.waitForFunction(() => document.body.dataset.drive !== '1');
  assert(await page.locator('#btn-punch').isVisible(), `${label}: Frapper ne revient pas`);
}

const server = startServer();
let browser;
try {
  await server.ready;
  browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  for (const name of ['iPhone 14', 'Pixel 7']) {
    const device = devices[name];
    assert(device, `appareil Playwright introuvable : ${name}`);
    const context = await browser.newContext({ ...device, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await exercise(page, name);
    assert(errors.length === 0, `${name} erreurs page : ${errors.join(' | ')}`);
    await context.close();
    console.log('boutons ok', name);
  }
} finally {
  await browser?.close();
  server.child.kill('SIGTERM');
}

console.log('touch buttons ok');
