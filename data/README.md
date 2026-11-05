# Game data draft

These JSON files are the first data-driven balance draft (v0.1-draft).

## Ownership

- balance.json: global player, progression, upgrade-draft, and performance budgets.
- creatures.json: normal enemies, elite variants, and bosses.
- skills.json: skill behavior keys and stage values.
- parts.json: boss parts, slots, branches, effects, and upgrade choices.
- growth.json: branch nodes and cross-branch synergies.
- stages.json: stage order, timing, bosses, and part reward policy.
- waves.json: time-windowed spawn pools and alive caps.
- locales/: user-facing names and later descriptions.

## Data versus code

Values and content belong here. Behavior keys such as tracking_projectile or
fox_tail_sweep are implemented by game systems. A data entry may select a
behavior, but it must not contain executable code.

## Units

- *Sec: seconds.
- *Px: logical pixels.
- *PerSec: units per second.
- *Ratio and *Multiplier: decimal values where 1.0 means unchanged.
- *Chance: decimal values between 0 and 1.

Run node scripts/validate-data.mjs after editing these files.
