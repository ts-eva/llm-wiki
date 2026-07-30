Show a quick dashboard of your wiki's current state. Free — no model needed.

## Steps

1. Read `config.yaml` to get `mcp.path`
2. Gather stats by reading files directly:

### Pages
- Count `.md` files in `wiki/pages/` (excluding `.gitkeep`)
- Count by type: read each file's `type:` frontmatter field, tally entity / concept / summary / synthesis

### Tags
- Read `wiki/tags.md` — count total canonical tags
- For each page, collect its `tags:` array — tally usage per tag
- Report top 5 most-used tags

### Sources
- Count files in `sources/` (excluding `.gitkeep`, `index.md`)
- Count entries in `sources/index.md` (sections starting with `## sources/`)
- Unprocessed = files in sources/ not appearing in sources/index.md
- Organized = entries in sources/index.md where `wiki-pages:` is non-empty

### Activity
- Read `log.md` (root) — count entries this calendar month
- Report last 5 log entries

## Output format

```
Wiki: <wiki name>

Pages
  Total:      N
  Entities:   N  Concepts: N  Summaries: N  Syntheses: N

Tags
  Total: N canonical tags
  Top 5: tag-one (N), tag-two (N), tag-three (N), ...

Sources
  Total:       N files
  Tagged:      N  (in sources/index.md)
  Organized:   N  (have wiki pages)
  Pending:     N  (not yet tagged)

Activity this month: N changes
  Last entries:
    [YYYY-MM-DD] action | title
    ...
```
