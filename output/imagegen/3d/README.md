# 3D Art Generation Output

This folder contains the source boards generated in the direct conversation image workflow for the Beast Evo 3D art pass.

## Layout

- `characters/` — player, regular creatures, variants, and three Boss turntables.
- `runtime/characters/` — cleaned 4-view atlases cropped from the boards for runtime sprite sampling.
- `parts/` — the five replaceable Boss-part references.
- `stages/` — the three battlefield composition references.
- `vfx/` — combat, pickup, dash, telegraph, and progression effect boards.

The same files are copied into `public/assets/generated/` for project review and future tooling. `public/assets/generated/manifest.json` is the canonical ID-to-path mapping.

These remain concept/reference boards. The first executable GLB vertical slice is now under [`public/assets/models/vertical-slice/`](../../../public/assets/models/vertical-slice/), generated from low-poly procedural meshes with the approved node and animation contract. The next production step is to replace those intermediate meshes with authored models, textures, and LODs while keeping the same IDs and sockets.
