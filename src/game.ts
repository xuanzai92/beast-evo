import * as THREE from 'three';
import {
  balance,
  creatures,
  growth,
  parts,
  skills as skillsData,
  stages,
  waves,
  skillMap,
  creatureMap,
  partMap,
  waveMap,
  localize,
  getLanguage,
  setLanguage,
  t
} from './data';
import type {
  Mode,
  BranchId,
  SkillId,
  PartId,
  Vec2,
  PlayerState,
  Enemy,
  SoulDrop,
  DangerZone,
  Projectile,
  SkillState,
  UpgradeOption,
  PartOffer,
  PartUpgradeOption
} from './types';
import { CameraController } from './camera';
import { Renderer3D, simToWorld } from './renderer3d';
import { CombatManager } from './combat';
import { UIController } from './ui';
import { audio } from './audio';
import { meta } from './meta';

export const WIDTH = 360;
export const HEIGHT = 640;
export const PLAY_TOP = 72;
export const PLAY_BOTTOM = 610;
export const PLAYER_RADIUS = 14;

export class GameEngine {
  public mode: Mode = 'playing';
  public stageIndex = 0;
  public stageElapsed = 0;
  public runTime = 0;
  public manualMode = false;

  public player: PlayerState = {
    x: WIDTH / 2,
    y: (PLAY_TOP + PLAY_BOTTOM) / 2,
    hp: balance.player.maxHealth,
    maxHp: balance.player.maxHealth,
    level: 1,
    xp: 0,
    nextXp: balance.experience.baseXpToNext,
    facing: { x: 0, y: 1 },
    speed: balance.player.moveSpeedPxPerSec,
    invulnerable: 0,
    soulsCollected: 0
  };

  public dashCooldown = 0;
  public dashRemaining = 0;
  public dashDirection: Vec2 = { x: 0, y: 1 };

  public skills: SkillState[] = [
    { id: 'basic_bite', stage: 1, numericLevel: 0, cooldown: 0 },
    { id: 'devour_mouth', stage: 1, numericLevel: 0, cooldown: 0 }
  ];

  public enemies: Enemy[] = [];
  public souls: SoulDrop[] = [];
  public dangerZones: DangerZone[] = [];
  public projectiles: Projectile[] = [];

  public boss: Enemy | null = null;
  public bossSpawned = false;
  public bossDefeated = false;
  public bossAttackTimer = 0;
  public spawnAccumulator = 0;

  public levelupCount = 0;
  public levelupOptions: UpgradeOption[] = [];
  public partOffers: PartOffer[] = [];
  public partUpgradeOptions: PartUpgradeOption[] = [];
  public pendingPart: PartId | null = null;
  public metaUnlocks: string[] = [];

  public cameraController: CameraController;
  public renderer3d: Renderer3D;
  public combat: CombatManager;
  public ui: UIController;

  private keysDown = new Set<string>();
  private choiceLatch = false;
  private pointerPos = { x: 0, y: 0 };
  private isPointerAiming = false;
  private regenTimer = 0;

  constructor(container: HTMLElement) {
    this.cameraController = new CameraController(window.innerWidth / window.innerHeight);
    this.renderer3d = new Renderer3D(container);
    this.combat = new CombatManager();
    this.ui = new UIController(container);

    this.metaUnlocks = this.loadMetaUnlocks();
    this.bindInputs();
    this.setupUIHandlers();
    this.applyTalentsToPlayer();

    // Attach global testing hooks
    window.render_game_to_text = () => this.renderGameToText();
    window.advanceTime = (ms: number) => {
      this.manualMode = true;
      if (this.mode === 'title') {
        this.mode = 'playing';
        this.ui.hideModal();
      }
      const steps = Math.max(1, Math.round(ms / (1000 / 60)));
      for (let i = 0; i < steps; i++) this.simulateStep(1 / 60);
      this.render();
    };
    window.__beastEvoGame = this;
    (window as any).__beastEvoMeta = meta;

    this.renderer3d.setStage(this.stageIndex);
    this.updatePartsVisual();
    audio.setStageBgm(this.stageIndex);
  }

  private loadMetaUnlocks(): string[] {
    try {
      const raw = window.localStorage.getItem('beast-evo-unlocks');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private unlockMetaPart(partId: string) {
    if (!this.metaUnlocks.includes(partId)) this.metaUnlocks.push(partId);
    try {
      window.localStorage.setItem('beast-evo-unlocks', JSON.stringify(this.metaUnlocks));
    } catch {}
  }

  private bindInputs() {
    window.addEventListener('keydown', (e) => {
      audio.resume();
      this.keysDown.add(e.code);

      if (e.code === 'Escape') {
        if (this.mode === 'playing') {
          this.pauseGame();
        } else if (this.mode === 'paused') {
          this.resumeGame();
        }
      } else if (e.code === 'KeyF') {
        this.toggleFullscreen();
      } else if (e.code === 'KeyR') {
        if (this.mode === 'victory' || this.mode === 'defeat') {
          this.resetRun();
        } else {
          this.cameraController.resetBehind(this.player.facing);
        }
      } else if (e.code === 'Space') {
        e.preventDefault();
        this.triggerDash();
      }

      // 1, 2, 3 card choices
      if (!this.choiceLatch) {
        if (e.code === 'Digit1') this.handleChoiceKey(0);
        else if (e.code === 'Digit2') this.handleChoiceKey(1);
        else if (e.code === 'Digit3') this.handleChoiceKey(2);
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keysDown.delete(e.code);
      if (['Digit1', 'Digit2', 'Digit3'].includes(e.code)) {
        this.choiceLatch = false;
      }
    });

    // Mouse Controls (Pointer Aiming & Camera Orbit Dragging)
    let isMouseDown = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    window.addEventListener('pointerdown', (e) => {
      audio.resume();
      // If clicking outside HUD buttons, rotate camera with right-click or middle-click or viewport drag
      if ((e.target as HTMLElement)?.closest('button, .select-card, .modal-card, .joystick-zone')) return;
      isMouseDown = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;

      if (e.button === 0) {
        this.isPointerAiming = true;
        this.pointerPos = { x: e.clientX, y: e.clientY };
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (isMouseDown) {
        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;

        // Rotate camera if right button, middle button, or dragged significantly
        if (e.buttons === 2 || e.buttons === 4 || (!this.ui.isTouchMoving && e.buttons === 1 && (Math.abs(dx) > 2 || Math.abs(dy) > 2))) {
          this.cameraController.rotateDelta(dx * 0.006, dy * 0.006);
        }
      }
      if (this.isPointerAiming) {
        this.pointerPos = { x: e.clientX, y: e.clientY };
      }
    });

    window.addEventListener('pointerup', (e) => {
      isMouseDown = false;
      if (e.button === 0) this.isPointerAiming = false;
    });

    window.addEventListener('wheel', (e) => {
      this.cameraController.zoomDelta(e.deltaY * 0.01);
    }, { passive: true });

    // Prevent default context menu on right click to allow smooth camera rotation
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private handleChoiceKey(index: number) {
    this.choiceLatch = true;
    if (this.mode === 'levelup') {
      if (this.levelupOptions[index]) this.applyUpgrade(this.levelupOptions[index]);
    } else if (this.mode === 'part_reward') {
      if (this.partOffers[index]) this.choosePart(index);
    } else if (this.mode === 'part_upgrade') {
      if (this.partUpgradeOptions[index]) this.applyPartUpgrade(index);
    }
  }

  private setupUIHandlers() {
    this.ui.onFullscreenToggle = () => this.toggleFullscreen();
    this.ui.onResetCamera = () => this.cameraController.resetBehind(this.player.facing);
    this.ui.onRestartRun = () => this.resetRun();
    this.ui.onOpenTalents = () => this.openTalents();
    this.ui.onOpenBestiary = () => this.openBestiary();
    this.ui.onOpenSettings = () => {
      if (this.mode === 'playing') this.pauseGame();
      else if (this.mode === 'paused') this.resumeGame();
    };
    this.ui.onTouchDash = () => this.triggerDash();
    this.ui.onTouchCameraDrag = (dx, dy) => this.cameraController.rotateDelta(dx, dy);

    this.ui.onSelectUpgrade = (idx) => this.applyUpgrade(this.levelupOptions[idx]);
    this.ui.onSelectPart = (idx) => this.choosePart(idx);
    this.ui.onSelectPartUpgrade = (idx) => this.applyPartUpgrade(idx);
  }

  public openTalents() {
    if (this.mode === 'playing') this.mode = 'paused';
    this.ui.showTalentsModal(meta, () => this.resumeGame());
  }

  public openBestiary() {
    if (this.mode === 'playing') this.mode = 'paused';
    this.ui.showBestiaryModal(meta, () => this.resumeGame());
  }

  public pauseGame() {
    if (this.mode !== 'playing') return;
    this.mode = 'paused';
    const refreshSettings = () => {
      this.ui.showSettingsModal(
        () => this.resumeGame(),
        () => this.resetRun(),
        (lang) => {
          setLanguage(lang);
          refreshSettings();
        },
        this.cameraController
      );
    };
    refreshSettings();
  }

  public resumeGame() {
    if (this.mode === 'paused') {
      this.mode = 'playing';
      this.ui.hideModal();
    }
  }

  private applyTalentsToPlayer() {
    const vitalityBonus = (meta.profile.talents.vitality || 0) * 12;
    const swiftnessBonus = (meta.profile.talents.swiftness || 0) * 0.06;
    this.player.maxHp = balance.player.maxHealth + vitalityBonus;
    this.player.hp = this.player.maxHp;
    this.player.speed = balance.player.moveSpeedPxPerSec * (1 + swiftnessBonus);
  }

  private toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  public resetRun() {
    this.mode = 'playing';
    this.stageIndex = 0;
    this.stageElapsed = 0;
    this.runTime = 0;
    this.regenTimer = 0;
    audio.setStageBgm(this.stageIndex);
    this.player = {
      x: WIDTH / 2,
      y: (PLAY_TOP + PLAY_BOTTOM) / 2,
      hp: balance.player.maxHealth,
      maxHp: balance.player.maxHealth,
      level: 1,
      xp: 0,
      nextXp: balance.experience.baseXpToNext,
      facing: { x: 0, y: 1 },
      speed: balance.player.moveSpeedPxPerSec,
      invulnerable: 0,
      soulsCollected: 0
    };
    this.applyTalentsToPlayer();
    this.dashCooldown = 0;
    this.dashRemaining = 0;
    this.dashDirection = { x: 0, y: 1 };
    this.skills = [
      { id: 'basic_bite', stage: 1, numericLevel: 0, cooldown: 0 },
      { id: 'devour_mouth', stage: 1, numericLevel: 0, cooldown: 0 }
    ];
    this.enemies = [];
    this.souls = [];
    this.dangerZones = [];
    this.projectiles = [];
    this.boss = null;
    this.bossSpawned = false;
    this.bossDefeated = false;
    this.bossAttackTimer = 0;
    this.spawnAccumulator = 0;
    this.levelupCount = 0;

    this.combat.parts = { head: undefined, limb: undefined, tail: undefined, armor: undefined };
    this.combat.partUpgrades = {};
    this.combat.primaryBranch = null;
    this.combat.secondaryBranch = null;
    this.combat.branchNodes.clear();

    this.renderer3d.setStage(this.stageIndex);
    this.updatePartsVisual();
    this.ui.hideModal();
  }

  public update(dt: number) {
    if (!this.manualMode) {
      this.simulateStep(Math.min(dt, 0.05));
      this.render();
    }
  }

  public simulateStep(dt: number) {
    if (this.mode !== 'playing') {
      return;
    }

    this.runTime += dt;
    this.stageElapsed += dt;
    this.player.invulnerable = Math.max(0, this.player.invulnerable - dt);
    this.combat.soulAttackSpeedWindow = Math.max(0, this.combat.soulAttackSpeedWindow - dt);
    this.combat.soulShieldRemaining = Math.max(0, this.combat.soulShieldRemaining - dt);

    // Passive HP Regeneration talent
    if (meta.profile.talents.regeneration > 0 && this.player.hp < this.player.maxHp) {
      this.regenTimer += dt;
      if (this.regenTimer >= 3.0) {
        this.regenTimer -= 3.0;
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + meta.profile.talents.regeneration);
      }
    }

    this.updatePlayer(dt);
    this.updateSouls(dt);
    this.updateEnemies(dt);
    this.updateBossAttacks(dt);
    this.updateSkills(dt);
    this.updateProjectiles(dt);

    const currentStage = stages.stages[this.stageIndex];
    if (!this.bossSpawned && this.stageElapsed >= currentStage.normalDurationSec) {
      this.spawnBoss();
    }
    if (!this.bossSpawned) {
      this.spawnWaveEnemies(dt);
    }
    if (this.bossSpawned && this.bossDefeated) {
      this.finishBoss();
    }
    this.checkDefeat();
  }

  private readMoveDirection(): Vec2 {
    if (this.ui.isTouchMoving && (this.ui.touchDirection.x !== 0 || this.ui.touchDirection.y !== 0)) {
      return this.ui.touchDirection;
    }

    let dx = 0;
    let dy = 0;
    if (this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft')) dx -= 1;
    if (this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight')) dx += 1;
    if (this.keysDown.has('KeyW') || this.keysDown.has('ArrowUp')) dy -= 1;
    if (this.keysDown.has('KeyS') || this.keysDown.has('ArrowDown')) dy += 1;

    const len = Math.hypot(dx, dy);
    return len > 0 ? { x: dx / len, y: dy / len } : { x: 0, y: 0 };
  }

  public triggerDash(direction = this.readMoveDirection()) {
    if (this.mode !== 'playing' || this.dashCooldown > 0 || this.dashRemaining > 0) return;
    this.dashDirection = direction.x !== 0 || direction.y !== 0 ? direction : this.player.facing;
    this.dashRemaining = balance.player.dashDurationSec;
    const talentDashCdReduction = (meta.profile.talents.swiftness || 0) * 0.3;
    this.dashCooldown = Math.max(1.0, this.combat.getDashCooldownSec() - talentDashCdReduction);
    this.player.invulnerable = this.combat.getDashInvulnerableSec();
    this.combat.dashHitEnemies.clear();
    audio.playDash();
    this.renderer3d.triggerDashDustFx(this.player.x, this.player.y, this.dashDirection);
  }

  private updatePlayer(dt: number) {
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);

    let moveDir = this.readMoveDirection();
    const isMoving = moveDir.x !== 0 || moveDir.y !== 0;

    if (this.dashRemaining > 0) {
      this.dashRemaining = Math.max(0, this.dashRemaining - dt);
      const dashSpeed =
        (balance.player.dashDistancePx / balance.player.dashDurationSec) *
        (this.combat.getPartEffect('dash_distance_multiplier') || 1);
      this.player.x += this.dashDirection.x * dashSpeed * dt;
      this.player.y += this.dashDirection.y * dashSpeed * dt;
      this.player.facing = this.dashDirection;
      this.applyDashImpact();
    } else if (isMoving) {
      this.player.x += moveDir.x * this.player.speed * dt;
      this.player.y += moveDir.y * this.player.speed * dt;
      this.player.facing = moveDir;
    }

    // Clamp inside play area
    const margin = PLAYER_RADIUS + 4;
    this.player.x = Math.max(margin, Math.min(WIDTH - margin, this.player.x));
    this.player.y = Math.max(PLAY_TOP + margin, Math.min(PLAY_BOTTOM - margin, this.player.y));
  }

  private applyDashImpact() {
    const baseDamage =
      this.combat.getPartEffect('dash_damage_bonus') + this.combat.getGrowthEffect('dashDamage');
    if (baseDamage <= 0) return;

    const knockback = Math.max(
      1,
      this.combat.getPartEffect('dash_knockback_multiplier') ||
        this.combat.getGrowthEffect('dashKnockback') ||
        1
    );
    const impactRadius = this.combat.getPartUpgradeEffect('dash_impact_radius_px') || 8;

    for (const enemy of this.enemies) {
      if (this.combat.dashHitEnemies.has(enemy)) continue;
      if (this.distanceToPlayer(enemy) > enemy.radius + PLAYER_RADIUS + impactRadius) continue;
      this.combat.dashHitEnemies.add(enemy);

      const extraDamage =
        enemy.burnRemaining > 0 ? this.combat.getSynergyEffect('dash_burn_explosion_damage') : 0;
      this.damageEnemy(enemy, baseDamage + extraDamage);
      this.cameraController.triggerShake(0.25);

      const dx = enemy.x - this.player.x;
      const dy = enemy.y - this.player.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      enemy.x = Math.max(12, Math.min(WIDTH - 12, enemy.x + (dx / dist) * 30 * knockback));
      enemy.y = Math.max(PLAY_TOP + 10, Math.min(PLAY_BOTTOM - 10, enemy.y + (dy / dist) * 30 * knockback));
    }
  }

  private spawnWaveEnemies(dt: number) {
    const currentStage = stages.stages[this.stageIndex];
    const waveSet = waveMap.get(currentStage.waveSetId);
    if (!waveSet) return;

    const wave = waveSet.waves.find(
      (w) => this.stageElapsed >= w.startSec && this.stageElapsed < w.endSec
    );
    if (!wave || this.enemies.length >= wave.maxAlive) return;

    this.spawnAccumulator += dt * wave.spawnRatePerSec;
    while (this.spawnAccumulator >= 1 && this.enemies.length < wave.maxAlive) {
      this.spawnAccumulator -= 1;
      this.spawnEnemy(this.pickWeightedCreature(wave.enemyPool));
    }
  }

  private pickWeightedCreature(pool: Array<{ creatureId: string; weight: number }>): string {
    const total = pool.reduce((sum, item) => sum + item.weight, 0);
    let val = Math.random() * total;
    for (const entry of pool) {
      val -= entry.weight;
      if (val <= 0) return entry.creatureId;
    }
    return pool[pool.length - 1].creatureId;
  }

  private spawnEnemy(creatureId: string) {
    const def = creatureMap.get(creatureId);
    if (!def) return;
    meta.unlockCreature(def.id);

    const edge = Math.floor(Math.random() * 4);
    const margin = 24;
    let x = margin;
    let y = PLAY_TOP + margin;
    if (edge === 0) {
      x = margin;
      y = PLAY_TOP + margin + Math.random() * (PLAY_BOTTOM - PLAY_TOP - margin * 2);
    } else if (edge === 1) {
      x = WIDTH - margin;
      y = PLAY_TOP + margin + Math.random() * (PLAY_BOTTOM - PLAY_TOP - margin * 2);
    } else if (edge === 2) {
      x = margin + Math.random() * (WIDTH - margin * 2);
      y = PLAY_TOP + margin;
    } else {
      x = margin + Math.random() * (WIDTH - margin * 2);
      y = PLAY_BOTTOM - margin;
    }

    const radius =
      def.kind === 'boss' ? 34 : def.kind === 'elite' ? 18 : def.variant === 'heavy' ? 18 : 10;

    const enemy: Enemy = {
      id: def.id + '_' + Math.random().toString(36).slice(2, 7),
      kind: def.kind as any,
      variant: def.variant,
      x,
      y,
      radius,
      health: def.stats.health,
      maxHealth: def.stats.health,
      speed: def.stats.moveSpeedPxPerSec,
      contactDamage: def.stats.contactDamage,
      soul: def.stats.soul,
      damageCooldown: 0,
      burnRemaining: 0,
      burnTick: 0,
      burnDamagePerSec: 0,
      stunRemaining: 0,
      behaviorKey: def.behaviorKey,
      phases: def.phases
    };

    this.enemies.push(enemy);
  }

  private spawnBoss() {
    this.bossSpawned = true;
    this.enemies = [];
    this.dangerZones = [];
    this.bossAttackTimer = 2.5;
    audio.playBossAlert();

    const bossId = stages.stages[this.stageIndex].bossId;
    const def = creatureMap.get(bossId);
    if (!def) return;
    meta.unlockCreature(def.id);

    const boss: Enemy = {
      id: def.id,
      kind: 'boss',
      x: WIDTH / 2,
      y: PLAY_TOP + 60,
      radius: 34,
      health: def.stats.health,
      maxHealth: def.stats.health,
      speed: def.stats.moveSpeedPxPerSec,
      contactDamage: def.stats.contactDamage,
      soul: 0,
      damageCooldown: 0,
      burnRemaining: 0,
      burnTick: 0,
      burnDamagePerSec: 0,
      stunRemaining: 0,
      phases: def.phases
    };

    this.enemies.push(boss);
    this.boss = boss;
  }

  private updateBossAttacks(dt: number) {
    if (!this.boss || this.mode !== 'playing') {
      this.dangerZones = [];
      return;
    }

    this.bossAttackTimer -= dt;
    if (this.bossAttackTimer <= 0) {
      this.spawnBossAttack(this.boss);
      this.bossAttackTimer = this.getBossAttackInterval(this.boss);
    }

    for (const zone of this.dangerZones) {
      zone.impactIn -= dt;
      zone.ttl -= dt;
      if (zone.impactIn <= 0 && !zone.triggered) {
        zone.triggered = true;
        const dist = Math.hypot(this.player.x - zone.x, this.player.y - zone.y);
        if (dist <= zone.radius && this.player.invulnerable <= 0) {
          this.player.hp -= zone.damage;
          this.player.invulnerable = 0.45;
          this.cameraController.triggerShake(0.55);
          audio.playHit();
        }
      }
    }
    this.dangerZones = this.dangerZones.filter((z) => z.ttl > 0);
  }

  private getBossAttackInterval(boss: Enemy): number {
    const ratio = boss.health / boss.maxHealth;
    if (boss.id === 'nine_tail_shadow') return ratio <= 0.6 ? 2.2 : 3.2;
    if (boss.id === 'kui_spirit') return ratio <= 0.5 ? 2.0 : 3.0;
    return ratio <= 0.3 ? 1.45 : ratio <= 0.65 ? 2.0 : 2.8;
  }

  private spawnBossAttack(boss: Enemy) {
    const ratio = boss.health / boss.maxHealth;
    if (boss.id === 'nine_tail_shadow') {
      this.addDangerZone(this.player.x, this.player.y, ratio <= 0.6 ? 42 : 34, 0.55, 0.85, 24, 0xf27b9b);
      if (ratio <= 0.6) {
        this.addDangerZone(this.player.x - 54, this.player.y, 28, 0.7, 0.95, 16, 0xd95d72);
        this.addDangerZone(this.player.x + 54, this.player.y, 28, 0.7, 0.95, 16, 0xd95d72);
      }
      return;
    }

    if (boss.id === 'kui_spirit') {
      const count = ratio <= 0.5 ? 4 : 2;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        this.addDangerZone(
          this.player.x + Math.cos(angle) * 42,
          this.player.y + Math.sin(angle) * 42,
          26,
          0.75,
          1.05,
          ratio <= 0.5 ? 28 : 22,
          0x7ad7ff
        );
      }
      return;
    }

    const dist = ratio <= 0.3 ? 95 : 70;
    this.addDangerZone(
      Math.max(24, Math.min(WIDTH - 24, this.player.x + this.player.facing.x * dist)),
      Math.max(PLAY_TOP + 20, Math.min(PLAY_BOTTOM - 20, this.player.y + this.player.facing.y * dist)),
      ratio <= 0.3 ? 48 : 38,
      0.45,
      0.75,
      ratio <= 0.3 ? 36 : 28,
      0xff8b66
    );
  }

  private addDangerZone(x: number, y: number, radius: number, impactIn: number, ttl: number, damage: number, color: number) {
    this.dangerZones.push({
      id: Math.random().toString(36).slice(2, 9),
      x,
      y,
      radius,
      impactIn,
      ttl,
      damage,
      triggered: false,
      color
    });
  }

  private updateEnemies(dt: number) {
    for (const enemy of this.enemies) {
      enemy.damageCooldown = Math.max(0, enemy.damageCooldown - dt);
      enemy.stunRemaining = Math.max(0, enemy.stunRemaining - dt);
      this.combat.updateBurn(enemy, dt, (tgt, amt) => this.damageEnemy(tgt, amt));

      if (enemy.health <= 0) continue;

      const dx = this.player.x - enemy.x;
      const dy = this.player.y - enemy.y;
      const dist = Math.max(1, Math.hypot(dx, dy));

      if (enemy.stunRemaining > 0) {
        // Stunned
      } else if (enemy.kind === 'boss') {
        enemy.x += (dx / dist) * enemy.speed * dt * 0.55;
        enemy.y += (dy / dist) * enemy.speed * dt * 0.55;
      } else if (enemy.id.includes('spirit_rat')) {
        // Rats flee slightly
        enemy.x -= (dx / dist) * enemy.speed * dt;
        enemy.y -= (dy / dist) * enemy.speed * dt;
      } else {
        enemy.x += (dx / dist) * enemy.speed * dt;
        enemy.y += (dy / dist) * enemy.speed * dt;
      }

      if (
        dist <= enemy.radius + PLAYER_RADIUS &&
        enemy.damageCooldown <= 0 &&
        this.player.invulnerable <= 0 &&
        this.combat.soulShieldRemaining <= 0
      ) {
        this.player.hp -= enemy.contactDamage;
        this.player.invulnerable = 0.4;
        enemy.damageCooldown = 0.8;
        this.cameraController.triggerShake(0.4);
        audio.playHit();
      }

      const separation = enemy.radius + PLAYER_RADIUS + 8;
      if (dist < separation) {
        enemy.x = this.player.x + (dx / dist) * separation;
        enemy.y = this.player.y + (dy / dist) * separation;
      }
    }

    this.enemies = this.enemies.filter((e) => e.health > 0);
    if (this.boss && !this.enemies.includes(this.boss)) {
      this.bossDefeated = true;
      this.boss = null;
    }
  }

  private updateSouls(dt: number) {
    const talentAbsorb = (meta.profile.talents.absorption || 0) * 15;
    const absorbRadius = this.combat.getSoulAbsorbRadius() + talentAbsorb;
    for (const soul of this.souls) {
      soul.ttl -= dt;
      const dx = this.player.x - soul.x;
      const dy = this.player.y - soul.y;
      const dist = Math.max(1, Math.hypot(dx, dy));

      if (dist <= absorbRadius) {
        const speed =
          balance.player.soulMoveSpeedPxPerSec *
          (this.combat.getGrowthEffect('soulMoveSpeedMultiplier') || 1);
        soul.x += (dx / dist) * speed * dt;
        soul.y += (dy / dist) * speed * dt;
      }

      if (dist <= 14) {
        this.collectSoul(soul);
        soul.ttl = -1;
      }
    }
    this.souls = this.souls.filter((s) => s.ttl > 0);
  }

  private collectSoul(soul: SoulDrop) {
    this.player.xp += soul.value;
    this.player.soulsCollected += soul.value;
    audio.playSoulPickup();
    this.renderer3d.triggerSoulCollectFx(soul.x, soul.y);

    this.combat.soulAttackSpeedWindow = Math.max(
      this.combat.soulAttackSpeedWindow,
      this.combat.getPartUpgradeEffect('soul_absorb_attack_speed_window')
    );
    this.combat.soulShieldRemaining = Math.max(
      this.combat.soulShieldRemaining,
      this.combat.getSynergyEffect('dash_shield_sec')
    );
    this.combat.nextFireDamageMultiplier = Math.max(
      this.combat.nextFireDamageMultiplier,
      this.combat.getSynergyEffect('next_fire_damage_multiplier') || 1
    );

    const healChance = Math.min(1, this.combat.getPartEffect('soul_absorb_heal_chance'));
    if (healChance > 0 && Math.random() <= healChance) {
      const healAmount =
        this.combat.getPartEffect('soul_absorb_heal_amount') +
        this.combat.getPartUpgradeEffect('soul_absorb_heal_bonus') +
        this.combat.getGrowthEffect('healAmount');
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + healAmount);
    }

    while (this.player.xp >= this.player.nextXp && this.mode === 'playing') {
      this.player.xp -= this.player.nextXp;
      this.player.level += 1;
      this.player.nextXp = Math.round(this.player.nextXp * balance.experience.growthMultiplier);
      this.openLevelUp();
    }
  }

  private updateSkills(dt: number) {
    for (const skill of this.skills) skill.cooldown = Math.max(0, skill.cooldown - dt);
    if (this.mode !== 'playing') return;

    this.autoAttackBasic();
    for (const skill of this.skills) {
      if (skill.cooldown > 0) continue;
      if (skill.id === 'devour_mouth') this.castDevourMouth(skill);
      if (skill.id === 'nine_tail_fire') this.castFire(skill);
      if (skill.id === 'kui_thunder') this.castThunder(skill);
    }
  }

  private autoAttackBasic() {
    const biteInterval = this.combat.soulAttackSpeedWindow > 0 ? 0.68 : 0.9;
    if (this.runTime - this.combat.lastBiteTime < biteInterval) return;

    const targets = this.enemies
      .filter((e) => this.distanceToPlayer(e) <= 58)
      .slice(0, 2);
    if (targets.length === 0) return;

    this.combat.lastBiteTime = this.runTime;
    this.renderer3d.triggerBiteFx(this.player.x, this.player.y, this.player.facing);
    this.cameraController.triggerShake(0.18);
    audio.playBite();

    for (const enemy of targets) {
      this.damageEnemy(enemy, 10);
    }
  }

  private castDevourMouth(skill: SkillState) {
    const def = skillMap.get(skill.id);
    const stage: any = def?.stages.find((item) => item.stage === skill.stage);
    if (!stage) return;

    const targets = this.enemies
      .filter((e) => this.inCone(e, stage.rangePx, stage.angleDeg))
      .slice(0, stage.targetLimit);

    if (targets.length > 0) {
      this.renderer3d.triggerBiteFx(this.player.x, this.player.y, this.player.facing);
      audio.playBite();
    }

    for (const enemy of targets) {
      this.damageEnemy(enemy, stage.damage * (1 + skill.numericLevel * 0.1));
    }
    skill.cooldown = stage.cooldownSec;
  }

  private castFire(skill: SkillState) {
    const def = skillMap.get(skill.id);
    const stage: any = def?.stages.find((item) => item.stage === skill.stage);
    const target = this.findNearestTarget(220);
    if (!stage || !target) return;

    const fireMultiplier = this.combat.nextFireDamageMultiplier;
    this.combat.nextFireDamageMultiplier = 1;
    audio.playFire();

    // Launch 3D Projectile
    const projectileDamage =
      (stage.damage * (1 + skill.numericLevel * 0.1) + this.combat.getFireBonusDamage()) * fireMultiplier;

    this.projectiles.push({
      id: Math.random().toString(36).slice(2, 9),
      x: this.player.x,
      y: this.player.y,
      vx: 0,
      vy: 0,
      targetEnemyId: target.id,
      damage: projectileDamage,
      speed: 180,
      ttl: 2.0,
      splitCount: this.combat.getPartUpgradeEffect('ember_projectile_split') > 0 ? 2 : 0
    });

    skill.cooldown = stage.cooldownSec;
  }

  private castThunder(skill: SkillState) {
    const def = skillMap.get(skill.id);
    const stage: any = def?.stages.find((item) => item.stage === skill.stage);
    const target = this.findNearestTarget(260);
    if (!stage || !target) return;

    const hornBonus = this.combat.getPartEffect('basic_attack_lightning_damage');
    this.renderer3d.triggerThunderFx(target.x, target.y);
    this.cameraController.triggerShake(0.32);
    audio.playThunder();
    this.damageEnemy(target, stage.damage * (1 + skill.numericLevel * 0.1) + hornBonus);
    this.combat.applyThunderStun(target);

    const bounceCount =
      (stage.bounceCount ?? 0) +
      (hornBonus > 0 ? 1 : 0) +
      this.combat.getPartUpgradeEffect('horn_lightning_bounce');

    const others = this.enemies
      .filter((e) => e !== target && this.distanceBetween(target, e) <= 95)
      .slice(0, bounceCount);

    for (const enemy of others) {
      this.renderer3d.triggerThunderFx(enemy.x, enemy.y);
      this.damageEnemy(enemy, stage.damage * (stage.bounceDamageRatio ?? 0.7) + hornBonus * 0.5);
      this.combat.applyThunderStun(enemy);
    }

    skill.cooldown = stage.cooldownSec;
  }

  private updateProjectiles(dt: number) {
    for (const p of this.projectiles) {
      p.ttl -= dt;
      let target = this.enemies.find((e) => e.id === p.targetEnemyId);
      if (!target && this.enemies.length > 0) target = this.enemies[0];

      if (target) {
        const dx = target.x - p.x;
        const dy = target.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= target.radius + 6) {
          // Impact
          this.damageEnemy(target, p.damage);
          this.combat.applyBurn(target);
          p.ttl = -1;

          // Split projectiles
          if (p.splitCount && p.splitCount > 0) {
            const splitTargets = this.enemies
              .filter((e) => e !== target && this.distanceBetween(target!, e) <= 95)
              .slice(0, p.splitCount);
            for (const st of splitTargets) {
              this.damageEnemy(st, p.damage * 0.45);
              this.combat.applyBurn(st);
            }
          }
          continue;
        }
        p.vx = (dx / dist) * p.speed;
        p.vy = (dy / dist) * p.speed;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.projectiles = this.projectiles.filter((p) => p.ttl > 0);
  }

  public damageEnemy(enemy: Enemy, damage: number) {
    if (enemy.health <= 0) return;
    const talentPredation = (meta.profile.talents.predation || 0) * 0.06;
    const finalDamage = damage * (1 + talentPredation);
    enemy.health -= finalDamage;

    if (enemy.health <= 0 && enemy.kind !== 'boss') {
      const wasBurning = enemy.burnRemaining > 0;
      enemy.burnRemaining = 0;
      this.souls.push({
        id: Math.random().toString(36).slice(2, 9),
        x: enemy.x,
        y: enemy.y,
        value: enemy.soul,
        ttl: balance.player.soulLifetimeSec + this.combat.getGrowthEffect('soulLifetimeBonusSec')
      });

      const deathFireRadius = wasBurning ? this.combat.getGrowthEffect('deathFireRadiusPx') : 0;
      if (deathFireRadius > 0) {
        const deathFireDamage = this.combat.getGrowthEffect('deathFireDamagePerTick');
        const limit = Math.max(0, this.combat.getGrowthEffect('deathFireTargetLimit'));
        const targets = this.enemies
          .filter((o) => o !== enemy && o.health > 0 && this.distanceBetween(enemy, o) <= deathFireRadius)
          .slice(0, limit);
        for (const t of targets) this.damageEnemy(t, deathFireDamage);
      }
    }
  }

  private distanceToPlayer(enemy: Enemy): number {
    return Math.hypot(this.player.x - enemy.x, this.player.y - enemy.y);
  }

  private distanceBetween(a: { x: number; y: number }, b: { x: number; y: number }): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private inCone(enemy: Enemy, range: number, angleDeg: number): boolean {
    const dx = enemy.x - this.player.x;
    const dy = enemy.y - this.player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > range) return false;

    const angleToTarget = Math.atan2(dy, dx);
    const facingAngle = Math.atan2(this.player.facing.y, this.player.facing.x);
    let diff = Math.abs(angleToTarget - facingAngle);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    return diff <= (angleDeg * Math.PI) / 360;
  }

  private findNearestTarget(maxRange: number): Enemy | null {
    let nearest: Enemy | null = null;
    let minDist = maxRange;
    for (const enemy of this.enemies) {
      if (enemy.health <= 0) continue;
      const dist = this.distanceToPlayer(enemy);
      if (dist < minDist) {
        minDist = dist;
        nearest = enemy;
      }
    }
    return nearest;
  }

  // --- PROGRESSION & REWARDS ---
  private openLevelUp() {
    this.mode = 'levelup';
    this.levelupCount += 1;
    audio.playLevelUp();
    this.renderer3d.triggerLevelUpFx(this.player.x, this.player.y);

    const isZh = getLanguage() === 'zh';
    const availableSkills: SkillId[] = (['nine_tail_fire', 'kui_thunder'] as SkillId[]).filter(
      (id) => !this.skills.some((s) => s.id === id)
    );

    const options: UpgradeOption[] = [];
    if (this.levelupCount <= 2 && availableSkills.length > 0) {
      const skillId = availableSkills[0];
      const def = skillMap.get(skillId);
      options.push({
        id: 'unlock_' + skillId,
        label: (isZh ? '解锁 ' : 'Unlock ') + localize(def?.nameKey, skillId),
        description: isZh ? '获得新的主动攻击神能' : 'Acquire a new offensive mystic ability',
        kind: 'skill',
        skillId
      });
    }

    const existing = this.skills[0];
    const existingDef = skillMap.get(existing.id);
    options.push({
      id: 'upgrade_' + existing.id,
      label: (isZh ? '强化 ' : 'Upgrade ') + localize(existingDef?.nameKey, existing.id),
      description: isZh ? '技能阶段推进或大幅增强伤害数值' : 'Advance skill stage or boost damage scaling',
      kind: 'skill',
      skillId: existing.id
    });

    const branchOption = this.getNextBranchUpgradeOption();
    if (branchOption) options.push(branchOption);

    options.push({
      id: 'health',
      label: isZh ? '厚实血肉' : 'Thick Flesh',
      description: isZh ? '最大生命 +10，并立即恢复 10 点生命' : 'Max HP +10, and immediately heal 10 HP',
      kind: 'stat'
    });

    this.levelupOptions = options.slice(0, 3);
    this.ui.showLevelUpModal(this.levelupOptions);
  }

  private getNextBranchUpgradeOption(): UpgradeOption | null {
    const isZh = getLanguage() === 'zh';
    const candidates = [this.combat.primaryBranch, this.combat.secondaryBranch].filter(
      (b): b is BranchId => b !== null
    );
    for (const branchId of candidates) {
      const branch = growth.branches.find((b) => b.id === branchId);
      if (!branch) continue;

      const nextIndex = branch.nodes.findIndex(
        (node, idx) =>
          idx > 0 &&
          this.combat.branchNodes.has(branch.nodes[idx - 1].id) &&
          !this.combat.branchNodes.has(node.id)
      );
      if (nextIndex < 0) continue;

      const node = branch.nodes[nextIndex];
      return {
        id: 'branch_' + branchId + '_' + node.id,
        label: localize('branch.' + branchId + '.name', branchId) + (isZh ? ' · 节点 ' : ' · Node ') + (nextIndex + 1),
        description: this.describeBranchNode(node.id),
        kind: 'branch',
        branchId,
        nodeIndex: nextIndex
      };
    }
    return null;
  }

  private describeBranchNode(nodeId: string): string {
    const isZh = getLanguage() === 'zh';
    const descriptionsZh: Record<string, string> = {
      gluttonous_echo: '连续吸收兽魂后，短时间提高攻击速度并回复生命',
      brutal_impact: '冲刺伤害、击退强度与护体无敌时间提高',
      burning_spread: '灼烧敌人死亡时向周围扩散爆裂火焰'
    };
    const descriptionsEn: Record<string, string> = {
      gluttonous_echo: 'Absorbing souls temporarily boosts attack speed and heals HP',
      brutal_impact: 'Increases dash damage, knockback force, and invulnerability duration',
      burning_spread: 'Burning enemies explode into flames on death, burning neighbors'
    };
    return (isZh ? descriptionsZh[nodeId] : descriptionsEn[nodeId]) ?? nodeId;
  }

  public applyUpgrade(option: UpgradeOption) {
    if (!option) return;
    if (option.kind === 'stat') {
      this.player.maxHp += 10;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 10);
    } else if (option.kind === 'branch' && option.branchId && option.nodeIndex !== undefined) {
      this.addBranchNode(option.branchId, option.nodeIndex);
    } else if (option.skillId) {
      const existing = this.skills.find((s) => s.id === option.skillId);
      if (existing) {
        if (existing.stage < 3) existing.stage += 1;
        else existing.numericLevel += 1;
      } else {
        this.skills.push({ id: option.skillId, stage: 1, numericLevel: 0, cooldown: 0 });
      }
    }
    this.mode = 'playing';
    this.ui.hideModal();
  }

  private openPartReward() {
    const isZh = getLanguage() === 'zh';
    const offerIds: PartId[] =
      this.stageIndex === 0
        ? ['fox_mouth', 'nine_tail']
        : this.combat.primaryBranch === 'flame'
          ? ['kui_horn', 'kui_hoof']
          : ['kui_hoof', 'kui_horn'];

    const effectZh: Record<string, string> = {
      fox_mouth: '扩大兽魂吸收范围，吸魂概率回血，提升近战吞噬力',
      nine_tail: '九尾妖炎，强化火焰追踪并在敌人身上留下余烬',
      kui_horn: '夔牛雷角，召唤连锁雷霆并附加麻痹控制',
      kui_hoof: '夔牛巨蹄，缩短冲刺冷却并获得冲刺震地撞击'
    };

    const effectEn: Record<string, string> = {
      fox_mouth: 'Expand soul pickup radius, chance to heal on soul collect, boost melee bite',
      nine_tail: 'Nine-tail flame, enhances homing fireballs and inflicts burning embers',
      kui_horn: 'Kui thunder horn, strikes foes with bouncing chain lightning and stun',
      kui_hoof: 'Kui giant hoof, shortens dash cooldown and triggers ground stomp shockwaves'
    };

    this.partOffers = offerIds.map((id) => {
      const part = partMap.get(id);
      const title = localize(part?.nameKey, id);
      const replacement =
        part?.slot && this.combat.parts[part.slot]
          ? (isZh ? '替换当前 ' : 'Replaces ') + localize(partMap.get(this.combat.parts[part.slot]!)?.nameKey, this.combat.parts[part.slot]!)
          : undefined;

      return {
        id,
        branch: part?.branch as BranchId,
        title,
        effect: isZh ? effectZh[id] : effectEn[id],
        replacement
      };
    });

    this.mode = 'part_reward';
    this.ui.showPartOfferModal(this.partOffers);
  }

  public choosePart(index: number) {
    const offer = this.partOffers[index];
    if (!offer) return;
    const part = partMap.get(offer.id);
    if (!part) return;

    this.combat.parts[part.slot] = offer.id;
    if (!this.combat.primaryBranch) {
      this.combat.primaryBranch = offer.branch;
      this.addBranchNode(offer.branch, 0);
    } else if (!this.combat.secondaryBranch && offer.branch !== this.combat.primaryBranch) {
      this.combat.secondaryBranch = offer.branch;
      this.addBranchNode(offer.branch, 0);
    }

    this.updatePartsVisual();
    this.pendingPart = offer.id;

    this.partUpgradeOptions = part.upgradeChoices.map((choice) => ({
      id: choice.id,
      partId: offer.id,
      title: localize(choice.nameKey, choice.id),
      effectKey: choice.effectKey,
      value: choice.value,
      description: this.describePartUpgrade(choice.effectKey, choice.value)
    }));

    if (this.partUpgradeOptions.length > 0) {
      this.mode = 'part_upgrade';
      this.ui.showPartUpgradeModal(this.partUpgradeOptions);
      return;
    }

    this.finishPartTransition();
  }

  public applyPartUpgrade(index: number) {
    const opt = this.partUpgradeOptions[index];
    if (!opt || !this.pendingPart) return;
    this.combat.partUpgrades[opt.partId] = opt.id;
    this.partUpgradeOptions = [];
    this.pendingPart = null;
    this.finishPartTransition();
  }

  private finishPartTransition() {
    this.ui.hideModal();
    this.mode = 'playing';
    this.stageIndex += 1;
    this.renderer3d.setStage(this.stageIndex);
    this.stageElapsed = 0;
    this.bossSpawned = false;
    this.bossDefeated = false;
    this.boss = null;
    this.dangerZones = [];
    this.bossAttackTimer = 0;
    this.player.hp = Math.min(
      this.player.maxHp,
      this.player.hp + this.player.maxHp * balance.player.stageRecoveryRatio
    );
    audio.setStageBgm(this.stageIndex);
  }

  private describePartUpgrade(effectKey: string, value: number): string {
    const isZh = getLanguage() === 'zh';
    const descriptionsZh: Record<string, string> = {
      soul_absorb_attack_speed_window: '吸收兽魂后，暴食攻击速度加速窗口延长',
      soul_absorb_heal_bonus: '吸收兽魂时生命回复量提高',
      burning_path: '火焰掠过留下灼烧火径',
      ember_projectile_split: '火焰余烬命中后产生额外分裂火球',
      horn_lightning_bounce: '雷击跳跃连锁目标数增加',
      horn_lightning_stun_duration_sec: '雷击麻痹时间延长',
      dash_impact_radius_px: '冲刺撞击波及范围扩大',
      dash_armor_sec: '冲刺护体减伤时间延长'
    };
    const descriptionsEn: Record<string, string> = {
      soul_absorb_attack_speed_window: 'Extends attack speed boost window after absorbing souls',
      soul_absorb_heal_bonus: 'Increases healing amount gained when absorbing souls',
      burning_path: 'Leaves a burning flame trail along projectile paths',
      ember_projectile_split: 'Flames burst into splitting embers on enemy impact',
      horn_lightning_bounce: 'Increases lightning chain bounces to nearby enemies',
      horn_lightning_stun_duration_sec: 'Prolongs thunder paralysis stun duration',
      dash_impact_radius_px: 'Enlarges dash shockwave impact radius',
      dash_armor_sec: 'Extends dash damage reduction protective duration'
    };
    const suffix = isZh
      ? effectKey.includes('sec')
        ? value + ' 秒'
        : effectKey.includes('radius')
          ? value + ' px'
          : effectKey.includes('bonus')
            ? '+' + value
            : ''
      : effectKey.includes('sec')
        ? value + 's'
        : effectKey.includes('radius')
          ? value + ' px'
          : effectKey.includes('bonus')
            ? '+' + value
            : '';
    const desc = isZh ? descriptionsZh[effectKey] : descriptionsEn[effectKey];
    return (desc ?? effectKey) + (suffix ? ' (' + suffix + ')' : '');
  }

  private addBranchNode(branch: BranchId, index: number) {
    const branchData = growth.branches.find((b) => b.id === branch);
    const node = branchData?.nodes[index];
    if (!node || this.combat.branchNodes.has(node.id)) return;

    this.combat.branchNodes.add(node.id);
    const maxHealthBonus = (node as any).maxHealthBonus;
    if (typeof maxHealthBonus === 'number' && maxHealthBonus > 0) {
      this.player.maxHp += maxHealthBonus;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + maxHealthBonus);
    }
  }

  private finishBoss() {
    this.bossDefeated = false;
    this.dangerZones = [];
    this.bossAttackTimer = 0;

    if (this.stageIndex < 2) {
      this.openPartReward();
    } else {
      audio.stopStageBgm();
      const isFirstClear = !this.metaUnlocks.includes('qiongqi_wing');
      this.unlockMetaPart('qiongqi_wing');
      const earnedSouls = Math.floor(this.player.soulsCollected * 1.0);
      meta.recordRun(true, earnedSouls);
      this.mode = 'victory';
      const isZh = getLanguage() === 'zh';
      const summary = isZh
        ? `你已斩杀穷奇，肃清洪荒三劫！存活时间：${Math.floor(this.runTime)}秒，吞噬兽魂：${this.player.soulsCollected}点。`
        : `You have slain Qiongqi and cleansed the three perils! Time survived: ${Math.floor(this.runTime)}s, Souls devoured: ${this.player.soulsCollected}.`;
      this.ui.showResultModal(true, summary, isFirstClear, earnedSouls, () => this.openTalents());
    }
  }

  private checkDefeat() {
    if (this.player.hp <= 0 && this.mode === 'playing') {
      audio.stopStageBgm();
      this.player.hp = 0;
      const earnedSouls = Math.floor(this.player.soulsCollected * 0.8);
      meta.recordRun(false, earnedSouls);
      this.mode = 'defeat';
      const isZh = getLanguage() === 'zh';
      const summary = isZh
        ? `在第 ${this.stageIndex + 1} 关力竭身陨。累计吸取兽魂：${this.player.soulsCollected} 点。`
        : `Fallen in Stage ${this.stageIndex + 1}. Total souls devoured: ${this.player.soulsCollected}.`;
      this.ui.showResultModal(false, summary, false, earnedSouls, () => this.openTalents());
    }
  }

  private updatePartsVisual() {
    this.renderer3d.updatePlayerParts(this.combat.parts);
  }

  // --- RENDERING & SYNC ---
  public render() {
    const currentStage = stages.stages[this.stageIndex];
    const isMoving = this.readMoveDirection().x !== 0 || this.readMoveDirection().y !== 0;
    const isDashing = this.dashRemaining > 0;

    // Update 3D Camera
    const playerWorld = simToWorld(this.player.x, this.player.y);
    this.cameraController.setTarget(playerWorld.x, 0, playerWorld.z);
    this.cameraController.update(1 / 60);

    // Sync 3D Meshes
    this.renderer3d.syncPlayer(
      this.player.x,
      this.player.y,
      this.player.facing,
      isMoving,
      isDashing,
      1 / 60,
      this.runTime
    );
    this.renderer3d.syncEnemies(this.enemies);
    this.renderer3d.syncSouls(this.souls, this.runTime);
    this.renderer3d.syncDangerZones(this.dangerZones);
    this.renderer3d.syncProjectiles(this.projectiles);
    this.renderer3d.updateVfx(1 / 60);

    // Render 3D Scene
    this.renderer3d.render(this.cameraController.camera);

    // Update Off-Screen Target Radar Indicators
    const indicators: Array<{
      id: string;
      label: string;
      x: number;
      y: number;
      angleRad: number;
      distance: number;
      kind: 'boss' | 'elite';
    }> = [];

    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    if (this.boss) {
      const bossWorld = simToWorld(this.boss.x, this.boss.y);
      const res = this.cameraController.getScreenEdgeIndicator(bossWorld, screenW, screenH, 50);
      if (!res.onScreen) {
        indicators.push({
          id: this.boss.id,
          label: localize(creatureMap.get(this.boss.id)?.nameKey, this.boss.id),
          x: res.x,
          y: res.y,
          angleRad: res.angleRad,
          distance: res.distance,
          kind: 'boss'
        });
      }
    }

    for (const elite of this.enemies.filter((e) => e.kind === 'elite')) {
      const eliteWorld = simToWorld(elite.x, elite.y);
      const res = this.cameraController.getScreenEdgeIndicator(eliteWorld, screenW, screenH, 50);
      if (!res.onScreen) {
        indicators.push({
          id: elite.id,
          label: localize(creatureMap.get(elite.id)?.nameKey, '精英'),
          x: res.x,
          y: res.y,
          angleRad: res.angleRad,
          distance: res.distance,
          kind: 'elite'
        });
      }
    }

    this.ui.updateRadar(indicators);

    // Update HUD
    this.ui.updateHUD(
      this.player,
      localize(currentStage.nameKey, currentStage.id),
      this.stageIndex,
      this.stageElapsed,
      currentStage.normalDurationSec,
      this.boss,
      this.dashCooldown,
      this.combat.getDashCooldownSec(),
      this.combat.primaryBranch,
      this.combat.secondaryBranch,
      this.combat.getActiveSynergies(),
      this.combat.parts
    );
  }

  // --- SNAPSHOT FOR TESTING ---
  public renderGameToText(): string {
    return JSON.stringify({
      coordinateSystem: 'origin at top-left; x increases right; y increases down',
      mode: this.mode,
      stage: this.stageIndex + 1,
      stageElapsedSec: Number(this.stageElapsed.toFixed(2)),
      runTimeSec: Number(this.runTime.toFixed(2)),
      metaUnlocks: this.metaUnlocks,
      metaProfile: meta.profile,
      player: {
        x: Number(this.player.x.toFixed(1)),
        y: Number(this.player.y.toFixed(1)),
        hp: Math.ceil(this.player.hp),
        maxHp: Math.ceil(this.player.maxHp),
        level: this.player.level,
        xp: Math.floor(this.player.xp),
        nextXp: this.player.nextXp,
        facing: this.player.facing,
        dashCooldown: Number(this.dashCooldown.toFixed(2)),
        dashRemaining: Number(this.dashRemaining.toFixed(2)),
        soulAbsorbRadius: Number(this.combat.getSoulAbsorbRadius().toFixed(1)),
        dashCooldownDurationSec: Number(this.combat.getDashCooldownSec().toFixed(2)),
        fireBonusDamage: Number(this.combat.getFireBonusDamage().toFixed(1)),
        soulAttackSpeedWindow: Number(this.combat.soulAttackSpeedWindow.toFixed(2)),
        soulShieldRemaining: Number(this.combat.soulShieldRemaining.toFixed(2)),
        nextFireDamageMultiplier: Number(this.combat.nextFireDamageMultiplier.toFixed(2)),
        primaryBranch: this.combat.primaryBranch,
        secondaryBranch: this.combat.secondaryBranch,
        branchNodes: Array.from(this.combat.branchNodes),
        activeSynergies: this.combat.getActiveSynergies(),
        parts: this.combat.parts,
        partUpgrades: this.combat.partUpgrades,
        skills: this.skills.map((s) => ({
          id: s.id,
          stage: s.stage,
          numericLevel: s.numericLevel,
          cooldown: Number(s.cooldown.toFixed(2))
        }))
      },
      enemies: this.enemies.slice(0, 12).map((e) => ({
        id: e.id,
        kind: e.kind,
        x: Number(e.x.toFixed(1)),
        y: Number(e.y.toFixed(1)),
        hp: Math.ceil(e.health),
        maxHp: e.maxHealth,
        burnRemaining: Number(e.burnRemaining.toFixed(2)),
        stunRemaining: Number(e.stunRemaining.toFixed(2))
      })),
      souls: this.souls.slice(0, 12).map((s) => ({
        x: Number(s.x.toFixed(1)),
        y: Number(s.y.toFixed(1)),
        value: s.value
      })),
      dangerZones: this.dangerZones.map((z) => ({
        x: Number(z.x.toFixed(1)),
        y: Number(z.y.toFixed(1)),
        radius: Number(z.radius.toFixed(1)),
        impactIn: Number(z.impactIn.toFixed(2)),
        ttl: Number(z.ttl.toFixed(2)),
        triggered: z.triggered
      })),
      cards:
        this.mode === 'levelup'
          ? this.levelupOptions.map((opt) => ({ label: opt.label, kind: opt.kind }))
          : this.mode === 'part_reward'
            ? this.partOffers.map((o) => ({ title: o.title, branch: o.branch }))
            : this.mode === 'part_upgrade'
              ? this.partUpgradeOptions.map((o) => ({ title: o.title }))
              : []
    });
  }
}
