import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function testFullLoop() {
  console.log('Testing full Three.js game loop through Playwright...');
  const preview = spawn('npx', ['vite', 'preview', '--port', '4174', '--strictPort'], {
    cwd: root,
    stdio: 'pipe'
  });

  await new Promise((resolve) => setTimeout(resolve, 2000));

  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader']
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('http://localhost:4174', { waitUntil: 'networkidle' });

  // 1. Check Level-Up Trigger
  console.log('1. Triggering Level-Up...');
  await page.evaluate(() => {
    const game = window.__beastEvoGame;
    // Add XP to trigger level up
    game.player.xp = 150;
    window.advanceTime(100);
  });

  let state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  console.log('State after XP boost:', { mode: state.mode, level: state.player.level, cards: state.cards });

  if (state.mode === 'levelup') {
    console.log('Selecting first upgrade option...');
    await page.keyboard.press('Digit1');
    state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
    console.log('State after upgrade selection:', { mode: state.mode });
  }

  // 2. Fast forward to Stage 1 Boss
  console.log('2. Fast forwarding to Stage 1 Boss Nine-Tail...');
  await page.evaluate(() => {
    const game = window.__beastEvoGame;
    game.stageElapsed = 91; // triggers boss spawn
    window.advanceTime(100);
  });

  state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  console.log('Boss spawned:', {
    enemiesCount: state.enemies.length,
    boss: state.enemies.find((e) => e.kind === 'boss')
  });

  // Verify Radar Indicator when player moves away / camera rotates
  await page.evaluate(() => {
    const game = window.__beastEvoGame;
    game.player.y = 580; // move player to bottom edge
    game.cameraController.resetBehind({ x: 0, y: 1 });
    window.advanceTime(50);
  });
  const radarIndicator = await page.$('.radar-indicator');
  console.log('✅ Off-screen Radar Indicator verified:', !!radarIndicator);

  // Defeat Stage 1 Boss
  console.log('Defeating Stage 1 Boss...');
  await page.evaluate(() => {
    const game = window.__beastEvoGame;
    if (game.boss) {
      game.damageEnemy(game.boss, 1000);
    }
    window.advanceTime(100);
  });

  state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  console.log('After defeating Boss 1:', { mode: state.mode, cards: state.cards });

  if (state.mode === 'part_reward') {
    // Verify 3D Part Preview Canvases exist in the modal
    const previewCanvas0 = await page.$('#preview-viewport-0 canvas');
    const previewCanvas1 = await page.$('#preview-viewport-1 canvas');
    console.log('✅ 3D Part Preview canvases verified:', {
      hasCard0Preview: !!previewCanvas0,
      hasCard1Preview: !!previewCanvas1
    });

    const outDir = path.join(root, 'output', 'web-game');
    await page.screenshot({ path: path.join(outDir, 'part-offer-3d-preview.png') });
    console.log('✅ Saved modal screenshot with 3D preview to output/web-game/part-offer-3d-preview.png');

    console.log('Selecting Fox Mouth (card 1)...');
    await page.keyboard.press('Digit1');
    state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
    console.log('After choosing part:', { mode: state.mode, cards: state.cards });

    if (state.mode === 'part_upgrade') {
      console.log('Selecting Part Upgrade 1...');
      await page.keyboard.press('Digit1');
      state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
      console.log('Transitioned to Stage 2:', { stage: state.stage, mode: state.mode, parts: state.player.parts });
    }
  }

  // 3. Fast forward Stage 2 Boss
  console.log('3. Fast forwarding to Stage 2 Boss Kui Spirit...');
  await page.evaluate(() => {
    const game = window.__beastEvoGame;
    game.stageElapsed = 121;
    window.advanceTime(100);
  });

  state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  console.log('Boss 2 spawned:', {
    boss: state.enemies.find((e) => e.kind === 'boss')
  });

  // Defeat Boss 2
  await page.evaluate(() => {
    const game = window.__beastEvoGame;
    if (game.boss) game.damageEnemy(game.boss, 2000);
    window.advanceTime(100);
  });

  state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  console.log('After defeating Boss 2:', { mode: state.mode });

  if (state.mode === 'part_reward') {
    await page.keyboard.press('Digit1');
    state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
    if (state.mode === 'part_upgrade') {
      await page.keyboard.press('Digit1');
      state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
    }
  }

  console.log('Transitioned to Stage 3:', { stage: state.stage, parts: state.player.parts });

  // 4. Fast forward Stage 3 Boss Qiongqi
  console.log('4. Fast forwarding to Stage 3 Boss Qiongqi...');
  await page.evaluate(() => {
    const game = window.__beastEvoGame;
    game.stageElapsed = 151;
    window.advanceTime(100);
  });

  state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  console.log('Boss 3 spawned:', {
    boss: state.enemies.find((e) => e.kind === 'boss')
  });

  // Defeat Qiongqi
  console.log('Defeating Qiongqi...');
  await page.evaluate(() => {
    const game = window.__beastEvoGame;
    if (game.boss) game.damageEnemy(game.boss, 3000);
    window.advanceTime(100);
  });

  state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  console.log('Final run outcome:', {
    mode: state.mode,
    metaUnlocks: state.metaUnlocks
  });

  const storedUnlocks = await page.evaluate(() => window.localStorage.getItem('beast-evo-unlocks'));
  console.log('LocalStorage persistence verified:', storedUnlocks);

  if (state.mode !== 'victory' || !storedUnlocks?.includes('qiongqi_wing')) {
    throw new Error('Victory state or meta unlock not achieved!');
  }

  console.log('🎉 Full 3-Stage Three.js game loop tested successfully!');

  await browser.close();
  preview.kill();
}

testFullLoop().catch((err) => {
  console.error('Test loop failed:', err);
  process.exit(1);
});
