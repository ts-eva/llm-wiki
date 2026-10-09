Find near-duplicate tags and merge them. Run occasionally when the tag list gets messy.

## Steps

1. Call `source_status`; its `wiki` field is `<wiki>`.
2. Invoke `llm-wiki:wiki-analyst` (Haiku) with the contents of `<wiki>/wiki/tags.md`; it returns numbered merge proposals (`Keep X, remove Y`).
3. Show them. Ask: "Apply these? (y/N), or numbers to skip (e.g. 2,3)". No → stop.
4. For each confirmed merge call `rename_tag` with `from` (removed) and `to` (kept). It rewrites page frontmatter, `sources/index.md` entry tags and `wiki/tags.md` — never body text. Report any `skipped` pages (block-style YAML tag lists) for a manual edit.
5. Commit: `commit_files` with `wiki/pages/<slug>.md` for every page `rename_tag` reported, `wiki/tags.md` and `sources/index.md`, message `wiki: retag — merge <removed> into <kept>`.
6. Report pages and entries updated per merge.
