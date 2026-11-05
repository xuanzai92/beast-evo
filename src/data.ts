import balanceData from '../data/balance.json';
import creaturesData from '../data/creatures.json';
import growthData from '../data/growth.json';
import partsData from '../data/parts.json';
import skillsData from '../data/skills.json';
import stagesData from '../data/stages.json';
import wavesData from '../data/waves.json';
import zhLocale from '../data/locales/zh-CN.json';
import enLocale from '../data/locales/en-US.json';

export const balance = balanceData;
export const creatures = creaturesData;
export const growth = growthData;
export const parts = partsData;
export const skills = skillsData;
export const stages = stagesData;
export const waves = wavesData;

function flatten(obj: Record<string, any>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      result[fullKey] = value;
    } else if (typeof value === 'object' && value !== null) {
      Object.assign(result, flatten(value, fullKey));
    }
  }
  return result;
}

const locales: Record<'zh' | 'en', Record<string, string>> = {
  zh: flatten(zhLocale as unknown as Record<string, any>),
  en: flatten(enLocale as unknown as Record<string, any>)
};

// Common UI Strings Dictionary
const uiStrings: Record<'zh' | 'en', Record<string, string>> = {
  zh: {
    game_title: '山海吞噬录',
    game_subtitle: '3D 全屏低模像素风 · 异兽吞噬进化',
    btn_start: '进入山海',
    btn_settings: '洪荒设置',
    btn_resume: '继续游戏',
    btn_restart: '重新开始',
    settings_title: '设置与调节',
    settings_lang: '界面语言 (Language)',
    settings_master: '主音量',
    settings_sfx: '音效开关',
    settings_bgm: '背景氛围音乐',
    settings_cam_sens: '镜头旋转灵敏度',
    settings_cam_invert: '视角 Y 轴反转',
    stage_label: '关卡',
    boss_label: 'BOSS 阶段',
    dash_label: '冲刺',
    branch_primary: '主:',
    branch_secondary: '副:',
    btn_talents: '洪荒本源',
    btn_bestiary: '异兽志',
    talents_title: '洪荒本源 · 根骨修行',
    talents_subtitle: '以历练积累之兽魂本源洗髓伐脉，永久增幅异兽初始身躯属性',
    talents_primal_souls: '本源兽魂',
    talents_upgrade_btn: '突破强化',
    talents_reset_btn: '散功洗炼 (全额返还)',
    talents_max: '已达极境 (MAX)',
    talent_vitality_name: '生命本源',
    talent_vitality_desc: '淬炼血肉，初始最大生命上限提升 (+12 HP / 级)',
    talent_predation_name: '吞噬杀意',
    talent_predation_desc: '磨砺利齿獠牙，所有攻击技能伤害提升 (+6% / 级)',
    talent_absorption_name: '纳魂海眼',
    talent_absorption_desc: '身化纳魂涡旋，兽魂吸纳范围永久扩大 (+15px / 级)',
    talent_swiftness_name: '踏云疾风',
    talent_swiftness_desc: '足踏祥云罡风，移速 +6% 且冲刺冷却缩减 0.3 秒 / 级',
    talent_regeneration_name: '磐石生机',
    talent_regeneration_desc: '夺天地造化，试炼中每隔 3 秒自动回复生命 (+1 HP / 级)',
    bestiary_title: '山海异兽志 · 万物图录',
    bestiary_subtitle: '披阅古籍典册，360° 审视大荒百兽神形与古史记载',
    bestiary_locked: '未遭遇 · 雾隐迷蒙',
    bestiary_locked_hint: '在山海历练中遭遇并战胜该异兽后方可查阅全貌',
    bestiary_source_label: '《山海经》古籍记载',
    bestiary_stats_label: '灵体战力属性',
    bestiary_danger_label: '危险评级',
    level_up_title: '洪荒觉醒 · 吞噬升级',
    level_up_sub: '从以下三项中选取一项神能进化 (按 1 / 2 / 3 选择)',
    part_offer_title: '神兽部位吞噬',
    part_offer_sub: '击败关底神兽，选择吞噬融合一处核心部位 (按 1 / 2 选择)',
    part_upgrade_title: '神兽部位强化',
    part_upgrade_sub: '为新吞噬的神躯部位选择特化强化方向 (按 1 / 2 选择)',
    victory_title: '洪荒成圣 · 通关大捷',
    defeat_title: '身死道消 · 战败',
    first_clear_badge: '🏆 首次通关解锁神物：穷奇之翼（已永久保存）',
    drag_preview_hint: '可拖拽 360° 旋转审视'
  },
  en: {
    game_title: 'Shanhai Devour: Beast Evo',
    game_subtitle: '3D Low-Poly Pixel Survivor & Devour Evolution',
    btn_start: 'Enter Shanhai',
    btn_settings: 'Settings',
    btn_resume: 'Resume Game',
    btn_restart: 'Restart Run',
    settings_title: 'Game Settings',
    settings_lang: 'Language',
    settings_master: 'Master Volume',
    settings_sfx: 'Sound FX',
    settings_bgm: 'Ambient BGM',
    settings_cam_sens: 'Camera Sensitivity',
    settings_cam_invert: 'Invert Pitch Y',
    stage_label: 'Stage',
    boss_label: 'BOSS PHASE',
    dash_label: 'Dash',
    branch_primary: 'Primary:',
    branch_secondary: 'Sub:',
    btn_talents: 'Talents',
    btn_bestiary: 'Bestiary',
    talents_title: 'Primal Source · Talents',
    talents_subtitle: 'Channel accumulated primal souls to permanently empower your base stats',
    talents_primal_souls: 'Primal Souls',
    talents_upgrade_btn: 'Upgrade',
    talents_reset_btn: 'Respec Talents (Refund All)',
    talents_max: 'MAXED OUT',
    talent_vitality_name: 'Vitality Source',
    talent_vitality_desc: 'Reinforces physical body, increasing base Max HP (+12 per lv)',
    talent_predation_name: 'Predatory Might',
    talent_predation_desc: 'Sharpens fangs and claws, boosting all skill damage (+6% per lv)',
    talent_absorption_name: 'Soul Vortex',
    talent_absorption_desc: 'Expands natural soul pickup radius (+15px per lv)',
    talent_swiftness_name: 'Cloud Strider',
    talent_swiftness_desc: 'Move speed +6% and dash cooldown -0.3s per lv',
    talent_regeneration_name: 'Stone Regeneration',
    talent_regeneration_desc: 'Passively regenerates HP every 3 seconds (+1 HP per lv)',
    bestiary_title: 'Classic of Mountains and Seas · Bestiary',
    bestiary_subtitle: 'Explore 3D models, mythological lore, and combat stats of ancient beasts',
    bestiary_locked: 'Undiscovered · Shrouded in Mist',
    bestiary_locked_hint: 'Encounter and defeat this beast during a run to unlock records',
    bestiary_source_label: 'Ancient Shanhaijing Records',
    bestiary_stats_label: 'Entity Combat Attributes',
    bestiary_danger_label: 'Threat Level',
    level_up_title: 'Primal Awakening · Level Up',
    level_up_sub: 'Choose an evolution power (Press 1 / 2 / 3)',
    part_offer_title: 'Devour Beast Body Part',
    part_offer_sub: 'Defeated boss! Devour one core body part (Press 1 / 2)',
    part_upgrade_title: 'Beast Part Specialization',
    part_upgrade_sub: 'Specialize your newly devoured part (Press 1 / 2)',
    victory_title: 'Ascension · Run Complete',
    defeat_title: 'Fallen in Battle · Defeated',
    first_clear_badge: '🏆 First Clear Unlock: Qiongqi Wing (Saved to Meta)',
    drag_preview_hint: 'Drag to inspect 360°'
  }
};

let currentLang: 'zh' | 'en' = (() => {
  try {
    const saved = localStorage.getItem('beast-evo-lang');
    if (saved === 'en' || saved === 'zh') return saved;
  } catch {}
  return 'zh';
})();

export function getLanguage(): 'zh' | 'en' {
  return currentLang;
}

export function setLanguage(lang: 'zh' | 'en') {
  currentLang = lang;
  try {
    localStorage.setItem('beast-evo-lang', lang);
  } catch {}
}

export const skillMap = new Map(skillsData.skills.map((s) => [s.id, s]));
export const creatureMap = new Map(creaturesData.creatures.map((c) => [c.id, c]));
export const partMap = new Map(partsData.parts.map((p) => [p.id, p]));
export const stageMap = new Map(stagesData.stages.map((s) => [s.id, s]));
export const waveMap = new Map(wavesData.waveSets.map((w) => [w.id, w]));

export function localize(key?: string, fallback = ''): string {
  if (!key) return fallback;
  const map = locales[currentLang] || locales.zh;
  return map[key] || locales.zh[key] || fallback;
}

export function t(key: string): string {
  const dict = uiStrings[currentLang] || uiStrings.zh;
  return dict[key] || uiStrings.zh[key] || key;
}

export interface BestiaryEntry {
  id: string;
  nameKey: string;
  aliasZh: string;
  aliasEn: string;
  source: string;
  quoteZh: string;
  quoteEn: string;
  loreZh: string;
  loreEn: string;
  element: 'devour' | 'flame' | 'thunder' | 'brute';
  dangerLevel: string;
}

export const bestiaryList: BestiaryEntry[] = [
  {
    id: 'spirit_bug',
    nameKey: 'creature.spirit_bug.name',
    aliasZh: '草木微灵',
    aliasEn: 'Spirit Bug',
    source: '《山海经·海外北经》',
    quoteZh: '寻木之阳，微虫吸灵，受阴阳初气而生，色翠如碧。',
    quoteEn: 'On the sunny slopes of Xunmu, tiny insects absorb spiritual vapor, born from primeval Yin and Yang.',
    loreZh: '大荒最基础的灵生昆虫，行动迟缓但数量繁多，蕴含微量初阶兽魂。',
    loreEn: 'The most primitive spirit insects of Shanhai. Slow-moving but numerous, carrying traces of primal soul.',
    element: 'devour',
    dangerLevel: '★☆☆☆☆'
  },
  {
    id: 'spirit_rat',
    nameKey: 'creature.spirit_rat.name',
    aliasZh: '掘穴灵兽',
    aliasEn: 'Spirit Rat',
    source: '《山海经·中山经》',
    quoteZh: '洞室之下，有鼠含灵，遁地如梭，嗅魂而聚。',
    quoteEn: 'Deep beneath subterranean caverns dwell swift rodents imbued with spiritual senses, burrowing through earth.',
    loreZh: '生性警惕的敏捷异兽，能感知危机并迅速遁逃，常以群体游击撕咬侵入者。',
    loreEn: 'Agile and skittish beasts that scurry underground, attacking in nimble packs.',
    element: 'brute',
    dangerLevel: '★☆☆☆☆'
  },
  {
    id: 'mountain_spirit',
    nameKey: 'creature.mountain_spirit.name',
    aliasZh: '木石精魅',
    aliasEn: 'Mountain Spirit',
    source: '《山海经·东山经》',
    quoteZh: '独木之岩，有精似人而赤裸，喜匿草木，掷石如矢。',
    quoteEn: 'Upon lonely precipices dwell human-like spirits among dense flora, flinging rocks swift as arrows.',
    loreZh: '草木与山石聚灵化形之妖物，体格雄健，性暴烈，喜以蛮力撞击目标。',
    loreEn: 'Nature spirits coalesced from ancient moss and crags, charging foes with brute force.',
    element: 'brute',
    dangerLevel: '★★☆☆☆'
  },
  {
    id: 'red_feather_bird',
    nameKey: 'creature.red_feather_bird.name',
    aliasZh: '烈焰凶禽',
    aliasEn: 'Red Feather Bird',
    source: '《山海经·南山经》',
    quoteZh: '丹穴之山，有鸟如鹞，赤羽烈燃，其鸣自呼，过境生焰。',
    quoteEn: 'On Mount Danxue dwells a bird like a hawk, fiery plumage blazing, trailing embers in flight.',
    loreZh: '赤焰附体的凶悍飞禽，移速极快，俯冲掠袭时常常伴随灼热烈风。',
    loreEn: 'Ferocious avian predators bathed in flame, dive-bombing prey at blistering speeds.',
    element: 'flame',
    dangerLevel: '★★☆☆☆'
  },
  {
    id: 'rock_beast',
    nameKey: 'creature.rock_beast.name',
    aliasZh: '重铠巨岩',
    aliasEn: 'Rock Beast',
    source: '《山海经·西山经》',
    quoteZh: '坚石化形，四足如柱，鳞介为甲，钝重难损。',
    quoteEn: 'Formed from obsidian and granite, its pillars tread the earth, heavily armored and unyielding.',
    loreZh: '大荒中的重装巨兽，外覆厚重玄岩重铠，生命力极其顽强，近战撞击威力惊人。',
    loreEn: 'Armored behemoths encrusted with solid basalt. Slow-moving but impervious to minor attacks.',
    element: 'brute',
    dangerLevel: '★★★☆☆'
  },
  {
    id: 'nine_tail_shadow',
    nameKey: 'creature.nine_tail_shadow.name',
    aliasZh: '青丘妖狐',
    aliasEn: 'Nine-Tail Shadow',
    source: '《山海经·南山经》',
    quoteZh: '青丘之山，有兽焉，其状如狐而九尾，其音如婴儿，能食人，食者不蛊。',
    quoteEn: 'On Qingqiu Mountain dwells a beast shaped like a fox with nine tails. Its cry is like an infant; it devours men.',
    loreZh: '青丘秘境的古老凶兽残影，九尾挥洒狐火，能于战场唤起大范围追踪妖炎与死线红区。',
    loreEn: 'An ancient phantom from Qingqiu. Conjures homing soul flames and sweeps devastating danger zones.',
    element: 'flame',
    dangerLevel: '★★★★☆'
  },
  {
    id: 'kui_spirit',
    nameKey: 'creature.kui_spirit.name',
    aliasZh: '雷泽神牛',
    aliasEn: 'Kui Spirit',
    source: '《山海经·大荒东经》',
    quoteZh: '流波山有兽，状如牛，苍身而无角，一足，出入水必风雨，光如日月，声如雷，名曰夔。',
    quoteEn: 'In Mount Liubo dwells a beast shaped like an ox, blue-skinned and one-legged. Its voice roars like thunder.',
    loreZh: '雷泽之渊的远古雷神之灵，独足震地，引动八荒落雷与连环震慑，能令靠近者瞬间麻痹。',
    loreEn: 'The primal storm deity of the Thunder Marshes. Commands celestial thunderbolts that chain and stun.',
    element: 'thunder',
    dangerLevel: '★★★★☆'
  },
  {
    id: 'qiongqi',
    nameKey: 'creature.qiongqi.name',
    aliasZh: '上古四凶',
    aliasEn: 'Qiongqi (Four Evils)',
    source: '《山海经·海内北经 / 西山经》',
    quoteZh: '穷奇状如虎，有翼，食人从首始。所食者皆忠良，知人言语，凶德昭著。',
    quoteEn: 'Qiongqi resembles a winged tiger, devouring people from the head down. A harbinger of primal catastrophe.',
    loreZh: '洪荒四凶之一，虎躯生双翼，性恶而残暴。扑杀震天动地，展翼即刮骨罡风，唯有至强吞噬者方可降伏。',
    loreEn: 'One of the legendary Four Perils of ancient China. A winged feline fiend of unparalleled malice.',
    element: 'devour',
    dangerLevel: '★★★★★'
  }
];

export const bestiaryMap = new Map(bestiaryList.map((b) => [b.id, b]));

