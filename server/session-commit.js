import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import { commitFiles } from "./git-commit.js";

// Session-end commit (config.yaml `git.auto_commit`, default on), started by hooks/session-end.js.
// Commits only the wiki files this session's own Write/Edit calls touched, main thread and
// subagents, with `git commit --only`: several sessions can run at once, and one must never sweep
// up another's half-done edits or anything the user has staged. Edits made through Bash are not
// tracked. save_source and /llm-wiki:wiki-process commit their own work, so those are clean here.

const EDIT_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);

export function autoCommitEnabled(wikiPath) {
  try {
    const cfg = fs.readFileSync(path.join(wikiPath, "config.yaml"), "utf8");
    return !/^git:\s*\n(?:[ \t]+.*\n)*?[ \t]+auto_commit:\s*false\b/m.test(cfg);
  } catch { return false; }
}

const autoPush = (wikiPath) => {
  try { return /^git:\s*\n(?:[ \t]+.*\n)*?[ \t]+auto_push:\s*true\b/m.test(fs.readFileSync(path.join(wikiPath, "config.yaml"), "utf8")); }
  catch { return false; }
};

// Real path, in the on-disk letter case (macOS paths are case-insensitive, git's are not). A file
// that no longer exists: resolve its folder, keep its name.
function real(p) {
  try { return fs.realpathSync.native(p); } catch {}
  try { return path.join(fs.realpathSync.native(path.dirname(p)), path.basename(p)); } catch { return path.resolve(p); }
}

// Wiki-relative paths of every file a Write/Edit tool call in this transcript (and its
// subagents' transcripts, in <transcript>/subagents/) pointed at, inside the wiki.
export function touchedFiles(transcriptPath, wikiPath) {
  const transcripts = [transcriptPath];
  const sub = path.join(transcriptPath.replace(/\.jsonl$/, ""), "subagents");
  if (fs.existsSync(sub)) transcripts.push(...fs.readdirSync(sub).filter((f) => f.endsWith(".jsonl")).map((f) => path.join(sub, f)));
  const root = real(path.join(wikiPath, "."));
  const files = new Set();
  for (const t of transcripts) {
    for (const line of fs.readFileSync(t, "utf8").split("\n")) {
      if (!line.includes('"tool_use"')) continue;
      let row;
      try { row = JSON.parse(line); } catch { continue; }
      for (const b of Array.isArray(row.message?.content) ? row.message.content : []) {
        const p = b.type === "tool_use" && EDIT_TOOLS.has(b.name) && (b.input?.file_path || b.input?.notebook_path);
        if (!p) continue;
        const rel = path.relative(root, real(p));
        if (rel && !rel.startsWith("..") && !path.isAbsolute(rel) && !rel.split(path.sep).includes(".git")) files.add(rel);
      }
    }
  }
  return [...files].sort();
}

export function commitSession(transcriptPath, wikiPath, date = new Date()) {
  const touched = touchedFiles(transcriptPath, wikiPath);
  if (!touched.length) return { committed: [] };
  const subject = (files) => {
    const names = files.map((f) => path.basename(f, ".md"));
    return `wiki: session edits — ${names.slice(0, 3).join(", ")}${names.length > 3 ? ` and ${names.length - 3} more` : ""} [${date.toISOString().slice(0, 10)}]`;
  };
  const res = commitFiles(wikiPath, touched, subject);
  if (!res.committed?.length) return { committed: [] };
  let pushed = false;
  if (autoPush(wikiPath) && execFileSync("git", ["-C", wikiPath, "remote"]).toString().trim()) {
    try { execFileSync("git", ["-C", wikiPath, "push", "-q"], { stdio: "pipe" }); pushed = true; } catch {}
  }
  return { ...res, pushed };
}

// CLI: node session-commit.js <transcript.jsonl> <wiki-path>
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [transcript, wiki] = process.argv.slice(2);
  const stamp = `${new Date().toISOString().slice(0, 19)} ${path.basename(transcript || "", ".jsonl").slice(0, 8)}`;
  try {
    const r = commitSession(transcript, wiki);
    if (r.committed.length) console.log(`${stamp} ${r.commit}${r.pushed ? " (pushed)" : ""}: ${r.committed.join(", ")}`);
  } catch (e) {
    console.log(`${stamp} error: ${String(e.stderr || e.message).trim()}`);
    process.exitCode = 1;
  }
}
