---
name: wiki-schema
description: Page types, frontmatter specification, file naming conventions, and config.yaml schema for the llm-wiki system
---

# Wiki Schema

## File naming

All wiki pages live in `wiki/pages/` and use `kebab-case.md` filenames. Derive the slug from the title: lowercase, spaces to hyphens, remove special characters.

Examples: `event-sourcing.md`, `andrej-karpathy.md`, `summary-attention-is-all-you-need.md`

## Page types

| Type | Purpose | Filename prefix |
|---|---|---|
| `entity` | A person, organization, tool, or product | none (e.g. `postgres.md`) |
| `concept` | An idea, pattern, or theme | none (e.g. `event-sourcing.md`) |
| `summary` | Notes distilled from a specific source | `summary-` (e.g. `summary-attention-paper.md`) |
| `synthesis` | Cross-source analysis or comparison | none (e.g. `llm-context-window-comparison.md`) |

## Required frontmatter

Every page must have this YAML frontmatter block at the top:

```yaml
---
title: "Human-readable title"
type: concept
tags: [tag1, tag2]
created: <formatted-date>
updated: <formatted-date>
sources: []
---
```

- `title`: Human-readable, title case
- `type`: one of `entity`, `concept`, `summary`, `synthesis`
- `tags`: array of tags from `wiki/tags.md` canonical list (kebab-case, lowercase)
- `created`: date when page was first created — format from `wiki.date_format` in `config.yaml`
- `updated`: date when page was last modified — format from `wiki.date_format` in `config.yaml`
- `sources`: relative paths to files in `sources/` that this page draws from (e.g. `sources/paper.pdf`)
- `sensitive` *(optional)*: set to `true` to exclude this page from MCP `search_wiki` and `list_pages` results by default. `get_page` still works. Use for personal notes you don't want surfacing in work sessions.

**Date formatting**: read `wiki.date_format` from `config.yaml` before writing any date. Default is `MM/DD/YYYY` (e.g. `05/27/2026`). Tokens: `YYYY` = 4-digit year, `MM` = 2-digit month, `DD` = 2-digit day. Always use ISO `YYYY-MM-DD` for log.md headers — that format is structural and never changes.

## Link format

Read `config.yaml` before writing any links. The `wiki.link_format` field controls which format to use:

**`standard`** (default) — regular Markdown links. Renders everywhere: GitLab, GitHub, VS Code, Warp, any IDE.
```markdown
[Event Sourcing](pages/event-sourcing.md)          ← linking to another wiki page
[Meeting Notes](../sources/meeting-2026-05-27.md)  ← linking to a source file
```

**`obsidian`** — wikilinks. Enables Obsidian graph view and native backlinks. Does not render on GitLab/GitHub web UI.
```markdown
[[event-sourcing]]                    ← linking to another wiki page
[[event-sourcing|Event Sourcing]]     ← with display text
```
In Obsidian mode, omit the `## Sources` section — Obsidian tracks backlinks natively. Keep `sources` frontmatter field for MCP compatibility.

Always check `config.yaml` first. Never mix formats within the same wiki.

## Page structure

```markdown
---
[frontmatter]
---

One-paragraph summary of the topic.

## Key Points

- Point one
- Point two

## Detail sections as needed

...

## Sources
<!-- Standard mode only — omit in Obsidian mode -->
- [Source Title](../sources/filename.ext)
```

## config.yaml schema

Located at the root of the wiki data repo. Claude reads this at session start.

```yaml
wiki:
  name: "My Wiki"             # display name used in index.md and commit messages
  focus: "general notes"      # Claude uses this to decide relevance of new material
  author: "Your Name"         # used in git commits and page frontmatter
  link_format: standard       # standard | obsidian
  date_format: "MM/DD/YYYY"   # date display format — YYYY-MM-DD for ISO, DD/MM/YYYY for European

git:
  auto_commit: true           # commit before session ends
  auto_push: false            # push after auto-commit (only if remote is set)
  auto_pull: true             # pull at session start (only if remote is set)

mcp:
  path: "/absolute/path/to/wiki"   # set by /llm-wiki:wiki-setup, do not edit manually
```
