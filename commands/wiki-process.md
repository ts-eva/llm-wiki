Batch-process everything new or changed in sources/ — tag with Haiku, organize into wiki pages with Sonnet, commit once.

Mode: $ARGUMENTS — `auto` means unattended (the daily job, `scripts/nightly-process.sh`): never ask a question, baseline unstamped entries, skip the Obsidian offer, print only the final summary.

One run per batch is cheaper than processing each note on its own: prompt caches load once and Sonnet sees the full picture for better organization and tag consistency.

**Wiki path:** `<wiki>` is the `wiki` field returned by `prepare_sources` / `source_status` — the folder the llm-wiki server serves. Use it, as an absolute path, for every file and git command. Never take a wiki path from CLAUDE.md, memory, or the current directory.

`sources/index.md` is pipeline-owned and large. Never Read or Edit it — the llm-wiki tools read and write single entries: `get_source_entries`, `write_source_entry`, `set_wiki_pages`, `mark_sources`.

## Phase 1 — Prepare and detect

1. Call `prepare_sources`; its `wiki` field is `<wiki>`. Read `<wiki>/config.yaml` for `git.auto_push`.
2. `prepare_sources` stamps a `created:` date on notes missing one and renames untagged notes that break the naming rules (relinking `[[wikilinks]]`). If its `files` list is non-empty: `commit_files` with exactly those `files` and message `wiki: prepare sources`.
3. Call `source_status`:
   - **untagged** — files with no index entry
   - **changed** — edited since tagged (hash differs); **unstamped** is the subset tagged before change tracking existed
   - **unorganized** — entries whose wiki pages are missing or built from an older version
   - **removed** — entries whose source file is gone
   - **ignored** — `ignore: true` frontmatter, never processed
4. If **unstamped** is non-empty: in `auto` mode, baseline them. Otherwise ask once: re-tag those N entries (a Haiku pass each) or baseline them as current. Baseline = `mark_sources` with `stage: "baseline"`, then `commit_files` with `["sources/index.md"]` and message `wiki: baseline source hashes`, then `source_status` again.
5. If untagged, changed, unorganized and removed are all empty: say "Nothing new to process — wiki is up to date." and stop.
6. Report: `Found X new, Y changed, Z removed source(s); W to organize.`

## Phase 2 — Tag (wiki-tagger, Haiku)

Skip if untagged and changed are both empty.

Invoke `llm-wiki:wiki-tagger` with `<wiki>` and two labeled lists, **New files** (untagged) and **Changed files** (changed). More than 25 files: split into batches of 25, one invocation each.

`write_source_entry` stamps each entry's hash as it writes, so no separate mark step. Afterwards call `source_status`: any file still listed untagged or changed was not written — report it and leave it for the next run.

## Phase 3 — Organize (wiki-curator, Sonnet)

1. Call `source_status`; **unorganized** is the work (it now includes re-tagged sources).
2. For **removed** files, call `get_source_entries` with them to learn which `wiki-pages:` cited each.
3. If unorganized and removed are both empty, skip to Phase 4.
4. Invoke `llm-wiki:wiki-curator` once with `<wiki>` and:
   - **Unorganized** filenames, each marked *new* or *updated source* (it fetches the entries itself)
   - **Removed** filenames with the pages that cited them
5. Afterwards: `mark_sources` with `stage: "organized"` for the unorganized files and `stage: "remove"` for the removed ones; show any errors. Call `source_status` once more — unorganized and removed should be empty.

## Phase 4 — Commit and report

One commit for the tag + organize work: `commit_files` with message `wiki: process batch [YYYY-MM-DD]` and these `files`:

- `sources/<file>` for every **untagged**, **changed** and **removed** file from Phase 1 (the source versions this batch processed, and removals)
- `sources/index.md`, `wiki/` (pipeline-owned: every change under it), `log.md`, `backlinks.md`

Never `git add -A` or `git add .`: other sessions may have edits in progress in the wiki, and `commit_files` takes only these paths.

If `git.auto_push` is true and a remote is configured: `git -C "<wiki>" push`.

```
Pipeline complete.
  Prepared:  S stamped, R renamed
  Tagged:    X new, Y re-tagged
  Removed:   Z
  Pages:     N created, M updated
  Commit:    <short hash>
```

Not in `auto` mode, Obsidian link format, Obsidian not running: offer "Open your wiki in Obsidian? (y/N)" — yes runs `open -a Obsidian "<wiki>"`.
