Scan your tag list for near-duplicates and consolidate them. Run occasionally when you notice the tag list getting messy.

## Steps

1. Read `config.yaml` to get `mcp.path`
2. Read `wiki/tags.md` — extract all canonical tags

### Phase 1 — Detect near-duplicates (wiki-analyst, Haiku)

Invoke the `llm-wiki:wiki-analyst` agent (Haiku) with the contents of `wiki/tags.md`. It will return a numbered list of proposed merges.

### Phase 2 — User confirms

Show the proposed merges. Ask: "Apply these consolidations? (y/N) Or type the numbers to skip (e.g. 2,3)"

If user says no or skips all: stop here.

### Phase 3 — Rename across wiki (Sonnet)

For each confirmed merge:
1. Update all pages in `wiki/pages/` — replace old tag in frontmatter `tags:` array
2. Update `wiki/tags.md` — remove the deprecated tag entry
3. Note: do NOT do a naive find-replace on content body — only update the frontmatter `tags:` field

Commit: `git add . && git commit -m "wiki: retag — merge [old] into [kept] (N pages updated)"`

Report: how many pages were updated per merge.
