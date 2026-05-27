Save content to sources/ for later processing. No pipeline runs — use /wiki-process when ready to tag and organize.

Content: $ARGUMENTS

If $ARGUMENTS is empty, ask the user: "What would you like to add? (paste text, or give a file path)"

## Steps

1. Read `config.yaml` to get `mcp.path` and `wiki.link_format`
2. Derive a slug from the content or title: lowercase, kebab-case, max 40 chars (e.g. "event sourcing notes" → `event-sourcing-notes`)
3. Set filename: `sources/<slug>-<YYYY-MM-DD>.md` (use today's date)

### If link_format is `obsidian`

Use the Obsidian URI to create the note (zero Claude tokens for the write):

```bash
open "obsidian://new?vault=wiki&name=sources%2F<slug>-<YYYY-MM-DD>&content=<url-encoded-content>"
```

If the content is too long to URL-encode cleanly, fall back to writing the file directly (see standard mode below) and then opening it:
```bash
open "obsidian://open?vault=wiki&file=sources%2F<slug>-<YYYY-MM-DD>"
```

Tell the user: "Added to sources/ — Obsidian should open the new note. Run /wiki-process when you're ready to tag and organize."

### If link_format is `standard`

Write the content directly to `sources/<slug>-<YYYY-MM-DD>.md`.

Then run:
```bash
git -C "<wiki-path>" add sources/<slug>-<YYYY-MM-DD>.md && git -C "<wiki-path>" commit -m "wiki: add source <slug>"
```

Tell the user: "Saved to sources/<slug>-<YYYY-MM-DD>.md. Run /wiki-process when you're ready to tag and organize."
