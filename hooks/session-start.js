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
import { frontmatterDates, readDateFormat } from "../server/dates.js";
import { resolveWikiPath } from "../server/wiki-path.js";

const RECENT_LIMIT = 8;

// Newest by frontmatter updated:/created:, not mtime: pipeline steps (created: backfill,
// renames) touch many files at once and would flood the list with old notes.
function recentSources(wikiPath) {
  const dir = path.join(wikiPath, "sources");
  if (!fs.existsSync(dir)) return [];
  const fmt = readDateFormat(wikiPath);
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") && f !== "index.md")
    .map((f) => {
      const p = path.join(dir, f);
      const { created, updated } = frontmatterDates(fs.readFileSync(p, "utf8").slice(0, 600), fmt);
      return { f, day: (updated || created)?.getTime() || 0, mtime: fs.statSync(p).mtimeMs };
    })
    .sort((a, b) => b.day - a.day || b.mtime - a.mtime)
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

// Pending pipeline work, so the session knows to suggest /wiki-process. sources-state.js is
// dependency-free on purpose: this hook runs from the plugin cache, which has no node_modules.
let pending = "";
try {
  const { sourceStatus } = await import("../server/sources-state.js");
  const s = sourceStatus(wikiPath);
  const n = s.untagged.length + s.changed.length + s.unorganized.length + s.removed.length;
  if (n) pending = `${n} source change(s) waiting for /llm-wiki:wiki-process (they are already searchable).`;
} catch {}

const lines = [
  `# llm-wiki active — your persistent memory is at ${wikiPath}`,
  "",
  `${pages} wiki page(s), ${recent.length ? "most recent sources:" : "no sources yet."}`,
  ...recent.map((t) => `- ${t}`),
  ...(pending ? ["", pending] : []),
  "",
  "## Use it, don't guess",
  "- Recall: `search_wiki` / `get_recent` / `get_page` BEFORE answering from memory or inventing a convention. Search at: task start (feature, ticket key, area); before reasoning about feature behavior/flags/business logic; before drafting a ticket or review finding.",
  "- Capture: `save_source` (or `/llm-wiki:wiki-add`, which calls it) in the same turn a finding is verified, a ticket is created, or a decision settles — not deferred to session end. It applies naming + `created:` and commits; the note is searchable at once.",
  "- Scope split: this wiki holds durable cross-project knowledge (decisions, domain/business logic, diagnoses, session logs). Per-project `~/.claude/projects/*/memory/` (auto-loaded via MEMORY.md) holds repo-specific working rules and review habits. A lesson that applies beyond one repo goes in the wiki too; link the two.",
  "",
  "## Naming rules (checked against sources/ — break these and the user has to clean up)",
  "- Sources are named by readable title: lowercase, **spaces**, no slug, no `session-`/`project-` prefix.",
  "- Hyphens only inside names that contain one (`llm-wiki`, `x-ray`) — never as word separators.",
  "- Session logs are ordinary sources named by readable topic, no date in the name (`created:` frontmatter holds it). Never `_HHMM`, never a `-session` suffix, never a separate `sessions/` folder.",
  "- `sources/` is the editable layer: update facts by editing the source file in place and committing; `/llm-wiki:wiki-process` picks up the change by hash and revises the generated pages. Never hand-edit generated wiki pages to change facts.",
  "- Wiki pages (`wiki/pages/`) use `kebab-case.md` slugs — that is the one place hyphens are correct.",
  "",
  "At a natural end point, save a session log (`/llm-wiki:wiki-session`).",
];

console.log(lines.join("\n"));
