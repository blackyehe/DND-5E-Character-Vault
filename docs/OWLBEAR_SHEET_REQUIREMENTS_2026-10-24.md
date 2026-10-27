# Owlbear character sheet: requirements research

Project moved on 24 October 2026: current extension planning belongs to [the independent project](../../owlbear-character-sheet/README.md) and its [updated requirements](../../owlbear-character-sheet/docs/SHEET_REQUIREMENTS.md). This website-side document is retained as historical research; its same-repository and same-origin proposals have been superseded.

Research date: 24 October 2026. Status: documentation only; no extension code, dependency installation, deployment, account connection or database changes.

## Current objective

The user confirmed the first objective: a working character sheet inside Owlbear Rodeo, using our website, with compact and expandable views. This research supports that objective. The earlier [technical plan](OWLBEAR_EXTENSION_TECHNICAL_PLAN.md) retains broader requirements and implementation stages; this note does not authorise or begin those stages.

## Language and tools

Recommended implementation: TypeScript, Vue 3, HTML and CSS, built with the project's existing Vite setup. TypeScript becomes JavaScript for execution in the browser. Vue is the interface framework; HTML describes structure and CSS controls presentation. JSON supplies the extension manifest.

Owlbear embeds extension pages as iframes. Its SDK is written in TypeScript, and its tutorial explicitly permits Vue. JavaScript is also supported; TypeScript is our project choice rather than a required proprietary extension language. Sources: [architecture](https://docs.owlbear.rodeo/extensions/getting-started/), [tutorial](https://docs.owlbear.rodeo/extensions/tutorial-hello-world/).

The additional integration dependency would be `@owlbear-rodeo/sdk`, imported as `OBR`. It communicates with Owlbear; our own API continues to read and save character data. Source: [SDK installation](https://docs.owlbear.rodeo/extensions/tutorial-hello-world/install-the-sdk/).

Verified in local source:

- Frontend: Vue 3, TypeScript, Vite, Pinia and Vue Router; CSS and Tailwind are already present (`package.json`, `src/main.ts`).
- Backend: TypeScript, Node.js and Express (`server/package.json`, `server/app.ts`).
- Database: MongoDB through Mongoose (`server/db.ts`).
- Hosting configuration: Vercel frontend and Express backend (`vercel.json`).
- This repository requires Node.js >=22.12.0. Follow the repository requirement rather than older minimums in Owlbear's tutorial.

## How the sheet reaches Owlbear

We host a dedicated extension entry within our application, together with an icon and `manifest.json`. The manifest identifies the extension and its action page. It can also name an optional background page. Users install through a manifest link in their Owlbear profile and enable it for a room. Public extension-store listing is a separate sharing step. Sources: [manifest](https://docs.owlbear.rodeo/extensions/reference/manifest/), [installation](https://docs.owlbear.rodeo/extensions/tutorial-hello-world/install-your-extension/), [sharing overview](https://docs.owlbear.rodeo/extensions/tutorial-sharing-your-extension/).

Proposed paths, none implemented:

- `/owlbear/manifest.json`
- `/owlbear/index.html`
- `/owlbear/icon.svg`
- `/connect/owlbear` for website-account connection approval
- `/api/extension/*` for limited authenticated operations

An additional Vite entry and precise hosting rules should serve extension HTML, JSON and assets independently of the normal website router. HTTPS hosting is proposed for shared testing and release; the official tutorial also supports localhost for development. Existing Vercel hosting is a candidate, subject to deployed route, header and access checks. Sources: [development](https://docs.owlbear.rodeo/extensions/tutorial-hello-world/create-your-site/), [hosting](https://docs.owlbear.rodeo/extensions/tutorial-sharing-your-extension/hosting-your-extension/).

## Compact and expanded views

The action popover is the small window opened from the extension icon. `OBR.action.setWidth()` and `setHeight()` can change its dimensions. Proposed first approach: one page changes layout and resizes its enclosing action, preserving the selected character and one state controller. Source: [action API](https://docs.owlbear.rodeo/extensions/apis/action/).

An alternative expanded presentation is `OBR.modal.open()`, which accepts dimensions or a full-screen option. A modal is another page/frame, so it needs deliberate authentication, refresh and state ownership. Source: [modal API](https://docs.owlbear.rodeo/extensions/apis/modal/).

Custom popovers also support resizing and `disableClickAway`, documented as keeping them open when clicking elsewhere. This option is on custom popovers; do not assume it is an action-popover setting. It may be useful if the compact sheet must stay open while tokens move. Source: [popover API](https://docs.owlbear.rodeo/extensions/apis/popover/).

Actual usable sizes, screen-edge behaviour, map interaction, keyboard focus and close/reopen behaviour require a test in Owlbear. The documented APIs establish available mechanisms, not an already verified user experience.

Proposed content for discussion:

- Compact: character selection/name, HP and temporary HP, AC, key resources, short navigation and Expand.
- Expanded: existing player-sheet sections, readable spell/feature/item details and permitted play controls, with Collapse/Return.
- Both use the same authorised saved character. An expanded view is not permanent-edit permission.

## Existing application features to reuse

`src/components/sheet/`, `src/lib/character-sheet.ts` and `shared/character.ts` provide sheet components, calculations and data structures. Reuse those rules and adapt presentation to the available space.

`server/routes/rooms.ts` already checks room membership, assignments and character ownership for sheets and references. It exposes quick-sheet and reference reads, and a validated play-update route. `server/lib/play-update.ts` and `shared/rooms.ts` constrain allowed changes; `expectedUpdatedAt` and an atomic update condition detect stale saves.

Homebrew must resolve against the character owner's library, as existing room reads do. Players should not need duplicate imports.

Reuse needs some refactoring: `src/stores/characters.ts` and sheet components currently depend on a shared current-character store and website authentication. The extension needs an explicit authenticated request transport and account/room/character context. Its play controls must never fall through to broader permanent-edit endpoints. Avoid mounting two independent writers during expansion.

## Required integration work

### Embedding policy

Local `vercel.json` applies `X-Frame-Options: DENY` to frontend routes. The extension therefore needs a dedicated, narrowly scoped embedding policy. Configure HTTP response headers with the actual permitted embedding ancestors; verify final deployed responses. This research did not inspect current production headers. Source: [CSP frame-ancestors](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors).

### Account connection

Current authentication reads an HttpOnly website cookie with `SameSite=Lax` (`server/middleware/auth.ts`, `server/routes/auth.ts`). Lax cookies do not cover ordinary cross-site iframe requests, so an existing website login cannot be assumed to authenticate the embedded sheet. Source: [cookie behaviour](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie).

Proposed solution: a Connect button opens the website in a normal tab, the user approves a specific account/room connection, and the extension receives a limited, revocable session through a short-lived pairing flow. This is our proposed backend feature, not an Owlbear-provided website login service. Session storage, renewal and privacy-mode behaviour remain to prove. Never place credentials in manifest URLs, shared metadata or broadcasts.

### API request policy

`server/app.ts` checks Origin and rejects writes marked cross-site. Inspect actual extension requests before choosing any exception; keep changes limited to authenticated extension endpoints. Embedding and API CORS are different concerns. Serving extension UI and API on one application origin is the proposed default; do not add wildcard API access merely because Owlbear is the parent page.

### Permissions and reliable saving

Authorise using the website account and current room permissions. An Owlbear GM label or token owner is not proof of website character access. Reuse current reads and play validation through shared backend services.

The sheet must show server-confirmed saves, handle stale versions, stop conflicting pending writes, and recover after closing/reopening or a lost response. Version checks alone do not identify whether a timed-out operation already saved; the earlier plan proposes operation receipts for that case. Preserve assignments and existing play permissions, including permanent editing restrictions.

Refresh visible state on reopen/focus and use controlled polling initially. Preserve quick sheet loading followed by descriptions. Shared website and extension data does not imply instantaneous updates across clients.

## Proofs before calling it working

1. Install the test manifest in a real Owlbear room; load both view sizes and use the map alongside the compact view.
2. Connect a test website account with third-party cookies blocked; verify close/reopen, reload and disconnect.
3. Read an authorised test character with correct homebrew references; deny another account and an unassigned player.
4. Save one HP change, confirm it on the website, and confirm a website change appears in the extension.
5. Exercise simultaneous saves, an uncertain response, reconnection and assignment revocation without duplicate actions or stale protected displays.
6. Check readable layouts, keyboard use, narrow screens and error/loading states.

Use fictional data for the shell, then an isolated test database for connected proofs. No production settings or data need changing to collect these findings.

## Next planning decisions

Define compact contents, expanded-sheet parity and whether compact must remain open during map interaction. Prove resize versus modal behaviour before committing the layout. Then validate pairing/session lifecycle and write recovery. The earlier requirement for DM controls remains on the roadmap; this research focuses on the sheet foundation the user prioritised today.
