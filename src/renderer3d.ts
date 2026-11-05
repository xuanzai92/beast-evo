import * as THREE from 'three';
import type { Enemy, SoulDrop, DangerZone, Projectile, PartId, Vec2 } from './types';

// Scale factor: maps 2D simulation pixels (width 360, height 640) into 3D world units
export const WORLD_SCALE = 0.085;
export const SIM_CENTER_X = 180;
export const SIM_CENTER_Y = 341;

export function simToWorld(simX: number, simY: number): THREE.Vector3 {
  return new THREE.Vector3(
    (simX - SIM_CENTER_X) * WORLD_SCALE,
    0,
    (simY - SIM_CENTER_Y) * WORLD_SCALE
  );
}

export class Renderer3D {
  public scene: THREE.Scene;
  public renderer: THREE.WebGLRenderer;
  private container: HTMLElement;

  // Lights
  private ambientLight: THREE.AmbientLight;
  private dirLight: THREE.DirectionalLight;
  private playerPointLight: THREE.PointLight;

  // Stage Environment
  private stageGroup: THREE.Group;
  private currentStageIndex = -1;

  // Entities
  public playerGroup: THREE.Group;
  private playerBodyMesh!: THREE.Mesh;
  private playerHeadMesh!: THREE.Mesh;
  private playerLegs: THREE.Mesh[] = [];
  private playerPartNodes = new Map<PartId, THREE.Object3D>();

  // Entity Meshes Maps
  private enemyMeshes = new Map<string, THREE.Group>();
  private soulMeshes = new Map<string, THREE.Group>();
  private dangerMeshes = new Map<string, THREE.Group>();
  private projectileMeshes = new Map<string, THREE.Group>();
  private vfxList: Array<{ group: THREE.Group; ttl: number; maxTtl: number; update?: (t: number) => void }> = [];

  constructor(container: HTMLElement) {
    this.container = container;
    this.scene = new THREE.Scene();

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    container.appendChild(this.renderer.domElement);

    // Initial Lighting
    this.ambientLight = new THREE.AmbientLight(0xdde3ea, 0.9);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xfff6e6, 1.6);
    this.dirLight.position.set(18, 30, 20);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 100;
    this.dirLight.shadow.camera.left = -25;
    this.dirLight.shadow.camera.right = 25;
    this.dirLight.shadow.camera.top = 25;
    this.dirLight.shadow.camera.bottom = -25;
    this.scene.add(this.dirLight);

    this.playerPointLight = new THREE.PointLight(0x73ffc7, 1.8, 12, 1.5);
    this.playerPointLight.position.set(0, 1.5, 0);
    this.scene.add(this.playerPointLight);

    this.stageGroup = new THREE.Group();
    this.scene.add(this.stageGroup);

    // Build Player 3D Mesh
    this.playerGroup = this.createPlayerModel();
    this.scene.add(this.playerGroup);

    this.setStage(0);
  }

  public resize(width: number, height: number) {
    this.renderer.setSize(width, height);
  }

  // --- STAGE ENVIRONMENT BUILDER ---
  public setStage(stageIndex: number) {
    if (this.currentStageIndex === stageIndex) return;
    this.currentStageIndex = stageIndex;

    // Clear old stage
    while (this.stageGroup.children.length > 0) {
      const child = this.stageGroup.children[0];
      this.stageGroup.remove(child);
      if ((child as any).geometry) (child as any).geometry.dispose();
    }

    if (stageIndex === 0) {
      // Stage 1: Qingqiu Wilderness (青丘之野) - Jade / Verdant / Mystic
      this.scene.fog = new THREE.FogExp2(0x131f1c, 0.022);
      this.renderer.setClearColor(0x131f1c, 1);
      this.ambientLight.color.setHex(0xb5e2d5);
      this.dirLight.color.setHex(0xfffae8);
      this.buildQingqiuStage();
    } else if (stageIndex === 1) {
      // Stage 2: Yanhuo Mountain (炎火山) - Volcanic / Obsidian / Magma
      this.scene.fog = new THREE.FogExp2(0x271410, 0.024);
      this.renderer.setClearColor(0x271410, 1);
      this.ambientLight.color.setHex(0xf5a57a);
      this.dirLight.color.setHex(0xff7744);
      this.buildYanhuoStage();
    } else {
      // Stage 3: Qiongqi Arena (穷奇竞技场) - Dark Celestial / Storm Purple
      this.scene.fog = new THREE.FogExp2(0x150f24, 0.02);
      this.renderer.setClearColor(0x150f24, 1);
      this.ambientLight.color.setHex(0xc9a4eb);
      this.dirLight.color.setHex(0xe85555);
      this.buildQiongqiStage();
    }
  }

  private buildQingqiuStage() {
    // Ground
    const groundGeo = new THREE.CylinderGeometry(28, 29, 2, 32);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x1d3a2d,
      roughness: 0.85,
      flatShading: true
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.y = -1;
    ground.receiveShadow = true;
    this.stageGroup.add(ground);

    // Decorative Spirit Totems & Stones
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x2e4a42, roughness: 0.9, flatShading: true });
    const gemMat = new THREE.MeshStandardMaterial({ color: 0x54e5b6, emissive: 0x228866, roughness: 0.3, flatShading: true });

    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2;
      const radius = 24 + (i % 3) * 1.5;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const totem = new THREE.Group();
      totem.position.set(x, 0, z);

      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 2.5 + (i % 2), 6), stoneMat);
      base.position.y = 1.25;
      base.castShadow = true;
      totem.add(base);

      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.45), gemMat);
      crystal.position.y = 2.9 + (i % 2);
      totem.add(crystal);

      this.stageGroup.add(totem);
    }
  }

  private buildYanhuoStage() {
    // Scorched Obsidian Ground
    const groundGeo = new THREE.CylinderGeometry(28, 29, 2, 32);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x241716,
      roughness: 0.8,
      flatShading: true
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.y = -1;
    ground.receiveShadow = true;
    this.stageGroup.add(ground);

    // Magma Fissures
    const magmaRing = new THREE.Mesh(
      new THREE.RingGeometry(14, 15.5, 32),
      new THREE.MeshBasicMaterial({ color: 0xff4810, side: THREE.DoubleSide })
    );
    magmaRing.rotation.x = -Math.PI / 2;
    magmaRing.position.y = 0.02;
    this.stageGroup.add(magmaRing);

    // Basalt Pillars
    const basaltMat = new THREE.MeshStandardMaterial({ color: 0x1f1816, roughness: 0.95, flatShading: true });
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const radius = 24.5;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.1, 4 + (i % 3) * 1.5, 6), basaltMat);
      pillar.position.set(x, 2, z);
      pillar.castShadow = true;
      this.stageGroup.add(pillar);
    }
  }

  private buildQiongqiStage() {
    // Altar Platform
    const groundGeo = new THREE.CylinderGeometry(28, 29, 2, 36);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x181528,
      roughness: 0.75,
      flatShading: true
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.y = -1;
    ground.receiveShadow = true;
    this.stageGroup.add(ground);

    // Inner Runic Inscription Ring
    const runicRing = new THREE.Mesh(
      new THREE.RingGeometry(8, 8.8, 36),
      new THREE.MeshBasicMaterial({ color: 0xaa3366, side: THREE.DoubleSide })
    );
    runicRing.rotation.x = -Math.PI / 2;
    runicRing.position.y = 0.02;
    this.stageGroup.add(runicRing);

    // Floating Orbiting Monoliths
    const obeliskMat = new THREE.MeshStandardMaterial({ color: 0x221a36, roughness: 0.6, flatShading: true });
    const runeGlowMat = new THREE.MeshStandardMaterial({ color: 0xff3b6f, emissive: 0xcc2050, roughness: 0.2 });

    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const radius = 25;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const monolith = new THREE.Group();
      monolith.position.set(x, 2.5, z);

      const stone = new THREE.Mesh(new THREE.ConeGeometry(0.8, 4.5, 5), obeliskMat);
      stone.rotation.x = Math.PI;
      stone.castShadow = true;
      monolith.add(stone);

      const rune = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 0.4), runeGlowMat);
      monolith.add(rune);

      this.stageGroup.add(monolith);
    }
  }

  // --- PLAYER 3D MODEL & PART ATTACHMENTS ---
  private createPlayerModel(): THREE.Group {
    const group = new THREE.Group();

    // Torso / Main Body (Taotie Cub: ferocious, low-poly mythical beast)
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xc84b60,
      roughness: 0.6,
      flatShading: true
    });
    const bodyGeo = new THREE.DodecahedronGeometry(0.95);
    this.playerBodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.playerBodyMesh.scale.set(1.1, 0.9, 1.3);
    this.playerBodyMesh.position.y = 1.0;
    this.playerBodyMesh.castShadow = true;
    group.add(this.playerBodyMesh);

    // Beast Head
    const headMat = new THREE.MeshStandardMaterial({
      color: 0x2d1726,
      roughness: 0.5,
      flatShading: true
    });
    const headGeo = new THREE.BoxGeometry(0.85, 0.75, 0.95);
    this.playerHeadMesh = new THREE.Mesh(headGeo, headMat);
    this.playerHeadMesh.position.set(0, 1.35, 0.75);
    this.playerHeadMesh.castShadow = true;
    group.add(this.playerHeadMesh);

    // Beast Glowing Eyes
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x4df2b2,
      emissive: 0x2ce89c,
      emissiveIntensity: 1.5,
      roughness: 0.2
    });
    const eyeGeo = new THREE.BoxGeometry(0.18, 0.12, 0.18);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(0.3, 1.45, 1.2);
    group.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(-0.3, 1.45, 1.2);
    group.add(rightEye);

    // Initial Horns
    const hornMat = new THREE.MeshStandardMaterial({ color: 0x56384d, roughness: 0.6, flatShading: true });
    const hornGeo = new THREE.ConeGeometry(0.14, 0.6, 5);

    const leftHorn = new THREE.Mesh(hornGeo, hornMat);
    leftHorn.position.set(0.35, 1.85, 0.6);
    leftHorn.rotation.set(-0.3, 0, 0.3);
    group.add(leftHorn);

    const rightHorn = new THREE.Mesh(hornGeo, hornMat);
    rightHorn.position.set(-0.35, 1.85, 0.6);
    rightHorn.rotation.set(-0.3, 0, -0.3);
    group.add(rightHorn);

    // 4 Beast Legs
    const legMat = new THREE.MeshStandardMaterial({ color: 0xa8384d, roughness: 0.7, flatShading: true });
    const legGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.65, 6);
    const legOffsets = [
      { x: 0.6, z: 0.5 },
      { x: -0.6, z: 0.5 },
      { x: 0.6, z: -0.6 },
      { x: -0.6, z: -0.6 }
    ];

    this.playerLegs = legOffsets.map((off) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(off.x, 0.35, off.z);
      leg.castShadow = true;
      group.add(leg);
      return leg;
    });

    return group;
  }

  // Attach / update modular parts on player
  public updatePlayerParts(parts: Record<string, PartId | undefined>) {
    // Remove existing part meshes
    for (const [partId, node] of this.playerPartNodes.entries()) {
      if (!Object.values(parts).includes(partId)) {
        this.playerGroup.remove(node);
        this.playerPartNodes.delete(partId);
      }
    }

    // Add newly equipped parts
    for (const partId of Object.values(parts)) {
      if (!partId || this.playerPartNodes.has(partId)) continue;

      const partNode = Renderer3D.createPartMesh(partId);
      if (partNode) {
        this.playerGroup.add(partNode);
        this.playerPartNodes.set(partId, partNode);
      }
    }
  }

  public static createPartMesh(partId: PartId): THREE.Object3D {
    const group = new THREE.Group();

    if (partId === 'fox_mouth') {
      // Fox Mouth: spectral spirit jaw with luminous fangs
      const mouthMat = new THREE.MeshStandardMaterial({
        color: 0x9c4eed,
        emissive: 0x6e26b8,
        emissiveIntensity: 0.8,
        roughness: 0.4,
        flatShading: true
      });
      const upperJaw = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 5), mouthMat);
      upperJaw.rotation.set(Math.PI / 2, 0, 0);
      upperJaw.position.set(0, 1.25, 1.55);
      group.add(upperJaw);

      // Fangs
      const fangMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
      for (const offset of [-0.2, 0.2]) {
        const fang = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.35, 4), fangMat);
        fang.position.set(offset, 1.1, 1.45);
        fang.rotation.x = Math.PI;
        group.add(fang);
      }
    } else if (partId === 'nine_tail') {
      // Nine Tail: 9 fanning flame tails waving behind
      const tailMat = new THREE.MeshStandardMaterial({
        color: 0xe85a3a,
        emissive: 0x992415,
        emissiveIntensity: 0.6,
        roughness: 0.5,
        flatShading: true
      });
      const tailTipMat = new THREE.MeshStandardMaterial({
        color: 0xffcc33,
        emissive: 0xff8811,
        emissiveIntensity: 1.2,
        roughness: 0.3
      });

      for (let i = -4; i <= 4; i++) {
        const spreadAngle = (i / 4) * 0.75;
        const tail = new THREE.Group();
        tail.position.set(0, 1.1, -0.8);
        tail.rotation.y = spreadAngle;
        tail.rotation.x = -0.35 + Math.abs(i) * 0.05;

        const tailBody = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.22, 1.4, 5), tailMat);
        tailBody.position.y = 0.7;
        tail.add(tailBody);

        const tailTip = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.6, 5), tailTipMat);
        tailTip.position.y = 1.6;
        tail.add(tailTip);

        group.add(tail);
      }
    } else if (partId === 'kui_horn') {
      // Kui Thunder Horn: towering crackling thunder horn
      const hornMat = new THREE.MeshStandardMaterial({
        color: 0x22ccff,
        emissive: 0x1188cc,
        emissiveIntensity: 1.3,
        roughness: 0.3,
        flatShading: true
      });
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.8, 6), hornMat);
      horn.position.set(0, 2.3, 0.85);
      horn.rotation.x = -0.25;
      group.add(horn);

      const thunderRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.35, 0.06, 6, 16),
        new THREE.MeshBasicMaterial({ color: 0x66eeff })
      );
      thunderRing.position.set(0, 2.0, 0.85);
      thunderRing.rotation.x = Math.PI / 2;
      group.add(thunderRing);
    } else if (partId === 'kui_hoof') {
      // Kui Hoof: heavy bronze thunder hooves with ground plates
      const hoofMat = new THREE.MeshStandardMaterial({
        color: 0xa66038,
        emissive: 0x552810,
        roughness: 0.4,
        metalness: 0.7,
        flatShading: true
      });
      for (const off of [{ x: 0.65, z: 0.5 }, { x: -0.65, z: 0.5 }, { x: 0.65, z: -0.6 }, { x: -0.65, z: -0.6 }]) {
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.46), hoofMat);
        plate.position.set(off.x, 0.12, off.z);
        group.add(plate);
      }
    } else if (partId === 'qiongqi_wing') {
      // Qiongqi Wing: pair of majestic crimson demonic wings
      const wingMat = new THREE.MeshStandardMaterial({
        color: 0xd93850,
        emissive: 0x881122,
        emissiveIntensity: 0.7,
        side: THREE.DoubleSide,
        flatShading: true
      });
      for (const dir of [1, -1]) {
        const wing = new THREE.Group();
        wing.position.set(dir * 0.7, 1.5, -0.2);
        wing.rotation.y = dir * 0.3;
        wing.rotation.z = dir * -0.4;

        const blade = new THREE.Mesh(new THREE.ConeGeometry(0.4, 2.2, 4), wingMat);
        blade.scale.set(1, 1, 0.15);
        blade.position.set(dir * 0.9, 0.9, 0);
        blade.rotation.z = dir * -0.7;
        wing.add(blade);

        group.add(wing);
      }
    }

    return group;
  }

  public static createBestiaryMesh(creatureId: string): THREE.Object3D {
    const group = new THREE.Group();

    if (creatureId === 'spirit_bug') {
      const bugMat = new THREE.MeshStandardMaterial({
        color: 0x44bb66,
        emissive: 0x116622,
        emissiveIntensity: 0.5,
        roughness: 0.4,
        flatShading: true
      });
      const body = new THREE.Mesh(new THREE.DodecahedronGeometry(0.85), bugMat);
      body.position.y = 0.9;
      group.add(body);

      // Antennae
      const antMat = new THREE.MeshBasicMaterial({ color: 0x99ffaa });
      for (const dir of [-0.25, 0.25]) {
        const ant = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.6, 4), antMat);
        ant.position.set(dir, 1.6, 0.45);
        ant.rotation.x = 0.4;
        ant.rotation.z = -dir * 0.8;
        group.add(ant);
      }
    } else if (creatureId === 'spirit_rat') {
      const ratMat = new THREE.MeshStandardMaterial({
        color: 0x8855bb,
        emissive: 0x331155,
        roughness: 0.5,
        flatShading: true
      });
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.65, 1.8, 5), ratMat);
      body.rotation.x = Math.PI / 2;
      body.position.set(0, 0.7, 0);
      group.add(body);

      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3355 });
      for (const dir of [-0.22, 0.22]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 4, 4), eyeMat);
        eye.position.set(dir, 0.85, 0.7);
        group.add(eye);
      }

      // Tail
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.1, 1.2, 4), ratMat);
      tail.position.set(0, 0.7, -1.2);
      tail.rotation.x = -0.5;
      group.add(tail);
    } else if (creatureId === 'mountain_spirit') {
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0x5a554a, roughness: 0.9, flatShading: true });
      const mossMat = new THREE.MeshStandardMaterial({ color: 0x4a7c59, roughness: 0.8, flatShading: true });

      const torso = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.6, 1.1), stoneMat);
      torso.position.y = 1.3;
      group.add(torso);

      const moss = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6), mossMat);
      moss.position.set(0, 2.2, 0);
      group.add(moss);

      for (const dir of [-0.9, 0.9]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.1, 0.45), stoneMat);
        arm.position.set(dir, 1.1, 0);
        group.add(arm);
      }
    } else if (creatureId === 'red_feather_bird') {
      const birdMat = new THREE.MeshStandardMaterial({
        color: 0xee3322,
        emissive: 0x881100,
        emissiveIntensity: 0.6,
        roughness: 0.4,
        flatShading: true
      });
      const wingMat = new THREE.MeshStandardMaterial({
        color: 0xff6622,
        emissive: 0xaa3300,
        side: THREE.DoubleSide,
        flatShading: true
      });

      const body = new THREE.Mesh(new THREE.TetrahedronGeometry(0.85), birdMat);
      body.position.y = 1.4;
      body.rotation.y = Math.PI / 4;
      group.add(body);

      for (const dir of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.8), wingMat);
        wing.position.set(dir * 1.0, 1.5, 0);
        wing.rotation.y = dir * 0.3;
        wing.rotation.z = dir * -0.2;
        group.add(wing);
      }

      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.5, 4), new THREE.MeshBasicMaterial({ color: 0xffcc00 }));
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, 1.4, 0.8);
      group.add(beak);
    } else if (creatureId === 'rock_beast') {
      const rockMat = new THREE.MeshStandardMaterial({ color: 0x48423d, roughness: 0.95, flatShading: true });
      const shell = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4), rockMat);
      shell.position.y = 1.2;
      group.add(shell);

      for (const off of [{ x: 0.9, z: 0.8 }, { x: -0.9, z: 0.8 }, { x: 0.9, z: -0.8 }, { x: -0.9, z: -0.8 }]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.9, 6), rockMat);
        leg.position.set(off.x, 0.45, off.z);
        group.add(leg);
      }
    } else if (creatureId === 'nine_tail_shadow') {
      const foxMat = new THREE.MeshStandardMaterial({
        color: 0xd95536,
        emissive: 0x882010,
        emissiveIntensity: 0.6,
        roughness: 0.4,
        flatShading: true
      });
      const tailMat = new THREE.MeshStandardMaterial({
        color: 0xff9922,
        emissive: 0xff4411,
        emissiveIntensity: 0.8,
        roughness: 0.3,
        flatShading: true
      });

      const body = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2), foxMat);
      body.position.y = 1.4;
      group.add(body);

      // Head with ears
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.1, 5), foxMat);
      head.rotation.x = Math.PI / 2;
      head.position.set(0, 1.6, 1.1);
      group.add(head);

      for (let i = 0; i < 9; i++) {
        const t = new THREE.Mesh(new THREE.ConeGeometry(0.24, 2.4, 5), tailMat);
        t.position.set(0, 1.4, -0.6);
        t.rotation.y = ((i - 4) / 4) * 0.9;
        t.rotation.x = -0.6 + Math.abs(i - 4) * 0.08;
        group.add(t);
      }
    } else if (creatureId === 'kui_spirit') {
      const titanMat = new THREE.MeshStandardMaterial({
        color: 0x2e7b9e,
        emissive: 0x113e54,
        roughness: 0.4,
        flatShading: true
      });
      const hornMat = new THREE.MeshStandardMaterial({
        color: 0x44ddff,
        emissive: 0x1199dd,
        emissiveIntensity: 1.2,
        roughness: 0.2
      });

      const body = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.4, 2.5, 7), titanMat);
      body.position.y = 1.8;
      group.add(body);

      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.42, 2.4, 6), hornMat);
      horn.position.set(0, 3.8, 0.3);
      group.add(horn);

      // Single colossal thunder foot
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 0.8, 7), titanMat);
      foot.position.y = 0.4;
      group.add(foot);
    } else if (creatureId === 'qiongqi') {
      const fiendMat = new THREE.MeshStandardMaterial({
        color: 0x6e1b24,
        emissive: 0x33060c,
        roughness: 0.5,
        flatShading: true
      });
      const wingMat = new THREE.MeshStandardMaterial({
        color: 0xdd2244,
        emissive: 0x770a1a,
        emissiveIntensity: 0.8,
        side: THREE.DoubleSide
      });

      const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.6, 2.6), fiendMat);
      body.position.y = 1.5;
      group.add(body);

      // Wings
      for (const dir of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6), wingMat);
        wing.position.set(dir * 1.8, 2.2, 0);
        wing.rotation.y = dir * 0.4;
        wing.rotation.z = dir * -0.3;
        group.add(wing);
      }

      // Fangs
      const fangMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      for (const dir of [-0.3, 0.3]) {
        const fang = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.4, 4), fangMat);
        fang.position.set(dir, 1.2, 1.4);
        fang.rotation.x = Math.PI;
        group.add(fang);
      }
    }

    return group;
  }

  // --- ENTITIES SYNCHRONIZATION ---
  public syncPlayer(
    x: number,
    y: number,
    facing: Vec2,
    isMoving: boolean,
    isDashing: boolean,
    dt: number,
    runTime: number
  ) {
    const worldPos = simToWorld(x, y);
    this.playerGroup.position.set(worldPos.x, worldPos.y, worldPos.z);
    this.playerPointLight.position.set(worldPos.x, worldPos.y + 1.2, worldPos.z);

    // Facing rotation in 3D (XZ plane)
    const angle = Math.atan2(facing.x, facing.y);
    this.playerGroup.rotation.y = angle;

    // Movement / Dash Animation
    if (isDashing) {
      this.playerGroup.scale.set(1.4, 0.6, 1.5);
    } else {
      this.playerGroup.scale.set(1, 1, 1);
      // Leg swing & body bobbing
      if (isMoving) {
        const step = Math.sin(runTime * 14) * 0.45;
        this.playerLegs[0].rotation.x = step;
        this.playerLegs[1].rotation.x = -step;
        this.playerLegs[2].rotation.x = -step;
        this.playerLegs[3].rotation.x = step;
        this.playerBodyMesh.position.y = 1.0 + Math.abs(Math.sin(runTime * 14)) * 0.12;
      } else {
        // Idle breathing
        this.playerBodyMesh.position.y = 1.0 + Math.sin(runTime * 3) * 0.05;
        for (const leg of this.playerLegs) leg.rotation.x = 0;
      }
    }
  }

  // Sync Enemies
  public syncEnemies(enemies: Enemy[]) {
    const aliveIds = new Set(enemies.map((e) => e.id));

    // Remove dead enemy meshes
    for (const [id, mesh] of this.enemyMeshes.entries()) {
      if (!aliveIds.has(id)) {
        this.scene.remove(mesh);
        this.enemyMeshes.delete(id);
      }
    }

    // Update or create meshes
    for (const enemy of enemies) {
      let group = this.enemyMeshes.get(enemy.id);
      if (!group) {
        group = this.createEnemyMesh(enemy);
        this.scene.add(group);
        this.enemyMeshes.set(enemy.id, group);
      }

      const worldPos = simToWorld(enemy.x, enemy.y);
      group.position.set(worldPos.x, worldPos.y, worldPos.z);

      // Hit / Burn / Stun visual feedback
      const mat = (group.userData.mainMesh as THREE.Mesh)?.material as THREE.MeshStandardMaterial;
      if (mat) {
        if (enemy.damageCooldown > 0) {
          mat.emissive.setHex(0xffffff);
          mat.emissiveIntensity = 0.8;
        } else if (enemy.burnRemaining > 0) {
          mat.emissive.setHex(0xff5511);
          mat.emissiveIntensity = 0.9;
        } else if (enemy.stunRemaining > 0) {
          mat.emissive.setHex(0x33ccff);
          mat.emissiveIntensity = 0.9;
        } else {
          mat.emissive.setHex(group.userData.originalEmissive || 0x000000);
          mat.emissiveIntensity = group.userData.originalEmissiveIntensity || 0;
        }
      }
    }
  }

  private createEnemyMesh(enemy: Enemy): THREE.Group {
    const group = new THREE.Group();
    const isBoss = enemy.kind === 'boss';
    const isElite = enemy.kind === 'elite';

    let mesh: THREE.Mesh;
    let mainColor = 0x8877aa;
    let emissiveColor = 0x000000;

    if (isBoss) {
      if (enemy.id.includes('nine_tail')) {
        // Boss 1: Nine Tail Fox Shadow
        mainColor = 0xd95536;
        emissiveColor = 0x882010;
        const geo = new THREE.DodecahedronGeometry(2.2);
        mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: mainColor, emissive: emissiveColor, roughness: 0.5, flatShading: true }));
        mesh.position.y = 2.2;
        group.add(mesh);

        // 9 tails on boss
        const tailMat = new THREE.MeshStandardMaterial({ color: 0xffaa22, emissive: 0xff4411, roughness: 0.3, flatShading: true });
        for (let i = 0; i < 9; i++) {
          const t = new THREE.Mesh(new THREE.ConeGeometry(0.35, 3.2, 5), tailMat);
          t.position.set(0, 2.2, -1.2);
          t.rotation.y = (i / 9) * Math.PI * 2;
          t.rotation.x = 0.6;
          group.add(t);
        }
      } else if (enemy.id.includes('kui')) {
        // Boss 2: Kui Spirit (colossal one-legged thunder titan)
        mainColor = 0x3388bb;
        emissiveColor = 0x114466;
        const geo = new THREE.CylinderGeometry(1.6, 2.2, 4.2, 7);
        mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: mainColor, emissive: emissiveColor, roughness: 0.4, flatShading: true }));
        mesh.position.y = 2.4;
        group.add(mesh);

        // Big thunder horn
        const horn = new THREE.Mesh(
          new THREE.ConeGeometry(0.65, 3.2, 6),
          new THREE.MeshStandardMaterial({ color: 0x33ddff, emissive: 0x1188cc, roughness: 0.2 })
        );
        horn.position.set(0, 4.8, 0.4);
        group.add(horn);
      } else {
        // Boss 3: Qiongqi (giant demonic winged beast)
        mainColor = 0x882030;
        emissiveColor = 0x440810;
        const geo = new THREE.BoxGeometry(3.5, 3.2, 4.8);
        mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: mainColor, emissive: emissiveColor, roughness: 0.5, flatShading: true }));
        mesh.position.y = 2.6;
        group.add(mesh);

        // Demon Wings
        const wingMat = new THREE.MeshStandardMaterial({ color: 0xff2244, emissive: 0xaa1122, side: THREE.DoubleSide });
        for (const dir of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 2.4), wingMat);
          wing.position.set(dir * 2.8, 3.5, 0);
          wing.rotation.y = dir * 0.4;
          group.add(wing);
        }
      }
    } else {
      // Normal / Elite Enemies
      const radius = Math.max(0.4, enemy.radius * WORLD_SCALE);
      if (enemy.id.includes('bug')) {
        mainColor = 0x55aa66;
        mesh = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.1, 6, 5), new THREE.MeshStandardMaterial({ color: mainColor, roughness: 0.6, flatShading: true }));
      } else if (enemy.id.includes('rat')) {
        mainColor = 0x8855bb;
        mesh = new THREE.Mesh(new THREE.ConeGeometry(radius, radius * 2.4, 5), new THREE.MeshStandardMaterial({ color: mainColor, roughness: 0.6, flatShading: true }));
        mesh.rotation.x = Math.PI / 2;
      } else if (enemy.id.includes('bird')) {
        mainColor = 0xdd4433;
        mesh = new THREE.Mesh(new THREE.TetrahedronGeometry(radius * 1.3), new THREE.MeshStandardMaterial({ color: mainColor, roughness: 0.5, flatShading: true }));
        mesh.position.y = 1.0; // flies above ground
      } else {
        // Rock beast / mountain spirit
        mainColor = isElite ? 0xcc8833 : 0x6e6862;
        mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(radius * 1.3), new THREE.MeshStandardMaterial({ color: mainColor, roughness: 0.9, flatShading: true }));
      }
      mesh.position.y = Math.max(radius, 0.4);
      group.add(mesh);
    }

    mesh.castShadow = true;
    group.userData = {
      mainMesh: mesh,
      originalEmissive: emissiveColor,
      originalEmissiveIntensity: isBoss ? 0.7 : 0
    };

    return group;
  }

  // Sync Souls
  public syncSouls(souls: SoulDrop[], runTime: number) {
    const currentIds = new Set(souls.map((s) => s.id));

    for (const [id, group] of this.soulMeshes.entries()) {
      if (!currentIds.has(id)) {
        this.scene.remove(group);
        this.soulMeshes.delete(id);
      }
    }

    const soulMat = new THREE.MeshStandardMaterial({
      color: 0x64f5d2,
      emissive: 0x36caa6,
      emissiveIntensity: 1.2,
      roughness: 0.2,
      flatShading: true
    });

    for (const soul of souls) {
      let group = this.soulMeshes.get(soul.id);
      if (!group) {
        group = new THREE.Group();
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.32), soulMat);
        group.add(gem);
        this.scene.add(group);
        this.soulMeshes.set(soul.id, group);
      }

      const worldPos = simToWorld(soul.x, soul.y);
      const bobY = 0.5 + Math.sin(runTime * 4 + worldPos.x) * 0.15;
      group.position.set(worldPos.x, bobY, worldPos.z);
      group.rotation.y = runTime * 2.5;
    }
  }

  // Sync Danger Zones (Telegraphs)
  public syncDangerZones(zones: DangerZone[]) {
    const currentIds = new Set(zones.map((z) => z.id));

    for (const [id, mesh] of this.dangerMeshes.entries()) {
      if (!currentIds.has(id)) {
        this.scene.remove(mesh);
        this.dangerMeshes.delete(id);
      }
    }

    for (const zone of zones) {
      let group = this.dangerMeshes.get(zone.id);
      if (!group) {
        group = new THREE.Group();
        const radius3D = zone.radius * WORLD_SCALE;

        // Outer danger ring
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(radius3D * 0.94, radius3D, 32),
          new THREE.MeshBasicMaterial({ color: zone.color || 0xff3b55, side: THREE.DoubleSide })
        );
        ring.rotation.x = -Math.PI / 2;
        group.add(ring);

        // Expanding / pulsing inner indicator
        const fill = new THREE.Mesh(
          new THREE.CircleGeometry(radius3D, 32),
          new THREE.MeshBasicMaterial({ color: zone.color || 0xff3b55, transparent: true, opacity: 0.25, side: THREE.DoubleSide })
        );
        fill.rotation.x = -Math.PI / 2;
        group.add(fill);

        this.scene.add(group);
        this.dangerMeshes.set(zone.id, group);
      }

      const worldPos = simToWorld(zone.x, zone.y);
      group.position.set(worldPos.x, 0.05, worldPos.z);

      // Countdown scale fill
      const progress = Math.max(0, Math.min(1, 1 - zone.impactIn / Math.max(0.1, zone.ttl)));
      const fillMesh = group.children[1] as THREE.Mesh;
      if (fillMesh) {
        fillMesh.scale.set(progress, progress, progress);
      }
    }
  }

  // Sync Projectiles (Fireballs, Thunder bolts)
  public syncProjectiles(projectiles: Projectile[]) {
    const currentIds = new Set(projectiles.map((p) => p.id));

    for (const [id, group] of this.projectileMeshes.entries()) {
      if (!currentIds.has(id)) {
        this.scene.remove(group);
        this.projectileMeshes.delete(id);
      }
    }

    const fireMat = new THREE.MeshStandardMaterial({
      color: 0xff6622,
      emissive: 0xff3300,
      emissiveIntensity: 2.0,
      roughness: 0.1
    });

    for (const p of projectiles) {
      let group = this.projectileMeshes.get(p.id);
      if (!group) {
        group = new THREE.Group();
        const sphere = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35), fireMat);
        group.add(sphere);
        this.scene.add(group);
        this.projectileMeshes.set(p.id, group);
      }

      const worldPos = simToWorld(p.x, p.y);
      group.position.set(worldPos.x, 0.8, worldPos.z);
    }
  }

  // Spawn 3D Visual FX (e.g. Thunder strike, Devour bite, Explosion)
  public triggerBiteFx(simX: number, simY: number, facing: Vec2) {
    const pos = simToWorld(simX, simY);
    const group = new THREE.Group();
    group.position.set(pos.x, 0.8, pos.z);
    group.rotation.y = Math.atan2(facing.x, facing.y);

    const jawMat = new THREE.MeshStandardMaterial({
      color: 0x4df2b2,
      emissive: 0x22ee99,
      emissiveIntensity: 1.8,
      transparent: true,
      opacity: 0.85
    });

    const leftJaw = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.2, 4), jawMat);
    leftJaw.position.set(1.1, 0, 1.2);
    leftJaw.rotation.z = -0.5;
    group.add(leftJaw);

    const rightJaw = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.2, 4), jawMat);
    rightJaw.position.set(-1.1, 0, 1.2);
    rightJaw.rotation.z = 0.5;
    group.add(rightJaw);

    this.scene.add(group);
    this.vfxList.push({
      group,
      ttl: 0.35,
      maxTtl: 0.35,
      update: (t) => {
        // Snap jaws shut
        const factor = 1 - t;
        leftJaw.position.x = 1.1 * (1 - factor);
        rightJaw.position.x = -1.1 * (1 - factor);
      }
    });
  }

  public triggerThunderFx(simX: number, simY: number) {
    const pos = simToWorld(simX, simY);
    const group = new THREE.Group();
    group.position.set(pos.x, 0, pos.z);

    // Vertical lightning column
    const boltMat = new THREE.MeshBasicMaterial({ color: 0x66f5ff });
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.4, 18, 6), boltMat);
    column.position.y = 9;
    group.add(column);

    // Shockwave ring on ground
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 2.2, 24),
      new THREE.MeshBasicMaterial({ color: 0x44ddff, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    group.add(ring);

    this.scene.add(group);
    this.vfxList.push({
      group,
      ttl: 0.4,
      maxTtl: 0.4,
      update: (t) => {
        const factor = t / 0.4;
        ring.scale.set(2 - factor, 2 - factor, 2 - factor);
        column.scale.set(factor, 1, factor);
      }
    });
  }

  public triggerLevelUpFx(simX: number, simY: number) {
    const pos = simToWorld(simX, simY);
    const group = new THREE.Group();
    group.position.set(pos.x, 0.1, pos.z);

    const goldMat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.4, 32), goldMat);
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);

    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, 6, 16, 1, true), new THREE.MeshBasicMaterial({
      color: 0xffea66,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide
    }));
    pillar.position.y = 3;
    group.add(pillar);

    this.scene.add(group);
    this.vfxList.push({
      group,
      ttl: 0.6,
      maxTtl: 0.6,
      update: (t) => {
        const factor = 1 - t / 0.6;
        const scale = 1 + factor * 2.2;
        ring.scale.set(scale, scale, scale);
        goldMat.opacity = (t / 0.6) * 0.9;
        pillar.scale.set(scale * 0.8, 1 + factor * 0.5, scale * 0.8);
      }
    });
  }

  public triggerSoulCollectFx(simX: number, simY: number) {
    const pos = simToWorld(simX, simY);
    const group = new THREE.Group();
    group.position.set(pos.x, 0.6, pos.z);

    const sparkMat = new THREE.MeshBasicMaterial({ color: 0x73ffc7, transparent: true, opacity: 0.9 });
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), sparkMat);
      p.position.set((Math.random() - 0.5) * 0.6, Math.random() * 0.4, (Math.random() - 0.5) * 0.6);
      group.add(p);
    }

    this.scene.add(group);
    this.vfxList.push({
      group,
      ttl: 0.35,
      maxTtl: 0.35,
      update: (t) => {
        group.position.y += 0.04;
        sparkMat.opacity = t / 0.35;
      }
    });
  }

  public triggerDashDustFx(simX: number, simY: number, facing: Vec2) {
    const pos = simToWorld(simX, simY);
    const group = new THREE.Group();
    group.position.set(pos.x - facing.x * 0.6, 0.2, pos.z - facing.y * 0.6);

    const dustMat = new THREE.MeshBasicMaterial({ color: 0xc4b5fd, transparent: true, opacity: 0.6 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.9, 16), dustMat);
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);

    this.scene.add(group);
    this.vfxList.push({
      group,
      ttl: 0.25,
      maxTtl: 0.25,
      update: (t) => {
        const factor = 1 - t / 0.25;
        const scale = 1 + factor * 1.5;
        ring.scale.set(scale, scale, scale);
        dustMat.opacity = (t / 0.25) * 0.6;
      }
    });
  }

  public updateVfx(dt: number) {
    for (let i = this.vfxList.length - 1; i >= 0; i--) {
      const vfx = this.vfxList[i];
      vfx.ttl -= dt;
      if (vfx.update) vfx.update(vfx.ttl);

      if (vfx.ttl <= 0) {
        this.scene.remove(vfx.group);
        this.vfxList.splice(i, 1);
      }
    }
  }

  public render(camera: THREE.PerspectiveCamera) {
    this.renderer.render(this.scene, camera);
  }
}
