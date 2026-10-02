Find wiki pages that mention another page's title without linking it, and offer to add the links. Run occasionally to keep the graph dense.

## Steps

1. Call `find_unlinked_mentions` (free — no model reads the pages). Wiki path `<wiki>` = the `wiki` field of `source_status`; read `<wiki>/config.yaml` for `wiki.link_format`.
2. `count` is 0: "All page titles are linked — graph looks good." Stop.
3. Show the mentions grouped by page, numbered:
   ```
   event-sourcing.md mentions but doesn't link:
     1. "Postgres" → postgres  (…works well with Postgres for…)
   ```
4. Ask: "Add these links? (A)ll, (S)elect numbers, (N)o".
5. For each confirmed link, wrap the first prose occurrence of the title: standard `[Title](slug.md)`, obsidian `[[slug|Title]]`. Never inside links, headings, code or frontmatter.
6. Record the edits with one `append_log` call (`update`, page title each).
7. Commit: `git -C "<wiki>" add wiki/pages log.md && git commit -m "wiki: add missing links (N pages)"`.
