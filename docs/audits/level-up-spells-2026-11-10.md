# Level-up spell selection A - 10 November 2026

The user selected A: open a spell row to inspect its full rules and Learn inside
that row. A shared chooser now handles ordinary class learning and additional
grants. Each row loads its definition only when expanded, caches successful reads,
shows local failures/retry, and retains casting labels and higher-level rules.
Searching, level/name/source sorting, a level filter, counts and explicit paging
replace the silent 40/30-result limits. Selections remain visible and survive
filters/pages. Learn does not fetch every definition or save the character.
The selected C theme surfaces are reused without new palette formulas.

Class availability combines the SRD list with explicit imported class metadata.
The owned advancement-options response now includes class declarations and a
definition-availability flag, without full spell descriptions. Explicit Workshop
lists remain authoritative, matching stable aliases and legacy content keys;
subclass extras remain supported. Spells are not admitted just because their names
match an SRD spell. Missing Workshop lists retain the existing manual-review
warning/policy. Distinct source versions remain separate choices.

Known references/aliases, individual class spell rank, separate cantrip/levelled
allowances and replacements remain constrained. Choices use the catalog reference
even if its definition endpoint returns a canonical alias. A changed definition
level cannot be learned from stale metadata. Selected rows are not silently
dropped, and late requests cannot overwrite a newer class request or an unmounted
chooser. Saving guards remain in place; HP, slots, resources and inventory are
untouched until the existing reviewed level-up application.

Magical Secrets and Mystic Arcanum also include imported catalog definitions;
Arcanum still uses its appropriate rank/class restriction and dedicated pool.
Long feature option lists now show counts and Show more, keeping selected options
visible, instead of silently hiding everything after the thirtieth match.

Validation: 45 focused chooser, wizard, class-rule, advancement and spellbook
checks; all 15 isolated MongoDB/HTTP consistency scenarios, including owned
advancement metadata and foreign-owner rejection; both type checks and production
build. Component checks cover inline Learn/rules/scaling, paging beyond 80 spells,
sort/search/selection retention, stale/error responses, retries, separate limits,
grant mode and class changes. The initial exact-package test scan omitted two
tests absent from the hosted baseline; those are now supplied as validation-only
support. The final validated source manifest is identical to the staged input
manifest; the staged deployment was not resubmitted.

The candidate reconstructs the exact C-surface/parity deployment
`dpl_HC7Rs418PdEgihknoFcTvqaeVLQh` (561 inputs), overlays five runtime files and
five test files, and contains 567 exact source inputs. The unpublished checkout's
older extension changes are excluded. The extension API, current Owlbear aliases,
hosting settings, region/environment configuration and secondary website alias's
existing Vercel protection must remain intact. No live campaign writes, account
grants or production extension probes are used.

Receipts, guarded release helper and exact preimages remain in
`.local/level-up-spells-20261110/`; review on 10 December 2026. Sources/databases
use managed temporary workspaces, existing dependencies and two test workers;
processes/connections close before cleanup. Vitest filesystem cache stays off.
