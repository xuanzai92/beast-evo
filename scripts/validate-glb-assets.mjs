import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const publicRoot = path.join(projectRoot, 'public');
const manifestPath = path.join(publicRoot, 'assets', 'generated', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const requiredModels = [
  ['characters', 'taotie', ['root', 'body', 'head', 'socket_head', 'socket_limb', 'socket_tail', 'socket_armor']],
  ['characters', 'nine_tail_shadow', ['root', 'body', 'head', 'tails', 'socket_head', 'socket_limb', 'socket_tail', 'socket_armor']],
  ['characters', 'kui_spirit', ['root', 'body', 'head', 'horns', 'socket_head', 'socket_limb', 'socket_tail', 'socket_armor']],
  ['characters', 'qiongqi', ['root', 'body', 'head', 'wings', 'socket_head', 'socket_limb', 'socket_tail', 'socket_armor']],
  ['characters', 'spirit_bug', ['root', 'body', 'head', 'socket_head', 'socket_limb', 'socket_tail', 'socket_armor']],
  ['characters', 'spirit_rat', ['root', 'body', 'head', 'socket_head', 'socket_limb', 'socket_tail', 'socket_armor']],
  ['characters', 'mountain_spirit', ['root', 'body', 'head', 'socket_head', 'socket_limb', 'socket_tail', 'socket_armor']],
  ['characters', 'red_feather_bird', ['root', 'body', 'head', 'socket_head', 'socket_limb', 'socket_tail', 'socket_armor']],
  ['characters', 'rock_beast', ['root', 'body', 'head', 'socket_head', 'socket_limb', 'socket_tail', 'socket_armor']],
  ['characters', 'reinforced_spirit_rat', ['root', 'body', 'head', 'socket_head', 'socket_limb', 'socket_tail', 'socket_armor']],
  ['characters', 'reinforced_mountain_spirit', ['root', 'body', 'head', 'socket_head', 'socket_limb', 'socket_tail', 'socket_armor']],
  ['characters', 'corrupted_spirit_bug', ['root', 'body', 'head', 'socket_head', 'socket_limb', 'socket_tail', 'socket_armor']],
  ['characters', 'corrupted_red_feather_bird', ['root', 'body', 'head', 'socket_head', 'socket_limb', 'socket_tail', 'socket_armor']],
  ['characters', 'heavy_rock_beast', ['root', 'body', 'head', 'socket_head', 'socket_limb', 'socket_tail', 'socket_armor']],
  ['characters', 'elite_mountain_spirit', ['root', 'body', 'head', 'socket_head', 'socket_limb', 'socket_tail', 'socket_armor']],
  ['characters', 'elite_rock_beast', ['root', 'body', 'head', 'socket_head', 'socket_limb', 'socket_tail', 'socket_armor']],
  ['parts', 'fox_mouth', ['socket_head']],
  ['parts', 'nine_tail', ['socket_tail']],
  ['parts', 'kui_horn', ['socket_head']],
  ['parts', 'kui_hoof', ['socket_limb']],
  ['parts', 'qiongqi_wing', ['socket_limb']],
  ['stages', 'qingqiu_01', ['socket_player_spawn']]
];

function resolvePublicPath(assetPath) {
  if (typeof assetPath !== 'string' || !assetPath.endsWith('.glb')) {
    throw new Error(`Invalid GLB manifest path: ${assetPath}`);
  }
  return path.join(publicRoot, assetPath.replace(/^\/+/, ''));
}

function parseGlb(filePath) {
  const data = fs.readFileSync(filePath);
  if (data.length < 20 || data.subarray(0, 4).toString('ascii') !== 'glTF') {
    throw new Error(`Invalid GLB header: ${filePath}`);
  }
  const version = data.readUInt32LE(4);
  const declaredLength = data.readUInt32LE(8);
  if (version !== 2 || declaredLength !== data.length) {
    throw new Error(`Invalid GLB version/length: ${filePath}`);
  }

  let offset = 12;
  let json = null;
  while (offset + 8 <= data.length) {
    const chunkLength = data.readUInt32LE(offset);
    const chunkType = data.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;
    if (chunkEnd > data.length) throw new Error(`Truncated GLB chunk: ${filePath}`);
    if (chunkType === 0x4e4f534a) {
      json = JSON.parse(data.subarray(chunkStart, chunkEnd).toString('utf8').trim());
    }
    offset = chunkEnd;
  }
  if (!json) throw new Error(`Missing GLB JSON chunk: ${filePath}`);
  return {
    nodes: new Set((json.nodes ?? []).map((node) => node.name).filter(Boolean)),
    animations: new Set((json.animations ?? []).map((animation) => animation.name).filter(Boolean))
  };
}

const results = [];
for (const [kind, id, requiredNodes] of requiredModels) {
  const relativePath = manifest.models?.[kind]?.[id];
  const filePath = resolvePublicPath(relativePath);
  const parsed = parseGlb(filePath);
  for (const node of requiredNodes) {
    if (!parsed.nodes.has(node)) throw new Error(`${kind}.${id} is missing node ${node}`);
  }
  if (kind === 'characters') {
    for (const animation of ['idle', 'run', 'attack', 'hit', 'dash', 'death']) {
      if (!parsed.animations.has(animation)) throw new Error(`${kind}.${id} is missing animation ${animation}`);
    }
  }
  const declaredAnimations = manifest.modelAnimations?.[id];
  if (declaredAnimations) {
    const declared = new Set(declaredAnimations);
    if (declared.size !== parsed.animations.size || [...declared].some((name) => !parsed.animations.has(name))) {
      throw new Error(`${kind}.${id} animation metadata does not match the GLB`);
    }
  }
  const quality = manifest.modelQuality?.[id];
  if (quality) {
    if (!quality.lods?.includes('base') || !quality.targetLods?.includes('combat') || quality.materialProfile !== 'pixel-low-poly-single-emissive') {
      throw new Error(`${kind}.${id} model quality metadata is incomplete`);
    }
  }
  results.push({ kind, id, bytes: fs.statSync(filePath).size, nodes: parsed.nodes.size, animations: parsed.animations.size });
}

console.log(`Validated GLB vertical slice: ${JSON.stringify(results)}`);
