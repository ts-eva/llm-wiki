---
name: wiki-operations
description: Rules for maintaining wiki/index.md, wiki/log.md, wiki/tags.md, wiki/backlinks.md, and all git operations
---

# Wiki Operations

## Session start checklist

Run these steps at the start of every session when inside the wiki repo:

1. Read `config.yaml` to load user settings
2. If `git.auto_pull` is true and a remote is configured: run `git pull`
3. Run `git status` — any untracked files in `sources/` are pending ingestion
4. If pending sources exist, tell the user and offer to ingest them before anything else

## Ingesting a source

When ingesting content (from `sources/` or pasted by the user):

1. Determine the appropriate page type (entity, concept, summary, synthesis)
2. Check `wiki/tags.md` for existing tags — reuse the closest match, do not invent new ones unless truly necessary
3. Create `wiki/pages/<slug>.md` with correct frontmatter and `## Sources` section
4. Update `wiki/index.md` — add the new entry
5. Append to `wiki/log.md` — one line entry
6. Update `wiki/tags.md` — add any genuinely new tags
7. Update `wiki/backlinks.md` — add source → page mapping
8. Commit: `git add . && git commit -m "wiki: add <title>"`

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

## Maintaining wiki/log.md

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

## Maintaining wiki/backlinks.md

Inverse index: source file → wiki pages that reference it. Update whenever a page's `sources` frontmatter changes.

```markdown
# Backlinks

## sources/paper.pdf
- [Page Title](pages/page-title.md)
- [Another Page](pages/another-page.md)

## sources/notes.md
- [Concept Page](pages/concept.md)
```

## Updating an existing page

When updating a page:
1. Edit `wiki/pages/<slug>.md` — update content and the `updated` frontmatter field
2. Update `wiki/index.md` if the summary changed
3. Append to `wiki/log.md`: `## [YYYY-MM-DD] update | Title`
4. Update `wiki/tags.md` and `wiki/backlinks.md` if tags or sources changed
5. Commit: `git add . && git commit -m "wiki: update <title>"`

## Session end

Before the session ends:
1. Check for any uncommitted changes: `git status`
2. If there are uncommitted changes: `git add . && git commit -m "wiki: <brief summary of session changes>"`
3. If `git.auto_push` is true and a remote is configured: `git push`

## Scope guard

- Write only to `wiki/pages/`, `wiki/index.md`, `wiki/log.md`, `wiki/tags.md`, `wiki/backlinks.md`
- `sources/` is read-only — never modify or delete source files
- Never modify `config.yaml` unless the user explicitly asks
- Never modify `CLAUDE.md` unless the user explicitly asks
