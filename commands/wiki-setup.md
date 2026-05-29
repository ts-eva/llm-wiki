Run the llm-wiki first-time setup wizard. This creates the user's personal wiki repository and registers the MCP server.

---

## Phase 1: Collect settings

Display the header:
```
╔══════════════════════════════════════╗
║            llm-wiki setup            ║
╚══════════════════════════════════════╝
```

Then collect settings using `AskUserQuestion` in three sequential rounds. Each round must complete (user responds) before proceeding to the next. First run:
```
git config --global user.name 2>/dev/null; echo "HOME=$HOME"
```
to get `GIT_NAME` and `HOME`.

---

### Round 1 — Identity (call AskUserQuestion with these 2 questions)

**Q1 — Wiki name**
- header: `Wiki name`
- question: `What do you want to name your wiki?`
- options:
  - label: `My Wiki`, description: `Default — good for a general personal wiki`
  - label: `Work Notes`, description: `If this is primarily for work`

**Q2 — Your name**
- header: `Your name`
- question: `What name should appear as the wiki author?`
- options:
  - label: `<GIT_NAME>`, description: `From your git config`
  - label: `Anonymous`, description: `Leave author blank`

After Round 1: compute the wiki name slug (lowercase, spaces → hyphens) and the default location `<HOME>/<slug>`.

---

### Round 2 — Setup (call AskUserQuestion with these 3 questions)

**Q3 — Wiki location**
- header: `Wiki location`
- question: `Where should the wiki be created?`
- options:
  - label: `<HOME>/<slug>` (computed from Q1 answer), description: `Default location`
  - label: `<HOME>/wiki`, description: `Generic ~/wiki path`

**Q4 — Focus / purpose**
- header: `Focus`
- question: `What is this wiki for? (helps Claude decide what's worth adding)`
- options:
  - label: `General personal and work notes`, description: `Default`
  - label: `Work projects and technical notes`, description: `Engineering / product focus`

**Q5 — Date format**
- header: `Date format`
- question: `How should dates be displayed in wiki pages?`
- options:
  - label: `MM/DD/YYYY`, description: `e.g. 05/28/2026 — US format`
  - label: `YYYY-MM-DD`, description: `e.g. 2026-05-28 — ISO format`
  - label: `DD/MM/YYYY`, description: `e.g. 28/05/2026 — European format`

---

### Round 3 — Editor and sync (call AskUserQuestion with these 2 questions)

**Q6 — Editor / browse mode**
- header: `Editor mode`
- question: `How will you read and browse your wiki?`
- options:
  - label: `Standard`, description: `[Title](pages/slug.md) links — renders in any IDE, Warp, VS Code, GitLab web`
  - label: `Obsidian`, description: `[[wikilinks]] — graph view and Dataview queries, but won't render on GitLab/GitHub web UI`

**Q7 — Remote URL**
- header: `Remote URL`
- question: `Add a remote git repo for backup/sync? (private GitHub or GitLab repo)`
- options:
  - label: `Skip — local only`, description: `No remote; wiki stays on this machine`
  - label: `I have a remote repo URL`, description: `You'll enter the URL via Other`

If Q7 = "I have a remote repo URL" or "Other" (user typed a URL): call `AskUserQuestion` with two more questions:

**Q8 — Auto-push**
- header: `Auto-push`
- question: `Automatically push to remote after each commit?`
- options:
  - label: `No`, description: `Push manually with /wiki-commit`
  - label: `Yes`, description: `Push after every wiki commit`

**Q9 — Auto-pull**
- header: `Auto-pull`
- question: `Automatically pull from remote at session start?`
- options:
  - label: `Yes`, description: `Always pull latest on session open`
  - label: `No`, description: `Pull manually`

If Q7 = "Skip": set AUTO_PUSH = `false`, AUTO_PULL = `false` — do not ask Q8/Q9.

---

### After all rounds

Store all answers. If the user selected "Other" for any question, use whatever text they typed.
- Q3 location: expand any `~` to the HOME value from the shell command
- Q5 date format: use the label value directly (`MM/DD/YYYY`, `YYYY-MM-DD`, or `DD/MM/YYYY`)

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
  date_format: "<DATE_FORMAT>"   # MM/DD/YYYY | YYYY-MM-DD | DD/MM/YYYY

git:
  auto_commit: true
  auto_push: <AUTO_PUSH>
  auto_pull: <AUTO_PULL>

mcp:
  path: "<WIKI_PATH_ABSOLUTE>"
```

Substitute: WIKI_NAME, FOCUS, AUTHOR, DATE_FORMAT from user answers. WIKI_PATH_ABSOLUTE as the resolved absolute path.
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
