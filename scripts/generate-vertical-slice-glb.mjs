import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

// GLTFExporter uses FileReader for the final GLB Blob in browsers. Node 24 has
// Blob.arrayBuffer(), so this small adapter keeps the export reproducible
// without requiring Blender or another native modeling application.
class NodeFileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.();
    }).catch((error) => this.onerror?.(error));
  }
}

globalThis.FileReader ??= NodeFileReader;

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(projectRoot, 'public', 'assets', 'models', 'vertical-slice');
const reviewDir = path.join(projectRoot, 'output', 'assets', 'glb', 'vertical-slice');
fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(reviewDir, { recursive: true });

const palette = {
  ink: 0x171522,
  stone: 0x59616a,
  jade: 0x78e6c1,
  bronze: 0xb38a55,
  ivory: 0xe9d9bb,
  crimson: 0x9b3044,
  ember: 0xff5b29,
  violet: 0x6c3c9c,
  thunder: 0x5de9ff
};

function material(color, emissive = 0x000000, emissiveIntensity = 0) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity,
    roughness: 0.72,
    metalness: 0.08,
    flatShading: true
  });
}

function mesh(name, geometry, mat, position = [0, 0, 0], scale = [1, 1, 1]) {
  const value = new THREE.Mesh(geometry, mat);
  value.name = name;
  value.position.set(...position);
  value.scale.set(...scale);
  value.castShadow = true;
  value.receiveShadow = true;
  return value;
}

function socket(name, position, parent) {
  const value = new THREE.Object3D();
  value.name = name;
  value.position.set(...position);
  parent.add(value);
  return value;
}

function addCommonSockets(root) {
  socket('socket_head', [0, 1.7, 0.8], root);
  socket('socket_limb', [0, 0.45, 0.3], root);
  socket('socket_tail', [0, 1.1, -0.9], root);
  socket('socket_armor', [0, 1.05, 0], root);
}

function addCreatureAnimations(scene, rootName, bodyName = 'body') {
  const body = `${bodyName}.position[y]`;
  const headYaw = (angle) => new THREE.Quaternion().setFromEuler(new THREE.Euler(0, angle, 0));
  const bodyRoll = (angle) => new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, angle));
  const attackHeadRotations = [headYaw(0), headYaw(-0.28), headYaw(0)];
  const deathBodyRotations = [bodyRoll(0), bodyRoll(-Math.PI / 2)];
  const clips = [
    new THREE.AnimationClip('idle', 1.2, [
      new THREE.NumberKeyframeTrack(body, [0, 0.6, 1.2], [1, 1.08, 1])
    ]),
    new THREE.AnimationClip('run', 0.5, [
      new THREE.NumberKeyframeTrack(body, [0, 0.25, 0.5], [1, 1.18, 1])
    ]),
    new THREE.AnimationClip('attack', 0.45, [
      new THREE.QuaternionKeyframeTrack('head.quaternion', [0, 0.18, 0.45], attackHeadRotations.flatMap((value) => value.toArray()))
    ]),
    new THREE.AnimationClip('hit', 0.22, [
      new THREE.NumberKeyframeTrack('body.scale', [0, 0.08, 0.22], [1, 1, 1, 1.08, 0.92, 1.08, 1, 1, 1])
    ]),
    new THREE.AnimationClip('dash', 0.25, [
      new THREE.NumberKeyframeTrack('body.scale', [0, 0.12, 0.25], [1, 1, 1, 1.28, 0.72, 1.18, 1, 1, 1])
    ]),
    new THREE.AnimationClip('death', 0.7, [
      new THREE.QuaternionKeyframeTrack('body.quaternion', [0, 0.7], deathBodyRotations.flatMap((value) => value.toArray())),
      new THREE.NumberKeyframeTrack('body.position[y]', [0, 0.7], [1, 0.2])
    ])
  ];
  scene.userData.assetId = rootName;
  return clips;
}

function createTaotie() {
  const root = new THREE.Group();
  root.name = 'root';
  const body = mesh('body', new THREE.DodecahedronGeometry(0.95), material(palette.stone, palette.ink, 0.08), [0, 1, 0], [1.2, 0.92, 1.35]);
  root.add(body);
  root.add(mesh('head', new THREE.BoxGeometry(0.95, 0.78, 0.9), material(palette.ink), [0, 1.5, 0.72]));
  const eyeMat = material(palette.jade, palette.jade, 1.8);
  root.add(mesh('eye_l', new THREE.BoxGeometry(0.16, 0.1, 0.12), eyeMat, [0.28, 1.55, 1.15]));
  root.add(mesh('eye_r', new THREE.BoxGeometry(0.16, 0.1, 0.12), eyeMat, [-0.28, 1.55, 1.15]));
  const hornMat = material(palette.ink);
  const horns = new THREE.Group();
  horns.name = 'horns';
  horns.add(mesh('horn_l', new THREE.ConeGeometry(0.16, 0.72, 6), hornMat, [0.34, 1.94, 0.58], [1, 1, 1]));
  horns.add(mesh('horn_r', new THREE.ConeGeometry(0.16, 0.72, 6), hornMat, [-0.34, 1.94, 0.58], [1, 1, 1]));
  root.add(horns);
  const legMat = material(palette.bronze);
  for (const [index, position] of [[0, [0.58, 0.36, 0.46]], [1, [-0.58, 0.36, 0.46]], [2, [0.58, 0.36, -0.56]], [3, [-0.58, 0.36, -0.56]]]) {
    root.add(mesh(`leg_${index}`, new THREE.CylinderGeometry(0.2, 0.25, 0.72, 6), legMat, position));
  }
  addCommonSockets(root);
  return root;
}

function createNineTailBoss() {
  const root = new THREE.Group();
  root.name = 'root';
  const body = mesh('body', new THREE.DodecahedronGeometry(1.35), material(palette.crimson, palette.ember, 0.38), [0, 1.45, 0], [1.25, 1.05, 1.15]);
  root.add(body);
  root.add(mesh('head', new THREE.ConeGeometry(0.72, 1.15, 6), material(palette.crimson, palette.ember, 0.32), [0, 2.25, 0.62], [1, 0.9, 1]));
  const tailRoot = new THREE.Group();
  tailRoot.name = 'tails';
  const tailMat = material(palette.ember, palette.ember, 0.75);
  for (let i = 0; i < 9; i += 1) {
    const angle = ((i - 4) / 4) * 0.72;
    const tail = mesh(`tail_${String(i + 1).padStart(2, '0')}`, new THREE.ConeGeometry(0.3, 2.8, 6), tailMat, [Math.sin(angle) * 0.8, 1.75, -1.05]);
    tail.rotation.y = angle;
    tail.rotation.x = 0.58;
    tailRoot.add(tail);
  }
  root.add(tailRoot);
  addCommonSockets(root);
  return root;
}

function createKuiBoss() {
  const root = new THREE.Group();
  root.name = 'root';
  const bodyMat = material(palette.stone, palette.thunder, 0.22);
  const hornMat = material(palette.thunder, palette.thunder, 1.05);
  root.add(mesh('body', new THREE.CylinderGeometry(1.45, 1.9, 3.6, 7), bodyMat, [0, 1.8, 0]));
  root.add(mesh('head', new THREE.DodecahedronGeometry(0.78), bodyMat, [0, 3.55, 0.35], [1.05, 0.82, 1.1]));
  const horns = new THREE.Group();
  horns.name = 'horns';
  horns.add(mesh('horn_l', new THREE.ConeGeometry(0.32, 2.2, 6), hornMat, [0.42, 4.65, 0.28], [1, 1, 0.8]));
  horns.add(mesh('horn_r', new THREE.ConeGeometry(0.32, 2.2, 6), hornMat, [-0.42, 4.65, 0.28], [1, 1, 0.8]));
  root.add(horns);
  root.add(mesh('hoof', new THREE.CylinderGeometry(0.85, 1.1, 0.9, 7), bodyMat, [0, 0.45, 0.05]));
  addCommonSockets(root);
  return root;
}

function createQiongqiBoss() {
  const root = new THREE.Group();
  root.name = 'root';
  const bodyMat = material(palette.crimson, palette.violet, 0.32);
  const wingMat = material(palette.ember, palette.crimson, 0.52);
  root.add(mesh('body', new THREE.BoxGeometry(3.2, 2.8, 4.2), bodyMat, [0, 2.0, 0], [1, 1, 1]));
  root.add(mesh('head', new THREE.ConeGeometry(0.82, 1.25, 6), bodyMat, [0, 3.65, 1.25], [1.1, 0.9, 1]));
  const wings = new THREE.Group();
  wings.name = 'wings';
  for (const dir of [-1, 1]) {
    const wing = mesh(`wing_${dir < 0 ? 'l' : 'r'}`, new THREE.ConeGeometry(0.72, 3.6, 5), wingMat, [dir * 2.5, 3.1, 0], [1, 1, 0.3]);
    wing.rotation.z = dir * -0.72;
    wing.rotation.y = dir * 0.25;
    wings.add(wing);
  }
  root.add(wings);
  const tail = new THREE.Group();
  tail.name = 'tail';
  tail.add(mesh('tail_blade', new THREE.ConeGeometry(0.45, 2.6, 5), wingMat, [0, 1.65, -2.4], [1, 1, 0.7]));
  root.add(tail);
  addCommonSockets(root);
  return root;
}

function tintModel(root, color, scale = 1) {
  root.scale.setScalar(scale);
  root.traverse((node) => {
    const value = node;
    if (!value.isMesh) return;
    const materials = Array.isArray(value.material) ? value.material : [value.material];
    for (const mat of materials) {
      if (mat?.color) mat.color.setHex(color);
    }
  });
  return root;
}

function createSpiritBug() {
  const root = new THREE.Group();
  root.name = 'root';
  const bodyMat = material(palette.jade, 0x123c2d, 0.25);
  const eyeMat = material(palette.ember, palette.ember, 1.2);
  root.add(mesh('body', new THREE.DodecahedronGeometry(0.58), bodyMat, [0, 0.82, 0], [1.2, 0.8, 1.35]));
  root.add(mesh('head', new THREE.SphereGeometry(0.42, 8, 5), bodyMat, [0, 1.3, 0.45]));
  root.add(mesh('eye_l', new THREE.BoxGeometry(0.09, 0.09, 0.08), eyeMat, [0.18, 1.35, 0.8]));
  root.add(mesh('eye_r', new THREE.BoxGeometry(0.09, 0.09, 0.08), eyeMat, [-0.18, 1.35, 0.8]));
  const wingMat = material(palette.ink);
  for (const dir of [-1, 1]) {
    root.add(mesh(`wing_${dir < 0 ? 'l' : 'r'}`, new THREE.ConeGeometry(0.18, 0.72, 4), wingMat, [dir * 0.48, 0.98, 0], [1, 0.65, 0.18]));
  }
  addCommonSockets(root);
  return root;
}

function createSpiritRat() {
  const root = new THREE.Group();
  root.name = 'root';
  const bodyMat = material(palette.violet, 0x241038, 0.3);
  const eyeMat = material(palette.ember, palette.ember, 1.5);
  root.add(mesh('body', new THREE.ConeGeometry(0.62, 1.55, 6), bodyMat, [0, 0.8, 0], [1, 0.72, 1.15]));
  root.add(mesh('head', new THREE.SphereGeometry(0.48, 8, 5), bodyMat, [0, 1.55, 0.55]));
  root.add(mesh('ear_l', new THREE.ConeGeometry(0.16, 0.38, 5), bodyMat, [0.28, 1.95, 0.45]));
  root.add(mesh('ear_r', new THREE.ConeGeometry(0.16, 0.38, 5), bodyMat, [-0.28, 1.95, 0.45]));
  root.add(mesh('eye_l', new THREE.SphereGeometry(0.09, 6, 4), eyeMat, [0.2, 1.58, 0.95]));
  root.add(mesh('eye_r', new THREE.SphereGeometry(0.09, 6, 4), eyeMat, [-0.2, 1.58, 0.95]));
  const tail = mesh('tail', new THREE.CylinderGeometry(0.06, 0.12, 1.4, 5), bodyMat, [0, 0.72, -1.0]);
  tail.rotation.x = -0.5;
  root.add(tail);
  addCommonSockets(root);
  return root;
}

function createMountainSpirit() {
  const root = new THREE.Group();
  root.name = 'root';
  const stoneMat = material(palette.stone, 0x101820, 0.12);
  const mossMat = material(palette.jade, 0x123c2d, 0.18);
  root.add(mesh('body', new THREE.BoxGeometry(1.25, 1.55, 1.05), stoneMat, [0, 1.1, 0], [1, 1, 0.9]));
  root.add(mesh('head', new THREE.DodecahedronGeometry(0.55), mossMat, [0, 2.05, 0.05]));
  for (const dir of [-1, 1]) {
    root.add(mesh(`arm_${dir < 0 ? 'l' : 'r'}`, new THREE.BoxGeometry(0.38, 1.05, 0.42), stoneMat, [dir * 0.88, 1.0, 0]));
  }
  root.add(mesh('shoulder_l', new THREE.DodecahedronGeometry(0.32), mossMat, [0.78, 1.65, 0]));
  root.add(mesh('shoulder_r', new THREE.DodecahedronGeometry(0.32), mossMat, [-0.78, 1.65, 0]));
  addCommonSockets(root);
  return root;
}

function createRedFeatherBird() {
  const root = new THREE.Group();
  root.name = 'root';
  const bodyMat = material(palette.crimson, 0x4c101d, 0.38);
  const wingMat = material(palette.ember, palette.ember, 0.5);
  const beakMat = material(palette.ivory);
  root.add(mesh('body', new THREE.TetrahedronGeometry(0.82), bodyMat, [0, 1.15, 0], [1, 1.1, 1.35]));
  root.add(mesh('head', new THREE.SphereGeometry(0.42, 7, 5), bodyMat, [0, 1.85, 0.38]));
  for (const dir of [-1, 1]) {
    const wing = mesh(`wing_${dir < 0 ? 'l' : 'r'}`, new THREE.ConeGeometry(0.38, 1.45, 4), wingMat, [dir * 0.92, 1.32, -0.1], [1, 1, 0.22]);
    wing.rotation.z = dir * -0.35;
    root.add(wing);
  }
  const beak = mesh('beak', new THREE.ConeGeometry(0.16, 0.48, 4), beakMat, [0, 1.84, 0.82]);
  beak.rotation.x = Math.PI / 2;
  root.add(beak);
  addCommonSockets(root);
  return root;
}

function createRockBeast() {
  const root = new THREE.Group();
  root.name = 'root';
  const rockMat = material(palette.stone, palette.ink, 0.06);
  const armorMat = material(palette.bronze, 0x291709, 0.18);
  root.add(mesh('body', new THREE.DodecahedronGeometry(1.0), rockMat, [0, 1.05, 0], [1.35, 1, 1.2]));
  root.add(mesh('head', new THREE.BoxGeometry(0.72, 0.62, 0.75), armorMat, [0, 1.75, 0.58]));
  for (const [index, position] of [[0, [0.7, 0.38, 0.62]], [1, [-0.7, 0.38, 0.62]], [2, [0.7, 0.38, -0.62]], [3, [-0.7, 0.38, -0.62]]]) {
    root.add(mesh(`leg_${index}`, new THREE.CylinderGeometry(0.2, 0.3, 0.76, 6), armorMat, position));
  }
  addCommonSockets(root);
  return root;
}

const normalEnemyFactories = {
  spirit_bug: createSpiritBug,
  spirit_rat: createSpiritRat,
  mountain_spirit: createMountainSpirit,
  red_feather_bird: createRedFeatherBird,
  rock_beast: createRockBeast
};

function createEnemyVariant(id, baseId, color, scale) {
  return tintModel(normalEnemyFactories[baseId](), color, scale);
}

function createFoxMouth() {
  const root = new THREE.Group();
  root.name = 'fox_mouth';
  const jawMat = material(palette.violet, palette.violet, 0.55);
  root.add(mesh('upper_jaw', new THREE.ConeGeometry(0.38, 1.05, 6), jawMat, [0, 0.45, 0.25], [1, 1, 0.7]));
  root.add(mesh('lower_jaw', new THREE.BoxGeometry(0.8, 0.2, 0.55), jawMat, [0, -0.1, 0.35]));
  const fangMat = material(palette.ivory);
  for (const [index, x] of [-0.25, 0.25].entries()) {
    root.add(mesh(`fang_${index}`, new THREE.ConeGeometry(0.08, 0.34, 5), fangMat, [x, 0.15, 0.68]));
  }
  socket('socket_head', [0, 0, 0], root);
  return root;
}

function createNineTailPart() {
  const root = new THREE.Group();
  root.name = 'nine_tail';
  const tailMat = material(palette.crimson, palette.ember, 0.6);
  for (let i = 0; i < 9; i += 1) {
    const angle = ((i - 4) / 4) * 0.8;
    const tail = mesh(`tail_${String(i + 1).padStart(2, '0')}`, new THREE.ConeGeometry(0.12, 1.8, 5), tailMat, [Math.sin(angle) * 0.55, 0.9, 0]);
    tail.rotation.z = angle * 0.7;
    tail.rotation.x = -0.35;
    root.add(tail);
  }
  socket('socket_tail', [0, 0, 0], root);
  return root;
}

function createKuiHornPart() {
  const root = new THREE.Group();
  root.name = 'kui_horn';
  const hornMat = material(palette.thunder, palette.thunder, 1.15);
  root.add(mesh('horn', new THREE.ConeGeometry(0.3, 1.9, 6), hornMat, [0, 1.0, 0.1], [1, 1, 0.9]));
  root.add(mesh('charge', new THREE.TorusGeometry(0.38, 0.06, 6, 16), hornMat, [0, 0.72, 0.1], [1, 1, 1]));
  socket('socket_head', [0, 0, 0], root);
  return root;
}

function createKuiHoofPart() {
  const root = new THREE.Group();
  root.name = 'kui_hoof';
  const hoofMat = material(palette.bronze, palette.thunder, 0.35);
  root.add(mesh('hoof_l', new THREE.BoxGeometry(0.62, 0.28, 0.78), hoofMat, [-0.42, 0.16, 0]));
  root.add(mesh('hoof_r', new THREE.BoxGeometry(0.62, 0.28, 0.78), hoofMat, [0.42, 0.16, 0]));
  socket('socket_limb', [0, 0, 0], root);
  return root;
}

function createQiongqiWingPart() {
  const root = new THREE.Group();
  root.name = 'qiongqi_wing';
  const wingMat = material(palette.crimson, palette.ember, 0.45);
  for (const dir of [-1, 1]) {
    const wing = mesh(`wing_${dir < 0 ? 'l' : 'r'}`, new THREE.ConeGeometry(0.32, 2.2, 5), wingMat, [dir * 0.85, 1.1, 0], [1, 1, 0.25]);
    wing.rotation.z = dir * -0.62;
    root.add(wing);
  }
  socket('socket_limb', [0, 0, 0], root);
  return root;
}

function createQingqiuProps() {
  const root = new THREE.Group();
  root.name = 'qingqiu_stage_props';
  const stone = material(palette.stone);
  const jade = material(palette.jade, palette.jade, 1.1);
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2;
    const totem = new THREE.Group();
    totem.name = `totem_${String(i + 1).padStart(2, '0')}`;
    totem.position.set(Math.cos(angle) * 6, 0, Math.sin(angle) * 6);
    totem.add(mesh('base', new THREE.CylinderGeometry(0.55, 0.8, 2.2, 6), stone, [0, 1.1, 0]));
    totem.add(mesh('crystal', new THREE.OctahedronGeometry(0.42), jade, [0, 2.6, 0]));
    root.add(totem);
  }
  socket('socket_player_spawn', [0, 0, 0], root);
  return root;
}

const assets = [
  ['taotie', createTaotie(), true],
  ['nine_tail_shadow', createNineTailBoss(), true],
  ['kui_spirit', createKuiBoss(), true],
  ['qiongqi', createQiongqiBoss(), true],
  ['spirit_bug', createSpiritBug(), true],
  ['spirit_rat', createSpiritRat(), true],
  ['mountain_spirit', createMountainSpirit(), true],
  ['red_feather_bird', createRedFeatherBird(), true],
  ['rock_beast', createRockBeast(), true],
  ['reinforced_spirit_rat', createEnemyVariant('reinforced_spirit_rat', 'spirit_rat', palette.jade, 1.08), true],
  ['reinforced_mountain_spirit', createEnemyVariant('reinforced_mountain_spirit', 'mountain_spirit', palette.bronze, 1.08), true],
  ['corrupted_spirit_bug', createEnemyVariant('corrupted_spirit_bug', 'spirit_bug', palette.violet, 1.08), true],
  ['corrupted_red_feather_bird', createEnemyVariant('corrupted_red_feather_bird', 'red_feather_bird', palette.violet, 1.08), true],
  ['heavy_rock_beast', createEnemyVariant('heavy_rock_beast', 'rock_beast', palette.bronze, 1.18), true],
  ['elite_mountain_spirit', createEnemyVariant('elite_mountain_spirit', 'mountain_spirit', palette.ember, 1.2), true],
  ['elite_rock_beast', createEnemyVariant('elite_rock_beast', 'rock_beast', palette.crimson, 1.22), true],
  ['fox_mouth', createFoxMouth(), false],
  ['nine_tail', createNineTailPart(), false],
  ['kui_horn', createKuiHornPart(), false],
  ['kui_hoof', createKuiHoofPart(), false],
  ['qiongqi_wing', createQiongqiWingPart(), false],
  ['qingqiu_01', createQingqiuProps(), false]
];

async function exportAsset(id, root, animated) {
  const scene = new THREE.Scene();
  scene.name = `${id}_scene`;
  scene.add(root);
  const animations = animated ? addCreatureAnimations(scene, id) : [];
  const exporter = new GLTFExporter();
  const glb = await new Promise((resolve, reject) => {
    exporter.parse(scene, resolve, reject, {
      binary: true,
      onlyVisible: true,
      trs: true,
      animations
    });
  });
  const buffer = Buffer.from(glb);
  const publicPath = path.join(outputDir, `${id}.glb`);
  const reviewPath = path.join(reviewDir, `${id}.glb`);
  fs.writeFileSync(publicPath, buffer);
  fs.writeFileSync(reviewPath, buffer);
  return { id, publicPath: path.relative(projectRoot, publicPath), bytes: buffer.length, animations: animations.map((clip) => clip.name) };
}

const results = [];
for (const [id, root, animated] of assets) results.push(await exportAsset(id, root, animated));

const modelQuality = Object.fromEntries(results.map((item) => [item.id, {
  lods: ['base'],
  targetLods: ['base', 'combat'],
  materialProfile: 'pixel-low-poly-single-emissive',
  emissive: 'single-accent'
}]));

const manifest = {
  schemaVersion: 1,
  status: 'vertical-slice-glb',
  note: 'Procedural low-poly GLB vertical slice generated from the approved art direction. Replace with Blender-authored meshes when available.',
  models: Object.fromEntries(results.map((item) => [item.id, `/assets/models/vertical-slice/${item.id}.glb`])),
  animations: Object.fromEntries(results.filter((item) => item.animations.length).map((item) => [item.id, item.animations])),
  modelQuality
};
fs.writeFileSync(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(path.join(reviewDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

// Keep the generated art manifest as the single runtime lookup table. The
// model registry accepts a kind → id → path shape so the existing gameplay
// IDs remain stable while the asset storage can live outside the PNG folder.
const generatedManifestPath = path.join(projectRoot, 'public', 'assets', 'generated', 'manifest.json');
const generatedManifest = JSON.parse(fs.readFileSync(generatedManifestPath, 'utf8'));
generatedManifest.models = {
  characters: {
    ...Object.fromEntries(results
      .filter((item) => item.animations.length)
      .map((item) => [item.id, `/assets/models/vertical-slice/${item.id}.glb`])),
  },
  parts: {
    fox_mouth: '/assets/models/vertical-slice/fox_mouth.glb',
    nine_tail: '/assets/models/vertical-slice/nine_tail.glb',
    kui_horn: '/assets/models/vertical-slice/kui_horn.glb',
    kui_hoof: '/assets/models/vertical-slice/kui_hoof.glb',
    qiongqi_wing: '/assets/models/vertical-slice/qiongqi_wing.glb'
  },
  stages: {
    qingqiu_01: '/assets/models/vertical-slice/qingqiu_01.glb'
  }
};
generatedManifest.modelAnimations = manifest.animations;
generatedManifest.modelQuality = modelQuality;
generatedManifest.status = 'concept-reference-plus-glb-vertical-slice';
fs.writeFileSync(generatedManifestPath, `${JSON.stringify(generatedManifest, null, 2)}\n`);
console.log(JSON.stringify(results, null, 2));
