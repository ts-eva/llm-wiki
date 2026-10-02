Capture content into sources/ with the `save_source` tool. No pipeline runs — the note is searchable immediately; `/llm-wiki:wiki-process` (or the nightly job) organizes it into pages later.

Content: $ARGUMENTS

If $ARGUMENTS is empty, ask the user: "What would you like to add? (paste text, URL, or file path)"

## Input types

- Starts with `http://`, `https://`, or `url:` — strip `url:`, WebFetch the page, keep the title and main body (drop nav/footer/ads). Call `save_source` with `title` = page title, `content` = body, `source_url` = the URL, `type: "article"`.
- An existing file path — Read it, then `save_source` with a title from its first heading or filename.
- Otherwise pasted text — `save_source` with a short readable title for the topic.

## Rules

- Pass `content` without frontmatter; `save_source` writes `created:` (and `updated:` on an existing title), applies the naming rules, and commits.
- Same title = same note. To add to an existing note, read `sources/<title>.md` first and pass the full merged content.
- Title: readable, specific (`smart match widget background refresh on android`), no date, no `session-` prefix.

Tell the user: "Saved to <file>. Searchable now; organized into pages on the next /llm-wiki:wiki-process."
