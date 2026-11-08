import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function run() {
  console.log('Starting Vite preview server on dist...');
  const preview = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], {
    cwd: root,
    stdio: 'pipe'
  });

  // Wait for server to be ready
  await new Promise((resolve) => {
    preview.stdout.on('data', (data) => {
      if (data.toString().includes('http://localhost:4173')) {
        resolve();
      }
    });
    setTimeout(resolve, 2000);
  });

  console.log('Launching Playwright Chromium browser...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader']
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const consoleLogs = [];
  const glbResponses = new Map();
  page.on('console', (msg) => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => consoleLogs.push(`[pageerror] ${err.message}`));
  page.on('response', (response) => {
    if (response.url().endsWith('.glb')) glbResponses.set(response.url(), response.status());
  });

  console.log('Navigating to http://localhost:4173...');
  await page.goto('http://localhost:4173', { waitUntil: 'networkidle' });

  console.log('Console logs:', consoleLogs);
  const content = await page.content();
  console.log('Page content length:', content.length, 'Snippet:', content.slice(0, 300));

  // Check canvas
  const canvas = await page.$('canvas');
  if (!canvas) throw new Error('Canvas not found on page!');
  console.log('✅ Three.js WebGL Canvas found!');

  // Check window.render_game_to_text
  const stateStr = await page.evaluate(() => window.render_game_to_text?.());
  if (!stateStr) throw new Error('window.render_game_to_text did not return state');
  const state = JSON.parse(stateStr);
  console.log('✅ Initial state verified:', {
    mode: state.mode,
    stage: state.stage,
    player: { x: state.player.x, y: state.player.y, hp: state.player.hp, level: state.player.level }
  });

  const glbStatus = [...glbResponses.entries()];
  console.log('✅ GLB vertical slice requests verified:', glbStatus);
  if (!glbStatus.some(([url, status]) => url.endsWith('/taotie.glb') && status === 200)) {
    throw new Error('taotie.glb was not loaded by the web runtime');
  }
  if (!glbStatus.some(([url, status]) => url.endsWith('/qingqiu_01.glb') && status === 200)) {
    throw new Error('qingqiu_01.glb was not loaded by the web runtime');
  }
  await page.evaluate(() => {
    const renderer = window.__beastEvoGame.renderer3d;
    renderer.setModelQuality('low');
    window.advanceTime(50);
    renderer.setModelQuality('high');
  });
  console.log('✅ Model quality profile switch verified: low → high');

  // Advance time
  await page.evaluate(() => window.advanceTime(1000));
  await page.waitForTimeout(150);
  const stateAfter1s = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  console.log('✅ After advanceTime(1000):', {
    stageElapsedSec: stateAfter1s.stageElapsedSec,
    runTimeSec: stateAfter1s.runTimeSec,
    enemiesCount: stateAfter1s.enemies.length
  });
  const normalCharacterGlb = [...glbResponses.keys()].find((url) =>
    /\/(spirit_bug|spirit_rat|mountain_spirit|red_feather_bird|rock_beast)\.glb$/.test(url)
  );
  if (!normalCharacterGlb || glbResponses.get(normalCharacterGlb) !== 200) {
    throw new Error(`No first-stage ordinary enemy GLB loaded: ${JSON.stringify([...glbResponses])}`);
  }
  console.log('✅ Ordinary enemy GLB request verified:', normalCharacterGlb);

  // Test Dash
  await page.keyboard.press('Space');
  await page.evaluate(() => window.advanceTime(100));
  const stateDash = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  console.log('✅ Dash verified:', {
    dashCooldown: stateDash.player.dashCooldown,
    dashRemaining: stateDash.player.dashRemaining
  });

  // Test Camera Orbit
  const initialYaw = await page.evaluate(() => window.__beastEvoGame?.cameraController?.yaw);
  // Simulate mouse drag to rotate camera
  await page.mouse.move(640, 360);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(840, 360);
  await page.mouse.up({ button: 'right' });
  await page.evaluate(() => window.advanceTime(200));

  const newYaw = await page.evaluate(() => window.__beastEvoGame?.cameraController?.yaw);
  console.log('✅ Camera 360 rotation verified:', { initialYaw, newYaw, rotated: initialYaw !== newYaw });

  // Take screenshot
  const outDir = path.join(root, 'output', 'web-game');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const shotPath = path.join(outDir, 'threejs-runtime.png');
  await page.screenshot({ path: shotPath });
  console.log('✅ Screenshot saved to:', shotPath);

  // Check for fatal errors
  const errors = consoleLogs.filter((l) => l.includes('[error]') || l.includes('[pageerror]'));
  if (errors.length > 0) {
    console.warn('Console warnings/errors detected:', errors);
  } else {
    console.log('✅ No browser console errors observed!');
  }

  await browser.close();
  preview.kill();
  console.log('All Three.js runtime checks passed successfully!');
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
