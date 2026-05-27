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

function writeWikiFile(name, content) {
  const filePath = path.join(WIKI_DIR, name);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function gitCommit(message) {
  try {
    execSync(`git -C "${WIKI_PATH}" add .`, { stdio: "pipe" });
    execSync(`git -C "${WIKI_PATH}" commit -m "${message}"`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
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

function searchWiki({ query, tags }) {
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
        if (tags?.length) {
          const page = readPage(slug);
          if (!page || !tags.some((t) => page.frontmatter.tags?.includes(t))) continue;
        }
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
      if (tags?.length) {
        const page = readPage(entry.slug);
        if (!page || !tags.some((t) => page.frontmatter.tags?.includes(t))) continue;
      }
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

function listPages({ type, tag }) {
  const files = readMarkdownFiles(PAGES_DIR);
  const results = [];

  for (const { slug } of files) {
    const page = readPage(slug);
    if (!page) continue;
    const { frontmatter } = page;
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

function addNote({ slug, markdown }) {
  if (!slug || !markdown) return { error: "slug and markdown are required" };

  const filePath = path.join(PAGES_DIR, `${slug}.md`);
  fs.mkdirSync(PAGES_DIR, { recursive: true });
  fs.writeFileSync(filePath, markdown, "utf8");

  const parsed = matter(markdown);
  const { title, type, tags = [], sources = [] } = parsed.data;

  // Update index.md
  const indexPath = path.join(WIKI_DIR, "index.md");
  let index = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, "utf8") : "";
  const entry = `- [${title || slug}](pages/${slug}.md) — ${parsed.content.split("\n").find((l) => l.trim()) || ""}`;
  const section = type ? type.charAt(0).toUpperCase() + type.slice(1) + "s" : "Concepts";
  if (index.includes(`## ${section}`)) {
    index = index.replace(`## ${section}\n`, `## ${section}\n${entry}\n`);
  } else {
    index += `\n## ${section}\n${entry}\n`;
  }
  fs.writeFileSync(indexPath, index, "utf8");

  // Append to log.md — use obsidian append in obsidian mode (no read needed)
  const logPath = path.join(WIKI_DIR, "log.md");
  const logEntry = `\n## [${today()}] add | ${title || slug}`;
  let appendedViaObsidian = false;
  if (useObsidian()) {
    try {
      obsidianRun(`append "wiki/log.md" "${logEntry.replace(/"/g, '\\"')}"`);
      appendedViaObsidian = true;
    } catch { /* fall through */ }
  }
  if (!appendedViaObsidian) fs.appendFileSync(logPath, logEntry, "utf8");

  // Update backlinks.md
  if (sources.length) {
    const backlinksPath = path.join(WIKI_DIR, "backlinks.md");
    let backlinks = fs.existsSync(backlinksPath) ? fs.readFileSync(backlinksPath, "utf8") : "# Backlinks\n";
    for (const src of sources) {
      const link = `- [${title || slug}](pages/${slug}.md)`;
      if (backlinks.includes(`## ${src}`)) {
        backlinks = backlinks.replace(`## ${src}\n`, `## ${src}\n${link}\n`);
      } else {
        backlinks += `\n## ${src}\n${link}\n`;
      }
    }
    fs.writeFileSync(backlinksPath, backlinks, "utf8");
  }

  gitCommit(`wiki: add ${title || slug}`);
  return { success: true, slug, title: title || slug };
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

  // Standard mode: read backlinks.md
  const backlinksRaw = readWikiFile("backlinks.md");
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
          : `[${page.frontmatter.title || slug}](pages/${slug}.md)`);
      }
    }
  }

  return { source_file, count: results.length, pages: results, via: "file-io" };
}

// --- Server setup ---

const server = new Server(
  { name: "wiki-notes", version: "1.0.0" },
  { capabilities: { tools: {}, resources: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_wiki",
      description: "Search wiki pages by text and/or tags",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Text to search for" },
          tags: { type: "array", items: { type: "string" }, description: "Filter by tags" },
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
      description: "List all wiki pages, optionally filtered by type or tag",
      inputSchema: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["entity", "concept", "summary", "synthesis"] },
          tag: { type: "string" },
        },
      },
    },
    {
      name: "list_tags",
      description: "Return the canonical tag list from wiki/tags.md",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "add_note",
      description: "Write a new wiki page and update all indexes. Claude should format the full markdown (with frontmatter) before calling this.",
      inputSchema: {
        type: "object",
        properties: {
          slug: { type: "string", description: "kebab-case filename without .md" },
          markdown: { type: "string", description: "Complete markdown content including YAML frontmatter" },
        },
        required: ["slug", "markdown"],
      },
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
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  let result;

  if (name === "search_wiki") result = searchWiki(args);
  else if (name === "get_page") result = getPage(args);
  else if (name === "list_pages") result = listPages(args);
  else if (name === "list_tags") result = listTags();
  else if (name === "add_note") result = addNote(args);
  else if (name === "get_backlinks") result = getBacklinks(args);
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
  else if (uri === "wiki://log") text = readWikiFile("log.md");
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
