# llm-wiki

Personal knowledge wiki managed by Claude. You feed context; Claude writes.

Markdown, git-backed, accessible from any Claude Code session via MCP.

## Install

Run these one at a time, in order — each depends on the previous one finishing (the plugin must be installed before `/reload-plugins` picks it up, and `/reload-plugins` must complete before `/llm-wiki:wiki-setup` exists as a command). Don't paste them as a block.

```
/plugin marketplace add git@github.com:ts-eva/llm-wiki.git
```
```
/plugin install llm-wiki@llm-wiki-marketplace
```
```
/reload-plugins
```
```
/llm-wiki:wiki-setup
```

`/llm-wiki:wiki-setup` runs an interactive wizard: creates your wiki repo (defaults to current directory), asks for name/focus/remote/date format, initializes git, and **automatically registers the MCP server** (user-scoped, pointing at the wiki path you chose) so wiki tools are available in every Claude Code session.

**Manual MCP registration** (if you need to re-run, reinstalled the plugin, or the wizard failed):
```bash
find "<plugin-dir>/server" -name "package.json" -execdir npm install \;
claude mcp add llm-wiki --scope user --env WIKI_PATH="<absolute-path-to-your-wiki>" -- node "<plugin-dir>/server/index.js"
```
Where `<plugin-dir>` is found via:
```bash
find "$HOME/.claude" -type d -name "llm-wiki" 2>/dev/null | head -1
```
`--scope user` matters — without it the server only registers for the current project, and reinstalling the plugin can leave stale or conflicting registrations behind. The `npm install` step matters too: a fresh plugin cache has no `node_modules`, and the server fails to connect (`Connection closed`) without it.

**Requirement**: GitHub SSH key with access to `ts-eva/llm-wiki`.

## Daily workflow

```
Drop files into sources/                     ← zero tokens, any time
/llm-wiki:wiki-add interesting article url   ← save a URL or paste text
/llm-wiki:wiki-session                       ← capture today's Claude session

/llm-wiki:wiki-process                       ← Haiku tags everything, Sonnet organizes
/llm-wiki:wiki-ask how does X work?          ← synthesized answer from your wiki
/llm-wiki:wiki-digest this week              ← what did I learn?
```

## Commands

| Command | Model | What it does |
|---|---|---|
| `/llm-wiki:wiki-setup` | free | First-time setup wizard |
| `/llm-wiki:wiki-add [text\|url]` | free | Save content to sources/ for later processing |
| `/llm-wiki:wiki-process` | Haiku + Sonnet | Batch tag + organize everything new in sources/ |
| `/llm-wiki:wiki-session [topic]` | Sonnet | Summarize current Claude session → sources/ |
| `/llm-wiki:wiki-ask [question]` | Sonnet | Synthesize answer from wiki pages |
| `/llm-wiki:wiki-search [query]` | free | Find pages by text or tag |
| `/llm-wiki:wiki-digest [range]` | Haiku | "What did I learn this week/month?" |
| `/llm-wiki:wiki-stats` | free | Dashboard: page counts, tags, pipeline status |
| `/llm-wiki:wiki-retag` | Haiku + Sonnet | Consolidate near-duplicate tags |
| `/llm-wiki:wiki-link` | Haiku | Find unlinked page title mentions, add links |
| `/llm-wiki:wiki-autotag` | Haiku | Tag new sources/ files (run by cron or manually) |
| `/llm-wiki:wiki-open` | free | Open wiki vault in Obsidian |
| `/llm-wiki:wiki-convert [format]` | free | Switch between standard and Obsidian link format |
| `/llm-wiki:wiki-commit` | free | Manual git commit |

## MCP tools (available in every Claude session)

| Tool | Description |
|---|---|
| `search_wiki(query, tags?, include_sensitive?)` | Full-text + tag search |
| `get_page(slug)` | Fetch a page by slug |
| `list_pages(type?, tag?, include_sensitive?)` | List pages, filterable |
| `list_tags()` | Canonical tag list |
| `save_source(content, title?, source_url?)` | Save to sources/ for later pipeline processing — the only write path from ambient sessions |
| `get_backlinks(source_file)` | Pages referencing a source file |
| `get_recent(days?)` | Recent log entries (default 7 days) |

## Two ways to use

**Ambient** — MCP tools available in any Claude session. Drop a note, search, ask a question, save something interesting — without leaving your current project.

**Direct** — `cd <wiki-path> && claude`. CLAUDE.md loads automatically. Best for bulk ingestion, restructuring, or anything that needs the full wiki in context.

**As Claude memory** — opt-in during `/llm-wiki:wiki-setup`. Writes a block to `~/.claude/CLAUDE.md` so Claude searches the wiki for context at the start of every session and saves learnings back. Session captures via `/llm-wiki:wiki-session` feed into the pipeline, which organises them into the right wiki pages — closing the loop.

## Wiki structure

```
<wiki-path>/
├── CLAUDE.md            # Claude's operating manual
├── config.yaml          # Your settings
├── log.md               # Append-only change history
├── backlinks.md         # Source → page inverse index (standard mode)
├── .obsidian/           # Obsidian config (Obsidian mode only)
├── sources/             # Raw material — drop files here
│   └── index.md         # Haiku-maintained tag index
└── wiki/
    ├── index.md         # Master navigation index
    ├── tags.md          # Canonical tag list
    ├── schema.md        # Page type and frontmatter reference
    └── pages/           # Wiki pages
```

## config.yaml

```yaml
wiki:
  name: "My Wiki"
  focus: "general personal and work notes"
  author: "Your Name"
  link_format: standard       # standard | obsidian
  date_format: "MM/DD/YYYY"   # date display — YYYY-MM-DD for ISO, DD/MM/YYYY for European

git:
  auto_commit: true    # commit before session ends
  auto_push: false     # push after commit (requires remote)
  auto_pull: false     # pull at session start (requires remote)

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
/cron "daily wiki autotag" "0 9 * * *" "run /llm-wiki:wiki-autotag in my wiki at <wiki-path>"
```

Haiku tags new sources each morning. Run `/llm-wiki:wiki-process` when you're ready to organize.

## Obsidian support

Requires [Obsidian](https://obsidian.md) installed. Run `/llm-wiki:wiki-setup` and choose Obsidian mode to get `[[wikilinks]]`, graph view, and Dataview support. Switch any time with `/llm-wiki:wiki-convert`. Standard mode renders everywhere (GitHub, VS Code, Warp).

Obsidian does not need to be open for any wiki commands to work — all commands use Claude and file I/O directly. Open Obsidian when you want to browse the graph, run Dataview queries, or read notes visually.

In Obsidian mode the vault root is the wiki folder itself (not a subfolder), so `sources/` files appear in the graph alongside wiki pages — you can see which source files generated which pages. Wiki pages link to sources via `[[sources/filename]]` wikilinks that Obsidian renders as graph edges.
