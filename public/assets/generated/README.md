# Generated 3D Art References

This directory contains the current 3D art reference boards generated for the web game. The boards use the agreed visual direction: **Shan Hai Jing inspired original creatures, low-poly geometry, flat shading, pixelized limited-color treatment, hard silhouettes, and one controlled emissive accent**.

The character and part images are transparent multi-view turntables intended to guide Blender/GLB production. The background images are scene composition references, and the VFX images are transparent effect boards. The GLB vertical slice now has procedural low-poly assets under [`../models/vertical-slice/`](../models/vertical-slice/). The web runtime can load the player, all three Boss IDs, first-stage ordinary enemies and variants, Qingqiu props, and all five replaceable parts when available, while retaining the cleaned atlases and procedural fallbacks.

## Characters

The playable character and the creature IDs from `data/creatures.json` are kept stable:

- `characters/taotie.png` — young Taotie player body.
- `characters/spirit_bug.png` — spirit bug.
- `characters/spirit_rat.png` — spirit rat.
- `characters/mountain_spirit.png` — mountain spirit.
- `characters/red_feather_bird.png` — red-feather bird.
- `characters/rock_beast.png` — rock beast.
- `characters/reinforced_spirit_rat.png` — reinforced spirit rat variant.
- `characters/reinforced_mountain_spirit.png` — reinforced mountain spirit variant.
- `characters/corrupted_spirit_bug.png` — corrupted spirit bug variant.
- `characters/corrupted_red_feather_bird.png` — corrupted red-feather bird variant.
- `characters/heavy_rock_beast.png` — heavy rock beast variant.
- `characters/elite_mountain_spirit.png` — elite mountain spirit variant.
- `characters/elite_rock_beast.png` — elite rock beast variant.
- `characters/nine_tail_shadow.png` — stage 1 Boss.
- `characters/kui_spirit.png` — stage 2 Boss.
- `characters/qiongqi.png` — final Boss.

The runtime uses the cleaned four-view atlases under [`runtime/characters/`](runtime/characters/). The original `characters/*.png` boards remain available for art review and include the full composition generated for each creature.

## Boss parts

The five part IDs remain aligned with `data/parts.json` and are stored in [`parts/`](parts/):

- `fox_mouth.png` — Fox Mouth head slot.
- `nine_tail.png` — Nine-Tail tail slot.
- `kui_horn.png` — Kui Horn head slot.
- `kui_hoof.png` — Kui Hoof limb slot.
- `qiongqi_wing.png` — Qiongqi Wing limb slot.

## Stages

The three stage IDs from `data/stages.json` map to the generated scene boards as follows:

- `backgrounds/qingqiu_01.png` — `qingqiu_01`, Qingqiu wilderness.
- `backgrounds/yanhuo_01.png` — `qingqiu_02`, the volcanic second stage.
- `backgrounds/qiongqi_arena.png` — `qingqiu_03`, the final Qiongqi arena.

## VFX

Combat and progression effect boards are in [`vfx/`](vfx/): `bite_jaw`, `fireball`, `thunder_bolt`, `level_up_aura`, `soul_crystal`, `danger_zone`, `dash_dust`, and `hit_burst`.

## Production handoff

Use [`manifest.json`](manifest.json) as the stable lookup table for the generated references, runtime atlases, and the GLB `models` entries. The current GLBs are an executable migration slice, not the final high-fidelity art pass: the next art pass should replace their meshes and materials while preserving the IDs, sockets, and animation names.
