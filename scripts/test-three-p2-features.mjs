import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function testP2Features() {
  console.log('Testing P2 features (Talents, Bestiary, Particle FX) via Playwright...');
  const preview = spawn('npx', ['vite', 'preview', '--port', '4175', '--strictPort'], {
    cwd: root,
    stdio: 'pipe'
  });

  await new Promise((resolve) => setTimeout(resolve, 2000));

  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader']
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const consoleLogs = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error('Browser error:', msg.text());
    else consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });

  await page.goto('http://localhost:4175', { waitUntil: 'networkidle' });

  // 1. Verify Meta Initial State
  console.log('1. Verifying Meta Initial Profile...');
  let state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  console.log('Initial Meta Profile:', state.metaProfile);
  if (!state.metaProfile || !state.metaProfile.talents) {
    throw new Error('Meta profile is not exposed or initialized!');
  }

  // 2. Grant some primal souls for testing talents
  console.log('2. Granting Primal Souls & Testing Talents Modal...');
  await page.evaluate(() => {
    if (window.__beastEvoMeta) {
      window.__beastEvoMeta.addPrimalSouls(500);
    }
  });

  // Open Talents Modal via HUD button
  const talentsBtn = await page.$('#btn-talents');
  if (talentsBtn) {
    await talentsBtn.click();
    console.log('Clicked Talents button in HUD');
  } else {
    await page.evaluate(() => window.__beastEvoGame.openTalents());
  }

  await page.waitForSelector('.talents-card', { state: 'visible', timeout: 3000 });
  console.log('✅ Talents Modal opened successfully');

  // Verify talent rows and upgrade button
  const talentRows = await page.$$('.talent-row');
  console.log(`Found ${talentRows.length} talent rows in modal`);
  if (talentRows.length !== 5) {
    throw new Error(`Expected 5 talent rows, got ${talentRows.length}`);
  }

  const upgradeBtn = await page.$('.talent-row button.upgrade-btn[data-key="vitality"]');
  if (upgradeBtn) {
    await upgradeBtn.click();
    console.log('Clicked upgrade button for Vitality');
  }

  const outDir = path.join(root, 'output', 'web-game');
  await page.screenshot({ path: path.join(outDir, 'talents-modal.png') });
  console.log('✅ Saved Talents Modal screenshot to output/web-game/talents-modal.png');

  // Test Respec Talents button
  const resetBtn = await page.$('#btn-reset-talents');
  if (resetBtn) {
    await resetBtn.click();
    console.log('Clicked Respec Talents button');
  }

  // Close Talents Modal
  const closeTalentsBtn = await page.$('#btn-close-talents');
  if (closeTalentsBtn) await closeTalentsBtn.click();

  // 3. Testing Bestiary Modal
  console.log('3. Testing Bestiary Modal & 3D Turntable Viewer...');
  // Unlock bestiary creatures in live meta instance
  await page.evaluate(() => {
    if (window.__beastEvoMeta) {
      window.__beastEvoMeta.unlockCreature('nine_tail_shadow');
      window.__beastEvoMeta.unlockCreature('mountain_spirit');
      window.__beastEvoMeta.unlockCreature('qiongqi');
    }
  });

  const bestiaryBtn = await page.$('#btn-bestiary');
  if (bestiaryBtn) {
    await bestiaryBtn.click();
    console.log('Clicked Bestiary button in HUD');
  } else {
    await page.evaluate(() => window.__beastEvoGame.openBestiary());
  }

  await page.waitForSelector('.bestiary-card', { state: 'visible', timeout: 3000 });
  console.log('✅ Bestiary Modal opened successfully');

  // Check bestiary items list
  const bestiaryItems = await page.$$('.bestiary-list-item');
  console.log(`Found ${bestiaryItems.length} bestiary items`);
  if (bestiaryItems.length !== 8) {
    throw new Error(`Expected 8 bestiary entries, got ${bestiaryItems.length}`);
  }

  // Click on Nine-Tail entry
  const nineTailItem = await page.$('.bestiary-list-item[data-id="nine_tail_shadow"]');
  if (nineTailItem) {
    await nineTailItem.click();
    console.log('Selected Nine-Tail Shadow in Bestiary');
  }

  // Verify the generated character reference board is present and decoded
  await page.waitForSelector('.bestiary-preview-viewport img.generated-character-image', { state: 'visible', timeout: 3000 });
  await page.waitForFunction(() => {
    const image = document.querySelector('.bestiary-preview-viewport img.generated-character-image');
    return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 1;
  }, undefined, { timeout: 5000 });
  const bestiaryImage = await page.$('.bestiary-preview-viewport img.generated-character-image');
  const bestiaryImageInfo = await page.$eval('.bestiary-preview-viewport img.generated-character-image', (image) => ({
    src: image.getAttribute('src'),
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight
  }));
  console.log('✅ Generated Bestiary character board verified:', { present: !!bestiaryImage, ...bestiaryImageInfo });
  if (!bestiaryImage || !bestiaryImageInfo.src?.includes('/assets/generated/characters/nine_tail_shadow.png') || bestiaryImageInfo.naturalWidth <= 1) {
    throw new Error('Generated Bestiary character board did not load');
  }

  await page.screenshot({ path: path.join(outDir, 'bestiary-modal.png') });
  console.log('✅ Saved Bestiary Modal screenshot to output/web-game/bestiary-modal.png');

  // Close Bestiary Modal
  const closeBestiaryBtn = await page.$('#btn-close-bestiary');
  if (closeBestiaryBtn) await closeBestiaryBtn.click();

  // 4. Test Particle Effects
  console.log('4. Testing Particle Effects triggers...');
  await page.evaluate(() => {
    const game = window.__beastEvoGame;
    game.renderer3d.triggerLevelUpFx(180, 320);
    game.renderer3d.triggerSoulCollectFx(180, 320);
    game.renderer3d.triggerDashDustFx(180, 320, { x: 1, y: 0 });
    window.advanceTime(200);
  });
  console.log('✅ Particle FX triggers completed without errors');

  console.log('🎉 All P2 Features (Talents, Bestiary, Particle FX) verified successfully!');

  await browser.close();
  preview.kill();
}

testP2Features().catch((err) => {
  console.error('P2 Features test failed:', err);
  process.exit(1);
});
