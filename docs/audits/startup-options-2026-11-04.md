# Startup options and sign-in overlap — 4 November 2026

Scope: compare small candidates against the current published website, using source inspection, retained request traces and a local ordering check. No product runtime files, hosting settings or public deployment changed in this investigation. Manual DMV import is verified and its automatic-link limitation is accepted by the user; it is not a priority for this loading work.

Subsequent implementation: [requested-page preparation during sign-in](sign-in-page-preparation-2026-11-04.md) is now published and verified. It uses native code/style file hints with no speculative component execution, and passes controlled positive-effect and access/recovery checks. The analysis below records the earlier selection of that option; earlier auth bootstrap and backend startup changes remain separate.

## What already happens

The main application already includes the login and Dashboard code. Most feature pages are separate downloads. The router's first navigation waits for `/api/auth/me` before resolving those feature-page components. The observed order matches Vue Router's [documented navigation flow](https://router.vuejs.org/guide/advanced/navigation-guards.html): global guards run before async route components resolve.

Compendium indexes and opened details already have bounded, owner/revision-validated browser caches. Hashed frontend files already retain long-lived browser caching. Compendium background preparation deliberately yields to sign-in and foreground activity. Those mechanisms are existing behavior, not new proposals.

In one retained Notebook trace, sign-in ran at 190–250 ms after navigation start, the Room page JavaScript at 249–420 ms, room data at 449–566 ms, Notebook JavaScript at 571–852 ms and initial Notebook data at 858–990 ms. The CSS overlapped Notebook JavaScript. This is one existing observed opening, not a cold-start guarantee, optimization benchmark or reason to add these overlapping request durations together. It exposes separate code-download gates that can be investigated without changing data permissions.

## Options, in proposed order

| Candidate | What the user gains | Extra work and limits |
| --- | --- | --- |
| Load the requested page's code during sign-in verification | Avoids waiting for sign-in to finish before downloading Compendium or the selected room section | Best first experiment. Public JS/CSS only; private data and component setup stay behind verified sign-in. Download only the requested page/section. An expired session can result in an unused public file download. Earlier downloads can also contend with more urgent resources, so real readiness must be measured. |
| Start the existing sign-in check earlier in the initial HTML startup | Lets server startup overlap fetching/loading the main frontend application | Reuse the same response exactly once; do not add a separate warm-up request. Adds a small bootstrap handoff and error/timeout handling, so it is a second experiment. The saved time is limited to the currently avoidable frontend-before-auth gap. It cannot help before HTML arrives. |
| Reduce the backend's initial dependency loading | Could reduce first-request startup work itself | The unpublished diagnostic confirms measurable module initialization, but no specific edit has shown a user-visible saving. Do not split the whole backend or blindly defer work that hosting already pre-initializes. Profile and test one dependency group first. |
| Show a clear opening state while the initial session is checked | Makes the existing wait understandable and avoids an apparently empty page | Small UX addition; it does not shorten backend or network work. Keep distinct from measured performance gains. |
| Periodic warm-up requests or different hosting | May reduce some lifecycle waits under appropriate hosting guarantees | Lower priority. Scheduled pings add recurring requests and cannot guarantee the next visitor reaches a warm instance. Current Fluid startup optimizations are already enabled; no measured plan/provider change supports a paid recommendation. |

Browser [module preloading](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel/modulepreload) can fetch and prepare public module files before execution. A production experiment must choose a build-compatible implementation and check actual module side effects; a loader-order demonstration alone does not prove every real page module is safe to execute before sign-in.

The user's suggestion has two situations. During a fresh password login, the default Dashboard code is already available, so blindly preloading that adds little. During an existing-session check, or a login that returns to a bookmarked feature page, preparing the exact requested page is a concrete opportunity. For Notebook, loading only the Room wrapper early misses the later Notebook section download; the selected section needs explicit consideration.

## Small controlled check

`.local/startup-options-20261104/check-overlap.mjs` uses the installed Vue Router with deferred sign-in and code-file promises, without HTTP or production mutation. Eight cases cover successful/expired sessions with sign-in or page files resolving first, under current and overlapping order. The overlapping version starts the code loader before sign-in finishes, performs one physical code load for an authorised destination, and still prevents protected route entry before successful sign-in. Rejected sessions reach Login without protected entry. A rejected session can have one unused public code download; the baseline has none.

This is a controlled ordering proof using synthetic components, not implementation of the website change or a speed measurement. It does not exercise actual Compendium/Notebook module side effects, rendering, CSS application, browser contention, network errors, cancellation or full sign-in/logout races. Those belong in the next narrow built-browser experiment, rather than a speculative release.

Recommendation: first test requested-page/selected-section code loading alongside the existing sign-in check. Require unchanged authentication, no protected data calls before verification, no duplicated code or API requests, working expired-session/error recovery, and a positive readiness result under matched conditions. Keep page files cached as they already are. Consider earlier auth bootstrap only as a separate second change, so its effect remains attributable. Do not preload every category or complete character/Notebook library.
