import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { frontmatterDates, isoDate, readDateFormat } from "./dates.js";

// Pipeline state for sources/. Each `## sources/<file>` section in
// sources/index.md carries two stamps written only by markSources():
//   hash:           content hash of the source when it was last tagged
//   organized-hash: the hash its wiki pages were last updated from
// A source edited after tagging has a different hash, so /wiki-process can
// pick up edits, not just new files.

const HEADER = /^## sources\/(.+?)\s*$/;

export function fileHash(p) {
  return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex").slice(0, 12);
}

// Headers inside <!-- --> comments (the format example at the top of index.md) are not entries.
export function parseIndex(text) {
  const lines = text.split("\n");
  const sections = [];
  let inComment = false;
  lines.forEach((l, i) => {
    const m = !inComment && l.match(HEADER);
    if (m) sections.push({ file: m[1], start: i });
    const open = l.lastIndexOf("<!--"), close = l.lastIndexOf("-->");
    if (open !== -1 || close !== -1) inComment = open > close;
  });
  sections.forEach((s, k) => { s.end = k + 1 < sections.length ? sections[k + 1].start : lines.length; });
  return { lines, sections };
}

function fieldLine(lines, s, key) {
  for (let i = s.start + 1; i < s.end; i++) if (lines[i].startsWith(`${key}:`)) return i;
  return -1;
}

function field(lines, s, key) {
  const i = fieldLine(lines, s, key);
  return i === -1 ? undefined : lines[i].slice(key.length + 1).trim();
}

const hasPages = (v) => v !== undefined && !/^\[\s*\]$/.test(v);

function sourceFiles(dir) {
  return fs.readdirSync(dir).filter((f) => f !== "index.md" && !f.startsWith(".") && fs.statSync(path.join(dir, f)).isFile());
}

// Regex, not gray-matter: this module stays dependency-free so the SessionStart hook (run from
// the plugin cache, which has no node_modules) and nightly-process.sh can import it.
function isIgnored(p) {
  if (!p.endsWith(".md")) return false;
  try {
    const fm = fs.readFileSync(p, "utf8").match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] || "";
    return /^ignore:\s*true\s*$/m.test(fm);
  } catch { return false; }
}

export function sourceStatus(wikiPath) {
  const dir = path.join(wikiPath, "sources");
  const indexPath = path.join(dir, "index.md");
  const { lines, sections } = parseIndex(fs.existsSync(indexPath) ? fs.readFileSync(indexPath, "utf8") : "");
  const indexed = new Map(sections.map((s) => [s.file, s]));
  const files = fs.existsSync(dir) ? sourceFiles(dir) : [];
  const out = { untagged: [], changed: [], unstamped: [], unorganized: [], removed: [], ignored: [] };
  for (const f of files) {
    const p = path.join(dir, f);
    if (isIgnored(p)) { out.ignored.push(f); continue; }
    const s = indexed.get(f);
    if (!s) { out.untagged.push(f); continue; }
    const hash = field(lines, s, "hash");
    if (hash !== fileHash(p)) {            // edited since tagging, or never stamped
      out.changed.push(f);
      if (!hash) out.unstamped.push(f);
      continue;
    }
    if (!hasPages(field(lines, s, "wiki-pages")) || field(lines, s, "organized-hash") !== hash) out.unorganized.push(f);
  }
  const present = new Set(files);
  out.removed = sections.map((s) => s.file).filter((f) => !present.has(f));
  return out;
}

function setField(lines, s, key, value) {
  const i = fieldLine(lines, s, key);
  if (i !== -1) { lines[i] = `${key}: ${value}`; return; }
  let at = fieldLine(lines, s, "wiki-pages");
  if (at === -1) { at = s.end; while (at > s.start + 1 && lines[at - 1].trim() === "") at--; }
  lines.splice(at, 0, `${key}: ${value}`);
}

// stage: "tagged" | "organized" | "baseline" | "remove"
export function markSources(wikiPath, files, stage) {
  if (!["tagged", "organized", "baseline", "remove"].includes(stage)) return { error: `unknown stage "${stage}"` };
  const dir = path.join(wikiPath, "sources");
  const indexPath = path.join(dir, "index.md");
  if (!fs.existsSync(indexPath)) return { error: "sources/index.md not found" };
  let text = fs.readFileSync(indexPath, "utf8");
  const updated = [], errors = [];
  for (const f of files) {
    const { lines, sections } = parseIndex(text);
    const s = sections.find((x) => x.file === f);
    const p = path.join(dir, f);
    if (!s) { errors.push(`${f}: no index section`); continue; }
    if (stage === "remove") {
      if (fs.existsSync(p)) { errors.push(`${f}: file still exists, not removing its entry`); continue; }
      lines.splice(s.start, s.end - s.start);
    } else {
      if (!fs.existsSync(p)) { errors.push(`${f}: file not found`); continue; }
      const hash = fileHash(p);
      if (stage === "tagged") setField(lines, s, "hash", hash);
      if (stage === "organized") {
        if (field(lines, s, "hash") !== hash) { errors.push(`${f}: changed since tagging, re-tag before marking organized`); continue; }
        if (!hasPages(field(lines, s, "wiki-pages"))) { errors.push(`${f}: wiki-pages is empty`); continue; }
        setField(lines, s, "organized-hash", hash);
      }
      if (stage === "baseline") {
        const pages = hasPages(field(lines, s, "wiki-pages"));
        setField(lines, s, "hash", hash);
        if (pages) setField(lines, parseIndex(lines.join("\n")).sections.find((x) => x.file === f), "organized-hash", hash);
      }
    }
    text = lines.join("\n");
    updated.push(f);
  }
  writeAtomic(indexPath, text);
  return { stage, updated, errors };
}

function writeAtomic(p, text) {
  fs.writeFileSync(`${p}.tmp`, text, "utf8");
  fs.renameSync(`${p}.tmp`, p);
}

function readIndex(wikiPath) {
  const indexPath = path.join(wikiPath, "sources", "index.md");
  return { indexPath, text: fs.existsSync(indexPath) ? fs.readFileSync(indexPath, "utf8") : "# Sources Index\n" };
}

// Return only the requested sections of sources/index.md, so agents never read the whole file.
export function getSourceEntries(wikiPath, files) {
  const { lines, sections } = parseIndex(readIndex(wikiPath).text);
  const entries = {};
  for (const f of files) {
    const s = sections.find((x) => x.file === f);
    entries[f] = s ? lines.slice(s.start, s.end).join("\n").trim() : null;
  }
  return { entries };
}

const PIPELINE_KEYS = /^(hash|organized-hash|wiki-pages|date):/;

// Write (or replace) one tagger entry. The server owns the bookkeeping fields: `date:` comes
// from the note's created: frontmatter, `hash:` is stamped now (this is the "tagged" mark),
// and an existing entry's `wiki-pages:` and `organized-hash:` carry forward.
export function writeSourceEntry(wikiPath, file, entry) {
  const p = path.join(wikiPath, "sources", file);
  if (!fs.existsSync(p)) return { error: `${file}: file not found` };
  const { indexPath, text } = readIndex(wikiPath);
  const { lines, sections } = parseIndex(text);
  const s = sections.find((x) => x.file === file);
  const created = frontmatterDates(fs.readFileSync(p, "utf8"), readDateFormat(wikiPath)).created || fs.statSync(p).mtime;
  const body = String(entry).split("\n").filter((l) => !HEADER.test(l) && !PIPELINE_KEYS.test(l));
  while (body.length && !body[body.length - 1].trim()) body.pop();
  while (body.length && !body[0].trim()) body.shift();
  const organized = s && field(lines, s, "organized-hash");
  const section = [
    `## sources/${file}`,
    `date: ${isoDate(created)}`,
    ...body,
    `hash: ${fileHash(p)}`,
    ...(organized ? [`organized-hash: ${organized}`] : []),
    `wiki-pages: ${(s && field(lines, s, "wiki-pages")) || "[]"}`,
    "",
  ];
  if (s) lines.splice(s.start, s.end - s.start, ...section);
  else {
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    lines.push("", ...section);
  }
  writeAtomic(indexPath, lines.join("\n"));
  return { written: file, replaced: Boolean(s) };
}

// Set one entry's wiki-pages list. Accepts slugs or wiki/pages/<slug>.md paths.
export function setWikiPages(wikiPath, file, pages) {
  const { indexPath, text } = readIndex(wikiPath);
  const { lines, sections } = parseIndex(text);
  const s = sections.find((x) => x.file === file);
  if (!s) return { error: `${file}: no index section` };
  const list = [...new Set(pages.map((x) => `wiki/pages/${path.basename(String(x)).replace(/\.md$/, "")}.md`))];
  setField(lines, s, "wiki-pages", `[${list.join(", ")}]`);
  writeAtomic(indexPath, lines.join("\n"));
  return { file, wikiPages: list };
}

// CLI: node sources-state.js status <wiki-path>
//      node sources-state.js mark <wiki-path> <stage> <file>...
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, wiki, stage, ...files] = process.argv.slice(2);
  const res = cmd === "status" ? sourceStatus(wiki) : cmd === "mark" ? markSources(wiki, files, stage) : { error: "usage: status <wiki> | mark <wiki> <stage> <file>..." };
  console.log(JSON.stringify(res, null, 2));
}
