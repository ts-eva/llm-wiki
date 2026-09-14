import fs from "fs";

// Readable source filenames ("payments architecture review.md"): lowercase with spaces,
// not kebab slugs — the filename is the note title in Obsidian. Strips only
// characters that break on some filesystem or inside Obsidian links, plus
// en/em dashes and $ / backtick (they expand inside double-quoted shell paths).
// Matching is case-insensitive: APFS/Windows fold case, Linux/Android don't.
export function sourceFilename(title, dir, { update = false } = {}) {
  const base = String(title || "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/^#+\s*/, "")
    .replace(/\.md$/i, "")
    .replace(/[\\/:*?"<>|#^[\]–—$`]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 180)
    .replace(/^[.\s]+|[.\s]+$/g, "") || "untitled";
  const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  const taken = (name) => files.find((f) => f.toLowerCase() === name.toLowerCase());
  // update: same title means the same note — reuse the existing file
  if (update && base !== "untitled" && base !== "index") {
    const hit = taken(`${base}.md`);
    if (hit) return hit;
  }
  let name = `${base}.md`;
  for (let n = 2; taken(name); n++) name = `${base} (${n}).md`;
  return name;
}
