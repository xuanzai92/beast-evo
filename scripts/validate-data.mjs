import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'data');

function readJson(relativePath) {
  const filePath = path.join(root, relativePath);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error('Cannot read valid JSON from ' + relativePath + ': ' + error.message);
  }
}

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function uniqueIds(items, label) {
  const ids = new Set();
  for (const item of items) {
    assert(item && item.id, label + ' entry is missing id');
    assert(!ids.has(item.id), label + ' contains duplicate id: ' + item.id);
    ids.add(item.id);
  }
  return ids;
}

const balance = readJson('data/balance.json');
const creatures = readJson('data/creatures.json');
const skills = readJson('data/skills.json');
const parts = readJson('data/parts.json');
const growth = readJson('data/growth.json');
const stages = readJson('data/stages.json');
const waves = readJson('data/waves.json');

assert(balance.schemaVersion === 1, 'Unsupported balance schemaVersion');
assert(Array.isArray(balance.partSlots), 'balance.partSlots must be an array');

const creatureIds = uniqueIds(creatures.creatures, 'creatures');
const skillIds = uniqueIds(skills.skills, 'skills');
const partIds = uniqueIds(parts.parts, 'parts');
const stageIds = uniqueIds(stages.stages, 'stages');
const waveSetIds = uniqueIds(waves.waveSets, 'waveSets');
const branchIds = uniqueIds(growth.branches, 'branches');

const slotSet = new Set(balance.partSlots);
for (const part of parts.parts) {
  assert(slotSet.has(part.slot), 'part ' + part.id + ' uses unknown slot ' + part.slot);
  assert(branchIds.has(part.branch), 'part ' + part.id + ' uses unknown branch ' + part.branch);
  assert(creatureIds.has(part.bossId), 'part ' + part.id + ' references unknown boss ' + part.bossId);
  assert(Array.isArray(part.upgradeChoices) && part.upgradeChoices.length === 2,
    'part ' + part.id + ' must have exactly two upgrade choices');
  uniqueIds(part.upgradeChoices, 'part ' + part.id + ' upgrade choices');
}

for (const skill of skills.skills) {
  assert(Array.isArray(skill.stages) && skill.stages.length >= 1,
    'skill ' + skill.id + ' must have at least one stage');
  const stageNumbers = skill.stages.map((stage) => stage.stage);
  assert(new Set(stageNumbers).size === stageNumbers.length,
    'skill ' + skill.id + ' contains duplicate stage numbers');
  for (const stage of skill.stages) {
    assert(stage.stage >= 1, 'skill ' + skill.id + ' has invalid stage number');
    assert(stage.cooldownSec > 0, 'skill ' + skill.id + ' stage ' + stage.stage + ' has invalid cooldown');
  }
}

for (const branch of growth.branches) {
  assert(Array.isArray(branch.nodes) && branch.nodes.length === 2,
    'branch ' + branch.id + ' must have exactly two draft nodes');
  uniqueIds(branch.nodes, 'branch ' + branch.id + ' nodes');
}

for (const synergy of growth.synergies) {
  assert(Array.isArray(synergy.requiredBranches) && synergy.requiredBranches.length === 2,
    'synergy ' + synergy.id + ' must require two branches');
  for (const branchId of synergy.requiredBranches) {
    assert(branchIds.has(branchId), 'synergy ' + synergy.id + ' references unknown branch ' + branchId);
  }
}

for (const stage of stages.stages) {
  assert(waveSetIds.has(stage.waveSetId), 'stage ' + stage.id + ' references unknown wave set ' + stage.waveSetId);
  assert(creatureIds.has(stage.bossId), 'stage ' + stage.id + ' references unknown boss ' + stage.bossId);
  assert(stage.normalDurationSec > 0, 'stage ' + stage.id + ' has invalid normal duration');
  assert(stage.partOfferCount >= 0, 'stage ' + stage.id + ' has invalid part offer count');
}

for (const waveSet of waves.waveSets) {
  let previousEnd = 0;
  for (const wave of waveSet.waves) {
    assert(wave.startSec >= previousEnd, 'wave set ' + waveSet.id + ' has overlapping or reversed waves');
    assert(wave.endSec > wave.startSec, 'wave set ' + waveSet.id + ' has invalid wave window');
    assert(wave.spawnRatePerSec > 0, 'wave set ' + waveSet.id + ' has invalid spawn rate');
    assert(wave.maxAlive > 0, 'wave set ' + waveSet.id + ' has invalid maxAlive');
    assert(Array.isArray(wave.enemyPool) && wave.enemyPool.length > 0,
      'wave set ' + waveSet.id + ' has an empty enemy pool');
    for (const entry of wave.enemyPool) {
      assert(creatureIds.has(entry.creatureId),
        'wave set ' + waveSet.id + ' references unknown creature ' + entry.creatureId);
      assert(entry.weight > 0, 'wave set ' + waveSet.id + ' has non-positive weight');
    }
    previousEnd = wave.endSec;
  }
}

const requiredFiles = [
  'data/locales/zh-CN.json',
  'data/locales/en-US.json',
  'data/README.md'
];
for (const relativePath of requiredFiles) {
  assert(fs.existsSync(path.join(root, relativePath)), 'Missing required file: ' + relativePath);
}

console.log('Validated ' + dataDir);
console.log('creatures=' + creatureIds.size + ' skills=' + skillIds.size + ' parts=' + partIds.size + ' stages=' + stageIds.size + ' branches=' + branchIds.size);
