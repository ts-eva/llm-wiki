#!/usr/bin/env node
/**
 * llm-wiki format converter
 * Usage: node convert.js <wiki-path> <target-format>
 *   target-format: "obsidian" | "standard"
 */

import fs from "fs";
import path from "path";
import matter from "gray-matter";

const [,, WIKI_PATH_RAW, TARGET] = process.argv;

if (!WIKI_PATH_RAW || !["obsidian", "standard"].includes(TARGET)) {
  console.error("Usage: node convert.js <wiki-path> obsidian|standard");
  process.exit(1);
}

const WIKI_PATH = path.resolve(WIKI_PATH_RAW.replace(/^~/, process.env.HOME));
const PAGES_DIR = path.join(WIKI_PATH, "wiki", "pages");
const WIKI_DIR  = path.join(WIKI_PATH, "wiki");
const CONFIG_PATH = path.join(WIKI_PATH, "config.yaml");

// --- Helpers ---

function readConfig() {
  const raw = fs.readFileSync(CONFIG_PATH, "utf8");
  // Simple key read — avoid yaml dep, just extract link_format
  const match = raw.match(/link_format:\s*(\S+)/);
  return match ? match[1].replace(/['"]/g, "") : "standard";
}

function updateConfig(format) {
  let raw = fs.readFileSync(CONFIG_PATH, "utf8");
  raw = raw.replace(/link_format:\s*\S+/, `link_format: ${format}`);
  fs.writeFileSync(CONFIG_PATH, raw, "utf8");
}

function pageFiles() {
  if (!fs.existsSync(PAGES_DIR)) return [];
  return fs.readdirSync(PAGES_DIR)
    .filter(f => f.endsWith(".md") && f !== ".gitkeep")
    .map(f => ({ file: f, slug: f.replace(/\.md$/, ""), fullPath: path.join(PAGES_DIR, f) }));
}

// Build slug → title map from all page frontmatter
function buildTitleMap() {
  const map = {};
  for (const { slug, fullPath } of pageFiles()) {
    const parsed = matter(fs.readFileSync(fullPath, "utf8"));
    map[slug] = parsed.data.title || slug;
  }
  return map;
}

// --- Conversion functions ---

function toObsidian(content) {
  // Convert ## Sources links to [[sources/filename]] first — before the
  // general page-link regex below, since both match a "[...](...)" shape.
  // Matches either ../../sources/x (correct, two levels up from wiki/pages/)
  // or the legacy ../sources/x (one level — content written before that was fixed).
  let result = content.replace(
    /\[([^\]]+)\]\((?:\.\.\/)+sources\/([^)]+)\)/g,
    (_, _title, filename) => `[[sources/${filename}]]`
  );

  // Replace [Title](slug.md) → [[slug]] — same-dir cross-page link (both
  // pages live in wiki/pages/). Also matches the legacy pages/slug.md form.
  result = result.replace(
    /\[([^\]]+)\]\((?:pages\/)?([^\/)]+)\.md\)/g,
    (_, _title, slug) => `[[${slug}]]`
  );

  return result;
}

function toStandard(content, titleMap) {
  // Handle source file wikilinks first — before general slug replacement
  // [[sources/filename.ext]] → [filename.ext](../../sources/filename.ext)
  // (up two levels from wiki/pages/ to reach the wiki-root sources/ dir)
  let result = content.replace(
    /\[\[sources\/([^\]]+)\]\]/g,
    (_, filename) => `[${filename}](../../sources/${filename})`
  );

  // Replace [[slug|Display]] → [Display](slug.md) — same dir
  result = result.replace(
    /\[\[([^\]|]+)\|([^\]]+)\]\]/g,
    (_, slug, display) => `[${display}](${slug}.md)`
  );

  // Replace [[slug]] → [Title](slug.md) using title map — same dir
  result = result.replace(
    /\[\[([^\]|]+)\]\]/g,
    (_, slug) => {
      const title = titleMap[slug] || slug;
      return `[${title}](${slug}.md)`;
    }
  );

  return result;
}

function rebuildSourcesSection(content, sources) {
  if (!sources || sources.length === 0) return content;
  const section = "\n## Sources\n" + sources.map(s => {
    const name = path.basename(s);
    return `- [${name}](../../${s})`;
  }).join("\n") + "\n";
  // Append before any trailing whitespace
  return content.trimEnd() + section;
}

function rebuildBacklinksMd(titleMap) {
  const backlinks = {};
  for (const { slug, fullPath } of pageFiles()) {
    const parsed = matter(fs.readFileSync(fullPath, "utf8"));
    const sources = parsed.data.sources || [];
    for (const src of sources) {
      if (!backlinks[src]) backlinks[src] = [];
      const title = titleMap[slug] || slug;
      backlinks[src].push(`[${title}](wiki/pages/${slug}.md)`);
    }
  }

  let md = "# Backlinks\n";
  for (const [src, links] of Object.entries(backlinks)) {
    md += `\n## ${src}\n` + links.map(l => `- ${l}`).join("\n") + "\n";
  }
  return md;
}

// --- Main ---

const current = readConfig();
if (current === TARGET) {
  console.log(`Already in ${TARGET} mode. Nothing to do.`);
  process.exit(0);
}

console.log(`Converting ${current} → ${TARGET}…`);

const titleMap = buildTitleMap();
let convertedCount = 0;

for (const { slug, fullPath } of pageFiles()) {
  const raw = fs.readFileSync(fullPath, "utf8");
  const parsed = matter(raw);
  let body = parsed.content;

  if (TARGET === "obsidian") {
    body = toObsidian(body);
  } else {
    body = toStandard(body, titleMap);
    // Only rebuild Sources section if toStandard didn't already restore it
    // (i.e. the page was created in Obsidian without [[sources/]] links)
    if (!body.includes("## Sources")) {
      body = rebuildSourcesSection(body, parsed.data.sources || []);
    }
  }

  // Reconstruct full file (frontmatter unchanged)
  const newContent = matter.stringify(body, parsed.data);
  fs.writeFileSync(fullPath, newContent, "utf8");
  convertedCount++;
  console.log(`  ✓ ${slug}.md`);
}

// Handle backlinks.md (root-level)
const backlinksPath = path.join(WIKI_PATH, "backlinks.md");
if (TARGET === "obsidian") {
  if (fs.existsSync(backlinksPath)) {
    fs.unlinkSync(backlinksPath);
    console.log("  ✓ removed backlinks.md (Obsidian handles this natively)");
  }
} else {
  const backlinks = rebuildBacklinksMd(titleMap);
  fs.writeFileSync(backlinksPath, backlinks, "utf8");
  console.log("  ✓ rebuilt backlinks.md");
}

// Handle .obsidian/ folder
const obsidianDir = path.join(WIKI_PATH, ".obsidian");
if (TARGET === "standard" && fs.existsSync(obsidianDir)) {
  fs.rmSync(obsidianDir, { recursive: true });
  console.log("  ✓ removed .obsidian/ folder");
}

// Update config.yaml
updateConfig(TARGET);
console.log(`  ✓ config.yaml updated to link_format: ${TARGET}`);

console.log(`\nDone. ${convertedCount} page(s) converted to ${TARGET} format.`);
if (TARGET === "obsidian") {
  console.log(`Open ${WIKI_PATH} in Obsidian as your vault (vault root is the wiki folder itself, not wiki/). Install the Dataview plugin for query support.`);
} else {
  console.log("Links now render on GitLab, GitHub, VS Code, Warp, and any editor.");
}
