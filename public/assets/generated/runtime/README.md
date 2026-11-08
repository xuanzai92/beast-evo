# Runtime Generated Atlases

The files under `characters/` are four-view character atlases derived from the full concept boards. Each atlas uses four equal horizontal samples with transparent padding so the renderer can switch view by camera yaw without sampling the neighboring panel.

These atlases are an interim runtime presentation layer. They are intentionally kept separate from the original art boards and remain the fallback for creatures without a GLB or for a failed model load. The first-stage player and Boss GLBs are under [`../../models/vertical-slice/`](../../models/vertical-slice/).
