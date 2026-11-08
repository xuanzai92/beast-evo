import type { UpgradeOption, PartOffer, PartUpgradeOption, PlayerState, Enemy, BranchId, PartId } from './types';
import { localize, t, getLanguage, setLanguage, bestiaryList, bestiaryMap, creatureMap } from './data';
import { audio, AudioManager } from './audio';
import type { CameraController } from './camera';
import { MetaManager, Talents, TALENT_MAX_LEVELS } from './meta';

export class UIController {
  private root: HTMLElement;
  public hudContainer: HTMLDivElement;
  public modalContainer: HTMLDivElement;
  public radarLayer: HTMLDivElement;

  // Top HUD elements
  private hpFill: HTMLDivElement;
  private hpText: HTMLSpanElement;
  private expFill: HTMLDivElement;
  private expText: HTMLSpanElement;
  private stageText: HTMLDivElement;
  private soulsText: HTMLSpanElement;
  private branchBadges: HTMLDivElement;
  private bossBarContainer: HTMLDivElement;
  private bossBarFill: HTMLDivElement;
  private bossBarText: HTMLSpanElement;

  // Action buttons
  public onFullscreenToggle?: () => void;
  public onResetCamera?: () => void;
  public onRestartRun?: () => void;
  public onOpenSettings?: () => void;
  public onOpenTalents?: () => void;
  public onOpenBestiary?: () => void;

  // Selection callbacks
  public onSelectUpgrade?: (index: number) => void;
  public onSelectPart?: (index: number) => void;
  public onSelectPartUpgrade?: (index: number) => void;

  // Touch joystick callbacks
  public touchDirection = { x: 0, y: 0 };
  public isTouchMoving = false;
  public onTouchDash?: () => void;
  public onTouchCameraDrag?: (deltaX: number, deltaY: number) => void;

  // Touch Joystick elements
  private joystickZone: HTMLDivElement;
  private joystickBase: HTMLDivElement;
  private joystickKnob: HTMLDivElement;
  private dashButton: HTMLButtonElement;
  private dashCooldownOverlay: HTMLDivElement;
  private joystickPointerId: number | null = null;
  private cameraPointerId: number | null = null;
  private lastCameraX = 0;
  private lastCameraY = 0;

  constructor(root: HTMLElement) {
    this.root = root;

    // Create HUD layer
    this.hudContainer = document.createElement('div');
    this.hudContainer.id = 'hud-layer';
    this.hudContainer.className = 'hud-layer';
    this.root.appendChild(this.hudContainer);

    // Create Radar layer
    this.radarLayer = document.createElement('div');
    this.radarLayer.id = 'radar-layer';
    this.radarLayer.className = 'radar-layer';
    this.root.appendChild(this.radarLayer);

    // Create Modal layer
    this.modalContainer = document.createElement('div');
    this.modalContainer.id = 'modal-layer';
    this.modalContainer.className = 'modal-layer hidden';
    this.root.appendChild(this.modalContainer);

    // Build HUD Elements
    this.hudContainer.innerHTML = `
      <div class="hud-top-bar">
        <div class="hud-stat-group">
          <div class="bar-container hp-bar">
            <div class="bar-fill hp-fill" id="hp-fill"></div>
            <span class="bar-label" id="hp-text">100 / 100 HP</span>
          </div>
          <div class="bar-container exp-bar">
            <div class="bar-fill exp-fill" id="exp-fill"></div>
            <span class="bar-label" id="exp-text">Lv.1 EXP 0/100</span>
          </div>
        </div>

        <div class="hud-center-group">
          <div class="stage-info" id="stage-text">第 1/3 关 · 青丘之野</div>
          <div class="boss-bar-wrap hidden" id="boss-bar-wrap">
            <div class="boss-name" id="boss-name">九尾狐影</div>
            <div class="bar-container boss-bar">
              <div class="bar-fill boss-fill" id="boss-fill"></div>
              <span class="bar-label" id="boss-hp-text">650 / 650</span>
            </div>
          </div>
        </div>

        <div class="hud-meta-group">
          <div class="souls-counter">
            <span class="soul-icon">✦</span>
            <span id="souls-text">0</span>
          </div>
          <div class="top-buttons">
            <button class="icon-btn" id="btn-talents" title="${t('btn_talents')}">🌳</button>
            <button class="icon-btn" id="btn-bestiary" title="${t('btn_bestiary')}">📜</button>
            <button class="icon-btn" id="btn-settings" title="${t('btn_settings')} (Esc)">⚙️</button>
            <button class="icon-btn" id="btn-camera" title="回正镜头 (R)">🎥</button>
            <button class="icon-btn" id="btn-fullscreen" title="全屏切换 (F)">⛶</button>
          </div>
        </div>
      </div>

      <div class="hud-branches" id="hud-branches"></div>

      <!-- Mobile Touch Controls -->
      <div class="touch-controls">
        <div class="joystick-zone" id="joystick-zone">
          <div class="joystick-base" id="joystick-base">
            <div class="joystick-knob" id="joystick-knob"></div>
          </div>
        </div>
        <div class="camera-drag-zone" id="camera-drag-zone"></div>
        <div class="touch-actions">
          <button class="dash-btn" id="btn-dash">
            <span id="dash-label">${t('dash_label')}</span>
            <div class="dash-cooldown-overlay" id="dash-cd-overlay"></div>
          </button>
        </div>
      </div>
    `;

    // Cache elements
    this.hpFill = this.hudContainer.querySelector('#hp-fill')!;
    this.hpText = this.hudContainer.querySelector('#hp-text')!;
    this.expFill = this.hudContainer.querySelector('#exp-fill')!;
    this.expText = this.hudContainer.querySelector('#exp-text')!;
    this.stageText = this.hudContainer.querySelector('#stage-text')!;
    this.soulsText = this.hudContainer.querySelector('#souls-text')!;
    this.branchBadges = this.hudContainer.querySelector('#hud-branches')!;
    this.bossBarContainer = this.hudContainer.querySelector('#boss-bar-wrap')!;
    this.bossBarFill = this.hudContainer.querySelector('#boss-fill')!;
    this.bossBarText = this.hudContainer.querySelector('#boss-hp-text')!;

    this.joystickZone = this.hudContainer.querySelector('#joystick-zone')!;
    this.joystickBase = this.hudContainer.querySelector('#joystick-base')!;
    this.joystickKnob = this.hudContainer.querySelector('#joystick-knob')!;
    this.dashButton = this.hudContainer.querySelector('#btn-dash')!;
    this.dashCooldownOverlay = this.hudContainer.querySelector('#dash-cd-overlay')!;

    this.bindButtons();
    this.bindTouchControls();
  }

  private bindButtons() {
    this.hudContainer.querySelector('#btn-fullscreen')?.addEventListener('click', () => {
      audio.resume();
      this.onFullscreenToggle?.();
    });
    this.hudContainer.querySelector('#btn-camera')?.addEventListener('click', () => {
      audio.resume();
      this.onResetCamera?.();
    });
    this.hudContainer.querySelector('#btn-talents')?.addEventListener('click', () => {
      audio.resume();
      this.onOpenTalents?.();
    });
    this.hudContainer.querySelector('#btn-bestiary')?.addEventListener('click', () => {
      audio.resume();
      this.onOpenBestiary?.();
    });
    this.hudContainer.querySelector('#btn-settings')?.addEventListener('click', () => {
      audio.resume();
      this.onOpenSettings?.();
    });
    this.dashButton.addEventListener('pointerdown', (e) => {
      audio.resume();
      e.stopPropagation();
      this.onTouchDash?.();
    });
  }

  private bindTouchControls() {
    const maxRadius = 45;

    // Joystick Touch
    this.joystickZone.addEventListener('pointerdown', (e) => {
      audio.resume();
      e.preventDefault();
      this.joystickPointerId = e.pointerId;
      this.isTouchMoving = true;
      const rect = this.joystickBase.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      this.updateJoystick(e.clientX, e.clientY, centerX, centerY, maxRadius);
    });

    window.addEventListener('pointermove', (e) => {
      if (this.joystickPointerId === e.pointerId) {
        const rect = this.joystickBase.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        this.updateJoystick(e.clientX, e.clientY, centerX, centerY, maxRadius);
      } else if (this.cameraPointerId === e.pointerId) {
        const dx = e.clientX - this.lastCameraX;
        const dy = e.clientY - this.lastCameraY;
        this.lastCameraX = e.clientX;
        this.lastCameraY = e.clientY;
        this.onTouchCameraDrag?.(dx * 0.008, dy * 0.008);
      }
    });

    const resetJoystick = (e: PointerEvent) => {
      if (this.joystickPointerId === e.pointerId) {
        this.joystickPointerId = null;
        this.isTouchMoving = false;
        this.touchDirection = { x: 0, y: 0 };
        this.joystickKnob.style.transform = `translate(0px, 0px)`;
      }
      if (this.cameraPointerId === e.pointerId) {
        this.cameraPointerId = null;
      }
    };

    window.addEventListener('pointerup', resetJoystick);
    window.addEventListener('pointercancel', resetJoystick);

    // Camera Drag Touch Pad
    const cameraPad = this.hudContainer.querySelector('#camera-drag-zone')!;
    cameraPad.addEventListener('pointerdown', (e: any) => {
      audio.resume();
      if (this.cameraPointerId !== null) return;
      this.cameraPointerId = e.pointerId;
      this.lastCameraX = e.clientX;
      this.lastCameraY = e.clientY;
    });
  }

  private updateJoystick(clientX: number, clientY: number, centerX: number, centerY: number, maxRadius: number) {
    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);

    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }

    this.joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    if (dist > 8) {
      this.touchDirection = { x: dx / maxRadius, y: dy / maxRadius };
    } else {
      this.touchDirection = { x: 0, y: 0 };
    }
  }

  // --- HUD UPDATES ---
  public updateHUD(
    player: PlayerState,
    stageName: string,
    stageIndex: number,
    stageElapsed: number,
    normalDuration: number,
    boss: Enemy | null,
    dashCooldownRemaining: number,
    dashCooldownTotal: number,
    primaryBranch: BranchId | null,
    secondaryBranch: BranchId | null,
    activeSynergies: string[],
    parts: Record<string, PartId | undefined>
  ) {
    // HP
    const hpRatio = Math.max(0, Math.min(1, player.hp / player.maxHp));
    this.hpFill.style.width = `${hpRatio * 100}%`;
    this.hpText.textContent = `${Math.ceil(player.hp)} / ${Math.ceil(player.maxHp)} HP`;

    // EXP
    const expRatio = Math.max(0, Math.min(1, player.xp / player.nextXp));
    this.expFill.style.width = `${expRatio * 100}%`;
    this.expText.textContent = `Lv.${player.level} EXP ${Math.floor(player.xp)}/${player.nextXp}`;

    // Stage & Souls
    const timeLeft = Math.max(0, normalDuration - Math.floor(stageElapsed));
    const stagePrefix = `${t('stage_label')} ${stageIndex + 1}/3 · ${stageName}`;
    this.stageText.textContent = `${stagePrefix} · ${boss ? t('boss_label') : `${timeLeft}s`}`;
    this.soulsText.textContent = `${player.soulsCollected}`;

    // Boss Bar
    if (boss) {
      this.bossBarContainer.classList.remove('hidden');
      const bossRatio = Math.max(0, Math.min(1, boss.health / boss.maxHealth));
      this.bossBarFill.style.width = `${bossRatio * 100}%`;
      this.bossBarText.textContent = `${Math.ceil(boss.health)} / ${boss.maxHealth}`;
    } else {
      this.bossBarContainer.classList.add('hidden');
    }

    // Dash Cooldown
    if (dashCooldownRemaining > 0) {
      const cdRatio = Math.max(0, Math.min(1, dashCooldownRemaining / dashCooldownTotal));
      this.dashCooldownOverlay.style.height = `${cdRatio * 100}%`;
    } else {
      this.dashCooldownOverlay.style.height = '0%';
    }

    // Branch Badges
    const branchNames: string[] = [];
    if (primaryBranch) branchNames.push(`${t('branch_primary')}${localize('branch.' + primaryBranch + '.name', primaryBranch)}`);
    if (secondaryBranch) branchNames.push(`${t('branch_secondary')}${localize('branch.' + secondaryBranch + '.name', secondaryBranch)}`);
    const partBadges = Object.values(parts).filter(Boolean).map((p) => localize('part.' + p + '.name', p!));

    const dashLbl = this.dashButton.querySelector('#dash-label');
    if (dashLbl) dashLbl.textContent = t('dash_label');

    this.branchBadges.innerHTML = `
      ${branchNames.map((b) => `<span class="badge branch-badge">${b}</span>`).join('')}
      ${activeSynergies.map((s) => `<span class="badge synergy-badge">⚡ ${localize('synergy.' + s + '.name', s)}</span>`).join('')}
      ${partBadges.map((p) => `<span class="badge part-badge">🦴 ${p}</span>`).join('')}
    `;
  }

  // --- RADAR / OFF-SCREEN INDICATORS ---
  public updateRadar(
    indicators: Array<{
      id: string;
      label: string;
      x: number;
      y: number;
      angleRad: number;
      distance: number;
      kind: 'boss' | 'elite';
    }>
  ) {
    if (indicators.length === 0) {
      this.radarLayer.innerHTML = '';
      return;
    }
    this.radarLayer.innerHTML = indicators
      .map(
        (ind) => `
        <div class="radar-indicator ${ind.kind}-radar" style="left: ${ind.x}px; top: ${ind.y}px;">
          <span class="radar-arrow" style="transform: rotate(${ind.angleRad}rad);">➤</span>
          <span class="radar-label">${ind.kind === 'boss' ? '👹' : '💀'} ${ind.label} ${Math.round(ind.distance)}m</span>
        </div>
      `
      )
      .join('');
  }

  // --- TITLE SCREEN MODAL ---
  public showTitleModal(
    onStart: () => void,
    onOpenSettings: () => void,
    onOpenTalents: () => void,
    onOpenBestiary: () => void,
    metaUnlocks: string[]
  ) {
    this.modalContainer.classList.remove('hidden');
    const hasQiongqiWing = metaUnlocks.includes('qiongqi_wing');

    this.modalContainer.innerHTML = `
      <div class="modal-card title-card">
        <div class="title-logo-icon">🐉</div>
        <h1 class="title-main-logo">${t('game_title')}</h1>
        <p class="title-tagline">${t('game_subtitle')}</p>

        ${
          hasQiongqiWing
            ? `<div class="meta-unlock-badge">${t('first_clear_badge')}</div>`
            : ''
        }

        <div class="title-buttons" style="display:flex; flex-direction:column; gap:10px; max-width:280px; margin:0 auto;">
          <button class="primary-btn title-start-btn" id="btn-title-start">${t('btn_start')}</button>
          <button class="secondary-btn" id="btn-title-talents">${t('btn_talents')}</button>
          <button class="secondary-btn" id="btn-title-bestiary">${t('btn_bestiary')}</button>
          <button class="secondary-btn title-settings-btn" id="btn-title-settings">${t('btn_settings')}</button>
        </div>
      </div>
    `;

    this.modalContainer.querySelector('#btn-title-start')?.addEventListener('click', () => {
      audio.resume();
      this.hideModal();
      onStart();
    });

    this.modalContainer.querySelector('#btn-title-talents')?.addEventListener('click', () => {
      audio.resume();
      onOpenTalents();
    });

    this.modalContainer.querySelector('#btn-title-bestiary')?.addEventListener('click', () => {
      audio.resume();
      onOpenBestiary();
    });

    this.modalContainer.querySelector('#btn-title-settings')?.addEventListener('click', () => {
      audio.resume();
      onOpenSettings();
    });
  }

  // --- TALENTS MODAL (洪荒本源) ---
  public showTalentsModal(metaManager: MetaManager, onClose: () => void) {
    this.modalContainer.classList.remove('hidden');

    const render = () => {
      const p = metaManager.profile;
      const talentKeys: Array<keyof Talents> = ['vitality', 'predation', 'absorption', 'swiftness', 'regeneration'];

      this.modalContainer.innerHTML = `
        <div class="modal-card talents-card">
          <div class="talents-header">
            <div>
              <h2 class="modal-title">${t('talents_title')}</h2>
              <p class="modal-subtitle">${t('talents_subtitle')}</p>
            </div>
            <div class="primal-souls-badge">
              <span class="soul-icon">✦</span>
              <span class="souls-num">${p.primalSouls}</span>
              <span class="souls-lbl">${t('talents_primal_souls')}</span>
            </div>
          </div>

          <div class="talents-list">
            ${talentKeys.map((key) => {
              const currentLvl = p.talents[key] || 0;
              const maxLvl = TALENT_MAX_LEVELS[key];
              const cost = metaManager.getTalentCost(key);
              const isMax = currentLvl >= maxLvl;
              const canAfford = !isMax && cost !== null && p.primalSouls >= cost;
              const icon = key === 'vitality' ? '❤️' : key === 'predation' ? '⚔️' : key === 'absorption' ? '🌀' : key === 'swiftness' ? '🌪️' : '🌿';

              return `
                <div class="talent-row">
                  <div class="talent-icon">${icon}</div>
                  <div class="talent-info">
                    <div class="talent-name-wrap">
                      <span class="talent-name">${t(`talent_${key}_name`)}</span>
                      <span class="talent-lvl">Lv.${currentLvl} / ${maxLvl}</span>
                    </div>
                    <div class="talent-desc">${t(`talent_${key}_desc`)}</div>
                    <div class="talent-progress-bar">
                      <div class="talent-progress-fill" style="width: ${(currentLvl / maxLvl) * 100}%;"></div>
                    </div>
                  </div>
                  <div class="talent-action">
                    ${isMax 
                      ? `<button class="talent-btn max-btn" disabled>${t('talents_max')}</button>`
                      : `<button class="talent-btn upgrade-btn ${canAfford ? '' : 'disabled'}" data-key="${key}" ${canAfford ? '' : 'disabled'}>
                          ${t('talents_upgrade_btn')}<br/><small>✦ ${cost}</small>
                        </button>`
                    }
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <div class="talents-footer" style="display:flex; justify-content:space-between; gap:12px; align-items:center;">
            <button class="secondary-btn" id="btn-reset-talents" style="font-size:12px; padding:8px 14px; opacity:0.85;">${t('talents_reset_btn')}</button>
            <button class="primary-btn" id="btn-close-talents">${t('btn_resume')}</button>
          </div>
        </div>
      `;

      this.modalContainer.querySelector('#btn-reset-talents')?.addEventListener('click', () => {
        audio.playHit();
        metaManager.resetTalents();
        render();
      });

      this.modalContainer.querySelectorAll('.upgrade-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const key = (e.currentTarget as HTMLElement).dataset.key as keyof Talents;
          if (key && metaManager.upgradeTalent(key)) {
            audio.playLevelUp();
            render();
          }
        });
      });

      this.modalContainer.querySelector('#btn-close-talents')?.addEventListener('click', () => {
        audio.resume();
        this.hideModal();
        onClose();
      });
    };

    render();
  }

  // --- BESTIARY MODAL (山海异兽志) ---
  public showBestiaryModal(metaManager: MetaManager, onClose: () => void) {
    this.modalContainer.classList.remove('hidden');
    let selectedId = bestiaryList[0].id;

    const render = () => {

      const isZh = getLanguage() === 'zh';
      const selected = bestiaryMap.get(selectedId) || bestiaryList[0];
      const isUnlocked = metaManager.profile.bestiaryUnlocked.includes(selected.id);
      const creatureDef = creatureMap.get(selected.id);

      this.modalContainer.innerHTML = `
        <div class="modal-card bestiary-card">
          <div class="bestiary-header">
            <div>
              <h2 class="modal-title">${t('bestiary_title')}</h2>
              <p class="modal-subtitle">${t('bestiary_subtitle')}</p>
            </div>
            <button class="close-icon-btn" id="btn-close-bestiary-top">✕</button>
          </div>

          <div class="bestiary-body">
            <div class="bestiary-list">
              ${bestiaryList.map((entry) => {
                const unlocked = metaManager.profile.bestiaryUnlocked.includes(entry.id);
                const isSelected = entry.id === selectedId;
                const icon = entry.id === 'qiongqi' ? '🐯' : entry.id.includes('kui') ? '🐂' : entry.id.includes('nine_tail') ? '🦊' : entry.id.includes('rock') ? '🪨' : entry.id.includes('bird') ? '🦅' : entry.id.includes('mountain') ? '🗿' : entry.id.includes('rat') ? '🐀' : '🐛';

                return `
                  <div class="bestiary-list-item ${isSelected ? 'active' : ''} ${unlocked ? '' : 'locked'}" data-id="${entry.id}">
                    <span class="bestiary-item-icon">${unlocked ? icon : '🔒'}</span>
                    <span class="bestiary-item-name">${unlocked ? (isZh ? entry.aliasZh : entry.aliasEn) : t('bestiary_locked')}</span>
                  </div>
                `;
              }).join('')}
            </div>

            <div class="bestiary-detail">
              ${isUnlocked ? `
                <div class="bestiary-preview-viewport generated-art-viewport">
                  <img
                    class="generated-art-image generated-character-image"
                    src="/assets/generated/characters/${selected.id}.png"
                    alt="${isZh ? selected.aliasZh : selected.aliasEn} 3D reference"
                    loading="lazy"
                  />
                </div>
                <div class="preview-hint">四视图 3D 美术参考</div>

                <div class="bestiary-info-block">
                  <div class="bestiary-name-row">
                    <h3 class="bestiary-name">${isZh ? selected.aliasZh : selected.aliasEn} · ${localize(selected.nameKey, selected.id)}</h3>
                    <span class="badge ${selected.element === 'flame' ? 'synergy-badge' : selected.element === 'thunder' ? 'part-badge' : 'branch-badge'}">
                      ${selected.dangerLevel}
                    </span>
                  </div>

                  <div class="bestiary-quote-card">
                    <div class="bestiary-source">${selected.source}</div>
                    <div class="bestiary-quote">“${isZh ? selected.quoteZh : selected.quoteEn}”</div>
                  </div>

                  <p class="bestiary-lore">${isZh ? selected.loreZh : selected.loreEn}</p>

                  ${creatureDef ? `
                    <div class="bestiary-stats-grid">
                      <div class="stat-pill"><strong>HP:</strong> ${creatureDef.stats.health}</div>
                      <div class="stat-pill"><strong>SPD:</strong> ${creatureDef.stats.moveSpeedPxPerSec}</div>
                      <div class="stat-pill"><strong>ATK:</strong> ${creatureDef.stats.contactDamage}</div>
                      <div class="stat-pill"><strong>SOUL:</strong> ${creatureDef.stats.soul}</div>
                    </div>
                  ` : ''}
                </div>
              ` : `
                <div class="bestiary-locked-view">
                  <div class="locked-silhouette">🔒</div>
                  <h3 class="locked-title">${t('bestiary_locked')}</h3>
                  <p class="locked-hint">${t('bestiary_locked_hint')}</p>
                </div>
              `}
            </div>
          </div>

          <div class="bestiary-footer">
            <button class="primary-btn" id="btn-close-bestiary">${t('btn_resume')}</button>
          </div>
        </div>
      `;

      this.modalContainer.querySelectorAll('.bestiary-list-item').forEach((item) => {
        item.addEventListener('click', (e) => {
          const id = (e.currentTarget as HTMLElement).dataset.id;
          if (id && id !== selectedId) {
            audio.resume();
            selectedId = id;
            render();
          }
        });
      });

      this.modalContainer.querySelector('#btn-close-bestiary')?.addEventListener('click', () => {
        audio.resume();
        this.hideModal();
        onClose();
      });
      this.modalContainer.querySelector('#btn-close-bestiary-top')?.addEventListener('click', () => {
        audio.resume();
        this.hideModal();
        onClose();
      });
    };

    render();
  }

  // --- SETTINGS MODAL ---
  public showSettingsModal(
    onResume: () => void,
    onRestart: () => void,
    onChangeLang: (lang: 'zh' | 'en') => void,
    cameraController: CameraController
  ) {
    this.modalContainer.classList.remove('hidden');
    const currentLang = getLanguage();

    this.modalContainer.innerHTML = `
      <div class="modal-card settings-card">
        <h2 class="modal-title">${t('settings_title')}</h2>
        
        <div class="settings-group">
          <label class="settings-label">${t('settings_lang')}</label>
          <div class="settings-lang-toggle">
            <button class="lang-btn ${currentLang === 'zh' ? 'active' : ''}" id="btn-lang-zh">中文 (简体)</button>
            <button class="lang-btn ${currentLang === 'en' ? 'active' : ''}" id="btn-lang-en">English</button>
          </div>
        </div>

        <div class="settings-group">
          <label class="settings-label">
            <span>${t('settings_master')}</span>
            <span id="label-master-vol">${Math.round(audio.masterVolume * 100)}%</span>
          </label>
          <input type="range" class="settings-slider" id="slider-master" min="0" max="100" value="${Math.round(audio.masterVolume * 100)}" />
        </div>

        <div class="settings-group settings-row">
          <label class="settings-label">${t('settings_sfx')}</label>
          <input type="checkbox" class="settings-checkbox" id="check-sfx" ${audio.sfxVolume > 0 ? 'checked' : ''} />
        </div>

        <div class="settings-group settings-row">
          <label class="settings-label">${t('settings_bgm')}</label>
          <input type="checkbox" class="settings-checkbox" id="check-bgm" ${audio.bgmVolume > 0 ? 'checked' : ''} />
        </div>

        <div class="settings-group">
          <label class="settings-label">
            <span>${t('settings_cam_sens')}</span>
            <span id="label-cam-sens">${cameraController.sensitivity.toFixed(1)}x</span>
          </label>
          <input type="range" class="settings-slider" id="slider-sens" min="5" max="25" value="${Math.round(cameraController.sensitivity * 10)}" />
        </div>

        <div class="settings-group settings-row">
          <label class="settings-label">${t('settings_cam_invert')}</label>
          <input type="checkbox" class="settings-checkbox" id="check-invert" ${cameraController.invertPitch ? 'checked' : ''} />
        </div>

        <div class="settings-actions">
          <button class="primary-btn" id="btn-resume-game">${t('btn_resume')} (Esc)</button>
          <button class="danger-btn" id="btn-restart-game">${t('btn_restart')}</button>
        </div>
      </div>
    `;

    // Bind Settings Events
    this.modalContainer.querySelector('#btn-lang-zh')?.addEventListener('click', () => {
      audio.resume();
      onChangeLang('zh');
    });
    this.modalContainer.querySelector('#btn-lang-en')?.addEventListener('click', () => {
      audio.resume();
      onChangeLang('en');
    });

    const masterSlider = this.modalContainer.querySelector('#slider-master') as HTMLInputElement;
    masterSlider?.addEventListener('input', (e: any) => {
      audio.masterVolume = Number(e.target.value) / 100;
      audio.saveSettings();
      const lbl = this.modalContainer.querySelector('#label-master-vol');
      if (lbl) lbl.textContent = `${e.target.value}%`;
    });

    const sfxCheck = this.modalContainer.querySelector('#check-sfx') as HTMLInputElement;
    sfxCheck?.addEventListener('change', (e: any) => {
      audio.sfxVolume = e.target.checked ? 0.8 : 0;
      audio.saveSettings();
    });

    const bgmCheck = this.modalContainer.querySelector('#check-bgm') as HTMLInputElement;
    bgmCheck?.addEventListener('change', (e: any) => {
      audio.bgmVolume = e.target.checked ? 0.4 : 0;
      audio.saveSettings();
    });

    const sensSlider = this.modalContainer.querySelector('#slider-sens') as HTMLInputElement;
    sensSlider?.addEventListener('input', (e: any) => {
      cameraController.sensitivity = Number(e.target.value) / 10;
      const lbl = this.modalContainer.querySelector('#label-cam-sens');
      if (lbl) lbl.textContent = `${cameraController.sensitivity.toFixed(1)}x`;
    });

    const invertCheck = this.modalContainer.querySelector('#check-invert') as HTMLInputElement;
    invertCheck?.addEventListener('change', (e: any) => {
      cameraController.invertPitch = e.target.checked;
    });

    this.modalContainer.querySelector('#btn-resume-game')?.addEventListener('click', () => {
      audio.resume();
      this.hideModal();
      onResume();
    });

    this.modalContainer.querySelector('#btn-restart-game')?.addEventListener('click', () => {
      audio.resume();
      this.hideModal();
      onRestart();
    });
  }

  // --- MODAL DIALOGS ---
  public showLevelUpModal(options: UpgradeOption[]) {
    this.modalContainer.classList.remove('hidden');
    this.modalContainer.innerHTML = `
      <div class="modal-card">
        <h2 class="modal-title">${t('level_up_title')}</h2>
        <p class="modal-subtitle">${t('level_up_sub')}</p>
        <div class="cards-grid">
          ${options
            .map(
              (opt, idx) => `
            <div class="select-card" data-index="${idx}">
              <div class="card-key">${idx + 1}</div>
              <div class="card-kind">${opt.kind === 'skill' ? '🌟 技能强化' : opt.kind === 'branch' ? '🧬 分支进化' : '💪 体质蜕变'}</div>
              <h3 class="card-title">${opt.label}</h3>
              <p class="card-desc">${opt.description}</p>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;

    this.modalContainer.querySelectorAll('.select-card').forEach((card) => {
      card.addEventListener('click', () => {
        audio.resume();
        const idx = Number(card.getAttribute('data-index'));
        this.hideModal();
        this.onSelectUpgrade?.(idx);
      });
    });
  }

  public showPartOfferModal(offers: PartOffer[]) {
    this.modalContainer.classList.remove('hidden');
    this.modalContainer.innerHTML = `
      <div class="modal-card">
        <h2 class="modal-title">${t('part_offer_title')}</h2>
        <p class="modal-subtitle">${t('part_offer_sub')}</p>
        <div class="cards-grid two-cards">
          ${offers
            .map(
              (offer, idx) => `
            <div class="select-card part-card" data-index="${idx}">
              <div class="card-key">${idx + 1}</div>
              <div class="card-kind">分支: ${localize('branch.' + offer.branch + '.name', offer.branch)}</div>
              <h3 class="card-title">${offer.title}</h3>
              <div class="part-preview-viewport generated-art-viewport">
                <img
                  class="generated-art-image generated-part-image"
                  src="/assets/generated/parts/${offer.id}.png"
                  alt="${offer.title} 3D reference"
                  loading="lazy"
                />
              </div>
              <div class="preview-hint">多视图部位参考</div>
              <p class="card-desc">${offer.effect}</p>
              ${offer.replacement ? `<div class="card-replace">${offer.replacement}</div>` : ''}
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;

    this.modalContainer.querySelectorAll('.select-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        if ((e.target as HTMLElement)?.closest('.part-preview-viewport')) return;
        audio.resume();
        const idx = Number(card.getAttribute('data-index'));
        this.hideModal();
        this.onSelectPart?.(idx);
      });
    });
  }

  public showPartUpgradeModal(choices: PartUpgradeOption[]) {
    this.modalContainer.classList.remove('hidden');
    this.modalContainer.innerHTML = `
      <div class="modal-card">
        <h2 class="modal-title">${t('part_upgrade_title')}</h2>
        <p class="modal-subtitle">${t('part_upgrade_sub')}</p>
        <div class="cards-grid two-cards">
          ${choices
            .map(
              (choice, idx) => `
            <div class="select-card upgrade-card" data-index="${idx}">
              <div class="card-key">${idx + 1}</div>
              <h3 class="card-title">${choice.title}</h3>
              <p class="card-desc">${choice.description}</p>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;

    this.modalContainer.querySelectorAll('.select-card').forEach((card) => {
      card.addEventListener('click', () => {
        audio.resume();
        const idx = Number(card.getAttribute('data-index'));
        this.hideModal();
        this.onSelectPartUpgrade?.(idx);
      });
    });
  }

  public showResultModal(
    isVictory: boolean,
    summaryText: string,
    isFirstClear: boolean,
    primalSoulsGained = 0,
    onOpenTalents?: () => void
  ) {
    this.modalContainer.classList.remove('hidden');
    this.modalContainer.innerHTML = `
      <div class="modal-card result-card">
        <h2 class="modal-title ${isVictory ? 'victory-title' : 'defeat-title'}">
          ${isVictory ? t('victory_title') : t('defeat_title')}
        </h2>
        <div class="result-summary">${summaryText}</div>
        
        ${
          primalSoulsGained > 0
            ? `<div class="primal-souls-badge" style="display:inline-flex; margin-bottom:14px;">
                <span class="soul-icon">✦</span>
                <span class="souls-num">+${primalSoulsGained}</span>
                <span class="souls-lbl">${t('talents_primal_souls')}</span>
              </div>`
            : ''
        }

        ${
          isFirstClear
            ? `<div class="meta-unlock-badge">${t('first_clear_badge')}</div>`
            : ''
        }
        <div class="result-actions" style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap; margin-top:10px;">
          <button class="primary-btn restart-btn" id="btn-restart">${t('btn_restart')} (按 R 键)</button>
          <button class="secondary-btn" id="btn-result-talents">${t('btn_talents')}</button>
        </div>
      </div>
    `;

    this.modalContainer.querySelector('#btn-restart')?.addEventListener('click', () => {
      audio.resume();
      this.hideModal();
      this.onRestartRun?.();
    });

    this.modalContainer.querySelector('#btn-result-talents')?.addEventListener('click', () => {
      audio.resume();
      onOpenTalents?.();
    });
  }

  public hideModal() {
    this.modalContainer.classList.add('hidden');
    this.modalContainer.innerHTML = '';
  }
}
