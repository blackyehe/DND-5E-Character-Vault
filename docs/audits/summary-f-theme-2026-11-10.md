# Theme-aware Summary layout F — 10 November 2026

The user selected preview F, retaining the current theme's colours, and requested
brighter/bolder saving-throw names and Combat at a glance labels.

The website Summary now groups skills, saves and combat entries using background
surfaces rather than repeated panel and row outlines. Every entry has a fill;
proficiency and expertise use distinct theme-derived fills based on effective
rank, including granted proficiencies. Saving throws spell out the six ability
names. Those names and spell attack/DC/casting-ability labels use foreground ink
at weight 600. Text labels retain proficiency meaning independently of colour.

Only `CharacterSummary.vue` changes at runtime. All colours derive from the
existing `--cb-*` theme variables. Calculations, rest/XP behaviour, inventory,
permissions and character data remain unchanged. The skill grid adapts to the
available space; saving throws stack their labels/numbers on narrow screens.
The wider UI consistency rollout and Owlbear implementation remain pending.

Fifty focused tests, frontend/server type checks and production build pass on the
isolated production baseline. The additional rendering check verifies actual
proficient/expert/untrained attributes, full ability names and removal of granted
proficiency. Existing effective totals and rest failure/retry checks still pass.

Configuration: `scripts/releases/summary-f-theme-2026-11-10.json`.
Concise manifests and receipts: `.local/summary-f-theme-20261110/`.
Managed source/build files and dependency junctions are removed after validation.
