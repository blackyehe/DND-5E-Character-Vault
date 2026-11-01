# Armour-preview detour ? 1 November 2026

The preceding cleanup is committed and pushed as 888db6f on codex/verified-website-20261031. Production was not changed. This subsequent armour-preview adjustment remains local and uncommitted.

EquipmentSpellsTab previously calculated armourValues for every inventory entry while building rows, including rows excluded by filters. Armour-bearing rows now expose a lazy Vue computed preview; non-armour items do not allocate preview computations. The existing hypothetical equipment mapping and AC/rule calculation are unchanged. No permanent cache, altered equip/attunement rules or data writes.

The preview is first evaluated when a rendered armour row reads it. Nested ability/rule changes invalidate it even when the existing row object is retained. Filtering out rows avoids preview work; when all armour is displayed, those previews still need calculation. Collapsed groups currently render their slot content, so this does not defer their previews. No end-to-end loading-time saving is claimed.

Validation: frontend production build/type check and 45 focused tests pass, including two component tests. They verify zero preview calls for armour excluded by a search and current rendered/existing-row AC after ability and rule changes. Existing equipment/rule tests also pass. Backend runtime is unchanged. Evidence and reversible before-source: .local/armour-preview-20261101/.

## Published cleanup and armour release

Published and publicly verified on 1 November 2026: dpl_DrPd5jzRBe7HhLXoavzdPV9QgpQy, https://dndoldal.vercel.app. Rollback: dpl_922Tuz5hpV7iS3Tuv45pju2hNDVe. Earlier local-only status above is historical.

The exact deployed source audit matches 421 inputs, with 12 intended runtime files changed from the prior public release. Held Owlbear authentication remains excluded. No schemas or dependencies changed.

Nine desktop Edge checks passed on both review and public hosts: equipped armour/shield totals, inventory filtering and restored previews, expertise, weapon bonuses, room combat calculations, saved ability updates, creator startup and no page errors. Each disposable synthetic character was deleted and verified unavailable; room-party selection was local to its temporary browser context. Existing real-library sessions also passed seven read-only response/authorization checks on each host. Public HTTP checks passed for ten protected endpoints, security headers, the reviewed bundle and extension boundaries. Promotion included rollback on failed public verification.

Local build/type and focused test evidence was reused for unchanged source. No end-to-end latency saving is claimed. Release evidence: .local/code-cleanup-release-20261101/.
