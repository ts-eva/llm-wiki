Run the llm-wiki first-time setup wizard. This creates the user's personal wiki repository and registers the MCP server.

---

## Phase 1: Collect settings

First, run this command to get the user's git name and HOME path:
```
git config --global user.name 2>/dev/null; echo "HOME=$HOME"
```

Then send **exactly this message** to the user and stop — do not proceed to Phase 2 until they reply:

---

```
╔══════════════════════════════════════╗
║            llm-wiki setup            ║
╚══════════════════════════════════════╝
```

Please answer each question (press Enter to accept the default in brackets):

1. **Wiki name** — [My Wiki]
2. **Wiki location** — [/Users/<you>/<wiki-name-slug>]  *(e.g. name "tsm" → ~/tsm)*
3. **Your name** — [<git-user-name>]
4. **Focus / purpose** — [general personal and work notes]  *(helps Claude decide what's worth adding)*
5. **Editor / browse mode** — [1]
   - 1 Standard (any IDE, Warp, VS Code, GitLab web) — uses `[Title](pages/slug.md)` links, renders everywhere
   - 2 Obsidian vault (graph view, Dataview queries) — uses `[[wikilinks]]`, great for graph view but won't render on GitLab/GitHub web UI
6. **Remote URL** — [skip]  *(a private GitHub or GitLab repo for backup/sync. Leave blank to skip.)*
7. **Auto-push after commit?** — [N]  *(only relevant if remote provided)*
8. **Auto-pull at session start?** — [Y]  *(only relevant if remote provided)*

Reply with your answers. Leave any blank to use the default.

---

Substitute `<git-user-name>` and `<wiki-name-slug>` with the actual values before sending. For question 2, compute the default slug from the default name "My Wiki" → `/Users/<HOME-value>/my-wiki`.

**Do not proceed to Phase 2 until the user replies with their answers.**

Once they reply, parse each answer:
- Blank or missing → use the default
- For question 2: if they give a `~` path, expand it using the HOME value from the shell command above
- Store all values; you'll need them for every subsequent phase

---

## Phase 2: Check for existing wiki

If the wiki location directory already exists and contains a `config.yaml`, stop and tell the user:
"A wiki already exists at <path>. Run /wiki-setup again only to create a new wiki at a different location."

---

## Phase 3: Scaffold the wiki directory

Create the following directory structure (use `mkdir -p`):
```
<wiki-path>/
<wiki-path>/sources/
<wiki-path>/wiki/
<wiki-path>/wiki/pages/
<wiki-path>/.claude/
<wiki-path>/.claude/commands/
```

---

## Phase 4: Write all template files

Write each file below exactly as shown, substituting the user's answers where indicated.

### `<wiki-path>/config.yaml`

```yaml
wiki:
  name: "<WIKI_NAME>"
  focus: "<FOCUS>"
  author: "<AUTHOR>"
  link_format: <LINK_FORMAT>    # standard | obsidian
  date_format: "MM/DD/YYYY"     # date display format — change to YYYY-MM-DD for ISO, DD/MM/YYYY for European

git:
  auto_commit: true
  auto_push: <AUTO_PUSH>
  auto_pull: <AUTO_PULL>

mcp:
  path: "<WIKI_PATH_ABSOLUTE>"
```

Substitute: WIKI_NAME, FOCUS, AUTHOR from user answers. WIKI_PATH_ABSOLUTE as the resolved absolute path.
- If no remote URL was provided: AUTO_PUSH = `false`, AUTO_PULL = `false`
- If remote URL was provided: AUTO_PUSH and AUTO_PULL from user answers (`true` or `false`)

---

### `<wiki-path>/CLAUDE.md`

```markdown
# <WIKI_NAME>

This is your personal wiki. Claude maintains it — you feed context, Claude writes.

## Role

You are the wiki curator for this knowledge base. Read `config.yaml` to understand the wiki's focus and settings before doing anything else.

Follow the skills loaded by the llm-wiki plugin:
- `llm-wiki:wiki-schema` — page types, frontmatter, naming conventions
- `llm-wiki:wiki-operations` — index maintenance, git operations, session checklist

## Session start

1. Read `config.yaml`
2. Run `git pull` if `git.auto_pull` is true and a remote is configured
3. Run `git status` — untracked files in `sources/` are pending ingestion
4. If pending sources exist, tell the user and offer to ingest them

## Session end

Before the session ends, check `git status`. If there are uncommitted changes:
- Run: `git add . && git commit -m "wiki: <brief summary>"`
- If `git.auto_push` is true and a remote is configured, also push

## Scope

Write only to `wiki/pages/`, `wiki/index.md`, `wiki/tags.md`, `log.md` (root), `backlinks.md` (root).
`sources/` is read-only — never modify or delete source files.
```

Substitute: WIKI_NAME from user answer.

---

### `<wiki-path>/wiki/index.md`

```markdown
# <WIKI_NAME>

## Entities

## Concepts

## Summaries

## Syntheses
```

Substitute: WIKI_NAME from user answer.

---

### `<wiki-path>/log.md`

```markdown
# Log

<!-- Append-only. Format: ## [YYYY-MM-DD] action | title -->
```

---

### `<wiki-path>/wiki/tags.md`

```markdown
# Tags

<!-- Canonical tag list. kebab-case, lowercase. One tag per line with short definition. -->
<!-- Example: - `machine-learning` — topics related to ML models and training -->
```

---

### `<wiki-path>/backlinks.md`

```markdown
# Backlinks

<!-- Inverse index: source file → wiki pages that reference it. -->
<!-- Format: ## sources/filename.ext followed by list of page links. -->
```

---

### `<wiki-path>/wiki/schema.md`

```markdown
# Wiki Schema Reference

This wiki uses the llm-wiki Claude Code plugin conventions.

## Page types
- **Entity** — a person, org, tool, or product (`postgres.md`)
- **Concept** — an idea, pattern, or theme (`event-sourcing.md`)
- **Summary** — notes from a specific source (`summary-paper-title.md`)
- **Synthesis** — cross-source analysis (`llm-comparison.md`)

## Frontmatter
Every page requires: `title`, `type`, `tags`, `created`, `updated`, `sources`

## Tags
See `tags.md` for the canonical list. Claude manages tags — do not edit manually.

## Indexes
- `wiki/index.md` — master navigation index
- `log.md` — append-only change history (wiki root)
- `backlinks.md` — source → page inverse index (wiki root)

All indexes are maintained by Claude. Do not edit manually.
```

---

### `<wiki-path>/sources/index.md`

```markdown
# Sources Index

<!-- Maintained by wiki-tagger (Haiku). One section per source file. -->
<!-- Format:
## sources/<filename>
date: YYYY-MM-DD
type: meeting-notes | article | document | code | conversation | other
tags: []
summary: One sentence.
key-points:
  - Point
action-items: []
notable-quotes: []
wiki-pages: []
-->
```

---

### `<wiki-path>/sources/.gitkeep`

Empty file.

---

### `<wiki-path>/wiki/pages/.gitkeep`

Empty file.

---

### If LINK_FORMAT is `obsidian` — scaffold `.obsidian/` folder

Create `<wiki-path>/wiki/.obsidian/app.json`:

```json
{
  "newLinkFormat": "shortest",
  "useMarkdownLinks": false,
  "attachmentFolderPath": "../../sources"
}
```

Create `<wiki-path>/wiki/.obsidian/community-plugins.json`:

```json
["dataview"]
```

Create `<wiki-path>/wiki/.obsidian/plugins/dataview/data.json`:

```json
{
  "renderNullAs": "-",
  "taskCompletionTracking": false,
  "recursiveSubTaskCompletion": false,
  "warnOnEmptyResult": true,
  "enableInlineDataview": true,
  "dataviewJsTimeout": 10000
}
```

Tell the user:
"Obsidian vault scaffolded at <wiki-path>/wiki/. Open that folder in Obsidian as your vault. Install the Dataview community plugin for query support. Links will use [[wikilinks]] format."

Also tell the user:
"Note: [[wikilinks]] won't render on GitLab/GitHub web UI — they still work as links but show as plain text in the browser. All content remains fully readable in any editor."

---

### `<wiki-path>/.claude/commands/wiki-commit.md`

```markdown
Manually commit all current wiki changes.

Steps:
1. Run `git status` to see what has changed
2. If no changes, report "Nothing to commit — wiki is up to date"
3. If changes exist: `git add . && git commit -m "wiki: manual commit [YYYY-MM-DD]"` (use today's date)
4. Report committed files via `git diff HEAD~1 --name-only`
5. If `git.auto_push` is true in `config.yaml` and a remote is configured, also push
```

---

### `<wiki-path>/.claude/settings.json`

```json
{
  "permissions": {
    "allow": [
      "Bash(git add *)",
      "Bash(git commit *)",
      "Bash(git pull)",
      "Bash(git push)",
      "Bash(git status)",
      "Bash(git diff *)",
      "Bash(git log *)"
    ]
  }
}
```

---

## Phase 5: Initialize git

Run in `<wiki-path>`:
```
git init
git add .
git commit -m "wiki: init"
```

---

## Phase 6: Install and register MCP server

1. Find the llm-wiki plugin directory by running:
   ```
   find "$HOME/.claude" -type d -name "llm-wiki" 2>/dev/null | head -1
   ```
   If not found, also try:
   ```
   find "$HOME/Library/Application Support/Claude" -type d -name "llm-wiki" 2>/dev/null | head -1
   ```

2. If a plugin directory is found and it contains `server/index.js`:
   - Run `npm install` inside `<plugin-dir>/server/`
   - Register the MCP server:
     ```
     claude mcp add llm-wiki --env WIKI_PATH="<WIKI_PATH_ABSOLUTE>" -- node "<plugin-dir>/server/index.js"
     ```

3. If the plugin directory is not found, tell the user:
   "Could not locate the llm-wiki plugin directory automatically. Please run:
   `claude mcp add llm-wiki --env WIKI_PATH=<wiki-path> -- node <path-to-plugin>/server/index.js`
   replacing <path-to-plugin> with the directory where the llm-wiki plugin is installed."

---

## Phase 7: Configure remote (if provided)

If the user provided a remote URL:
```
git -C "<WIKI_PATH_ABSOLUTE>" remote add origin <REMOTE_URL>
git -C "<WIKI_PATH_ABSOLUTE>" push -u origin main
```

If push fails (e.g. repo doesn't exist yet), tell the user to create the remote repo first and then run:
`git remote add origin <url> && git push -u origin main`

---

## Phase 8: Open Obsidian (Obsidian mode only)

If LINK_FORMAT is `obsidian`, open the vault automatically:

```bash
open "obsidian://open?vault=$(basename '<wiki-path>/wiki')"
```

If that fails (vault not yet known to Obsidian), fall back to:
```bash
open -a Obsidian "<wiki-path>/wiki"
```

Tell the user: "Opening your wiki vault in Obsidian. If it prompts you to trust the vault, click 'Trust and Enable Plugins'."

---

## Phase 9: Confirm setup

Print a summary:
```
✓ Wiki created at: <wiki-path>
✓ Git initialized with first commit
✓ MCP server registered (or instructions provided)
<if remote> ✓ Remote configured and pushed to <url>
<if obsidian> ✓ Obsidian vault opened

Workflow:
  Collect notes anytime → drop files in sources/ (zero tokens)
  Run /wiki-process when ready → Haiku tags, Sonnet organizes, all at once
  Batching saves tokens: one pipeline run beats many individual /wiki-add calls

Commands:
  /wiki-add      — add a single note from any Claude session
  /wiki-process  — batch process everything new in sources/ at once
  /wiki-search   — search your wiki
  /wiki-open     — open your wiki in Obsidian (Obsidian mode only)
  /wiki-commit   — manual git commit
  /wiki-convert  — switch between standard and Obsidian format
```
