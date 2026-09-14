---
name: wiki-operations
description: Rules for maintaining wiki/index.md, wiki/tags.md, log.md, backlinks.md, and all git operations
---

# Wiki Operations

## Context lookup hierarchy

Always follow this order — never skip ahead:

1. **`wiki/index.md`** — first stop, titles and one-line summaries, minimal tokens
2. **`wiki/pages/<slug>.md`** — full organized page, read when the index points here
3. **`sources/index.md`** — Haiku-processed entries with tags/key-points, read if no wiki page exists yet
4. **`sources/<file>`** — raw input, **never read by default** — only if user explicitly asks for the original

This hierarchy ensures Claude consumes the minimum tokens needed for accurate answers.

## Session start checklist

Run these steps at the start of every session when inside the wiki repo:

1. Read `config.yaml` to load user settings
2. If `git.auto_pull` is true and a remote is configured: run `git pull`
3. Call the `source_status` tool — untagged or changed files in `sources/` signal new material
4. If there are any, tell the user and offer to run `/llm-wiki:wiki-process` (tags and organizes new and changed sources)

## Two-phase ingestion

Change tracking: each `sources/index.md` entry carries `hash:` (source content hash when tagged) and `organized-hash:` (the hash its wiki pages were built from), stamped only by the `mark_sources` tool. `source_status` compares them with the current files, so edits to existing sources are processed just like new files.

**Phase 1 — Tagging (wiki-tagger, Haiku)**: runs on new and changed source files
- Reads raw source once
- Writes a rich entry to `sources/index.md` (tags, key-points, action-items, quotes); for a changed source, replaces its entry in place and keeps `wiki-pages:`
- Pipeline stamps `hash:` and commits `sources/index.md` and any new tags

**Phase 2 — Organization (wiki-curator, Sonnet)**: runs when user wants wiki pages
- Works the `source_status` unorganized list: new entries (`wiki-pages: []`) and entries whose source changed
- Writes or revises structured wiki pages from the Haiku-processed summaries; cleans up pages citing removed sources
- Never re-reads raw source files (Haiku captured what matters)
- Updates all wiki indexes and commits

## Ingesting pasted content (no source file)

When a user pastes content directly (no file in sources/):
1. Write the content to `sources/<title>.md` first (naming: see `llm-wiki:wiki-schema`)
2. Run `/llm-wiki:wiki-process`

## Maintaining wiki/index.md

One entry per page, grouped by type. Format:

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

Append-only. Never edit past entries. Format each entry as:

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
5. Commit: `git add . && git commit -m "wiki: update <title>"`

## Session end

Before the session ends:
1. Check for any uncommitted changes: `git status`
2. If there are uncommitted changes: `git add . && git commit -m "wiki: <brief summary of session changes>"`
3. If `git.auto_push` is true and a remote is configured: `git push`

## Scope guard

- Write only to `wiki/pages/`, `wiki/index.md`, `wiki/tags.md`, `log.md` (root), `backlinks.md` (root), and source files in `sources/`
- `sources/` holds raw material. Add a new file for new material; edit an existing source when its content changes (corrections, follow-ups) — `/llm-wiki:wiki-process` detects the edit and updates the pages. Don't delete a source unless the user asks.
- `sources/index.md` is pipeline-owned: written only by wiki-tagger (entries), wiki-curator (`wiki-pages:` lines) and the `mark_sources` tool (`hash:` / `organized-hash:`). Never hand-edit it in a session — to change what the wiki says, edit or add a source and run `/llm-wiki:wiki-process`.
- Never modify `config.yaml` unless the user explicitly asks
- Never modify `CLAUDE.md` unless the user explicitly asks
