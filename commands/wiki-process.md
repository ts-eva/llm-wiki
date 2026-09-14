Batch-process everything new or changed in sources/ — tag with Haiku, organize into wiki pages with Sonnet, commit everything.

Use this at the end of the day (or whenever you're ready) after adding or editing files in sources/. One pipeline run is cheaper than calling /llm-wiki:wiki-add for each file individually: prompt caches load once, Sonnet sees the full picture for better organization and tag consistency.

`sources/index.md` is owned by this pipeline. Never hand-edit it — to change what the wiki says, add or edit a source file and run this command.

## Steps

### Phase 1 — Detect new, changed, and removed sources

1. Read `config.yaml` to load settings
2. Call the `source_status` tool (llm-wiki MCP server). It returns:
   - **untagged** — files in `sources/` with no index entry
   - **changed** — files edited since they were tagged (content hash differs); **unstamped** is the subset tagged before change tracking existed
   - **unorganized** — entries whose wiki pages are missing or were built from an older version of the source
   - **removed** — index entries whose source file no longer exists
   - **ignored** — files with `ignore: true` frontmatter (never tagged or organized)
3. If **unstamped** is non-empty, the index predates change tracking. Ask the user once: re-tag those N entries (a Haiku pass over each), or baseline them as current. For baseline: call `mark_sources` with `stage: "baseline"` and those files, commit `git add sources/index.md && git commit -m "wiki: baseline source hashes"`, then call `source_status` again.
4. If untagged, changed, unorganized and removed are all empty, tell the user: "Nothing new to process — wiki is up to date." Stop here.
5. Report what was found:
   ```
   Found X new, Y changed, Z removed source(s); W entry/entries to organize.
   Starting pipeline…
   ```

### Phase 2 — Tag new and changed sources (wiki-tagger, Haiku)

Skip if untagged and changed are both empty.

Invoke the `llm-wiki:wiki-tagger` agent once with two labeled lists:
- **New files** (untagged) — write a new entry for each
- **Changed files** (changed) — replace each file's existing entry in place, carrying its `wiki-pages:` list forward

After wiki-tagger completes:
- Call `mark_sources` with `stage: "tagged"` and every file from both lists. If it reports errors, stop and show them.
- Commit: `git add sources/index.md wiki/tags.md && git commit -m "wiki: tag sources"`
- Report: "Tagged X new, re-tagged Y changed source(s)."

### Phase 3 — Organize into wiki pages (wiki-curator, Sonnet)

1. Call `source_status` again — its **unorganized** list is the work (it now includes the re-tagged sources).
2. For each **removed** entry, read its `wiki-pages:` from `sources/index.md` before anything else.
3. If unorganized and removed are both empty, skip to Phase 4.
4. Invoke the `llm-wiki:wiki-curator` agent once with:
   - **Unorganized entries**, each marked *new* (`wiki-pages: []`) or *updated source* (has pages — revise those pages to match the new entry: change facts that changed, remove facts the source no longer supports)
   - **Removed sources** with the pages that cited them — drop the source from those pages' `sources:` frontmatter and `[[sources/...]]` links, and remove facts only that source supported
5. After wiki-curator completes:
   - Call `mark_sources` with `stage: "organized"` and the unorganized files, and `stage: "remove"` with the removed files. If either reports errors, show them.
   - Call `source_status` once more; unorganized and removed should be empty.
   - Commit: `git add . && git commit -m "wiki: process batch [YYYY-MM-DD]"` (use today's date)
   - If `git.auto_push` is true and a remote is configured: `git push`

### Phase 4 — Report

Print a summary:
```
Pipeline complete.
  Tagged:    X new source(s)
  Re-tagged: Y changed source(s)
  Removed:   Z deleted source(s)
  Created:   N new wiki page(s)
  Updated:   M existing page(s)
  Committed: [commit hash short form]
```

If in Obsidian mode and Obsidian is not already open, offer: "Open your wiki in Obsidian? (y/N)"
If user says yes, run: `open -a Obsidian "<wiki-path>"`
