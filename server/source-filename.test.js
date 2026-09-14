import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { sourceFilename } from "./source-filename.js";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "llm-wiki-"));

test("lowercases, keeps spaces, strips unsafe characters and dashes", () => {
  assert.equal(sourceFilename("Payments: review — with [Platform] #Team?", tmp()), "payments review with platform team.md");
  assert.equal(sourceFilename("llm-wiki Plugin Scope", tmp()), "llm-wiki plugin scope.md");
  assert.equal(sourceFilename("Cost in $USD via `curl`", tmp()), "cost in usd via curl.md");
  assert.equal(sourceFilename("Scope vs PROJECT.md", tmp()), "scope vs project.md");
});

test("trims headings, trailing dots, and empty titles", () => {
  assert.equal(sourceFilename("## Session notes...", tmp()), "session notes.md");
  assert.equal(sourceFilename("  ", tmp()), "untitled.md");
  assert.equal(sourceFilename(undefined, tmp()), "untitled.md");
});

test("dedupes case-insensitively, including index.md", () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, "Weekly Standup.md"), "");
  fs.writeFileSync(path.join(dir, "index.md"), "");
  assert.equal(sourceFilename("Weekly Standup", dir), "weekly standup (2).md");
  fs.writeFileSync(path.join(dir, "weekly standup (2).md"), "");
  assert.equal(sourceFilename("weekly standup", dir), "weekly standup (3).md");
  assert.equal(sourceFilename("Index", dir), "index (2).md");
});

test("update reuses an existing note by title, case-insensitively", () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, "Weekly Standup.md"), "");
  fs.writeFileSync(path.join(dir, "index.md"), "");
  assert.equal(sourceFilename("weekly standup", dir, { update: true }), "Weekly Standup.md");
  assert.equal(sourceFilename("New Note", dir, { update: true }), "new note.md");
  assert.equal(sourceFilename("Index", dir, { update: true }), "index (2).md");
  assert.equal(sourceFilename("", dir, { update: true }), "untitled.md");
});

test("caps long titles", () => {
  assert.ok(sourceFilename("a ".repeat(300), tmp()).length <= 183);
});
