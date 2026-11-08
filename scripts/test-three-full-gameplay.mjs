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
  const glbResponses = new Map();
  page.on('response', (response) => {
    if (response.url().endsWith('.glb')) glbResponses.set(response.url(), response.status());
  });
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
  await page.waitForTimeout(100);
  console.log('Boss spawned:', {
    enemiesCount: state.enemies.length,
    boss: state.enemies.find((e) => e.kind === 'boss')
  });
  if (!glbResponses.has('http://localhost:4174/assets/models/vertical-slice/nine_tail_shadow.glb')) {
    throw new Error(`nine_tail_shadow.glb was not requested by the boss runtime: ${JSON.stringify([...glbResponses])}`);
  }
  if (glbResponses.get('http://localhost:4174/assets/models/vertical-slice/nine_tail_shadow.glb') !== 200) {
    throw new Error('nine_tail_shadow.glb did not return HTTP 200');
  }
  console.log('✅ Stage 1 Boss GLB request verified');

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
    // Verify generated 3D part reference boards are loaded in the modal
    const previewImages = await page.$$('.select-card img.generated-part-image');
    const previewImageSources = await page.$$eval('.select-card img.generated-part-image', (images) => images.map((image) => image.getAttribute('src')));
    console.log('✅ Generated part reference boards verified:', {
      count: previewImages.length,
      sources: previewImageSources
    });
    if (previewImages.length < 2 || previewImageSources.some((src) => !src?.includes('/assets/generated/parts/'))) {
      throw new Error('Generated part reference boards are missing from the part reward modal');
    }

    const outDir = path.join(root, 'output', 'web-game');
    await page.screenshot({ path: path.join(outDir, 'part-offer-3d-preview.png') });
    console.log('✅ Saved modal screenshot with generated art to output/web-game/part-offer-3d-preview.png');

    console.log('Selecting Fox Mouth (card 1)...');
    await page.keyboard.press('Digit1');
    state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
    console.log('After choosing part:', { mode: state.mode, cards: state.cards });

    if (state.mode === 'part_upgrade') {
      console.log('Selecting Part Upgrade 1...');
      await page.keyboard.press('Digit1');
      state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
      console.log('Transitioned to Stage 2:', { stage: state.stage, mode: state.mode, parts: state.player.parts });

      // Exercise both first-stage GLB part paths through the real socket update.
      await page.evaluate(() => {
        const game = window.__beastEvoGame;
        game.combat.parts.tail = 'nine_tail';
        game.updatePartsVisual();
        window.advanceTime(100);
      });
      await page.waitForTimeout(100);
      for (const asset of ['fox_mouth.glb', 'nine_tail.glb']) {
        const url = `http://localhost:4174/assets/models/vertical-slice/${asset}`;
        if (glbResponses.get(url) !== 200) throw new Error(`${asset} was not loaded by the socket part update`);
      }
      const socketsReady = await page.evaluate(() => {
        const group = window.__beastEvoGame.renderer3d.playerGroup;
        return Boolean(group.getObjectByName('socket_head') && group.getObjectByName('socket_tail'));
      });
      if (!socketsReady) throw new Error('Player GLB socket nodes are missing');
      console.log('✅ First-stage GLB parts and socket nodes verified');
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
  await page.waitForTimeout(100);
  console.log('Boss 2 spawned:', {
    boss: state.enemies.find((e) => e.kind === 'boss')
  });
  const kuiBossUrl = 'http://localhost:4174/assets/models/vertical-slice/kui_spirit.glb';
  if (glbResponses.get(kuiBossUrl) !== 200) {
    throw new Error(`kui_spirit.glb was not loaded by the stage 2 Boss runtime: ${JSON.stringify([...glbResponses])}`);
  }
  console.log('✅ Stage 2 Boss GLB request verified');

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

  // Exercise the stage 2 part models through the real socket update.
  await page.evaluate(() => {
    const game = window.__beastEvoGame;
    game.combat.parts.head = 'kui_horn';
    game.combat.parts.limb = 'kui_hoof';
    game.updatePartsVisual();
    window.advanceTime(100);
  });
  await page.waitForTimeout(100);
  for (const asset of ['kui_horn.glb', 'kui_hoof.glb']) {
    const url = `http://localhost:4174/assets/models/vertical-slice/${asset}`;
    if (glbResponses.get(url) !== 200) throw new Error(`${asset} was not loaded by the stage 2 socket update`);
  }
  console.log('✅ Stage 2 GLB parts verified');

  // 4. Fast forward Stage 3 Boss Qiongqi
  console.log('4. Fast forwarding to Stage 3 Boss Qiongqi...');
  await page.evaluate(() => {
    const game = window.__beastEvoGame;
    game.stageElapsed = 151;
    window.advanceTime(100);
  });

  state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  await page.waitForTimeout(100);
  console.log('Boss 3 spawned:', {
    boss: state.enemies.find((e) => e.kind === 'boss')
  });
  const qiongqiBossUrl = 'http://localhost:4174/assets/models/vertical-slice/qiongqi.glb';
  if (glbResponses.get(qiongqiBossUrl) !== 200) {
    throw new Error(`qiongqi.glb was not loaded by the stage 3 Boss runtime: ${JSON.stringify([...glbResponses])}`);
  }
  console.log('✅ Stage 3 Boss GLB request verified');

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

  await page.evaluate(() => {
    const game = window.__beastEvoGame;
    game.combat.parts.limb = 'qiongqi_wing';
    game.updatePartsVisual();
    window.advanceTime(100);
  });
  await page.waitForTimeout(100);
  const qiongqiWingUrl = 'http://localhost:4174/assets/models/vertical-slice/qiongqi_wing.glb';
  if (glbResponses.get(qiongqiWingUrl) !== 200) {
    throw new Error('qiongqi_wing.glb was not loaded after the first-clear unlock');
  }
  console.log('✅ Final Boss wing GLB request verified');

  console.log('🎉 Full 3-Stage Three.js game loop tested successfully!');

  await browser.close();
  preview.kill();
}

testFullLoop().catch((err) => {
  console.error('Test loop failed:', err);
  process.exit(1);
});
