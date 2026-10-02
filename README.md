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

**Reconnecting an existing wiki** (after reinstalling the plugin, or the MCP server just stopped working): run `/llm-wiki:wiki-reconnect` — it re-registers the server for your existing wiki without touching its content or re-running the whole setup wizard.

**Manual MCP registration** (fallback — only needed if the plugin isn't installed/loading at all, so `/llm-wiki:wiki-reconnect` isn't available either):
```bash
PLUGIN_DIR=$(grep -l '"name": "llm-wiki"' "$HOME"/.claude/plugins/marketplaces/*/.claude-plugin/plugin.json | head -1 | sed 's#/.claude-plugin/plugin.json$##')
claude mcp add llm-wiki --scope user --env WIKI_PATH="<absolute-path-to-your-wiki>" -- node "$PLUGIN_DIR/server/start.mjs"
```
Register the marketplace clone, not `~/.claude/plugins/cache/.../llm-wiki/<version>/`: each plugin update creates a new versioned cache folder, so a registration there silently stays on the old server. `server/start.mjs` installs the server's npm dependencies on first run and again whenever `package-lock.json` changes, so there's no manual `npm install` step. It uses `npm install --no-save` (never rewrites the lockfile, so the marketplace clone stays clean for updates; never wipes `node_modules`, so an offline update keeps the old working deps) under a lock, so several sessions starting at once don't race. `--scope user` matters: without it the server only registers for the current project.

**Requirement**: GitHub SSH key with access to `ts-eva/llm-wiki`.

**Updating**: after `/plugin update llm-wiki@llm-wiki-marketplace`, run `/reload-plugins` — the `SessionStart` hook is declared in `.claude-plugin/plugin.json` and only takes effect once the plugin reloads (or in the next new session). The MCP server reports the plugin version in its `serverInfo`, so you can tell which build a session is running.

**Development**: `cd server && npm test` (node's built-in runner, no dev deps). Try a working copy end to end without installing it, against a throwaway wiki:
```bash
claude -p "/llm-wiki:wiki-process auto" --plugin-dir . --strict-mcp-config \
  --mcp-config '{"mcpServers":{"llm-wiki":{"command":"node","args":["'"$PWD"'/server/start.mjs"],"env":{"WIKI_PATH":"/tmp/test-wiki"}}}}' \
  --permission-mode acceptEdits --allowedTools "mcp__llm-wiki" Read Write Edit Agent "Bash(git:*)"
```

## Daily workflow

```
Drop files into sources/                     ← zero tokens, any time (any name — they get normalized)
/llm-wiki:wiki-add interesting article url   ← save a URL or paste text (searchable at once)
/llm-wiki:wiki-session                       ← capture today's Claude session

daily job (/llm-wiki:wiki-schedule)          ← processes new notes; free on idle days
/llm-wiki:wiki-process                       ← same, on demand: Haiku tags, Sonnet organizes
/llm-wiki:wiki-ask how does X work?          ← synthesized answer from your wiki
/llm-wiki:wiki-digest this week              ← what did I learn?
```

## Commands

| Command | Model | What it does |
|---|---|---|
| `/llm-wiki:wiki-setup` | free | First-time setup wizard |
| `/llm-wiki:wiki-reconnect [path]` | free | Re-register the MCP server for an existing wiki (e.g. after reinstalling the plugin) |
| `/llm-wiki:wiki-add [text\|url]` | free | Save content to sources/ via `save_source` (searchable at once) |
| `/llm-wiki:wiki-process [auto]` | Haiku + Sonnet | Batch prepare + tag + organize everything new, changed or removed in sources/; `auto` = unattended |
| `/llm-wiki:wiki-schedule [install HH:MM\|uninstall\|status]` | free | Daily processing job (crontab) |
| `/llm-wiki:wiki-session [topic]` | Sonnet | Summarize current Claude session → sources/ |
| `/llm-wiki:wiki-ask [question]` | session model | Search, read the top hits, answer |
| `/llm-wiki:wiki-search [query]` | free | `search_wiki`: ranked pages and sources |
| `/llm-wiki:wiki-digest [range]` | Haiku | "What did I learn this week/month?" from `get_recent` |
| `/llm-wiki:wiki-stats` | free | `wiki_stats` dashboard: pages, tags, pipeline status |
| `/llm-wiki:wiki-retag` | Haiku | Analyst proposes tag merges; `rename_tag` applies them |
| `/llm-wiki:wiki-link` | free | `find_unlinked_mentions`, then add the links you approve |
| `/llm-wiki:wiki-autotag` | Haiku | Tag only (no organizing); the daily job supersedes it |
| `/llm-wiki:wiki-open` | free | Open wiki vault in Obsidian |
| `/llm-wiki:wiki-convert [format]` | free | Switch between standard and Obsidian link format |
| `/llm-wiki:wiki-commit` | free | Manual git commit |

## MCP tools (available in every Claude session)

| Tool | Description |
|---|---|
| `search_wiki(query?, tags?, include_sensitive?, limit?)` | Word search over pages **and sources** (unprocessed notes too). Every word must match, any order, any field; otherwise best partial matches, flagged. Ticket keys (`HW-2538`) stay whole. Tags filter every result |
| `get_page(slug)` | Fetch a page by slug |
| `list_pages(type?, tag?, include_sensitive?)` | List pages, filterable |
| `list_tags()` | Canonical tag list |
| `save_source(content, title?, source_url?, type?)` | **The** write path into sources/ — `/llm-wiki:wiki-add` and `/llm-wiki:wiki-session` call it. Applies the naming rules, writes `created:`/`updated:`, commits; same title updates the note |
| `get_recent(days? \| since?, until?)` | log.md entries plus sources created/updated in the window, processed or not |
| `get_backlinks(source_file)` | Pages referencing a source file |
| `wiki_stats()` | Dashboard numbers |
| `find_unlinked_mentions()` | Page titles mentioned in prose but not linked |
| `rename_tag(from, to)` | Rename/merge a tag in page frontmatter, index entries, tags.md |
| `source_status()` | Pipeline state of sources/ (untagged, changed, unorganized, removed, ignored) plus `wiki`, the path the server serves |
| `prepare_sources()` | Pipeline: backfill `created:`, rename untagged notes to the naming rules, relink `[[wikilinks]]` |
| `get_source_entries(files)` / `write_source_entry(file, entry)` / `set_wiki_pages(file, pages)` | Pipeline: read/write single `sources/index.md` entries, so no agent loads the whole (large) file |
| `mark_sources(files, stage)` | Pipeline: stamp entries organized / baseline / remove |
| `append_log(entries)` / `remove_page(slug)` | Pipeline: log.md append without reading it; delete an orphaned page and its index line |

Tool results are compact JSON (no indentation) — they're model context.

## Two ways to use

**Ambient** — MCP tools available in any Claude session. Drop a note, search, ask a question, save something interesting — without leaving your current project.

**Direct** — `cd <wiki-path> && claude`. CLAUDE.md loads automatically. Best for bulk ingestion, restructuring, or anything that needs the full wiki in context.

**As Claude memory** — automatic, via a `SessionStart` hook (`hooks/session-start.js`). Every session starts with the wiki's location, its most recent sources (newest by `updated:`/`created:` frontmatter, not file mtime, which pipeline steps churn), how many source changes await processing, and the naming rules already in context, so Claude recalls before it answers and names files correctly the first time. Instructions in `~/.claude/CLAUDE.md` alone are not enough: they're prose the model can skip, and it does — a hook always fires.

The hook resolves the wiki the same way the MCP server does (`$WIKI_PATH`, else the path registered for `llm-wiki` in `~/.claude.json`, else `~/wiki`), prints nothing when no wiki is found, and runs in ~150 ms. Because the hook carries the rules, the `~/.claude/CLAUDE.md` block `/llm-wiki:wiki-setup` writes is a two-line pointer — repeating the rules there would cost tokens every session for nothing. Session captures via `/llm-wiki:wiki-session` feed into the pipeline, which organises them into the right wiki pages — closing the loop.

## Wiki structure

```
<wiki-path>/
├── CLAUDE.md            # Claude's operating manual
├── config.yaml          # Your settings
├── log.md               # Append-only change history
├── backlinks.md         # Source → page inverse index (standard mode)
├── .obsidian/           # Obsidian config (Obsidian mode only)
├── sources/             # Raw material — drop files here
│   └── index.md         # Pipeline-owned entry per source (tags, key points, hashes) — read/written only via tools
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
| `wiki-tagger` | Haiku | First pass: reads raw source, writes its entry with `write_source_entry` |
| `wiki-curator` | Sonnet | Fetches its entries with `get_source_entries`, writes pages, records them with `set_wiki_pages` / `append_log` / `remove_page` |
| `wiki-analyst` | Haiku | Judgment calls only: tag-merge proposals, digest narrative |

## Pipeline (`/llm-wiki:wiki-process`)

1. **Prepare** — `prepare_sources` stamps missing `created:` dates (earlier of git first-add and file birth time) and renames untagged notes that break the naming rules: uppercase, ` - ` separators, legacy `session-…-2026-09-16` slugs (ticket keys like `hw-2409` survive). Renames use `git mv` (case-only renames are otherwise invisible to git on macOS) and rewrite `[[wikilinks]]` to the old name. Tagged and `ignore: true` notes are never renamed.
2. **Detect** — `source_status` hashes every source against its entry: new, changed, unorganized, removed. Headers inside the index's `<!-- -->` format comment are ignored.
3. **Tag** — wiki-tagger (Haiku), batches of 25.
4. **Organize** — wiki-curator (Sonnet).
5. **Commit once** — `git add -A -- sources wiki ':(glob)*.md'`; push only if `git.auto_push`.

The wiki path comes from the server (`wiki` in `source_status`), never from the current directory or CLAUDE.md, so running it from any project folder is safe.

## Daily processing (optional)

```
/llm-wiki:wiki-schedule install 16:30
```

Adds a crontab line (tagged `# llm-wiki-process`) running `scripts/nightly-process.sh`. Pick a time the machine is awake: cron skips runs while asleep.

- **Free when idle**: it counts pending work with plain node and exits without starting Claude when nothing is new.
- **Otherwise** it runs `claude -p "/llm-wiki:wiki-process auto"` in the wiki folder, with the MCP server pinned to that same wiki and a narrow tool allowlist (llm-wiki tools, Read/Write/Edit, Agent, `git`).
- **Auth under cron**: `claude -p` can't read the login keychain from cron and needs `HOME`/`USER`/`LOGNAME`/`TMPDIR`. The script sets those and reads a `claude setup-token` token from `LLM_WIKI_TOKEN_FILE` (default `~/.claude/.oauth-token`, `chmod 600`). Set `LLM_WIKI_TOKEN_FILE` when running install to bake a different path into the cron line.
- **Overlap**: a mkdir lock skips a run if the previous one is still going.
- Log: `~/.claude/llm-wiki-process.log`. Remove with `/llm-wiki:wiki-schedule uninstall`.

## Obsidian support

Requires [Obsidian](https://obsidian.md) installed. Run `/llm-wiki:wiki-setup` and choose Obsidian mode to get `[[wikilinks]]`, graph view, and Dataview support. Switch any time with `/llm-wiki:wiki-convert`. Standard mode renders everywhere (GitHub, VS Code, Warp).

Obsidian does not need to be open for any wiki commands to work — all commands use Claude and file I/O directly. Open Obsidian when you want to browse the graph, run Dataview queries, or read notes visually.

In Obsidian mode the vault root is the wiki folder itself (not a subfolder), so `sources/` files appear in the graph alongside wiki pages — you can see which source files generated which pages. Wiki pages link to sources via `[[sources/filename]]` wikilinks that Obsidian renders as graph edges.
