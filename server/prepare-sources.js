import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { formatDate } from "./dates.js";
import { parseIndex } from "./sources-state.js";
import { sourceFilename } from "./source-filename.js";

// First step of /wiki-process, before hashing, so neither change counts as an edit:
// 1. stamp: every note in sources/ gets a `created:` date. Tools write it on save, but notes
//    written directly (Obsidian, copied in) don't. The date is the earlier of git's first-add
//    date and the file's birth time: a note usually exists before it's committed, and after a
//    fresh clone the birth time is the clone date, so git wins.
// 2. rename: untagged notes whose filename breaks the naming rules (uppercase, " - "
//    separators, legacy kebab-case slugs with session-/date affixes) get their readable name,
//    and [[wikilinks]] to the old name are rewritten. Tagged notes are never renamed (their
//    index entry is keyed by filename) and neither are ignored ones (the user opted them out).

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;

function gitAddedDate(wikiPath, rel) {
  try {
    const out = execFileSync(
      "git", ["-C", wikiPath, "log", "--diff-filter=A", "--follow", "--format=%aI", "--", rel],
      { stdio: ["ignore", "pipe", "ignore"] },
    ).toString().trim().split("\n").filter(Boolean);
    return out.length ? new Date(out[out.length - 1]) : null;
  } catch { return null; }
}

function birthDate(p) {
  const { birthtime, mtime } = fs.statSync(p);
  return birthtime.getTime() > 0 ? birthtime : mtime; // some filesystems report no birth time
}

function notes(dir) {
  return fs.readdirSync(dir).filter((f) => f !== "index.md" && f.endsWith(".md") && fs.statSync(path.join(dir, f)).isFile());
}

export function stampCreated(wikiPath, fmt) {
  const dir = path.join(wikiPath, "sources");
  const stamped = [];
  if (!fs.existsSync(dir)) return { stamped };
  for (const f of notes(dir)) {
    const p = path.join(dir, f);
    const text = fs.readFileSync(p, "utf8");
    const fm = text.match(FRONTMATTER);
    if (fm && /^created:/m.test(fm[1])) continue;
    const candidates = [gitAddedDate(wikiPath, `sources/${f}`), birthDate(p)].filter(Boolean);
    const created = formatDate(new Date(Math.min(...candidates.map((d) => d.getTime()))), fmt);
    const updated = fm
      ? text.replace(/^---\r?\n/, (open) => `${open}created: ${created}\n`)
      : `---\ncreated: ${created}\n---\n\n${text}`;
    fs.writeFileSync(p, updated, "utf8");
    stamped.push({ file: f, created });
  }
  return { stamped };
}

// Readable title for a filename. Legacy slugs ("session-hw-2409-widgetbook-plan-2026-08-31")
// lose their prefix and date suffix, and their hyphens become spaces, except inside ticket
// keys (hw-2409) and inner ISO dates. The `created:` frontmatter already holds the date.
export function readableTitle(file) {
  let base = file.replace(/\.md$/i, "");
  if (!/\s/.test(base) && base.includes("-")) {
    base = base
      .replace(/^(session|project)-/i, "")
      .replace(/-\d{4}-\d{2}-\d{2}$/, "")
      .replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, "$1\u0000$2\u0000$3")
      .replace(/\b([a-z]{2,6})-(?!(?:19|20)\d\d\b)(\d+)\b/gi, "$1\u0000$2")
      .replace(/-/g, " ")
      .replace(/\u0000/g, "-");
  }
  return base;
}

// Rewrites [[from]] links to [[to]]; adds each file it changed (wiki-relative) to `files`.
function relink(wikiPath, from, to, files) {
  const esc = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\[\\[(sources/)?${esc}(\\.md)?(?=[\\]|#])`, "gi");
  let count = 0;
  for (const sub of ["sources", "wiki"]) {
    const walk = (d) => {
      if (!fs.existsSync(d)) return;
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith(".md")) {
          const text = fs.readFileSync(p, "utf8");
          const next = text.replace(re, (_, pre = "", ext = "") => { count++; return `[[${pre}${to}${ext}`; });
          if (next !== text) { fs.writeFileSync(p, next, "utf8"); files.add(path.relative(wikiPath, p)); }
        }
      }
    };
    walk(path.join(wikiPath, sub));
  }
  return count;
}

// git mv for tracked files: on case-insensitive filesystems (macOS) a case-only rename is
// invisible to `git add -A`, so the old name would stay in the index.
function moveFile(wikiPath, from, to) {
  try {
    execFileSync("git", ["-C", wikiPath, "mv", "-f", `sources/${from}`, `sources/${to}`], { stdio: "ignore" });
  } catch {
    fs.renameSync(path.join(wikiPath, "sources", from), path.join(wikiPath, "sources", to));
  }
}

export function renameUntagged(wikiPath) {
  const dir = path.join(wikiPath, "sources");
  const renamed = [];
  const relinkedFiles = new Set();
  if (!fs.existsSync(dir)) return { renamed, relinked: 0, relinkedFiles: [] };
  const indexPath = path.join(dir, "index.md");
  const tagged = new Set(parseIndex(fs.existsSync(indexPath) ? fs.readFileSync(indexPath, "utf8") : "").sections.map((s) => s.file));
  let relinked = 0;
  for (const f of notes(dir)) {
    if (tagged.has(f)) continue;
    const fm = fs.readFileSync(path.join(dir, f), "utf8").match(FRONTMATTER)?.[1] || "";
    if (/^ignore:\s*true\s*$/m.test(fm)) continue;
    const to = sourceFilename(readableTitle(f), dir, { ignore: f });
    if (to === f || to === "untitled.md") continue;
    moveFile(wikiPath, f, to);
    relinked += relink(wikiPath, f.replace(/\.md$/, ""), to.replace(/\.md$/, ""), relinkedFiles);
    renamed.push({ from: f, to });
  }
  return { renamed, relinked, relinkedFiles: [...relinkedFiles].sort() };
}

// `files`: every path this step changed, for the caller to commit (commit_files) and nothing else.
export function prepareSources(wikiPath, fmt) {
  const { stamped } = stampCreated(wikiPath, fmt);
  const { renamed, relinked, relinkedFiles } = renameUntagged(wikiPath);
  // Both names of a rename: the commit needs the old one's removal and the new one's addition.
  const files = new Set([
    ...stamped.map((s) => `sources/${s.file}`),
    ...renamed.flatMap((r) => [`sources/${r.from}`, `sources/${r.to}`]),
    ...relinkedFiles,
  ]);
  return { stamped, renamed, relinked, files: [...files].sort() };
}
