import { balance, growth, parts as partsData, skillMap, partMap } from './data';
import type { Enemy, PlayerState, SkillState, SoulDrop, PartId, BranchId, Vec2 } from './types';

export class CombatManager {
  public dashHitEnemies = new Set<Enemy>();
  public lastBiteTime = 0;

  // Synergies and buffs
  public soulAttackSpeedWindow = 0;
  public soulShieldRemaining = 0;
  public nextFireDamageMultiplier = 1;

  public parts: Record<string, PartId | undefined> = {
    head: undefined,
    limb: undefined,
    tail: undefined,
    armor: undefined
  };
  public partUpgrades: Record<string, string | undefined> = {};
  public primaryBranch: BranchId | null = null;
  public secondaryBranch: BranchId | null = null;
  public branchNodes = new Set<string>();

  public getPartEffect(effectKey: string): number {
    let total = 0;
    for (const partId of Object.values(this.parts)) {
      if (!partId) continue;
      const part = partMap.get(partId);
      for (const effect of part?.baseEffects ?? []) {
        if (effect.effectKey === effectKey) total += effect.value;
      }
      for (const effects of Object.values(part?.branchEffects ?? {})) {
        for (const effect of effects) {
          if (effect.effectKey === effectKey) total += effect.value;
        }
      }
    }
    return total;
  }

  public getPartUpgradeEffect(effectKey: string): number {
    let total = 0;
    for (const [partId, upgradeId] of Object.entries(this.partUpgrades)) {
      if (!upgradeId) continue;
      const part = partMap.get(partId);
      const upgrade = part?.upgradeChoices.find((u) => u.id === upgradeId);
      if (upgrade && upgrade.effectKey === effectKey) total += upgrade.value;
    }
    return total;
  }

  public getGrowthEffect(effectKey: string): number {
    let total = 0;
    for (const branch of growth.branches) {
      if (branch.id !== this.primaryBranch && branch.id !== this.secondaryBranch) continue;
      for (const node of branch.nodes) {
        if (this.branchNodes.has(node.id) && effectKey in node) {
          total += (node as any)[effectKey] ?? 0;
        }
      }
    }
    return total;
  }

  public getActiveSynergies(): string[] {
    const active: string[] = [];
    for (const synergy of growth.synergies) {
      const branchesMatch = synergy.requiredBranches.every(
        (b) => b === this.primaryBranch || b === this.secondaryBranch
      );
      const nodesMatch = synergy.requiredNodes.every((n) => this.branchNodes.has(n));
      if (branchesMatch && nodesMatch) active.push(synergy.id);
    }
    return active;
  }

  public getSynergyEffect(effectKey: string): number {
    let total = 0;
    const activeSynergies = this.getActiveSynergies();
    for (const synergy of growth.synergies) {
      if (!activeSynergies.includes(synergy.id)) continue;
      for (const effect of synergy.baseEffects) {
        if (effect.effectKey === effectKey) total += effect.value;
      }
      const partEnhanced = Object.values(this.parts).some(Boolean);
      if (partEnhanced) {
        for (const effect of synergy.partEnhancedEffects ?? []) {
          if (effect.effectKey === effectKey) total += effect.value;
        }
      }
    }
    return total;
  }

  public getFireBonusDamage(): number {
    return this.getPartEffect('ember_damage_per_tick') * 1.5;
  }

  public getSoulAbsorbRadius(): number {
    return (
      balance.player.soulAbsorbRadiusPx *
      (this.getPartEffect('soul_absorb_radius_multiplier') || 1) *
      (this.getGrowthEffect('soulAbsorbRadiusMultiplier') || 1) +
      this.getSynergyEffect('soul_pull_radius_px')
    );
  }

  public getDashCooldownSec(): number {
    const bonus = this.getPartEffect('dash_cooldown_bonus_sec');
    return Math.max(2.5, balance.player.dashCooldownSec + bonus);
  }

  public getDashInvulnerableSec(): number {
    return (
      balance.player.dashInvulnerableSec +
      this.getPartEffect('dash_protection_sec') +
      this.getGrowthEffect('dashInvulnerableSec') +
      this.getPartUpgradeEffect('dash_armor_sec')
    );
  }

  public applyBurn(enemy: Enemy) {
    if (enemy.health <= 0) return;
    const chance = Math.min(1, this.getPartEffect('ember_chance') + this.getGrowthEffect('burnChance'));
    if (chance <= 0 || Math.random() > chance) return;
    enemy.burnRemaining = Math.max(
      enemy.burnRemaining,
      this.getPartEffect('ember_duration_sec') + this.getGrowthEffect('burnDurationSec')
    );
    enemy.burnDamagePerSec = Math.max(
      enemy.burnDamagePerSec,
      this.getPartEffect('ember_damage_per_tick') + this.getGrowthEffect('burnDamagePerSec')
    );
    enemy.burnTick = Math.min(enemy.burnTick, 0.5);
  }

  public applyThunderStun(enemy: Enemy) {
    const chance = Math.min(1, this.getPartEffect('thunder_stun_chance_bonus'));
    if (chance <= 0 || Math.random() > chance) return;
    enemy.stunRemaining = Math.max(
      enemy.stunRemaining,
      this.getPartEffect('horn_lightning_stun_duration_sec') +
        this.getPartUpgradeEffect('horn_lightning_stun_duration_sec') || 0.35
    );
  }

  public updateBurn(enemy: Enemy, dt: number, damageCallback: (target: Enemy, amount: number) => void) {
    if (enemy.burnRemaining <= 0 || enemy.health <= 0) return;
    enemy.burnRemaining = Math.max(0, enemy.burnRemaining - dt);
    enemy.burnTick -= dt;
    while (enemy.burnTick <= 0 && enemy.health > 0) {
      damageCallback(enemy, enemy.burnDamagePerSec * 0.5);
      enemy.burnTick += 0.5;
    }
  }
}
