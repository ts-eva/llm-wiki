import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { frontmatterDates, isoDate, readDateFormat } from "./dates.js";
import { parseIndex, sourceStatus } from "./sources-state.js";

// Deterministic wiki chores that used to be done by a model reading every file:
// stats, recent activity, unlinked-mention detection, tag renames.

const pagesDir = (w) => path.join(w, "wiki", "pages");
const mdFiles = (d) => (fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith(".md") && f !== "index.md") : []);
const readPages = (w) => mdFiles(pagesDir(w)).map((f) => {
  const raw = fs.readFileSync(path.join(pagesDir(w), f), "utf8");
  return { slug: f.replace(/\.md$/, ""), raw, ...matter(raw) };
});

function logEntries(w) {
  const p = path.join(w, "log.md");
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, "utf8").split("\n").flatMap((l) => {
    const m = l.match(/^## \[(\d{4}-\d{2}-\d{2})\] (\w+) \| (.+)$/);
    return m ? [{ date: m[1], action: m[2], title: m[3] }] : [];
  });
}

export function wikiStats(w) {
  const pages = readPages(w);
  const byType = {}, tagUse = {};
  for (const { data } of pages) {
    byType[data.type || "untyped"] = (byType[data.type || "untyped"] || 0) + 1;
    for (const t of data.tags || []) tagUse[t] = (tagUse[t] || 0) + 1;
  }
  const tagsPath = path.join(w, "wiki", "tags.md");
  const canonical = fs.existsSync(tagsPath) ? (fs.readFileSync(tagsPath, "utf8").match(/^- `[^`]+`/gm) || []).length : 0;
  const s = sourceStatus(w);
  const indexPath = path.join(w, "sources", "index.md");
  const { lines, sections } = parseIndex(fs.existsSync(indexPath) ? fs.readFileSync(indexPath, "utf8") : "");
  const organized = sections.filter((x) => lines.slice(x.start, x.end).some((l) => /^wiki-pages: \[.+\]/.test(l))).length;
  const log = logEntries(w);
  const month = isoDate(new Date()).slice(0, 7);
  return {
    pages: { total: pages.length, byType },
    tags: { canonical, top: Object.entries(tagUse).sort((a, b) => b[1] - a[1]).slice(0, 5) },
    sources: {
      files: fs.existsSync(path.join(w, "sources")) ? fs.readdirSync(path.join(w, "sources")).filter((f) => f !== "index.md" && !f.startsWith(".")).length : 0,
      tagged: sections.length, organized,
      untagged: s.untagged.length, changed: s.changed.length, unorganized: s.unorganized.length,
      removed: s.removed.length, ignored: s.ignored.length,
    },
    activity: { thisMonth: log.filter((e) => e.date.startsWith(month)).length, last: log.slice(-5).reverse() },
  };
}

// Log entries plus sources created/updated in the window, so captures show up before
// /wiki-process has run. since/until are ISO dates (inclusive); default is the last `days` days.
export function getRecent(w, { days = 7, since, until } = {}) {
  const start = since || isoDate(new Date(Date.now() - days * 864e5));
  const end = until || isoDate(new Date());
  const inRange = (d) => d >= start && d <= end;
  const fmt = readDateFormat(w);
  const s = sourceStatus(w);
  const pending = new Set([...s.untagged, ...s.changed, ...s.unorganized]);
  const dir = path.join(w, "sources");
  const sources = mdFiles(dir).flatMap((f) => {
    const { created, updated } = frontmatterDates(fs.readFileSync(path.join(dir, f), "utf8"), fmt);
    const c = created && isoDate(created), u = updated && isoDate(updated);
    if (!(c && inRange(c)) && !(u && inRange(u))) return [];
    return [{ file: f, created: c, ...(u && { updated: u }), processed: !pending.has(f) && !s.ignored.includes(f) }];
  }).sort((a, b) => (b.updated || b.created).localeCompare(a.updated || a.created));
  const log = logEntries(w).filter((e) => inRange(e.date)).sort((a, b) => b.date.localeCompare(a.date));
  return { since: start, until: end, log, sources };
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Pages that mention another page's title in prose without linking it. Skips frontmatter,
// headings, code, existing links, and titles shorter than 4 characters.
export function findUnlinkedMentions(w) {
  const pages = readPages(w);
  const titles = pages.map((p) => ({ slug: p.slug, title: String(p.data.title || p.slug) })).filter((t) => t.title.length >= 4);
  const out = {};
  for (const page of pages) {
    const prose = page.content
      .replace(/```[\s\S]*?```/g, "")
      .split("\n").filter((l) => !/^#/.test(l)).join("\n")
      .replace(/`[^`]*`/g, " ")
      .replace(/\[\[[^\]]*\]\]/g, " ")
      .replace(/\[[^\]]*\]\([^)]*\)/g, " ");
    for (const t of titles) {
      if (t.slug === page.slug) continue;
      const m = prose.match(new RegExp(`(^|[^\\p{L}\\p{N}])(${escapeRe(t.title)})(?=$|[^\\p{L}\\p{N}])`, "iu"));
      if (!m) continue;
      (out[page.slug] ||= []).push({ title: t.title, slug: t.slug, excerpt: prose.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30).replace(/\s+/g, " ").trim() });
    }
  }
  return { count: Object.values(out).flat().length, mentions: out };
}

// Rename (or merge) a tag in page frontmatter, sources/index.md entries, and wiki/tags.md.
export function renameTag(w, from, to) {
  if (!from || !to || from === to) return { error: "from and to required and different" };
  const swap = (line) => {
    const m = line.match(/^(tags:\s*\[)(.*)(\]\s*)$/);
    if (!m) return line;
    const list = m[2].split(",").map((t) => t.trim()).filter(Boolean);
    if (!list.includes(from)) return line;
    return `${m[1]}${[...new Set(list.map((t) => (t === from ? to : t)))].join(", ")}${m[3]}`;
  };
  const pages = [], skipped = [];
  for (const p of readPages(w)) {
    if (!(p.data.tags || []).includes(from)) continue;
    const fm = p.raw.match(/^---\r?\n[\s\S]*?\r?\n---/)[0];
    const next = fm.split("\n").map(swap).join("\n");
    if (next === fm) { skipped.push(p.slug); continue; } // block-style YAML list: leave for a manual edit
    fs.writeFileSync(path.join(pagesDir(w), `${p.slug}.md`), p.raw.replace(fm, next), "utf8");
    pages.push(p.slug);
  }
  let entries = 0;
  const indexPath = path.join(w, "sources", "index.md");
  if (fs.existsSync(indexPath)) {
    const text = fs.readFileSync(indexPath, "utf8");
    const next = text.split("\n").map((l) => { const n = swap(l); if (n !== l) entries++; return n; }).join("\n");
    if (next !== text) fs.writeFileSync(indexPath, next, "utf8");
  }
  const tagsPath = path.join(w, "wiki", "tags.md");
  if (fs.existsSync(tagsPath)) {
    const lines = fs.readFileSync(tagsPath, "utf8").split("\n");
    const hasTo = lines.some((l) => l.startsWith(`- \`${to}\``));
    const next = lines.flatMap((l) => (l.startsWith(`- \`${from}\``) ? (hasTo ? [] : [l.replace(`\`${from}\``, `\`${to}\``)]) : [l]));
    fs.writeFileSync(tagsPath, next.join("\n"), "utf8");
  }
  return { from, to, pages, entries, skipped };
}

// Append log.md entries without the caller reading the file. entries: [{ action, title }].
export function appendLog(w, entries) {
  const lines = (entries || []).filter((e) => e?.action && e?.title)
    .map((e) => `## [${isoDate(new Date())}] ${String(e.action).trim()} | ${String(e.title).replace(/\n/g, " ").trim()}`);
  if (!lines.length) return { error: "entries: [{ action, title }] required" };
  const p = path.join(w, "log.md");
  const text = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "# Log\n";
  fs.writeFileSync(p, text.replace(/\n*$/, "\n") + lines.join("\n") + "\n", "utf8");
  return { appended: lines.length };
}

// Delete a page and its wiki/index.md line (either link format).
export function removePage(w, slug) {
  const s = path.basename(String(slug || "")).replace(/\.md$/, "");
  const p = path.join(pagesDir(w), `${s}.md`);
  if (!s || !fs.existsSync(p)) return { error: `page "${s}" not found` };
  fs.unlinkSync(p);
  const indexPath = path.join(w, "wiki", "index.md");
  let indexLine = false;
  if (fs.existsSync(indexPath)) {
    const lines = fs.readFileSync(indexPath, "utf8").split("\n");
    const re = new RegExp(`\\[\\[${escapeRe(s)}(\\|[^\\]]*)?\\]\\]|\\]\\((pages/)?${escapeRe(s)}\\.md\\)`);
    const kept = lines.filter((l) => !(l.startsWith("- ") && re.test(l)));
    indexLine = kept.length !== lines.length;
    fs.writeFileSync(indexPath, kept.join("\n"), "utf8");
  }
  return { removed: s, indexLine };
}
