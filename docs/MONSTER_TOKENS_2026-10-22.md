# Monster token display

Available tokens appear as native linked images in the upper-right of the
statblock heading. They display at 88 pixels (64 in narrow containers) while
retaining the original image resolution. Right-click offers the browser image
menu, including Save image as; clicking opens the full image. No canvas, CSS
background, custom context menu or intercepted pointer event is involved.
Unavailable tokens are omitted; failed requests hide the image/link.

Existing imported packs already contain the resolved source record in their
provenance. `readMonsterExtensions` derives token metadata from it, leaving the
stored entry and content ID unchanged. An independent source/name lookup adds
tokens to the previously saved supplements and standard SRD reader. The lookup
contains 4,928 declared token mappings, including retained base tokens for
generated forms. Actual availability still depends on the upstream image host.

`shared/monster-token.ts` follows the upstream renderer's explicit override
precedence and ASCII filename normalization (accent removal, AE ligatures,
quotes stripped). URLs are safely encoded and restricted to HTTP(S) without
credentials. Optional token metadata and attribution survive native draft
validation. Token art remains separate from the lore/artwork references.

Validation: 21 targeted tests passed; frontend build and server typecheck passed.
Browser checks loaded the MM Aboleth token at 560 pixels, verified an unobstructed
contextmenu event, and confirmed no heading/token overlap at 320-pixel container
width, including a long name. No-token and failed-image cases omit their image.
MM/XMM Aboleth and VGM Abjurer image URLs returned 200 image/webp upstream.
Screenshot capture timed out twice; the alternate browser connection had no
browser available. Layout/image metrics were checked through the T3 preview.

The narrow UI patch is staged in ignored `.preview.local/monster-token-ui.patch`
against the combined Maps/theme component and stylesheet. The release thread
received the patch and supporting file list. Root production publishing remains
paused; all future publication must preserve the combined Maps branch source.
No pack data was rewritten and T3 Code was not restarted.

Published from the combined branch as app commit `e398964`, deployment
`dpl_6V52nXzdTVXaqTYbdRNvFYS6UqNe`, at https://dndoldal.vercel.app.
Read-only live QA confirmed the MM Aboleth token loads at 560 pixels and displays
at 88 pixels aligned to the heading's upper-right corner, with its native
contextmenu event unprevented and a link to the original image. Info, Artwork,
Regional effects and theme controls remain available without overflow or alerts.
Source-filter options show full titles and sort alphabetically by displayed name;
underlying source IDs remain intact. Root publishing remains paused.
