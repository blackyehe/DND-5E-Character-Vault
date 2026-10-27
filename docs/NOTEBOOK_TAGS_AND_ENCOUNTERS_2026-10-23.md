# Codex tags and encounter links

Released: [deployment and verification](NOTEBOOK_TAGS_AND_ENCOUNTERS_RELEASE_2026-10-23.md).

Use the approved Codex theme, type and bounded Library/reader panes. Tag chips are small, left aligned and functional: the entry editor creates/reuses custom tags; the Library filter combines selected tags with AND; a reader chip opens the whole library filtered by that tag. The filter is collapsible and searchable so navigation remains compact. Reuse existing theme colors and motion; no separate geography browser or tag dashboard.

Only the DM changes entry tags. Players can see and filter tags on readable entries; suggestions/counts are derived after entry and ancestor permissions. Tags do not grant entry access. Preserve tags for old clients and text-only version restoration. Up to 20 tags, 48 characters per tag; normalize whitespace, Unicode and case duplicates. Fully custom text (including commas) works.

Encounters automatically link plain session references, including bold labels, number lists, ranges and Session N notation, to a single accessible session entry. Existing Markdown links and inline/fenced code are retained. Missing or ambiguous targets stay readable text. Link navigation uses the existing notebook Back behavior. Source Markdown is not rewritten.

No automatic tags are inferred or added to live campaign entries. Existing approved content and sharing remain intact; the feature supplies manual tagging controls.
