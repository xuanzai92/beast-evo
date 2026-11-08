# Generated 3D VFX References

Transparent low-poly pixelized effect boards for the current combat and progression cues:

- `bite_jaw.png` — basic bite and devour-mouth impact.
- `fireball.png` — Nine-Tail fire projectile and trail.
- `thunder_bolt.png` — Kui Thunder strike column.
- `level_up_aura.png` — level-up and evolution aura.
- `soul_crystal.png` — dropped beast-soul pickup.
- `danger_zone.png` — Boss telegraph and damage warning area.
- `dash_dust.png` — dash burst and ground dust.
- `hit_burst.png` — generic hit confirmation burst.

The renderer now prefers these transparent boards at runtime and falls back to procedural geometry when a board is unavailable. They are still reference inputs for the future GLB/texture/particle pass and should not be treated as final particle atlases.
