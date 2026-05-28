# wiki-notes

Personal knowledge wiki managed by Claude. You feed context; Claude writes.

Markdown, git-backed, accessible from any Claude Code session via MCP.

## Install

```
/plugin marketplace add git@gitlab.com:truckstopcom/agentic-development/wiki-notes.git
/plugin install wiki-notes@wiki-notes-marketplace
/wiki-setup
```

**Requirement**: GitLab SSH key with access to the `truckstopcom` org.

`/wiki-setup` runs an interactive wizard: creates your wiki repo (default `~/wiki`), asks for name/focus/remote, initializes git, and registers the MCP server so wiki tools are available in every Claude Code session.

## Daily workflow

```
Drop files into sources/          ← zero tokens, any time
/wiki-add interesting article url ← save a URL or paste text
/wiki-session                     ← capture today's Claude session

/wiki-process                     ← Haiku tags everything, Sonnet organizes
/wiki-ask how does X work?        ← synthesized answer from your wiki
/wiki-digest this week            ← what did I learn?
```

## Commands

| Command | Model | What it does |
|---|---|---|
| `/wiki-setup` | free | First-time setup wizard |
| `/wiki-add [text\|url]` | free | Save content to sources/ for later processing |
| `/wiki-process` | Haiku + Sonnet | Batch tag + organize everything new in sources/ |
| `/wiki-session [topic]` | Sonnet | Summarize current Claude session → sources/ |
| `/wiki-ask [question]` | Sonnet | Synthesize answer from wiki pages |
| `/wiki-search [query]` | free | Find pages by text or tag |
| `/wiki-digest [range]` | Haiku | "What did I learn this week/month?" |
| `/wiki-stats` | free | Dashboard: page counts, tags, pipeline status |
| `/wiki-retag` | Haiku + Sonnet | Consolidate near-duplicate tags |
| `/wiki-link` | Haiku | Find unlinked page title mentions, add links |
| `/wiki-autotag` | Haiku | Tag new sources/ files (run by cron or manually) |
| `/wiki-open` | free | Open wiki vault in Obsidian |
| `/wiki-convert [format]` | free | Switch between standard and Obsidian link format |
| `/wiki-commit` | free | Manual git commit |

## MCP tools (available in every Claude session)

| Tool | Description |
|---|---|
| `search_wiki(query, tags?, include_sensitive?)` | Full-text + tag search |
| `get_page(slug)` | Fetch a page by slug |
| `list_pages(type?, tag?, include_sensitive?)` | List pages, filterable |
| `list_tags()` | Canonical tag list |
| `add_note(slug, markdown)` | Write wiki page + update indexes + commit |
| `save_source(content, title?, source_url?)` | Save to sources/ for later pipeline processing |
| `get_backlinks(source_file)` | Pages referencing a source file |
| `get_recent(days?)` | Recent log entries (default 7 days) |

## Two ways to use

**Ambient** — MCP tools available in any Claude session. Drop a note, search, ask a question, save something interesting — without leaving your current project.

**Direct** — `cd ~/wiki && claude`. CLAUDE.md loads automatically. Best for bulk ingestion, restructuring, or anything that needs the full wiki in context.

## Wiki structure

```
~/wiki/
├── CLAUDE.md            # Claude's operating manual
├── config.yaml          # Your settings
├── sources/             # Raw material — drop files here
│   └── index.md         # Haiku-maintained tag index
└── wiki/
    ├── index.md         # Master navigation index
    ├── log.md           # Append-only change history
    ├── tags.md          # Canonical tag list
    ├── backlinks.md     # Source → page inverse index
    └── pages/           # Wiki pages
```

## config.yaml

```yaml
wiki:
  name: "My Wiki"
  focus: "general personal and work notes"
  author: "Your Name"
  link_format: standard       # standard | obsidian
  date_format: "MM/DD/YYYY"   # date display — YYYY-MM-DD for ISO

git:
  auto_commit: true    # commit before session ends
  auto_push: false     # push after commit (requires remote)
  auto_pull: true      # pull at session start (requires remote)

mcp:
  path: "/absolute/path/to/wiki"
```

## Agents

| Agent | Model | Role |
|---|---|---|
| `wiki-tagger` | Haiku | First pass: reads raw source, writes structured entry to sources/index.md |
| `wiki-curator` | Sonnet | Organization: reads sources/index.md entries, writes wiki pages |
| `wiki-analyst` | Haiku | Lightweight analysis: tag deduplication, digest summarization |

## Scheduled auto-tagging (optional)

Set up a daily cron to tag new files automatically without opening a session:

```
/cron "daily wiki autotag" "0 9 * * *" "run /wiki-autotag in my wiki at <wiki-path>"
```

Haiku tags new sources each morning. Run `/wiki-process` when you're ready to organize.

## Obsidian support

Run `/wiki-setup` and choose Obsidian mode to get `[[wikilinks]]`, graph view, and Dataview support. Switch any time with `/wiki-convert`. Standard mode renders everywhere (GitHub, VS Code, Warp).
