import fs from "fs";

// Near-duplicate source titles, so save_source can stop a second note on a topic that already
// has one. Titles are compared as word sets: lowercase, stopwords and bare numbers (dates) dropped,
// a trailing plural "s" trimmed. Ticket keys (hw-2538) count as one word. Dependency-free (used by
// the session capture script).

const STOP = new Set(("a an and are as at be but by for from has how in into is it its of on or " +
  "session that the this to vs via was what when where which why will with without").split(" "));

export function titleWords(title) {
  return new Set((String(title).toLowerCase().replace(/\.md$/, "").match(/[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu) || [])
    .flatMap((w) => (/^[a-z]{2,6}-\d+$/.test(w) ? [w] : w.split("-")))
    .filter((w) => w.length > 1 && !/^\d+$/.test(w) && !STOP.has(w))
    .map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w)));
}

// Dice coefficient of the word sets. Fewer than two shared words is no match, unless they share a
// ticket key: two notes on one ticket are worth merging whatever else their titles say.
export function similarity(a, b) {
  const shared = [...a].filter((w) => b.has(w));
  const dice = (2 * shared.length) / (a.size + b.size);
  if (shared.some((w) => /^[a-z]{2,6}-\d+$/.test(w))) return Math.max(dice, SIMILAR_THRESHOLD);
  return shared.length < 2 ? 0 : dice;
}

export const SIMILAR_THRESHOLD = 0.6;

export function similarSources(title, sourcesDir, { limit = 5, ignore } = {}) {
  if (!fs.existsSync(sourcesDir)) return [];
  const words = titleWords(title);
  if (!words.size) return [];
  return fs.readdirSync(sourcesDir)
    .filter((f) => f.endsWith(".md") && f !== "index.md" && f !== ignore)
    .map((f) => ({ file: f, score: similarity(words, titleWords(f)) }))
    .filter((r) => r.score >= SIMILAR_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => ({ title: r.file.replace(/\.md$/, ""), score: Math.round(r.score * 100) / 100 }));
}
