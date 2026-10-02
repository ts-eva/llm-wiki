Search the wiki for: $ARGUMENTS

If $ARGUMENTS is empty, ask the user: "What are you looking for?"

Call the `search_wiki` tool with the query (words match in any order; pages and sources, including unprocessed notes). Show:

- Pages: **[Title](pages/slug.md)** (type) — excerpt
- Sources: `sources/<file>` — summary or excerpt; mark unprocessed ones `(not yet organized)`

If `partial` is set, say no note matched every word. If nothing matched, call `list_tags` and suggest related tags.

For a synthesized answer instead of links, use `/llm-wiki:wiki-ask`.
