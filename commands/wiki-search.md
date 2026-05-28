Search the wiki for pages matching: $ARGUMENTS

If $ARGUMENTS is empty, ask the user: "What are you looking for?"

## Steps

1. Read `config.yaml` to get `mcp.path`
2. Check `wiki/index.md` first — scan titles and one-line summaries for quick matches (minimal reads)
3. If index gives no results, scan `wiki/pages/` — check frontmatter tags and body content
4. Return matching pages as:
   **[Title](pages/slug.md)** — one-line summary · matched in: title | tags | content
5. If no matches: say so clearly and suggest related tags from `wiki/tags.md`

This command returns links. For synthesized answers across pages, use `/wiki-ask`.
