Search the wiki for pages matching: $ARGUMENTS

If $ARGUMENTS is empty, ask the user: "What are you looking for?"

Steps:
1. Read `config.yaml` to get the wiki path (mcp.path)
2. Search `wiki/pages/` — scan page titles, frontmatter tags, and body content for matches
3. Also check `wiki/index.md` for quick title/summary matches
4. Return matching pages as a list: **[Title](pages/slug.md)** — one-line summary, with a brief excerpt showing where the match was found
5. If no matches found, say so clearly and suggest related tags from `wiki/tags.md`
