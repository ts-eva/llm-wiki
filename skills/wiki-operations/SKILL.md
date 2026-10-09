---
name: wiki-operations
description: Rules for maintaining wiki/index.md, wiki/tags.md, log.md, backlinks.md, and all git operations
---

# Wiki Operations

## Context lookup hierarchy

Always follow this order — never skip ahead:

1. **`search_wiki`** — ranked pages and sources with excerpts, minimal tokens; finds unprocessed notes too
2. **`get_page`** / `wiki/pages/<slug>.md` — full organized page
3. **`get_source_entries`** — the tagger's entry (tags, key-points) for a source with no page yet. Never Read `sources/index.md` whole: it is large
4. **`sources/<file>`** — raw input, only when the hit is unprocessed or the user asks for the original

This hierarchy ensures Claude consumes the minimum tokens needed for accurate answers.

## Session start checklist

Run these steps at the start of every session when inside the wiki repo:

1. Read `config.yaml` to load user settings
2. If `git.auto_pull` is true and a remote is configured: run `git pull`
3. The SessionStart hook already reports pending source changes; if any, offer `/llm-wiki:wiki-process` (or point at the daily job, `/llm-wiki:wiki-schedule`)

## Two-phase ingestion

Change tracking: each `sources/index.md` entry carries `hash:` (source content hash when tagged) and `organized-hash:` (the hash its wiki pages were built from), stamped only by the `mark_sources` tool. `source_status` compares them with the current files, so edits to existing sources are processed just like new files.

**Phase 0 — Prepare (`prepare_sources`)**: stamps missing `created:` dates; renames untagged notes that break the naming rules and relinks `[[wikilinks]]` to them

**Phase 1 — Tagging (wiki-tagger, Haiku)**: runs on new and changed source files
- Reads raw source once
- Writes its entry with `write_source_entry`, which sets `date:` from `created:`, stamps `hash:`, and carries `wiki-pages:` forward on a changed source

**Phase 2 — Organization (wiki-curator, Sonnet)**: runs when user wants wiki pages
- Works the `source_status` unorganized list: new entries (`wiki-pages: []`) and entries whose source changed
- Fetches only its entries (`get_source_entries`), writes or revises pages, records them with `set_wiki_pages`; cleans up pages citing removed sources
- Never re-reads raw source files (Haiku captured what matters)
- Updates wiki indexes; the pipeline commits once at the end

## Ingesting pasted content (no source file)

When a user pastes content directly (no file in sources/): call `save_source` (or `/llm-wiki:wiki-add`). It names the file, writes `created:`, and commits. The note is searchable at once; `/llm-wiki:wiki-process` organizes it.

## Maintaining wiki/index.md

One entry per page, grouped by type. Use the configured link format — standard shown here; in obsidian mode entries are `- [[slug|Title]] — one-line summary`. Format:

```markdown
# [Wiki Name]

## Entities
- [Title](pages/filename.md) — one-line summary

## Concepts
- [Title](pages/filename.md) — one-line summary

## Summaries
- [Title](pages/filename.md) — one-line summary

## Syntheses
- [Title](pages/filename.md) — one-line summary
```

Always keep entries sorted alphabetically within each group.

## Maintaining log.md (wiki root)

Append-only. Never edit past entries; append with the `append_log` tool (no need to read the file). Format each entry as:

```
## [YYYY-MM-DD] action | title
```

Actions: `add`, `update`, `delete`, `ingest`, `restructure`

Example:
```
## [2026-05-22] add | Event Sourcing
## [2026-05-22] ingest | summary-attention-is-all-you-need
```

## Maintaining wiki/tags.md

Canonical tag list. One tag per line with a short definition:

```markdown
# Tags

- `machine-learning` — topics related to training and using ML models
- `architecture` — software architecture patterns and decisions
- `database` — database systems, query patterns, migrations
```

Rules:
- Always kebab-case, always lowercase
- Before adding a tag, check if a similar one exists and reuse it
- Normalize on ingest: "ML" → `machine-learning`, "NLP" → `natural-language-processing`, "DB" → `database`
- Never create near-duplicate tags (e.g. do not add `ml` if `machine-learning` exists)

## Maintaining backlinks.md (wiki root)

**Only maintained in `standard` mode.** Check `config.yaml` → `wiki.link_format`:
- `standard`: maintain `backlinks.md` as described below — Claude owns this
- `obsidian`: skip entirely — Obsidian tracks backlinks natively via `[[wikilinks]]`

Inverse index: source file → wiki pages that reference it. Update whenever a page's `sources` frontmatter changes.

```markdown
# Backlinks

## sources/paper.pdf
- [Page Title](wiki/pages/page-title.md)
- [Another Page](wiki/pages/another-page.md)

## sources/notes.md
- [Concept Page](wiki/pages/concept.md)
```

## Updating an existing page

When updating a page:
1. Edit `wiki/pages/<slug>.md` — update content and the `updated` frontmatter field
2. Update `wiki/index.md` if the summary changed
3. Append to `log.md` (root): `## [YYYY-MM-DD] update | Title`
4. Update `wiki/tags.md` and `backlinks.md` (root) if tags or sources changed
5. Commit only the files you changed: `commit_files` with those paths (or leave it to the session-end commit)

## Session end

The `SessionEnd` hook commits the wiki files this session wrote with Write/Edit (`git.auto_commit`, default on), and pushes if `git.auto_push`. Never `git add .` / `git add -A` the wiki: other sessions may have edits in progress there. Files changed through Bash aren't tracked by the hook; commit those yourself with `commit_files`.

## Scope guard

- Write only to `wiki/pages/`, `wiki/index.md`, `wiki/tags.md`, `log.md` (root), `backlinks.md` (root), and source files in `sources/`
- `sources/` holds raw material. Add a new file for new material; edit an existing source when its content changes (corrections, follow-ups) — `/llm-wiki:wiki-process` detects the edit and updates the pages. Don't delete a source unless the user asks.
- `sources/index.md` is pipeline-owned: written only through `write_source_entry`, `set_wiki_pages` and `mark_sources`. Never hand-edit it in a session — to change what the wiki says, edit or add a source and run `/llm-wiki:wiki-process`.
- Never modify `config.yaml` unless the user explicitly asks
- Never modify `CLAUDE.md` unless the user explicitly asks
