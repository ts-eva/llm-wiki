import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import matter from "gray-matter";

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

function parseIndex(text) {
  const lines = text.split("\n");
  const sections = [];
  lines.forEach((l, i) => { const m = l.match(HEADER); if (m) sections.push({ file: m[1], start: i }); });
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

function isIgnored(p) {
  if (!p.endsWith(".md")) return false;
  try { return matter(fs.readFileSync(p, "utf8")).data.ignore === true; } catch { return false; }
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
  fs.writeFileSync(indexPath, text, "utf8");
  return { stage, updated, errors };
}

// CLI: node sources-state.js status <wiki-path>
//      node sources-state.js mark <wiki-path> <stage> <file>...
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, wiki, stage, ...files] = process.argv.slice(2);
  const res = cmd === "status" ? sourceStatus(wiki) : cmd === "mark" ? markSources(wiki, files, stage) : { error: "usage: status <wiki> | mark <wiki> <stage> <file>..." };
  console.log(JSON.stringify(res, null, 2));
}
