Convert the wiki between Standard (Markdown links) and Obsidian ([[wikilinks]]) format.

Target: $ARGUMENTS

If $ARGUMENTS is empty, ask the user:
"Convert to which format?
  1. obsidian — [[wikilinks]], graph view, native backlinks (backlinks.md removed)
  2. standard — [Title](path) links, renders on GitLab/GitHub/any editor (backlinks.md rebuilt)"

## What this does

**Standard → Obsidian:**
- Converts all `[Title](pages/slug.md)` links to `[[slug]]`
- Removes `## Sources` sections (Obsidian tracks backlinks natively)
- Deletes `wiki/backlinks.md`
- Scaffolds `wiki/.obsidian/` if not already present
- Updates `config.yaml` → `link_format: obsidian`

**Obsidian → Standard:**
- Converts `[[slug]]` → `[Title](pages/slug.md)` (title looked up from page frontmatter)
- Converts `[[slug|Display]]` → `[Display](pages/slug.md)`
- Rebuilds `## Sources` sections from each page's `sources` frontmatter
- Rebuilds `wiki/backlinks.md` from scratch
- Removes `wiki/.obsidian/` folder
- Updates `config.yaml` → `link_format: standard`

## Steps

1. Read `config.yaml` to get the wiki path (`mcp.path`)
2. Confirm the conversion direction with the user before proceeding
3. Run: `node <plugin-path>/server/convert.js "<wiki-path>" <target-format>`
   - Find the plugin path the same way as /wiki-setup (search ~/.claude for wiki-notes directory)
4. Stage and commit: `git -C "<wiki-path>" add . && git -C "<wiki-path>" commit -m "wiki: convert to <target-format> format"`
5. Report how many pages were converted and any next steps

## Note

This is a free operation — no Claude model is used for the conversion. The script handles all link rewriting, title lookup, and index rebuilding deterministically.
