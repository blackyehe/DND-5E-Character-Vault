# Balanced hybrid motion

## Decision

After reviewing four initial motion directions, the user selected the buttons from Tactile controls and the panels from Flowing panels. Three combined previews followed. The user chose the first, Balanced hybrid, for implementation.

The approved preview remains at `C:/Users/PC/.codex/visualizations/2026/10/17/01a14b8c-9c21-7ff0-81a5-3ba2f85c5819/site-motion-hybrids.html`.

## Changes

- Shared action buttons use a 150 ms response, a 1 px hover lift on a fine pointer and a small press movement. Disabled controls do not move. Existing theme colours, fonts, layout and focus styling remain in use.
- Room cards respond through their border, without lifting the entire card. Library cards, choices, resource pips and disclosure headings have short colour transitions.
- Native disclosures expand and collapse over 220 ms, with a small fade and 3 px content movement. Their native state, keyboard controls and existing Vue bindings remain responsible for opening them. This applies to character rules, spell descriptions, room management and Workshop disclosures.
- Sheet tabs and guided character/class/subclass/race/monster creation sections receive a 190 ms fade and 4 px movement on a section change. Existing elements are retained; there is no delayed navigation or animation-driven remount.
- HP, temporary HP, remaining slots/resources and AC get a 160 ms visual response after their displayed value changes. A newer change cancels that element's previous animation. Saves and counters do not wait for an animation.
- Appearance → Motion offers Balanced and Reduced. This preference is saved on the current device with the other appearance preferences. The operating system's reduced-motion setting always takes priority. Changing that setting cancels active scripted feedback too.
- Initial sheet mounting has no entrance animation. No page-wide choreography, repeating effects, new dependency, API change, database migration or resource calculation change was added.

## Implementation and compatibility

`src/site-motion.css` contains shared control and disclosure styles. Native disclosure animation is a progressive enhancement guarded by support checks for `::details-content`, intrinsic-size interpolation and discrete transitions. Engines without these features retain immediate native disclosures. Reference popups already teleport outside the disclosure content and retain that behavior.

`src/directives/siteMotion.ts` supplies two Vue directives for changed values and sections. They run only when their bound value changes, skip initial mounting and reduced motion, cancel prior feedback, and clean up on unmount. There is no DOM observer, background polling or animation timer loop.

Browser reference: [MDN: details content and its transitions](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/::details-content), [MDN: intrinsic-size interpolation](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/interpolate-size).

## Checks

- Frontend type check and production build passed. No automated tests were added or run.
- Local manual review confirmed the Appearance preference, 150 ms controls, 220 ms native disclosure styling, keyboard disclosure toggling, nested rules, changed-value feedback, section changes and immediate Reduced mode. A disposable local review page used the actual motion stylesheet/directives without account data.
- Signed-in live review confirmed Balanced is selected, Game room cards retain their position, character tabs open, and feature descriptions expand. The observed sheet had no horizontal overflow at the review viewport.
- In the existing temporary player preview, HP changed from 54 to 53, first-level slots from 4 to 3 and sorcery points from 6 to 5. All three were restored, then the page returned to DM view. The preview explicitly does not save these changes; live character resources were not modified.
- No warning/error console entries were captured in the live review. Vercel reported READY, the public alias was checked against the deployment below, and `/api/health` returned `{"ok":true}`.
- Other browser engines and an operating-system preference change were not manually exercised. Reduced mode was checked through the site's own preference; the OS condition and change listener were reviewed in source.

Local screenshots, excluded from deployment:

- `.preview.local/balanced-motion-appearance-live.png`
- `.preview.local/balanced-motion-sheet-live.png`

## Release and rollback

- Application commit: `5ae9dd8` — `feat: apply balanced tactile controls and flowing panels`.
- Deployment: `dpl_3eKoPxsgrPWCU7in3GpLYHx4Wnf5`.
- Deployment URL: https://dndoldal-2r0m04he7-dndenjoyerstudio.vercel.app
- Public site: https://dndoldal.vercel.app
- Previous application commit: `08569f0`.
- Source checkpoint: `pre-balanced-motion-2026-10-20`.
- Previous deployment: `dpl_QkDPxiDNENksd5QwDKNvzejRQCBJ`.

To return the public site to the preceding release:

```powershell
vercel rollback dpl_QkDPxiDNENksd5QwDKNvzejRQCBJ --scope dndenjoyerstudio --yes
```

Alternatively, revert application commit `5ae9dd8` and deploy that result. A Git revert alone does not change the public site. The extra appearance preference can remain in browser storage; the preceding version ignores it. No content or character migration needs reversing.
