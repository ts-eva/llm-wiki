#!/usr/bin/env node
/**
 * SessionStart hook: put the wiki's conventions and recent activity into context
 * automatically, so Claude doesn't have to remember to call search_wiki first.
 *
 * Without this, the wiki is only reachable if the model chooses to look — and it
 * often doesn't, then writes files that break the naming rules it never read.
 *
 * Resolves the wiki the same way the MCP server does: $WIKI_PATH, else the path
 * registered for the llm-wiki MCP server in ~/.claude.json, else ~/wiki.
 * Prints nothing at all if no wiki is found — never block or noise up a session.
 */
import fs from "fs";
import path from "path";
import os from "os";

const RECENT_LIMIT = 8;

function resolveWikiPath() {
  if (process.env.WIKI_PATH) {
    return path.resolve(process.env.WIKI_PATH.replace(/^~/, os.homedir()));
  }
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".claude.json"), "utf8"));
    const p = cfg?.mcpServers?.["llm-wiki"]?.env?.WIKI_PATH;
    if (p) return path.resolve(p.replace(/^~/, os.homedir()));
  } catch {}
  return path.join(os.homedir(), "wiki");
}

function recentSources(wikiPath) {
  const dir = path.join(wikiPath, "sources");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") && f !== "index.md")
    .map((f) => ({ f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, RECENT_LIMIT)
    .map((e) => e.f.replace(/\.md$/, ""));
}

function wikiPageCount(wikiPath) {
  const dir = path.join(wikiPath, "wiki", "pages");
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter((f) => f.endsWith(".md")).length;
}

const wikiPath = resolveWikiPath();
if (!fs.existsSync(path.join(wikiPath, "sources")) && !fs.existsSync(path.join(wikiPath, "wiki"))) {
  process.exit(0); // no wiki here; stay silent
}

const recent = recentSources(wikiPath);
const pages = wikiPageCount(wikiPath);

const lines = [
  `# llm-wiki active — your persistent memory is at ${wikiPath}`,
  "",
  `${pages} wiki page(s), ${recent.length ? "most recent sources:" : "no sources yet."}`,
  ...recent.map((t) => `- ${t}`),
  "",
  "## Use it, don't guess",
  "- Recall: `search_wiki` / `get_recent` / `get_page` BEFORE answering from memory or inventing a convention. Do this at the start of any task touching past work, projects, hardware, or preferences.",
  "- Capture: `save_source` for anything durable — decisions, diagnoses, session logs.",
  "- This wiki replaces per-project memory files. Never write to `~/.claude/projects/*/memory/`.",
  "",
  "## Naming rules (checked against sources/ — break these and the user has to clean up)",
  "- Sources are named by readable title: lowercase, **spaces**, no slug, no `session-`/`project-` prefix.",
  "- Hyphens only inside names that contain one (`llm-wiki`, `x-ray`) — never as word separators.",
  "- Session logs are ordinary sources: `save_source` with title `YYYY-MM-DD short readable topic` (zero-padded date). Never `_HHMM`, never a `-session` suffix, never a separate `sessions/` folder.",
  "- `sources/` is otherwise read-only: never edit or delete a source file; ask the user.",
  "- Wiki pages (`wiki/pages/`) use `kebab-case.md` slugs — that is the one place hyphens are correct.",
  "",
  "At a natural end point, save a session log. Run `/llm-wiki:wiki-process` to tag and organize new sources.",
];

console.log(lines.join("\n"));
