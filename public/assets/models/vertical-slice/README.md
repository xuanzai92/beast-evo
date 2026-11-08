# Vertical Slice GLB Assets

This folder contains the first reproducible GLB handoff for the Qingqiu vertical slice:

- `taotie.glb` — player creature with `socket_head`, `socket_limb`, `socket_tail`, and `socket_armor`.
- `nine_tail_shadow.glb` — stage 1 boss with the same creature sockets and nine named tail nodes.
- `kui_spirit.glb` — stage 2 boss with thunder horns and the same creature sockets.
- `qiongqi.glb` — stage 3 boss with wings, tail, and the same creature sockets.
- `spirit_bug.glb`, `spirit_rat.glb`, `mountain_spirit.glb`, `red_feather_bird.glb`, and `rock_beast.glb` — stage 1 normal enemy meshes.
- `reinforced_spirit_rat.glb`, `reinforced_mountain_spirit.glb`, `corrupted_spirit_bug.glb`, `corrupted_red_feather_bird.glb`, `heavy_rock_beast.glb`, `elite_mountain_spirit.glb`, and `elite_rock_beast.glb` — normal/elite variants with the same node and animation contract.
- `fox_mouth.glb` — head-slot part with `socket_head`.
- `nine_tail.glb` — tail-slot part with `socket_tail`.
- `kui_horn.glb` — stage 2 head-slot part with `socket_head`.
- `kui_hoof.glb` — stage 2 limb-slot part with `socket_limb`.
- `qiongqi_wing.glb` — final Boss limb-slot part with `socket_limb`.
- `qingqiu_01.glb` — Qingqiu stage props: six low-poly totems around `socket_player_spawn`.

All character GLBs include the animation clips `idle`, `run`, `attack`, `hit`, `dash`, and `death`; parts and stage props are static attachment/environment assets.

The manifest records a `base` LOD for every asset, a planned `combat` target tier, and the shared `pixel-low-poly-single-emissive` material profile. The runtime can change shadow and emissive quality without changing gameplay or asset IDs.

These are procedural low-poly GLBs generated with Three.js `GLTFExporter` while Blender is unavailable. They provide stable paths, node names, sockets, and animation contracts for the runtime migration. The web runtime now loads the player, all three Bosses, first-stage ordinary enemies and variants, stage props, and all five replaceable parts when available; PNG/procedural geometry remains the fallback. Replace the meshes with Blender-authored exports later without changing the gameplay IDs or attachment names.

Regenerate from the repository root with:

```sh
npm run generate:glb
```

The generated review copies are written to `output/assets/glb/vertical-slice/`.

Validate the binary headers, required nodes, animation names, and manifest animation metadata with:

```sh
npm run validate:glb
```

## P7.2 migration result

The first-stage ordinary enemy pool now follows the same contract:

- `spirit_bug`, `spirit_rat`, `mountain_spirit`, `red_feather_bird`, and `rock_beast`.
- Their `reinforced`, `corrupted`, `heavy`, and `elite` variants where the gameplay data exposes them.
- The same `root/body/head` naming convention, with `socket_*` nodes only where a part can attach.
- One shared low-poly material family with a baked pixel palette and a single emissive accent per creature.
- The manifest and runtime leave room for two combat LODs; the current procedural export is the base LOD and the PNG atlas remains the failure fallback.

Browser acceptance for each migrated model is: GLB response `200`, `GLTFLoader` parse succeeds, required nodes are present, the model remains visible during a 360° camera orbit, and deleting or failing the GLB request leaves the PNG/procedural fallback active. These checks are now covered by `validate:glb` and the runtime Playwright smoke tests. Keep collision and attack volumes in gameplay data rather than deriving them from the rendered mesh.

## P7.3 boss and part contract

The second and third Boss model contracts are now present as low-poly procedural GLBs:

- `kui_spirit` → `kui_horn` / `kui_hoof`
- `qiongqi` → `qiongqi_wing`

The next art pass is focused on authored materials, adding the two combat LODs, and replacing these procedural proxies with Blender-authored meshes while preserving the same IDs and sockets.
