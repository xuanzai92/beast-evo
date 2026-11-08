import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadGeneratedManifest, type GeneratedAssetManifest } from './artAssets';

export type ModelAssetKind = 'characters' | 'parts' | 'stages' | 'vfx';
export type ModelQuality = 'low' | 'medium' | 'high';

export interface ModelQualityProfile {
  /** GLB meshes currently present in the package. The slice ships `base` only. */
  lods: string[];
  /** Planned distance tiers that authored exports may add without changing IDs. */
  targetLods: string[];
  materialProfile: string;
  emissive?: string;
}

type ModelManifest = GeneratedAssetManifest & {
  /**
   * The generated reference manifest may eventually group models by kind,
   * while the vertical-slice manifest intentionally keeps a flat id -> path
   * map. Supporting both keeps the runtime lookup stable during the rollout.
   */
  models?: Partial<Record<ModelAssetKind, Record<string, string>>> | Record<string, string>;
  animations?: Record<string, string[]>;
  modelQuality?: Record<string, ModelQualityProfile>;
};

const MODEL_BASE = '/assets/generated/';
const VERTICAL_SLICE_MANIFEST = '/assets/models/vertical-slice/manifest.json';
const loader = new GLTFLoader();
const modelPromises = new Map<string, Promise<THREE.Group | null>>();
const modelRoots = new Map<string, THREE.Group>();
const modelAnimations = new Map<string, THREE.AnimationClip[]>();
let modelManifestPromise: Promise<ModelManifest | null> | null = null;
let activeModelQuality: ModelQuality = 'high';

function applyModelQuality(root: THREE.Object3D, quality: ModelQuality) {
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = quality !== 'low';
    mesh.receiveShadow = quality === 'high';
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (!material) continue;
      const standard = material as THREE.MeshStandardMaterial;
      if (standard.roughness !== undefined) {
        standard.roughness = quality === 'high' ? 0.72 : quality === 'medium' ? 0.82 : 0.95;
      }
      if (standard.emissiveIntensity !== undefined) {
        const base = Number(material.userData.baseEmissiveIntensity ?? standard.emissiveIntensity);
        material.userData.baseEmissiveIntensity = base;
        standard.emissiveIntensity = quality === 'low' ? base * 0.72 : quality === 'medium' ? base * 0.88 : base;
      }
    }
  });
}

async function loadModelManifest(): Promise<ModelManifest | null> {
  if (modelManifestPromise) return modelManifestPromise;

  modelManifestPromise = loadGeneratedManifest()
    .then((manifest) => manifest as ModelManifest | null)
    .then(async (manifest) => {
      // Prefer the generated manifest when it contains an explicit model
      // registry. Older builds only have PNG entries, so probe the dedicated
      // vertical-slice manifest before falling back to the conventional path.
      if (manifest?.models) return manifest;
      try {
        const response = await fetch(VERTICAL_SLICE_MANIFEST);
        if (!response.ok) return manifest;
        return await response.json() as ModelManifest;
      } catch {
        return manifest;
      }
    });

  return modelManifestPromise;
}

function resolveModelPath(kind: ModelAssetKind, id: string, manifest: ModelManifest | null): string {
  const modelTable = manifest?.models;
  const groupedBucket = modelTable && typeof modelTable[kind] === 'object'
    ? (modelTable as Partial<Record<ModelAssetKind, Record<string, string>>>)[kind]
    : undefined;
  const groupedPath = groupedBucket?.[id];
  const flatCandidate = modelTable && typeof (modelTable as Record<string, unknown>)[id] === 'string'
    ? (modelTable as Record<string, string>)[id]
    : undefined;
  const flatPath = flatCandidate;
  const relativePath = groupedPath ?? flatPath ?? `models/${kind}/${id}.glb`;
  return relativePath.startsWith('/') ? relativePath : `${MODEL_BASE}${relativePath}`;
}

/** Resolve a GLB path without coupling gameplay data to the file layout. */
export async function getModelAssetPath(kind: ModelAssetKind, id: string): Promise<string> {
  const manifest = await loadModelManifest();
  return resolveModelPath(kind, id, manifest);
}

/**
 * Load a GLB model when it exists. Missing models are a soft failure so the
 * current PNG impostor/procedural renderer can remain the fallback during the
 * incremental art migration.
 */
export async function loadModelAsset(kind: ModelAssetKind, id: string): Promise<THREE.Group | null> {
  const cacheKey = `${kind}:${id}`;
  const cached = modelPromises.get(cacheKey);
  if (cached) return cached;

  const promise = getModelAssetPath(kind, id)
    .then((url) => new Promise<THREE.Group | null>((resolve) => {
      loader.load(
        url,
        (gltf) => {
          const root = gltf.scene;
          root.traverse((node) => {
            const mesh = node as THREE.Mesh;
            if (!mesh.isMesh) return;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
          });
          modelRoots.set(cacheKey, root);
          modelAnimations.set(cacheKey, gltf.animations ?? []);
          applyModelQuality(root, activeModelQuality);
          resolve(root);
        },
        undefined,
        () => resolve(null)
      );
    }))
    .catch(() => null);

  modelPromises.set(cacheKey, promise);
  return promise;
}

/**
 * Return the clips associated with a cached model. The helper performs the
 * same soft-failing load as `loadModelAsset`, so callers can create a mixer
 * without coupling to GLTFLoader internals.
 */
export async function getModelAssetAnimations(kind: ModelAssetKind, id: string): Promise<THREE.AnimationClip[]> {
  await loadModelAsset(kind, id);
  return modelAnimations.get(`${kind}:${id}`) ?? [];
}

/** Read the authored/base-LOD contract without coupling gameplay to file layout. */
export async function getModelAssetProfile(kind: ModelAssetKind, id: string): Promise<ModelQualityProfile | null> {
  const manifest = await loadModelManifest();
  return manifest?.modelQuality?.[id] ?? null;
}

/** Set the runtime material/shadow profile; GLB geometry and gameplay remain unchanged. */
export function setModelQuality(quality: ModelQuality) {
  activeModelQuality = quality;
  for (const root of modelRoots.values()) applyModelQuality(root, quality);
}

export function getModelQuality(): ModelQuality {
  return activeModelQuality;
}

/** Clone a loaded model before attaching it to a scene. */
export function cloneModelAsset(root: THREE.Group | null): THREE.Group | null {
  if (!root) return null;
  const clone = root.clone(true);
  applyModelQuality(clone, activeModelQuality);
  return clone;
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      material?.dispose();
    }
  });
}

/** Release loaded GLB geometry and clear the registry during a full teardown. */
export function disposeModelAssetCache() {
  for (const root of modelRoots.values()) disposeObject(root);
  modelRoots.clear();
  modelAnimations.clear();
  modelPromises.clear();
  modelManifestPromise = null;
}
