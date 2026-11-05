// Meta-progression and persistent player profile across runs

export interface Talents {
  vitality: number;     // 生命本源: +12 Max HP per level (max 5)
  predation: number;    // 吞噬杀意: +6% damage per level (max 5)
  absorption: number;   // 纳魂海眼: +15px soul absorption radius per level (max 5)
  swiftness: number;    // 踏云疾风: -0.3s dash cooldown & +6% move speed per level (max 5)
  regeneration: number; // 磐石生机: 每 3 秒自动回复 1 点生命 per level (max 3)
}

export interface MetaProfile {
  primalSouls: number;
  totalSoulsDevoured: number;
  runsPlayed: number;
  runsVictories: number;
  unlockedParts: string[];
  bestiaryUnlocked: string[];
  talents: Talents;
}

const STORAGE_KEY = 'beast-evo-meta-profile';

const DEFAULT_PROFILE: MetaProfile = {
  primalSouls: 0,
  totalSoulsDevoured: 0,
  runsPlayed: 0,
  runsVictories: 0,
  unlockedParts: [],
  bestiaryUnlocked: ['spirit_bug', 'spirit_rat'],
  talents: {
    vitality: 0,
    predation: 0,
    absorption: 0,
    swiftness: 0,
    regeneration: 0
  }
};

export const TALENT_MAX_LEVELS: Record<keyof Talents, number> = {
  vitality: 5,
  predation: 5,
  absorption: 5,
  swiftness: 5,
  regeneration: 3
};

export const TALENT_BASE_COSTS: Record<keyof Talents, number[]> = {
  vitality: [30, 60, 120, 220, 380],
  predation: [40, 80, 160, 300, 500],
  absorption: [25, 50, 100, 180, 320],
  swiftness: [35, 75, 150, 280, 480],
  regeneration: [80, 180, 360]
};

export class MetaManager {
  public profile: MetaProfile;

  constructor() {
    this.profile = this.load();
    this.migrateLegacyUnlocks();
  }

  private load(): MetaProfile {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_PROFILE,
          ...parsed,
          talents: {
            ...DEFAULT_PROFILE.talents,
            ...(parsed.talents || {})
          },
          unlockedParts: Array.isArray(parsed.unlockedParts) ? parsed.unlockedParts : [],
          bestiaryUnlocked: Array.isArray(parsed.bestiaryUnlocked) ? parsed.bestiaryUnlocked : DEFAULT_PROFILE.bestiaryUnlocked
        };
      }
    } catch {}
    return { ...DEFAULT_PROFILE };
  }

  private migrateLegacyUnlocks() {
    try {
      const legacyRaw = localStorage.getItem('beast-evo-unlocks');
      if (legacyRaw) {
        const legacyParts = JSON.parse(legacyRaw);
        if (Array.isArray(legacyParts)) {
          for (const p of legacyParts) {
            if (!this.profile.unlockedParts.includes(p)) {
              this.profile.unlockedParts.push(p);
            }
          }
        }
      }
    } catch {}
  }

  public save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.profile));
      // Keep legacy key synced for backward compatibility
      localStorage.setItem('beast-evo-unlocks', JSON.stringify(this.profile.unlockedParts));
    } catch {}
  }

  public addPrimalSouls(amount: number) {
    if (amount > 0) {
      this.profile.primalSouls += amount;
      this.profile.totalSoulsDevoured += amount;
      this.save();
    }
  }

  public unlockCreature(creatureId: string) {
    if (!this.profile.bestiaryUnlocked.includes(creatureId)) {
      this.profile.bestiaryUnlocked.push(creatureId);
      this.save();
    }
  }

  public unlockPart(partId: string) {
    if (!this.profile.unlockedParts.includes(partId)) {
      this.profile.unlockedParts.push(partId);
      this.save();
    }
  }

  public getTalentCost(key: keyof Talents): number | null {
    const current = this.profile.talents[key] || 0;
    const max = TALENT_MAX_LEVELS[key];
    if (current >= max) return null; // already max level
    return TALENT_BASE_COSTS[key][current] ?? 100;
  }

  public upgradeTalent(key: keyof Talents): boolean {
    const cost = this.getTalentCost(key);
    if (cost === null || this.profile.primalSouls < cost) return false;

    this.profile.primalSouls -= cost;
    this.profile.talents[key] = (this.profile.talents[key] || 0) + 1;
    this.save();
    return true;
  }

  public resetTalents(): number {
    let refund = 0;
    const talentKeys: Array<keyof Talents> = ['vitality', 'predation', 'absorption', 'swiftness', 'regeneration'];
    for (const key of talentKeys) {
      const lvl = this.profile.talents[key] || 0;
      for (let i = 0; i < lvl; i++) {
        refund += TALENT_BASE_COSTS[key][i] ?? 0;
      }
      this.profile.talents[key] = 0;
    }
    this.profile.primalSouls += refund;
    this.save();
    return refund;
  }

  public recordRun(victory: boolean, soulsDevoured: number) {
    this.profile.runsPlayed += 1;
    if (victory) this.profile.runsVictories += 1;
    this.addPrimalSouls(soulsDevoured);
  }
}

export const meta = new MetaManager();
