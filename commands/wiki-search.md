Search the wiki for pages matching: $ARGUMENTS

If $ARGUMENTS is empty, ask the user: "What are you looking for?"

## Steps

1. Read `config.yaml` to get `mcp.path` and `wiki.link_format`

### If link_format is `obsidian` and Obsidian is running

Try the Obsidian CLI first (free — no file reads, no tokens):
```bash
obsidian search:context "<query>"
```
If it returns results, format them as:
- **[Title](pages/slug.md)** — matched line excerpt

If the CLI is unavailable or returns nothing, fall back to the standard file scan below.

### Standard file scan (standard mode, and obsidian fallback)

2. Check `wiki/index.md` first — scan titles and one-line summaries for quick matches (minimal reads)
3. If index gives no results, scan `wiki/pages/` — check frontmatter tags and body content
4. Return matching pages as:
   **[Title](pages/slug.md)** — one-line summary · matched in: title | tags | content
5. If no matches: say so clearly and suggest related tags from `wiki/tags.md`

This command returns links. For synthesized answers across pages, use `/wiki-ask`.
