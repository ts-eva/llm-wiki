import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

// Commit exactly the given wiki paths, never `git add -A`: several sessions may have edits in
// progress in the wiki, and the user may have staged something, so a commit takes only what its
// caller changed. Paths without changes are dropped; nothing changed means no commit. An entry
// ending in "/" stands for every change under that folder (for pipeline-owned folders like
// wiki/). `message` may be a function of the committed list. Dependency-free: the MCP server and
// the SessionEnd hook both use it.
//
// The commit is built in a temporary index read from HEAD, not with `git commit --only`, which
// refuses case-only renames on case-insensitive filesystems ("will not add file alias"). The
// user's index is then reset for those paths alone, so whatever else they staged stays staged.

const git = (wikiPath, args, env) => execFileSync("git", ["-C", wikiPath, ...args], {
  stdio: ["ignore", "pipe", "pipe"], ...(env && { env: { ...process.env, ...env } }),
}).toString();

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// Another git process holding .git/index.lock (another session's commit): wait and retry.
export function gitRetry(wikiPath, args, env) {
  for (let i = 0; ; i++) {
    try { return git(wikiPath, args, env); } catch (e) {
      if (i >= 20 || !/index\.lock/.test(String(e.stderr))) throw e;
      sleep(250);
    }
  }
}

// Two sessions building on the same HEAD at once would each commit a tree missing the other's
// change, so read-tree → commit runs under a lock. One older than a minute is left from a crash.
function withLock(wikiPath, fn) {
  const lock = path.resolve(wikiPath, git(wikiPath, ["rev-parse", "--git-path", "llm-wiki-commit.lock"]).trim());
  for (let i = 0; ; i++) {
    try { fs.mkdirSync(lock); break; } catch {
      try { if (Date.now() - fs.statSync(lock).mtimeMs > 60_000) { fs.rmSync(lock, { recursive: true, force: true }); continue; } } catch {}
      if (i >= 120) throw new Error("llm-wiki commit lock held for over 30s");
      sleep(250);
    }
  }
  try { return fn(); } finally { fs.rmSync(lock, { recursive: true, force: true }); }
}

// On disk with this exact letter case (macOS answers existsSync for any case).
function onDisk(wikiPath, rel) {
  try { return fs.readdirSync(path.join(wikiPath, path.dirname(rel))).includes(path.basename(rel)); } catch { return false; }
}

export function commitFiles(wikiPath, files, message) {
  const wanted = [...new Set((files || []).map((f) => String(f).replace(/^\.\//, "")).filter(Boolean))];
  if (!wanted.length || !message) return { error: "files and message required" };
  const dirs = wanted.filter((f) => f.endsWith("/"));
  const exact = new Set(wanted.filter((f) => !f.endsWith("/")));
  const want = (name) => exact.has(name) || dirs.some((d) => name.startsWith(d));

  return withLock(wikiPath, () => {
    // -z: no quoting of names with spaces. A staged rename (git mv) is "R  new\0old": either
    // name being wanted takes both, so the commit records the rename whole.
    const entries = gitRetry(wikiPath, ["status", "--porcelain", "-z", "--untracked-files=all"]).split("\0");
    const changed = new Set();
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (!e) continue;
      const names = /^[RC]/.test(e) ? [e.slice(3), entries[++i]] : [e.slice(3)];
      if (names.some(want)) names.forEach((n) => changed.add(n));
    }
    if (!changed.size) return { committed: [] };
    const list = [...changed].sort();

    const index = path.resolve(wikiPath, git(wikiPath, ["rev-parse", "--git-path", `llm-wiki-index-${process.pid}`]).trim());
    const env = { GIT_INDEX_FILE: index };
    try {
      let hasHead = true;
      try { git(wikiPath, ["rev-parse", "-q", "--verify", "HEAD"]); } catch { hasHead = false; }
      git(wikiPath, ["read-tree", ...(hasHead ? ["HEAD"] : ["--empty"])], env);
      const gone = list.filter((f) => !onDisk(wikiPath, f));
      const present = list.filter((f) => onDisk(wikiPath, f));
      if (gone.length) git(wikiPath, ["rm", "--cached", "-q", "--ignore-unmatch", "--", ...gone], env);
      if (present.length) git(wikiPath, ["add", "--", ...present], env);
      git(wikiPath, ["commit", "-q", "-m", typeof message === "function" ? message(list) : message], env);
    } finally {
      fs.rmSync(index, { force: true });
    }
    gitRetry(wikiPath, ["reset", "-q", "--", ...list]);
    return { committed: list, commit: git(wikiPath, ["rev-parse", "--short", "HEAD"]).trim() };
  });
}
