Convert the wiki between Standard (Markdown links) and Obsidian ([[wikilinks]]) format.

Target: $ARGUMENTS

If $ARGUMENTS is empty, ask the user:
"Convert to which format?
  1. obsidian — [[wikilinks]], graph view, native backlinks (backlinks.md removed)
  2. standard — [Title](path) links, renders on GitLab/GitHub/any editor (backlinks.md rebuilt)"

## What this does

**Standard → Obsidian:**
- Converts `[Title](slug.md)` cross-page links to `[[slug|Title]]`, in pages and in `wiki/index.md`
- Removes `## Sources` sections (the `sources:` frontmatter keeps the record; Obsidian tracks backlinks natively)
- Deletes `backlinks.md` (root)
- Updates `config.yaml` → `link_format: obsidian`

**Obsidian → Standard:**
- Converts `[[slug]]` → `[Title](slug.md)` (title from page frontmatter) and `[[slug|Display]]` → `[Display](slug.md)`, in pages and in `wiki/index.md` (`pages/slug.md` there)
- Rebuilds `## Sources` sections from each page's `sources` frontmatter
- Rebuilds `backlinks.md` (root) from scratch
- Removes `.obsidian/` folder from wiki root
- Updates `config.yaml` → `link_format: standard`

## Steps

1. Read `config.yaml` to get the wiki path (`mcp.path`)
2. Confirm the conversion direction with the user before proceeding
3. Run: `node <plugin-path>/server/convert.js "<wiki-path>" <target-format>`
   - `<plugin-path>`: `grep -l '"name": "llm-wiki"' "$HOME"/.claude/plugins/marketplaces/*/.claude-plugin/plugin.json | head -1 | sed 's#/.claude-plugin/plugin.json$##'`
4. Stage and commit: `git -C "<wiki-path>" add . && git -C "<wiki-path>" commit -m "wiki: convert to <target-format> format"`
5. Report how many pages were converted and any next steps

## Note

This is a free operation — no Claude model is used for the conversion. The script handles all link rewriting, title lookup, and index rebuilding deterministically. Page frontmatter is preserved byte-for-byte.
