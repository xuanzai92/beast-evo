# Generated 3D Part References

These files are transparent multi-view low-poly reference boards for the replaceable body-part slots. They remain useful for the art handoff and reward-card previews; all five part GLBs (`fox_mouth`, `nine_tail`, `kui_horn`, `kui_hoof`, `qiongqi_wing`) now live under [`../../models/vertical-slice/`](../../models/vertical-slice/) and are available to the runtime migration.

- `fox_mouth.png` — Fox Mouth head slot; wide jaw and ember throat accent.
- `nine_tail.png` — Nine-Tail tail slot; nine separated tails with a purple energy accent.
- `kui_horn.png` — Kui Horn head slot; asymmetric thunder horn and cyan charge lines.
- `kui_hoof.png` — Kui Hoof limb slot; heavy hoof with restrained electric glow.
- `qiongqi_wing.png` — Qiongqi Wing limb slot; dark feathered wing with red edge light.

Each board keeps the ID and slot from `data/parts.json`. Any authored replacement should preserve the same slot mapping, attachment node, local offset, scale, material key, and collision box. The boards are not runtime meshes; the current GLBs are low-poly migration assets and can be replaced without changing the gameplay IDs or socket names.
