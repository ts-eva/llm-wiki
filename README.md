# wiki-notes

Personal knowledge wiki managed by Claude. You feed context; Claude writes.

Markdown, git-backed, accessible from any Claude Code session via MCP.

## Install

From within a Claude Code session:

```
/plugin marketplace add git@gitlab.com:truckstopcom/agentic-development/wiki-notes.git
/plugin install wiki-notes@wiki-notes-marketplace
/wiki-setup
```

**Requirement**: GitLab SSH key with access to the `truckstopcom` org.

## First-time setup

`/wiki-setup` runs an interactive wizard that:
- Creates your personal wiki repo (default: `~/wiki`)
- Asks for your name, wiki focus/purpose, optional remote URL
- Initializes git and makes the first commit
- Registers the MCP server so wiki tools are available in every Claude Code session

## Usage

### From any Claude Code session (ambient mode)

```
/wiki-add the payments service requires idempotency keys on all POST endpoints
/wiki-add                          ← interactive, Claude asks what to add
/wiki-search event sourcing
```

Or naturally mid-conversation:
```
"Save that last explanation to my wiki"
"Do I have any notes on this pattern?"
```

### From inside the wiki folder (direct mode)

```bash
cd ~/wiki && claude
```

CLAUDE.md loads automatically. Best for bulk ingestion or restructuring.

## Commands

| Command | Description |
|---|---|
| `/wiki-setup` | First-time setup wizard |
| `/wiki-add [content]` | Add a note inline or interactively |
| `/wiki-search [query]` | Search by text or tag |
| `/wiki-commit` | Manual commit |

## MCP tools (available in all sessions)

| Tool | Description |
|---|---|
| `search_wiki(query, tags?)` | Full-text + tag search |
| `get_page(slug)` | Fetch a page by slug |
| `list_pages(type?, tag?)` | List pages, filterable |
| `list_tags()` | Canonical tag list |
| `add_note(slug, markdown)` | Write page + update indexes + commit |
| `get_backlinks(source_file)` | Pages referencing a source file |

## Wiki structure

```
~/wiki/
├── CLAUDE.md          # Claude's operating manual
├── config.yaml        # Your settings (editable any time)
├── sources/           # Drop raw material here
└── wiki/
    ├── index.md       # Master index
    ├── log.md         # Change history
    ├── tags.md        # Canonical tags
    ├── backlinks.md   # Source → page index
    └── pages/         # Wiki pages
```

## config.yaml options

```yaml
wiki:
  name: "My Wiki"
  focus: "general personal and work notes"
  author: "Your Name"

git:
  auto_commit: true    # commit before session ends
  auto_push: false     # push after commit (requires remote)
  auto_pull: true      # pull at session start (requires remote)
```

## Obsidian compatibility

The wiki data folder is designed to be Obsidian-compatible. Point Obsidian at `~/wiki/wiki/` as the vault root. YAML frontmatter, tags, and folder structure work natively. See the plan doc for the full migration path to `[[wikilinks]]` format.
