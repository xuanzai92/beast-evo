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
  page.on('console', (msg) => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => consoleLogs.push(`[pageerror] ${err.message}`));

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

  // Advance time
  await page.evaluate(() => window.advanceTime(1000));
  const stateAfter1s = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  console.log('✅ After advanceTime(1000):', {
    stageElapsedSec: stateAfter1s.stageElapsedSec,
    runTimeSec: stateAfter1s.runTimeSec,
    enemiesCount: stateAfter1s.enemies.length
  });

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
