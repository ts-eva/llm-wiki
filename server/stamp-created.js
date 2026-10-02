import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

// Every note in sources/ carries a `created:` date. Tools write it on save, but notes
// written directly (Obsidian, copied in) don't, so /wiki-process backfills it here,
// before hashing. The date is the earlier of git's first-add date and the file's birth
// time: a note usually exists before it's committed, and after a fresh clone the birth
// time is the clone date, so git wins.

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;

export function formatDate(d, fmt) {
  const yyyy = d.getFullYear().toString();
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const dd = d.getDate().toString().padStart(2, "0");
  return fmt.replace("YYYY", yyyy).replace("MM", mm).replace("DD", dd);
}

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

export function stampCreated(wikiPath, fmt) {
  const dir = path.join(wikiPath, "sources");
  const stamped = [];
  if (!fs.existsSync(dir)) return { stamped };
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (f === "index.md" || !f.endsWith(".md") || !fs.statSync(p).isFile()) continue;
    const text = fs.readFileSync(p, "utf8");
    const fm = text.match(FRONTMATTER);
    if (fm && /^created:/m.test(fm[1])) continue;
    const candidates = [gitAddedDate(wikiPath, `sources/${f}`), birthDate(p)].filter(Boolean);
    const date = new Date(Math.min(...candidates.map((d) => d.getTime())));
    const created = formatDate(date, fmt);
    const updated = fm
      ? text.replace(/^---\r?\n/, (open) => `${open}created: ${created}\n`)
      : `---\ncreated: ${created}\n---\n\n${text}`;
    fs.writeFileSync(p, updated, "utf8");
    stamped.push({ file: f, created });
  }
  return { stamped };
}
