import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { sourceFilename } from "./source-filename.js";
import { sourceStatus, markSources, getSourceEntries, writeSourceEntry, setWikiPages } from "./sources-state.js";
import { prepareSources } from "./prepare-sources.js";
import { searchWiki } from "./search.js";
import { wikiStats, getRecent, findUnlinkedMentions, renameTag, appendLog, removePage } from "./maintenance.js";
import { readDateFormat, formatDate } from "./dates.js";
import matter from "gray-matter";

const WIKI_PATH = process.env.WIKI_PATH
  ? path.resolve(process.env.WIKI_PATH.replace(/^~/, process.env.HOME))
  : path.join(process.env.HOME, "wiki");

const PAGES_DIR = path.join(WIKI_PATH, "wiki", "pages");
const WIKI_DIR  = path.join(WIKI_PATH, "wiki");
const VERSION = JSON.parse(fs.readFileSync(new URL("../.claude-plugin/plugin.json", import.meta.url), "utf8")).version;

// --- Helpers ---

function readMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({ file: f, slug: f.replace(/\.md$/, "") }));
}

function readPage(slug) {
  const filePath = path.join(PAGES_DIR, `${path.basename(String(slug))}.md`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = matter(raw);
  return { slug, frontmatter: parsed.data, content: parsed.content, raw };
}

function readWikiFile(name) {
  const filePath = path.join(WIKI_DIR, name);
  if (!fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf8");
}

function readRootFile(name) {
  const filePath = path.join(WIKI_PATH, name);
  if (!fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf8");
}

const todayFormatted = () => formatDate(new Date(), readDateFormat(WIKI_PATH));

// --- Tool handlers ---

function getPage({ slug }) {
  const page = readPage(slug);
  if (!page) return { error: `Page "${slug}" not found` };
  return { slug, ...page.frontmatter, content: page.content };
}

function listPages({ type, tag, include_sensitive = false }) {
  const files = readMarkdownFiles(PAGES_DIR);
  const results = [];

  for (const { slug } of files) {
    const page = readPage(slug);
    if (!page) continue;
    const { frontmatter } = page;
    if (!include_sensitive && frontmatter.sensitive === true) continue;
    if (type && frontmatter.type !== type) continue;
    if (tag && !frontmatter.tags?.includes(tag)) continue;
    results.push({
      slug,
      title: frontmatter.title || slug,
      type: frontmatter.type,
      tags: frontmatter.tags || [],
      updated: frontmatter.updated,
    });
  }

  return { count: results.length, pages: results };
}

function listTags() {
  const raw = readWikiFile("tags.md");
  const tags = [];
  for (const line of raw.split("\n")) {
    const match = line.match(/^- `([^`]+)`\s*[—–-]\s*(.+)$/);
    if (match) tags.push({ tag: match[1], description: match[2].trim() });
  }
  return { count: tags.length, tags };
}

function saveSource({ content, title, source_url, type }) {
  if (!content) return { error: "content is required" };

  const sourcesDir = path.join(WIKI_PATH, "sources");
  fs.mkdirSync(sourcesDir, { recursive: true });
  // A given title always means the same note: update it rather than create "name (2).md".
  const filename = sourceFilename(title || content.split("\n").find((l) => l.trim()), sourcesDir, { update: Boolean(title) });
  const filePath = path.join(sourcesDir, filename);
  const existed = fs.existsSync(filePath);

  // Keep the original created date and any other frontmatter (e.g. ignore: true) on update.
  const managed = new Set(["created", "updated", "title", "source_url", ...(type ? ["type"] : [])]);
  let created = todayFormatted();
  const kept = [];
  if (existed) {
    const fm = fs.readFileSync(filePath, "utf8").match(/^---\n([\s\S]*?)\n---/);
    let skipping = false;
    for (const line of fm ? fm[1].split("\n") : []) {
      const key = line.match(/^([A-Za-z0-9_-]+):/)?.[1];
      if (key) skipping = managed.has(key);
      if (key === "created") created = line.slice(line.indexOf(":") + 1).trim().replace(/^["']|["']$/g, "");
      if (!skipping) kept.push(line);
    }
  }

  const frontmatter = ["---", `created: ${created}`];
  if (existed) frontmatter.push(`updated: ${todayFormatted()}`);
  if (type) frontmatter.push(`type: ${type}`);
  if (title) frontmatter.push(`title: ${JSON.stringify(title)}`);
  if (source_url) frontmatter.push(`source_url: ${JSON.stringify(source_url)}`);
  frontmatter.push(...kept, "---", "");

  fs.writeFileSync(filePath, frontmatter.join("\n") + "\n" + content, "utf8");

  try {
    // execFileSync, not a shell string: titles contain spaces, quotes, $, etc.
    execFileSync("git", ["-C", WIKI_PATH, "add", `sources/${filename}`], { stdio: "pipe" });
    execFileSync("git", ["-C", WIKI_PATH, "commit", "-m", `wiki: ${existed ? "update" : "add"} source ${filename}`], { stdio: "pipe" });
  } catch { /* git may not be configured in all environments */ }

  return { saved: true, updated: existed, file: `sources/${filename}`, message: "Run /llm-wiki:wiki-process when ready to tag and organize." };
}

function getBacklinks({ source_file }) {
  const results = [];

  // Standard mode: read backlinks.md (root-level)
  const backlinksRaw = readRootFile("backlinks.md");
  if (backlinksRaw) {
    const lines = backlinksRaw.split("\n");
    let inSection = false;
    for (const line of lines) {
      if (line.startsWith(`## ${source_file}`)) { inSection = true; continue; }
      if (inSection && line.startsWith("## ")) break;
      if (inSection && line.startsWith("- ")) results.push(line.slice(2).trim());
    }
  }

  // Final fallback: scan frontmatter sources fields
  if (results.length === 0) {
    for (const { slug } of readMarkdownFiles(PAGES_DIR)) {
      const page = readPage(slug);
      if (!page) continue;
      const sources = page.frontmatter.sources || [];
      if (sources.some((s) => s === source_file || s.endsWith(path.basename(source_file)))) {
        const hasWikilinks = page.content.includes("[[");
        results.push(hasWikilinks
          ? `[[${slug}]]`
          : `[${page.frontmatter.title || slug}](wiki/pages/${slug}.md)`);
      }
    }
  }

  return { source_file, count: results.length, pages: results };
}

// --- Server setup ---

const server = new Server(
  { name: "llm-wiki", version: VERSION },
  { capabilities: { tools: {}, resources: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_wiki",
      description: "Search wiki pages AND sources/ (including notes not yet processed) by words and/or tags. Every word must match somewhere (any order); falls back to best partial matches. Returns ranked pages and sources with short excerpts. Sensitive notes excluded by default.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Words to search for (ticket keys like HW-2538 kept whole)" },
          tags: { type: "array", items: { type: "string" }, description: "Only return notes carrying at least one of these tags" },
          include_sensitive: { type: "boolean", description: "Include notes marked sensitive: true (default false)" },
          limit: { type: "number", description: "Max pages (default 10; sources get half)" },
        },
      },
    },
    {
      name: "get_page",
      description: "Fetch the full content of a wiki page by slug",
      inputSchema: {
        type: "object",
        properties: { slug: { type: "string", description: "Page slug (filename without .md)" } },
        required: ["slug"],
      },
    },
    {
      name: "list_pages",
      description: "List all wiki pages, optionally filtered by type or tag. Sensitive pages are excluded by default.",
      inputSchema: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["entity", "concept", "summary", "synthesis"] },
          tag: { type: "string" },
          include_sensitive: { type: "boolean", description: "Include pages marked sensitive: true (default false)" },
        },
      },
    },
    {
      name: "list_tags",
      description: "Return the canonical tag list from wiki/tags.md",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_backlinks",
      description: "Return all wiki pages that reference a given source file",
      inputSchema: {
        type: "object",
        properties: { source_file: { type: "string", description: "Relative path e.g. sources/paper.pdf" } },
        required: ["source_file"],
      },
    },
    {
      name: "get_recent",
      description: "What changed recently: log.md entries plus sources created/updated in the window (including unprocessed captures). Default last 7 days; or since/until ISO dates.",
      inputSchema: {
        type: "object",
        properties: {
          days: { type: "number", description: "Days to look back (default 7)" },
          since: { type: "string", description: "Start date YYYY-MM-DD (inclusive), overrides days" },
          until: { type: "string", description: "End date YYYY-MM-DD (inclusive, default today)" },
        },
      },
    },
    {
      name: "save_source",
      description: "Capture a note into sources/ (the one write path; /llm-wiki:wiki-add and /llm-wiki:wiki-session call this). Applies the naming rules, writes created:/updated: frontmatter, commits. Searchable immediately via search_wiki; /llm-wiki:wiki-process organizes it into pages later. Pass content WITHOUT frontmatter. If a source with the same title already exists, it is updated in place (content replaced, created date and other frontmatter kept) — read the existing file first and pass the full merged content.",
      inputSchema: {
        type: "object",
        properties: {
          content: { type: "string", description: "The content to save" },
          title: { type: "string", description: "Optional title — becomes the filename as-is, lowercased, spaces kept (e.g. \"payments architecture review.md\"). Same title = same note: updates the existing file" },
          source_url: { type: "string", description: "Optional URL the content came from" },
          type: { type: "string", description: "Optional note type for frontmatter, e.g. conversation, article, meeting-notes" },
        },
        required: ["content"],
      },
    },
    {
      name: "source_status",
      description: "Pipeline status of sources/ (plus `wiki`: the wiki path this server serves — use it for every file path and git command): untagged (new files), changed (edited since tagging, incl. unstamped), unorganized (wiki pages missing or out of date), removed (index entries whose file is gone), ignored. Used by /wiki-process and /wiki-autotag.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "prepare_sources",
      description: "Pipeline-only, first step of /wiki-process: stamp a created: date on every note in sources/ missing one, and rename untagged notes that break the naming rules (relinking [[wikilinks]]). Run before source_status.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_source_entries",
      description: "Pipeline: return only the named sections of sources/index.md (never read the whole file — it is large).",
      inputSchema: {
        type: "object",
        properties: { files: { type: "array", items: { type: "string" }, description: "Source filenames as in sources/" } },
        required: ["files"],
      },
    },
    {
      name: "write_source_entry",
      description: "Pipeline (wiki-tagger): write or replace one sources/index.md entry. Pass the entry fields (type, tags, summary, key-points, action-items, notable-quotes). The server sets date: from created:, stamps hash:, and carries wiki-pages:/organized-hash: forward.",
      inputSchema: {
        type: "object",
        properties: {
          file: { type: "string", description: "Source filename as in sources/" },
          entry: { type: "string", description: "Entry fields as markdown lines, no header" },
        },
        required: ["file", "entry"],
      },
    },
    {
      name: "set_wiki_pages",
      description: "Pipeline (wiki-curator): set one sources/index.md entry's wiki-pages list (slugs or wiki/pages/<slug>.md).",
      inputSchema: {
        type: "object",
        properties: {
          file: { type: "string" },
          pages: { type: "array", items: { type: "string" } },
        },
        required: ["file", "pages"],
      },
    },
    {
      name: "append_log",
      description: "Pipeline (wiki-curator) and maintenance commands: append entries to log.md (today's date) without reading it.",
      inputSchema: {
        type: "object",
        properties: {
          entries: {
            type: "array",
            items: {
              type: "object",
              properties: { action: { type: "string", enum: ["add", "update", "delete", "ingest", "restructure"] }, title: { type: "string" } },
              required: ["action", "title"],
            },
          },
        },
        required: ["entries"],
      },
    },
    {
      name: "remove_page",
      description: "Pipeline (wiki-curator): delete a wiki page whose only sources were removed, and drop its wiki/index.md line.",
      inputSchema: { type: "object", properties: { slug: { type: "string" } }, required: ["slug"] },
    },
    {
      name: "wiki_stats",
      description: "Counts for /wiki-stats: pages by type, top tags, source pipeline state, recent log activity. Free.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "find_unlinked_mentions",
      description: "For /wiki-link: pages that mention another page's title in prose without linking it. Free.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "rename_tag",
      description: "For /wiki-retag: rename or merge a tag across page frontmatter, sources/index.md entries and wiki/tags.md. Does not commit.",
      inputSchema: {
        type: "object",
        properties: { from: { type: "string" }, to: { type: "string" } },
        required: ["from", "to"],
      },
    },
    {
      name: "mark_sources",
      description: "Pipeline-only: stamp sources/index.md entries after a pipeline step. stage 'tagged' after wiki-tagger wrote/replaced entries; 'organized' after wiki-curator updated their pages; 'remove' drops entries whose source file was deleted; 'baseline' one-time stamp for entries tagged before change tracking.",
      inputSchema: {
        type: "object",
        properties: {
          files: { type: "array", items: { type: "string" }, description: "Source filenames as in sources/ (e.g. \"payments architecture review.md\")" },
          stage: { type: "string", enum: ["tagged", "organized", "baseline", "remove"] },
        },
        required: ["files", "stage"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  let result;

  if (name === "search_wiki") result = searchWiki(WIKI_PATH, args);
  else if (name === "get_page") result = getPage(args);
  else if (name === "list_pages") result = listPages(args);
  else if (name === "list_tags") result = listTags();
  else if (name === "get_backlinks") result = getBacklinks(args);
  else if (name === "get_recent") result = getRecent(WIKI_PATH, args);
  else if (name === "save_source") result = saveSource(args);
  else if (name === "prepare_sources") result = { wiki: WIKI_PATH, ...prepareSources(WIKI_PATH, readDateFormat(WIKI_PATH)) };
  else if (name === "get_source_entries") result = getSourceEntries(WIKI_PATH, args.files || []);
  else if (name === "write_source_entry") result = writeSourceEntry(WIKI_PATH, args.file, args.entry || "");
  else if (name === "set_wiki_pages") result = setWikiPages(WIKI_PATH, args.file, args.pages || []);
  else if (name === "append_log") result = appendLog(WIKI_PATH, args.entries);
  else if (name === "remove_page") result = removePage(WIKI_PATH, args.slug);
  else if (name === "wiki_stats") result = wikiStats(WIKI_PATH);
  else if (name === "find_unlinked_mentions") result = findUnlinkedMentions(WIKI_PATH);
  else if (name === "rename_tag") result = renameTag(WIKI_PATH, args.from, args.to);
  else if (name === "source_status") result = { wiki: WIKI_PATH, ...sourceStatus(WIKI_PATH) };
  else if (name === "mark_sources") result = markSources(WIKI_PATH, args.files || [], args.stage);
  else result = { error: `Unknown tool: ${name}` };

  // Compact JSON: tool results are model context, indentation is pure token cost.
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    { uri: "wiki://index", name: "Wiki Index", mimeType: "text/markdown" },
    { uri: "wiki://tags", name: "Tag List", mimeType: "text/markdown" },
    { uri: "wiki://log", name: "Change Log", mimeType: "text/markdown" },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  let text = "";

  if (uri === "wiki://index") text = readWikiFile("index.md");
  else if (uri === "wiki://tags") text = readWikiFile("tags.md");
  else if (uri === "wiki://log") text = readRootFile("log.md");
  else if (uri.startsWith("wiki://page/")) {
    const slug = uri.replace("wiki://page/", "");
    const page = readPage(slug);
    text = page ? page.raw : `Page "${slug}" not found`;
  } else {
    throw new Error(`Unknown resource: ${uri}`);
  }

  return { contents: [{ uri, mimeType: "text/markdown", text }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
