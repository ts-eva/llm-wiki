import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { sourceFilename } from "./source-filename.js";
import { similarSources } from "./similar.js";
import { readDateFormat, formatDate } from "./dates.js";

// The one write path into sources/: the save_source tool and the session capture script both
// call it. Dependency-free, so the capture script runs without node_modules.
//
// A new note whose title is close to an existing one is refused, with the matches, unless
// `new` is true: the caller either saves under the existing title (merging) or confirms.
export function saveSource(wikiPath, { content, title, source_url, type, new: confirmedNew = false }) {
  if (!content) return { error: "content is required" };

  const sourcesDir = path.join(wikiPath, "sources");
  fs.mkdirSync(sourcesDir, { recursive: true });
  // A given title always means the same note: update it rather than create "name (2).md".
  const filename = sourceFilename(title || content.split("\n").find((l) => l.trim()), sourcesDir, { update: Boolean(title) });
  const filePath = path.join(sourcesDir, filename);
  const existed = fs.existsSync(filePath);

  if (!existed && !confirmedNew) {
    const similar = similarSources(filename, sourcesDir);
    if (similar.length) {
      return {
        saved: false, similar,
        message: "Similar notes exist. To add to one, read sources/<title>.md and save_source the merged content under that title. If this is a different topic, call save_source again with new: true.",
      };
    }
  }

  const today = formatDate(new Date(), readDateFormat(wikiPath));
  // Keep the original created date and any other frontmatter (e.g. ignore: true) on update.
  const managed = new Set(["created", "updated", "title", "source_url", ...(type ? ["type"] : [])]);
  let created = today;
  const kept = [];
  if (existed) {
    const fm = fs.readFileSync(filePath, "utf8").match(/^---\n([\s\S]*?)\n---/);
    let skipping = false;
    for (const line of fm ? fm[1].split("\n") : []) {
      const key = line.match(/^([A-Za-z0-9_-]+):/)?.[1];
      if (key) skipping = managed.has(key);
      if (key === "created") created = line.slice(line.indexOf(":") + 1).trim().replace(/^["']|["']$/g, "");
      if (!skipping) kept.push(line);
    }
  }

  const frontmatter = ["---", `created: ${created}`];
  if (existed) frontmatter.push(`updated: ${today}`);
  if (type) frontmatter.push(`type: ${type}`);
  if (title) frontmatter.push(`title: ${JSON.stringify(title)}`);
  if (source_url) frontmatter.push(`source_url: ${JSON.stringify(source_url)}`);
  frontmatter.push(...kept, "---", "");

  fs.writeFileSync(filePath, frontmatter.join("\n") + "\n" + content, "utf8");

  try {
    // execFileSync, not a shell string: titles contain spaces, quotes, $, etc.
    execFileSync("git", ["-C", wikiPath, "add", `sources/${filename}`], { stdio: "pipe" });
    execFileSync("git", ["-C", wikiPath, "commit", "-m", `wiki: ${existed ? "update" : "add"} source ${filename}`], { stdio: "pipe" });
  } catch { /* git may not be configured in all environments */ }

  return { saved: true, updated: existed, file: `sources/${filename}`, message: "Run /llm-wiki:wiki-process when ready to tag and organize." };
}
