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
import { execSync } from "child_process";
import matter from "gray-matter";

const WIKI_PATH = process.env.WIKI_PATH
  ? path.resolve(process.env.WIKI_PATH.replace(/^~/, process.env.HOME))
  : path.join(process.env.HOME, "wiki");

const PAGES_DIR = path.join(WIKI_PATH, "wiki", "pages");
const WIKI_DIR  = path.join(WIKI_PATH, "wiki");

// --- Config & Obsidian CLI ---

function readLinkFormat() {
  const configPath = path.join(WIKI_PATH, "config.yaml");
  if (!fs.existsSync(configPath)) return "standard";
  const raw = fs.readFileSync(configPath, "utf8");
  return raw.match(/link_format:\s*(\S+)/)?.[1]?.replace(/['"]/g, "") || "standard";
}

// Cached per-process — Obsidian either is or isn't running when server starts
let _obsidianAvailable = null;
function obsidianAvailable() {
  if (_obsidianAvailable !== null) return _obsidianAvailable;
  try {
    execSync("obsidian version", { stdio: "pipe", timeout: 2000 });
    _obsidianAvailable = true;
  } catch {
    _obsidianAvailable = false;
  }
  return _obsidianAvailable;
}

function obsidianRun(cmd) {
  return execSync(`obsidian ${cmd}`, { encoding: "utf8", stdio: "pipe", timeout: 5000 });
}

// Returns true if we should try Obsidian CLI for read operations
function useObsidian() {
  return readLinkFormat() === "obsidian" && obsidianAvailable();
}

// --- Helpers ---

function readMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") && f !== ".gitkeep")
    .map((f) => ({ file: f, slug: f.replace(/\.md$/, "") }));
}

function readPage(slug) {
  const filePath = path.join(PAGES_DIR, `${slug}.md`);
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

function writeWikiFile(name, content) {
  const filePath = path.join(WIKI_DIR, name);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function readDateFormat() {
  const configPath = path.join(WIKI_PATH, "config.yaml");
  if (!fs.existsSync(configPath)) return "MM/DD/YYYY";
  const raw = fs.readFileSync(configPath, "utf8");
  return raw.match(/date_format:\s*["']?([^"'\n]+)["']?/)?.[1]?.trim() || "MM/DD/YYYY";
}

function today() {
  return new Date().toISOString().split("T")[0]; // ISO always used for log.md headers
}

function todayFormatted() {
  const d = new Date();
  const fmt = readDateFormat();
  const yyyy = d.getFullYear().toString();
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const dd = d.getDate().toString().padStart(2, "0");
  return fmt.replace("YYYY", yyyy).replace("MM", mm).replace("DD", dd);
}

function excerpt(content, query, maxLen = 150) {
  const idx = content.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return content.slice(0, maxLen).trim() + "…";
  const start = Math.max(0, idx - 40);
  const end = Math.min(content.length, idx + 100);
  return (start > 0 ? "…" : "") + content.slice(start, end).trim() + (end < content.length ? "…" : "");
}

// --- Tool handlers ---

function parseIndexMd() {
  const raw = readWikiFile("index.md");
  const entries = [];
  let currentType = null;
  for (const line of raw.split("\n")) {
    const typeMatch = line.match(/^## (.+)/);
    if (typeMatch) { currentType = typeMatch[1].toLowerCase().replace(/s$/, ""); continue; }
    const entryMatch = line.match(/^- \[(.+?)\]\(pages\/(.+?)\.md\)\s*[—–-]\s*(.+)/);
    if (entryMatch) entries.push({ title: entryMatch[1], slug: entryMatch[2], summary: entryMatch[3].trim(), type: currentType });
  }
  return entries;
}

function searchWiki({ query, tags, include_sensitive = false }) {
  const q = (query || "").toLowerCase();

  // Obsidian CLI path — no file reads needed
  if (useObsidian()) {
    try {
      const raw = obsidianRun(`search:context "${query.replace(/"/g, '\\"')}"`);
      const results = [];
      // Output format: "pages/slug.md:\n  ...matching line...\n"
      for (const block of raw.split(/\n(?=\S)/)) {
        const lines = block.trim().split("\n");
        const fileMatch = lines[0].match(/pages\/([^:.]+)\.md/);
        if (!fileMatch) continue;
        const slug = fileMatch[1];
        const matchExcerpt = lines.slice(1).map((l) => l.trim()).join(" ").slice(0, 150);
        const page = readPage(slug);
        if (!page) continue;
        if (!include_sensitive && page.frontmatter.sensitive === true) continue;
        if (tags?.length && !tags.some((t) => page.frontmatter.tags?.includes(t))) continue;
        results.push({ slug, excerpt: matchExcerpt, matchedIn: "obsidian-search" });
      }
      if (results.length) return { found: true, count: results.length, results, via: "obsidian-cli" };
    } catch { /* fall through to file I/O */ }
  }

  // File I/O path — index scan first, content scan as fallback
  const results = [];
  const seenSlugs = new Set();

  // Pass 1: fast index scan (no file reads)
  for (const entry of parseIndexMd()) {
    const titleMatch = entry.title.toLowerCase().includes(q);
    const summaryMatch = entry.summary.toLowerCase().includes(q);
    if (titleMatch || summaryMatch) {
      const page = readPage(entry.slug);
      if (!page) continue;
      if (!include_sensitive && page.frontmatter.sensitive === true) continue;
      if (tags?.length && !tags.some((t) => page.frontmatter.tags?.includes(t))) continue;
      results.push({ slug: entry.slug, title: entry.title, type: entry.type, summary: entry.summary, matchedIn: "index" });
      seenSlugs.add(entry.slug);
    }
  }

  // Pass 2: full content scan only if index gave nothing
  if (results.length === 0) {
    for (const { slug } of readMarkdownFiles(PAGES_DIR)) {
      if (seenSlugs.has(slug)) continue;
      const page = readPage(slug);
      if (!page) continue;
      const { frontmatter, content } = page;
      if (!include_sensitive && frontmatter.sensitive === true) continue;
      const tagMatch = tags?.length ? tags.some((t) => frontmatter.tags?.includes(t)) : false;
      const contentMatch = content.toLowerCase().includes(q);
      if (contentMatch || tagMatch) {
        results.push({ slug, title: frontmatter.title || slug, type: frontmatter.type, tags: frontmatter.tags || [], excerpt: excerpt(content, query), matchedIn: "content" });
      }
    }
  }

  if (!results.length) return { found: false, message: `No pages found matching "${query}"` };
  return { found: true, count: results.length, results, via: "file-io" };
}

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
  // Obsidian CLI path — returns tags with usage counts, no file reads
  if (useObsidian()) {
    try {
      const raw = obsidianRun("tags");
      // Output format: "tag-name (N)\n..."
      const tags = raw.trim().split("\n")
        .map((l) => l.match(/^(.+?)\s+\((\d+)\)$/))
        .filter(Boolean)
        .map((m) => ({ tag: m[1].trim(), count: parseInt(m[2]) }));
      if (tags.length) return { count: tags.length, tags, via: "obsidian-cli" };
    } catch { /* fall through */ }
  }

  // File I/O path — read tags.md
  const raw = readWikiFile("tags.md");
  const tags = [];
  for (const line of raw.split("\n")) {
    const match = line.match(/^- `([^`]+)`\s*[—–-]\s*(.+)$/);
    if (match) tags.push({ tag: match[1], description: match[2].trim() });
  }
  return { count: tags.length, tags, via: "file-io" };
}

function getRecent({ days = 7 } = {}) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  const raw = readRootFile("log.md");
  const entries = [];
  for (const line of raw.split("\n")) {
    const match = line.match(/^## \[(\d{4}-\d{2}-\d{2})\] (\w+) \| (.+)$/);
    if (!match) continue;
    const [, date, action, title] = match;
    if (date >= cutoffStr) entries.push({ date, action, title });
  }
  entries.sort((a, b) => b.date.localeCompare(a.date));
  return { days, since: cutoffStr, count: entries.length, entries };
}

function saveSource({ content, title, source_url }) {
  if (!content) return { error: "content is required" };

  const slug = (title || content.split("\n")[0].slice(0, 40))
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const filename = `session-${slug}-${today()}.md`;
  const filePath = path.join(WIKI_PATH, "sources", filename);

  const fmt = readDateFormat();
  const d = new Date();
  const created = todayFormatted();

  const frontmatter = ["---", `created: ${created}`, `type: conversation`];
  if (title) frontmatter.push(`title: "${title}"`);
  if (source_url) frontmatter.push(`source_url: "${source_url}"`);
  frontmatter.push("---", "");

  fs.mkdirSync(path.join(WIKI_PATH, "sources"), { recursive: true });
  fs.writeFileSync(filePath, frontmatter.join("\n") + "\n" + content, "utf8");

  try {
    execSync(`git -C "${WIKI_PATH}" add sources/${filename} && git -C "${WIKI_PATH}" commit -m "wiki: add source ${slug}"`, { stdio: "pipe" });
  } catch { /* git may not be configured in all environments */ }

  return { saved: true, file: `sources/${filename}`, message: "Run /llm-wiki:wiki-process when ready to tag and organize." };
}

function getBacklinks({ source_file }) {
  // Obsidian CLI path — native backlink tracking, no file reads
  if (useObsidian()) {
    try {
      const raw = obsidianRun(`backlinks "${source_file}"`);
      const pages = raw.trim().split("\n").map((l) => l.trim()).filter(Boolean);
      if (pages.length) return { source_file, count: pages.length, pages, via: "obsidian-cli" };
    } catch { /* fall through */ }
  }

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

  return { source_file, count: results.length, pages: results, via: "file-io" };
}

// --- Server setup ---

const server = new Server(
  { name: "llm-wiki", version: "1.0.0" },
  { capabilities: { tools: {}, resources: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_wiki",
      description: "Search wiki pages by text and/or tags. Sensitive pages are excluded by default.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Text to search for" },
          tags: { type: "array", items: { type: "string" }, description: "Filter by tags" },
          include_sensitive: { type: "boolean", description: "Include pages marked sensitive: true (default false)" },
        },
        required: ["query"],
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
      description: "Return wiki changes from the last N days (default 7). Reads log.md — free operation.",
      inputSchema: {
        type: "object",
        properties: {
          days: { type: "number", description: "Number of days to look back (default 7)" },
        },
      },
    },
    {
      name: "save_source",
      description: "Save content to sources/ for later processing via /llm-wiki:wiki-process. Use this from any ambient session to capture notes without creating a wiki page immediately.",
      inputSchema: {
        type: "object",
        properties: {
          content: { type: "string", description: "The content to save" },
          title: { type: "string", description: "Optional title (used for filename slug)" },
          source_url: { type: "string", description: "Optional URL the content came from" },
        },
        required: ["content"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  let result;

  if (name === "search_wiki") result = searchWiki(args);
  else if (name === "get_page") result = getPage(args);
  else if (name === "list_pages") result = listPages(args);
  else if (name === "list_tags") result = listTags();
  else if (name === "get_backlinks") result = getBacklinks(args);
  else if (name === "get_recent") result = getRecent(args);
  else if (name === "save_source") result = saveSource(args);
  else result = { error: `Unknown tool: ${name}` };

  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
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
