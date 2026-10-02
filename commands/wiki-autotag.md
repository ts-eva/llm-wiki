Tag new or changed sources/ files with wiki-tagger only (no page organizing). Silent when there is nothing to do.

Prefer the nightly job (`/llm-wiki:wiki-schedule`), which runs the full `/llm-wiki:wiki-process auto` and costs nothing on nights with no new notes.

## Steps

1. Call `source_status` (its `wiki` field is `<wiki>`). Work = **untagged** + **changed**, excluding **unstamped** (`/llm-wiki:wiki-process` handles those).
2. No work: exit with no output.
3. Invoke `llm-wiki:wiki-tagger` with `<wiki>`, **New files** and **Changed files** (batches of 25). `write_source_entry` stamps each entry as written.
4. Commit: `git -C "<wiki>" add sources/index.md wiki/tags.md && git commit -m "wiki: autotag <N> source(s) [YYYY-MM-DD]"`.
5. Report: "Tagged N new, re-tagged M: file1, file2, …"
