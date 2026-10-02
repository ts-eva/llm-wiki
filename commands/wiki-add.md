Save content to sources/ for later processing. No pipeline runs — use /llm-wiki:wiki-process when ready to tag and organize.

Content: $ARGUMENTS

If $ARGUMENTS is empty, ask the user: "What would you like to add? (paste text, URL, or file path)"

## Detecting input type

- If $ARGUMENTS starts with `http://`, `https://`, or `url:` → **URL capture** (see below)
- If $ARGUMENTS is a file path that exists → copy or reference that file
- Otherwise → treat as pasted text

## Reading settings

Read `config.yaml` to get:
- `mcp.path` — wiki root
- `wiki.date_format` — date format string (default: `MM/DD/YYYY`)

Format today's date using `wiki.date_format`. Token meanings: `YYYY` = 4-digit year, `MM` = 2-digit month, `DD` = 2-digit day. Example: `MM/DD/YYYY` → `05/27/2026`.

## URL capture

1. Strip leading `url:` prefix if present
2. Use WebFetch to retrieve the page
3. Extract: page title (for slug + frontmatter) and main body text (strip nav/footer/ads)
4. Name from title: readable lowercase title with spaces (see Naming below)

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

Derive a name from the first line or title of content (see Naming below).

Write the file with frontmatter:
```markdown
---
created: <formatted-date>
---

<content>
```

## Naming

Sources are named by readable title: lowercase, **spaces**, no kebab-case slug, no `session-`/`project-` prefix. Hyphens only inside names that contain one (`llm-wiki`, `x-ray`). Session logs: `YYYY-MM-DD short readable topic`. Other sources carry no date in the name (the `created:` frontmatter holds it).

## Saving

Set filename: `sources/<name>.md`.

Write the file to `sources/<name>.md`, then:

```bash
git -C "<wiki-path>" add "sources/<name>.md" && git -C "<wiki-path>" commit -m "wiki: add source <name>"
```

Tell the user: "Saved to sources/<name>.md. Not searchable until processed — run /llm-wiki:wiki-process."
