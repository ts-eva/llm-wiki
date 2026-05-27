Save content to sources/ for later processing. No pipeline runs — use /wiki-process when ready to tag and organize.

Content: $ARGUMENTS

If $ARGUMENTS is empty, ask the user: "What would you like to add? (paste text, URL, or file path)"

## Detecting input type

- If $ARGUMENTS starts with `http://`, `https://`, or `url:` → **URL capture** (see below)
- If $ARGUMENTS is a file path that exists → copy or reference that file
- Otherwise → treat as pasted text

## Reading settings

Read `config.yaml` to get:
- `mcp.path` — wiki root
- `wiki.link_format` — standard | obsidian
- `wiki.date_format` — date format string (default: `MM/DD/YYYY`)

Format today's date using `wiki.date_format`. Token meanings: `YYYY` = 4-digit year, `MM` = 2-digit month, `DD` = 2-digit day. Example: `MM/DD/YYYY` → `05/27/2026`.

## URL capture

1. Strip leading `url:` prefix if present
2. Use WebFetch to retrieve the page
3. Extract: page title (for slug + frontmatter) and main body text (strip nav/footer/ads)
4. Slug from title: lowercase kebab-case, max 40 chars

Write the file with frontmatter:
```markdown
---
created: <formatted-date>
source_url: <url>
title: <page title>
---

<extracted content>
```

## Pasted text or file

Derive a slug from the first line or title of content: lowercase kebab-case, max 40 chars.

Write the file with frontmatter:
```markdown
---
created: <formatted-date>
---

<content>
```

## Saving

Set filename: `sources/<slug>-<YYYY-MM-DD>.md` (always use ISO date in filename regardless of date_format — keeps filenames sortable).

### If link_format is `obsidian`

Use the Obsidian URI to create the note (zero Claude tokens for the write):

```bash
open "obsidian://new?vault=wiki&name=sources%2F<slug>-<YYYY-MM-DD>&content=<url-encoded-content>"
```

If the content is too long to URL-encode cleanly (over ~2000 chars), write the file directly then open it:
```bash
open "obsidian://open?vault=wiki&file=sources%2F<slug>-<YYYY-MM-DD>"
```

Tell the user: "Added to sources/ — Obsidian should open the new note. Run /wiki-process when you're ready to tag and organize."

### If link_format is `standard`

Write the file directly to `sources/<slug>-<YYYY-MM-DD>.md`, then:

```bash
git -C "<wiki-path>" add sources/<slug>-<YYYY-MM-DD>.md && git -C "<wiki-path>" commit -m "wiki: add source <slug>"
```

Tell the user: "Saved to sources/<slug>-<YYYY-MM-DD>.md. Run /wiki-process when ready."
