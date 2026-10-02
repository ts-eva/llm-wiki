import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { parseIndex, sourceStatus } from "./sources-state.js";

// Word-based search over wiki pages AND sources/, so a note is findable the moment it's saved,
// not only after /wiki-process. Every query word must appear (any order, any field); if no
// document has them all, documents matching the most words come back marked partial.
// Scores: title hit 5, tag hit 3, body hits 1 each (capped at 5 per word).

const tokenize = (q) => (String(q || "").toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}._-]*/gu) || [])
  .map((t) => t.replace(/[._-]+$/, ""));

function excerpt(text, words, len = 160) {
  const lower = text.toLowerCase();
  const idx = Math.max(0, Math.min(...words.map((w) => lower.indexOf(w)).filter((i) => i >= 0)));
  const start = Math.max(0, idx - 40);
  const s = text.slice(start, start + len).replace(/\s+/g, " ").trim();
  return (start > 0 ? "…" : "") + s + (start + len < text.length ? "…" : "");
}

function score(doc, words) {
  let total = 0, matched = 0;
  const title = doc.title.toLowerCase(), tags = doc.tags.map((t) => String(t).toLowerCase()), body = doc.body.toLowerCase();
  for (const w of words) {
    const t = title.includes(w) ? 5 : 0;
    const g = tags.some((x) => x.includes(w)) ? 3 : 0;
    const b = Math.min(5, body.split(w).length - 1);
    if (t || g || b) matched++;
    total += t + g + b;
  }
  return { total, matched };
}

function readDocs(dir, map) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".md") && f !== "index.md").flatMap((f) => {
    try { return [map(f, matter(fs.readFileSync(path.join(dir, f), "utf8")))]; } catch { return []; }
  });
}

export function searchWiki(wikiPath, { query = "", tags, include_sensitive = false, limit = 10 } = {}) {
  const words = tokenize(query);
  const tagFilter = (tags || []).map((t) => String(t).toLowerCase());
  if (!words.length && !tagFilter.length) return { error: "query or tags required" };
  const keep = (d) => (include_sensitive || d.sensitive !== true)
    && (!tagFilter.length || d.tags.some((t) => tagFilter.includes(String(t).toLowerCase())));

  const pages = readDocs(path.join(wikiPath, "wiki", "pages"), (f, { data, content }) => ({
    kind: "page", slug: f.replace(/\.md$/, ""), title: data.title || f.replace(/\.md$/, ""),
    type: data.type, tags: data.tags || [], sensitive: data.sensitive, body: content,
  })).filter(keep);

  // Sources: raw text, plus where the pipeline stands for each.
  const status = sourceStatus(wikiPath);
  const ignored = new Set(status.ignored);
  const pending = new Set([...status.untagged, ...status.changed, ...status.unorganized]);
  const indexPath = path.join(wikiPath, "sources", "index.md");
  const { lines, sections } = parseIndex(fs.existsSync(indexPath) ? fs.readFileSync(indexPath, "utf8") : "");
  const entryOf = new Map(sections.map((s) => [s.file, lines.slice(s.start, s.end)]));
  const sources = readDocs(path.join(wikiPath, "sources"), (f, { data, content }) => {
    const entry = entryOf.get(f) || [];
    const line = (k) => entry.find((l) => l.startsWith(`${k}:`))?.slice(k.length + 1).trim();
    const tagLine = line("tags");
    return {
      kind: "source", file: f, title: f.replace(/\.md$/, ""), sensitive: data.sensitive, body: content,
      tags: data.tags || (tagLine ? tagLine.replace(/^\[|\]$/g, "").split(",").map((t) => t.trim()).filter(Boolean) : []),
      summary: line("summary"),
      wikiPages: (line("wiki-pages") || "").replace(/^\[|\]$/g, "").split(",").map((p) => path.basename(p.trim(), ".md")).filter(Boolean),
    };
  }).filter((d) => !ignored.has(d.file) && keep(d));

  const scored = [...pages, ...sources].map((d) => ({ d, ...score(d, words) }));
  const full = words.length ? scored.filter((r) => r.matched === words.length) : scored;
  const partial = full.length === 0 && words.length > 1;
  const hits = (partial ? scored.filter((r) => r.matched > 0) : full)
    .sort((a, b) => b.matched - a.matched || b.total - a.total);

  const pageHits = hits.filter((r) => r.d.kind === "page");
  const shownPages = new Set(pageHits.slice(0, limit).map((r) => r.d.slug));
  const sourceHits = hits.filter((r) => r.d.kind === "source"
    && (pending.has(r.d.file) || !r.d.wikiPages.some((p) => shownPages.has(p))));

  const out = {
    query, ...(partial && { partial: true, note: "no document matches every word; showing best partial matches" }),
    pages: pageHits.slice(0, limit).map(({ d, total }) => ({
      slug: d.slug, title: d.title, type: d.type, score: total, excerpt: excerpt(d.body, words.length ? words : [""]),
    })),
    sources: sourceHits.slice(0, Math.ceil(limit / 2)).map(({ d, total }) => ({
      file: `sources/${d.file}`, processed: !pending.has(d.file), score: total,
      ...(d.summary ? { summary: d.summary } : { excerpt: excerpt(d.body, words.length ? words : [""]) }),
      ...(d.wikiPages.length && { wikiPages: d.wikiPages }),
    })),
  };
  out.more = Math.max(0, pageHits.length - out.pages.length) + Math.max(0, sourceHits.length - out.sources.length);
  out.found = out.pages.length + out.sources.length > 0;
  return out;
}
