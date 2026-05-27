Batch-process all new files in sources/ — tag with Haiku, organize into wiki pages with Sonnet, commit everything.

Use this at the end of the day (or whenever you're ready) after dropping files into sources/. One pipeline run is cheaper than calling /wiki-add for each file individually: prompt caches load once, Sonnet sees the full picture for better organization and tag consistency.

## Steps

### Phase 1 — Detect new sources

1. Read `config.yaml` to load settings
2. Run `git status --porcelain sources/` to find untracked files in `sources/`
3. Also check `sources/index.md` for any entries where `wiki-pages: []` (tagged but not yet organized)
4. Build two lists:
   - **Untagged**: files in `sources/` not yet in `sources/index.md`
   - **Unorganized**: entries in `sources/index.md` with `wiki-pages: []`
5. If both lists are empty, tell the user: "Nothing new to process — wiki is up to date." Stop here.
6. Report what was found:
   ```
   Found X new file(s) to tag, Y entry/entries ready to organize.
   Starting pipeline…
   ```

### Phase 2 — Tag new sources (wiki-tagger, Haiku)

For each untagged file (in one wiki-tagger invocation — batch them all together for efficiency):

Invoke the `wiki-notes:wiki-tagger` agent with all untagged files listed. The agent will:
- Read each raw source file once
- Write a rich entry per file to `sources/index.md` (tags, key-points, action-items, notable-quotes)

After wiki-tagger completes:
- Commit: `git add sources/index.md && git commit -m "wiki: tag sources"`
- Report: "Tagged X file(s)."

### Phase 3 — Organize into wiki pages (wiki-curator, Sonnet)

Invoke the `wiki-notes:wiki-curator` agent once with all entries that have `wiki-pages: []` in `sources/index.md`. The agent will:
- Read `sources/index.md` entries (never raw source files)
- Create or update wiki pages in `wiki/pages/`
- Update `wiki/index.md`, `wiki/log.md`, `wiki/tags.md`
- Update `wiki/backlinks.md` (standard mode only)

After wiki-curator completes:
- Commit: `git add . && git commit -m "wiki: process batch [YYYY-MM-DD]"` (use today's date)
- If `git.auto_push` is true and a remote is configured: `git push`

### Phase 4 — Report

Print a summary:
```
Pipeline complete.
  Tagged:    X new source(s)
  Created:   N new wiki page(s)
  Updated:   M existing page(s)
  Committed: [commit hash short form]
```

If in Obsidian mode and Obsidian is not already open, offer: "Open your wiki in Obsidian? (y/N)"
If user says yes, run: `open "obsidian://open?vault=$(basename '<wiki-path>/wiki')"`
