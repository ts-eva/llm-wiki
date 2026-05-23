---
name: wiki-schema
description: Page types, frontmatter specification, file naming conventions, and config.yaml schema for the wiki-notes system
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
created: YYYY-MM-DD
updated: YYYY-MM-DD
sources: []
---
```

- `title`: Human-readable, title case
- `type`: one of `entity`, `concept`, `summary`, `synthesis`
- `tags`: array of tags from `wiki/tags.md` canonical list (kebab-case, lowercase)
- `created`: ISO date when page was first created
- `updated`: ISO date when page was last modified
- `sources`: relative paths to files in `sources/` that this page draws from (e.g. `sources/paper.pdf`)

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

- [Source Title](../sources/filename.ext)
```

The `## Sources` section at the bottom mirrors the `sources` frontmatter field as human-readable links.

## config.yaml schema

Located at the root of the wiki data repo. Claude reads this at session start.

```yaml
wiki:
  name: "My Wiki"           # display name used in index.md and commit messages
  focus: "general notes"    # Claude uses this to decide relevance of new material
  author: "Your Name"       # used in git commits and page frontmatter

git:
  auto_commit: true         # commit before session ends
  auto_push: false          # push after auto-commit (only if remote is set)
  auto_pull: true           # pull at session start (only if remote is set)

mcp:
  path: "/absolute/path/to/wiki"   # set by /wiki-setup, do not edit manually
```
