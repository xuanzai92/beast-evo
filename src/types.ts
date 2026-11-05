export type Mode = 'title' | 'playing' | 'paused' | 'levelup' | 'part_reward' | 'part_upgrade' | 'victory' | 'defeat';

export type BranchId = 'devour' | 'brute' | 'flame';

export type SkillId = 'basic_bite' | 'devour_mouth' | 'nine_tail_fire' | 'kui_thunder';

export type PartId = 'fox_mouth' | 'nine_tail' | 'kui_horn' | 'kui_hoof' | 'qiongqi_wing';

export type SlotId = 'head' | 'limb' | 'tail' | 'horn' | 'wing';

export type Vec2 = { x: number; y: number };
export type Vec3 = { x: number; y: number; z: number };

export interface PlayerState {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  nextXp: number;
  facing: Vec2;
  speed: number;
  invulnerable: number;
  soulsCollected: number;
}

export interface Enemy {
  id: string;
  kind: 'normal' | 'elite' | 'boss';
  variant?: string;
  x: number;
  y: number;
  radius: number;
  health: number;
  maxHealth: number;
  speed: number;
  contactDamage: number;
  soul: number;
  damageCooldown: number;
  burnRemaining: number;
  burnTick: number;
  burnDamagePerSec: number;
  stunRemaining: number;
  behaviorKey?: string;
  phases?: Array<{ healthRatioBelow: number; behaviorKey: string }>;
  mesh?: any;
}

export interface SoulDrop {
  id: string;
  x: number;
  y: number;
  value: number;
  ttl: number;
  mesh?: any;
}

export interface DangerZone {
  id: string;
  x: number;
  y: number;
  radius: number;
  impactIn: number;
  ttl: number;
  damage: number;
  triggered: boolean;
  color: number;
  mesh?: any;
}

export interface Projectile {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetEnemyId?: string;
  damage: number;
  speed: number;
  ttl: number;
  splitCount?: number;
  burnDuration?: number;
  burnDps?: number;
  explosionRadius?: number;
  explosionDamage?: number;
  mesh?: any;
}

export interface SkillState {
  id: SkillId;
  stage: number;
  numericLevel: number;
  cooldown: number;
}

export interface UpgradeOption {
  id: string;
  label: string;
  description: string;
  kind: 'skill' | 'stat' | 'branch';
  skillId?: SkillId;
  branchId?: BranchId;
  nodeIndex?: number;
}

export interface PartOffer {
  id: PartId;
  branch: BranchId;
  title: string;
  effect: string;
  replacement?: string;
}

export interface PartUpgradeOption {
  id: string;
  partId: PartId;
  title: string;
  effectKey: string;
  value: number;
  description: string;
}
