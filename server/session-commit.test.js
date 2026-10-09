import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { touchedFiles, commitSession, autoCommitEnabled } from "./session-commit.js";

const git = (w, ...a) => execFileSync("git", ["-C", w, ...a], { stdio: "pipe" }).toString();
const edit = (name, file_path) => JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name, input: { file_path } }] } });

function wiki() {
  const w = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "llm-wiki-commit-")));
  for (const [f, t] of [["config.yaml", "git:\n  auto_commit: true\n"], ["sources/mine.md", "v1"], ["sources/theirs.md", "v1"], ["sources/staged.md", "v1"]]) {
    fs.mkdirSync(path.dirname(path.join(w, f)), { recursive: true });
    fs.writeFileSync(path.join(w, f), t);
  }
  git(w, "init", "-q"); git(w, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "root");
  git(w, "add", "-A"); git(w, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "init");
  git(w, "config", "user.name", "t"); git(w, "config", "user.email", "t@t");
  return w;
}

test("touchedFiles: Write/Edit targets inside the wiki, subagents included, nothing else", () => {
  const w = wiki();
  const t = path.join(w, "..", `${path.basename(w)}-session.jsonl`);
  fs.writeFileSync(t, [
    edit("Edit", path.join(w, "sources/mine.md")),
    edit("Read", path.join(w, "sources/theirs.md")),
    edit("Write", "/elsewhere/project/file.md"),
    edit("Write", path.join(w, ".git/config")),
  ].join("\n"));
  fs.mkdirSync(t.replace(/\.jsonl$/, "/subagents"), { recursive: true });
  fs.writeFileSync(t.replace(/\.jsonl$/, "/subagents/agent-1.jsonl"), edit("Write", path.join(w, "wiki/pages/new-page.md")));
  assert.deepEqual(touchedFiles(t, w), ["sources/mine.md", "wiki/pages/new-page.md"]);
});

test("commitSession commits only this session's files; other edits and staged files stay put", () => {
  const w = wiki();
  const t = path.join(w, "..", `${path.basename(w)}-s.jsonl`);
  fs.writeFileSync(t, [edit("Edit", path.join(w, "sources/mine.md")), edit("Write", path.join(w, "sources/brand new.md")), edit("Edit", path.join(w, "sources/gone.md"))].join("\n"));
  fs.writeFileSync(path.join(w, "sources/mine.md"), "v2");
  fs.writeFileSync(path.join(w, "sources/brand new.md"), "new");
  fs.writeFileSync(path.join(w, "sources/theirs.md"), "v2 by another session");
  fs.writeFileSync(path.join(w, "sources/staged.md"), "v2 staged by the user");
  git(w, "add", "sources/staged.md");

  const r = commitSession(t, w, new Date("2026-10-09T12:00:00Z"));
  assert.deepEqual(r.committed.sort(), ["sources/brand new.md", "sources/mine.md"]);
  assert.equal(git(w, "log", "-1", "--format=%s").trim(), "wiki: session edits — brand new, mine [2026-10-09]");
  assert.deepEqual(git(w, "show", "--name-only", "--format=", "HEAD").trim().split("\n").sort(), ["sources/brand new.md", "sources/mine.md"]);
  assert.deepEqual(git(w, "status", "--porcelain", "-z").split("\0").filter(Boolean).sort(), [" M sources/theirs.md", "M  sources/staged.md"]);
  assert.deepEqual(commitSession(t, w).committed, []); // already clean: no empty commit
});

test("auto_commit is on unless config.yaml says false", () => {
  const w = fs.mkdtempSync(path.join(os.tmpdir(), "llm-wiki-cfg-"));
  const cfg = (s) => (fs.writeFileSync(path.join(w, "config.yaml"), s), autoCommitEnabled(w));
  assert.equal(cfg("git:\n  auto_commit: true\n  auto_push: false\n"), true);
  assert.equal(cfg("wiki:\n  name: x\n"), true);
  assert.equal(cfg("git:\n  auto_push: false\n  auto_commit: false   # manual\n"), false);
});
