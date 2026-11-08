import * as THREE from 'three';

export type GeneratedAssetKind = 'characters' | 'parts' | 'stages' | 'vfx';

export interface GeneratedAssetManifest {
  schemaVersion?: number;
  status?: string;
  style?: string;
  note?: string;
  characters?: Record<string, string>;
  runtimeCharacters?: Record<string, string>;
  parts?: Record<string, string>;
  stages?: Record<string, string>;
  vfx?: Record<string, string>;
}

export interface TurntableTextureOptions {
  /** Number of horizontal views in the generated board. Current boards use four. */
  frameCount?: number;
  /** Initial view index, where 0 is the first view in the board. */
  frameIndex?: number;
  /** Flip the board vertically when the source art uses a bottom-up export. */
  flipY?: boolean;
}

export interface GeneratedSpriteOptions extends TurntableTextureOptions {
  color?: THREE.ColorRepresentation;
  opacity?: number;
  alphaTest?: number;
  depthWrite?: boolean;
  depthTest?: boolean;
  size?: number;
}

export interface GeneratedTextureImage {
  width?: number;
  height?: number;
}

const GENERATED_BASE = '/assets/generated/';
const DEFAULT_TURNTABLE_FRAMES = 4;
const textureCache = new Map<string, THREE.Texture>();
let manifestPromise: Promise<GeneratedAssetManifest | null> | null = null;
let cachedManifest: GeneratedAssetManifest | null = null;

/**
 * Fallback lookup used while the manifest is loading or when an older build
 * is missing the manifest. Keeping this table here makes the renderer robust
 * during incremental deploys and local file previews.
 */
const fallbackAssets: Record<GeneratedAssetKind, Record<string, string>> = {
  characters: {
    taotie: 'characters/taotie.png',
    spirit_bug: 'characters/spirit_bug.png',
    spirit_rat: 'characters/spirit_rat.png',
    mountain_spirit: 'characters/mountain_spirit.png',
    red_feather_bird: 'characters/red_feather_bird.png',
    rock_beast: 'characters/rock_beast.png',
    reinforced_spirit_rat: 'characters/reinforced_spirit_rat.png',
    reinforced_mountain_spirit: 'characters/reinforced_mountain_spirit.png',
    corrupted_spirit_bug: 'characters/corrupted_spirit_bug.png',
    corrupted_red_feather_bird: 'characters/corrupted_red_feather_bird.png',
    heavy_rock_beast: 'characters/heavy_rock_beast.png',
    elite_mountain_spirit: 'characters/elite_mountain_spirit.png',
    elite_rock_beast: 'characters/elite_rock_beast.png',
    nine_tail_shadow: 'characters/nine_tail_shadow.png',
    kui_spirit: 'characters/kui_spirit.png',
    qiongqi: 'characters/qiongqi.png'
  },
  parts: {
    fox_mouth: 'parts/fox_mouth.png',
    nine_tail: 'parts/nine_tail.png',
    kui_horn: 'parts/kui_horn.png',
    kui_hoof: 'parts/kui_hoof.png',
    qiongqi_wing: 'parts/qiongqi_wing.png'
  },
  stages: {
    qingqiu_01: 'backgrounds/qingqiu_01.png',
    qingqiu_02: 'backgrounds/yanhuo_01.png',
    qingqiu_03: 'backgrounds/qiongqi_arena.png'
  },
  vfx: {
    bite_jaw: 'vfx/bite_jaw.png',
    fireball: 'vfx/fireball.png',
    thunder_bolt: 'vfx/thunder_bolt.png',
    level_up_aura: 'vfx/level_up_aura.png',
    soul_crystal: 'vfx/soul_crystal.png',
    danger_zone: 'vfx/danger_zone.png',
    dash_dust: 'vfx/dash_dust.png',
    hit_burst: 'vfx/hit_burst.png'
  }
};

function getManifestBucket(manifest: GeneratedAssetManifest | null, kind: GeneratedAssetKind) {
  return manifest?.[kind] ?? {};
}

/** Load the generated asset manifest once. A missing manifest is a soft failure. */
export async function loadGeneratedManifest(url = `${GENERATED_BASE}manifest.json`): Promise<GeneratedAssetManifest | null> {
  if (cachedManifest) return cachedManifest;
  if (!manifestPromise) {
    manifestPromise = fetch(url)
      .then((response) => (response.ok ? response.json() as Promise<GeneratedAssetManifest> : null))
      .then((manifest) => {
        cachedManifest = manifest;
        return manifest;
      })
      .catch(() => null);
  }
  return manifestPromise;
}

/** Resolve a stable project asset path, falling back to the built-in table. */
export function getGeneratedAssetPath(kind: GeneratedAssetKind, id: string, manifest: GeneratedAssetManifest | null = cachedManifest): string | null {
  const relativePath = getManifestBucket(manifest, kind)[id] ?? fallbackAssets[kind][id];
  return relativePath ? `${GENERATED_BASE}${relativePath}` : null;
}

function createFallbackTexture(color: THREE.ColorRepresentation = 0x241d35): THREE.DataTexture {
  const parsed = new THREE.Color(color);
  const data = new Uint8Array([
    Math.round(parsed.r * 255),
    Math.round(parsed.g * 255),
    Math.round(parsed.b * 255),
    255
  ]);
  const texture = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  texture.userData.generatedFallback = true;
  return texture;
}

function configureTexture(texture: THREE.Texture, flipY = true) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = flipY;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

async function loadTexture(url: string, fallbackColor?: THREE.ColorRepresentation): Promise<THREE.Texture> {
  const cached = textureCache.get(url);
  if (cached) return cached;

  const loader = new THREE.TextureLoader();
  try {
    const texture = await new Promise<THREE.Texture>((resolve, reject) => {
      loader.load(url, resolve, undefined, reject);
    });
    const configured = configureTexture(texture);
    configured.userData.generatedFallback = false;
    textureCache.set(url, configured);
    return configured;
  } catch {
    const fallback = createFallbackTexture(fallbackColor);
    textureCache.set(url, fallback);
    return fallback;
  }
}

/** Load a generated PNG with manifest lookup and a non-null fallback texture. */
export async function loadGeneratedTexture(
  kind: GeneratedAssetKind,
  id: string,
  fallbackColor?: THREE.ColorRepresentation
): Promise<THREE.Texture> {
  const manifest = await loadGeneratedManifest();
  const path = getGeneratedAssetPath(kind, id, manifest);
  return path ? loadTexture(path, fallbackColor) : createFallbackTexture(fallbackColor);
}

/**
 * Configure a horizontal turntable texture. Generated character boards use
 * four views packed left-to-right, so only one quarter is sampled at a time.
 */
export function configureTurntableTexture(
  texture: THREE.Texture,
  options: TurntableTextureOptions = {}
): THREE.Texture {
  const frameCount = Math.max(1, options.frameCount ?? DEFAULT_TURNTABLE_FRAMES);
  const frameIndex = normalizeFrame(options.frameIndex ?? 0, frameCount);
  const image = texture.image as GeneratedTextureImage | undefined;
  // The generated boards have a few pixels of view-to-view overlap. Inset
  // each sample so the adjacent silhouette never bleeds into the sprite.
  const pixelPadding = image?.width ? 32 / image.width : 0.008;
  texture.repeat.set(Math.max(0.001, 1 / frameCount - pixelPadding * 2), 1);
  texture.offset.set(frameIndex / frameCount + pixelPadding, 0);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  // Avoid mipmap bleed from the adjacent turntable frame.
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/** True when the loader returned an actual generated image rather than the 1x1 fallback. */
export function isGeneratedTextureUsable(texture: THREE.Texture | null | undefined): boolean {
  if (!texture || texture.userData.generatedFallback) return false;
  const image = texture.image as GeneratedTextureImage | undefined;
  return Boolean(image && (image.width ?? 0) > 1 && (image.height ?? 0) > 1);
}

/** Set the sampled turntable frame from a world yaw in radians. */
export function setTurntableYaw(
  texture: THREE.Texture,
  yawRadians: number,
  frameCount = DEFAULT_TURNTABLE_FRAMES,
  phase = 0
): number {
  const normalized = ((yawRadians / (Math.PI * 2) + phase) % 1 + 1) % 1;
  const frame = Math.floor(normalized * frameCount + 0.5) % frameCount;
  configureTurntableTexture(texture, { frameCount, frameIndex: frame });
  return frame;
}

/** Load and configure a generated character turntable texture. */
export async function loadTurntableTexture(
  characterId: string,
  options: TurntableTextureOptions = {}
): Promise<THREE.Texture> {
  const manifest = await loadGeneratedManifest();
  const runtimeRelativePath = manifest?.runtimeCharacters?.[characterId] ?? `runtime/characters/${characterId}.png`;
  const runtimeTexture = await loadTexture(`${GENERATED_BASE}${runtimeRelativePath}`, 0x2a2434);
  const texture = isGeneratedTextureUsable(runtimeTexture)
    ? runtimeTexture
    : await loadGeneratedTexture('characters', characterId, 0x2a2434);
  return configureTurntableTexture(texture, options);
}

/** Create a camera-facing sprite from a generated asset, with a safe fallback. */
export async function loadGeneratedSprite(
  kind: GeneratedAssetKind,
  id: string,
  options: GeneratedSpriteOptions = {}
): Promise<THREE.Sprite> {
  const loadedTexture = kind === 'characters'
    ? await loadTurntableTexture(id, options)
    : await loadGeneratedTexture(kind, id, options.color ?? 0x241d35);
  // Turntable frame offsets are per sprite. Clone the cached source texture so
  // enemies with different facing directions do not overwrite one another.
  const texture = loadedTexture.clone();
  texture.needsUpdate = true;
  if (kind === 'characters') configureTurntableTexture(texture, options);

  const material = new THREE.SpriteMaterial({
    map: texture,
    color: options.color ?? 0xffffff,
    opacity: options.opacity ?? 1,
    transparent: true,
    alphaTest: options.alphaTest ?? 0.04,
    depthWrite: options.depthWrite ?? false,
    depthTest: options.depthTest ?? true
  });
  const sprite = new THREE.Sprite(material);
  const size = options.size ?? 1;
  const image = texture.image as GeneratedTextureImage | undefined;
  const frameCount = kind === 'characters' ? Math.max(1, options.frameCount ?? DEFAULT_TURNTABLE_FRAMES) : 1;
  const aspect = image && image.height ? (image.width ?? 1) / frameCount / image.height : 1;
  sprite.scale.set(size * aspect, size, 1);
  sprite.userData.generatedAsset = { kind, id };
  return sprite;
}

export function normalizeFrame(frameIndex: number, frameCount: number): number {
  return ((Math.floor(frameIndex) % frameCount) + frameCount) % frameCount;
}

/** Dispose cached GPU textures during a full scene teardown. */
export function disposeGeneratedAssetCache() {
  for (const texture of textureCache.values()) texture.dispose();
  textureCache.clear();
  cachedManifest = null;
  manifestPromise = null;
}

