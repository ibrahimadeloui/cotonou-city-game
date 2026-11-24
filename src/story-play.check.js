import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = 5213;
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
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Vite n'a pas démarré.\n${logs}`)), 20000);
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
      reject(new Error(`Vite s'est arrêté (${code}).\n${logs}`));
    });
  });
  return { child, ready };
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
  const context = await browser.newContext({ ...devices['iPhone 14'], hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => document.getElementById('loader')?.classList.contains('hidden'), { timeout: 20000 });
  await page.evaluate(() => { window.__cotonouFast = true; });
  await page.locator('#play').tap();
  for (let mission = 1; mission <= 8; mission += 1) {
    await page.waitForFunction(() => !document.getElementById('brief').classList.contains('hidden'));
    await page.locator('#brief-go').tap();
    await page.waitForFunction(() => document.getElementById('brief').classList.contains('hidden'));
    const kind = await page.evaluate(() => window.__cotonou.missionKind());
    const vehicle = await page.evaluate(() => window.__cotonou.missionVehicle());
    if (vehicle) {
      const entered = await page.evaluate((type) => window.__cotonou.enterType(type), vehicle);
      assert(entered, `mission ${mission}: pas de ${vehicle}`);
    }
    let done = false;
    for (let step = 0; step < 4 && !done; step += 1) {
      await page.evaluate(() => window.__cotonou.gotoGoal());
      if (kind === 'fight') {
        await page.waitForTimeout(350);
        await page.evaluate(() => window.__cotonou.knockBoss());
      }
      try {
        await page.waitForFunction(
          () => !document.getElementById('result').classList.contains('hidden'),
          { timeout: kind === 'protect' ? 2500 : 1200 },
        );
        done = true;
      } catch {
        done = false;
      }
    }
    assert(done, `mission ${mission} (${kind}) ne se termine pas`);
    const title = await page.locator('#result-title').innerText();
    assert(/réussie/i.test(title), `mission ${mission}: ${title}`);
    await page.locator('#result-ok').tap();
    console.log('mission ok', mission, kind);
  }
  await page.waitForTimeout(400);
  assert(errors.length === 0, errors.join(' | '));
  console.log('story play ok');
} finally {
  await browser?.close();
  server.child.kill('SIGTERM');
}
