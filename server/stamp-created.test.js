import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { stampCreated } from "./stamp-created.js";

function wiki({ git }) {
  const w = fs.mkdtempSync(path.join(os.tmpdir(), "llm-wiki-stamp-"));
  const src = path.join(w, "sources");
  fs.mkdirSync(src);
  fs.writeFileSync(path.join(src, "plain.md"), "just text");
  fs.writeFileSync(path.join(src, "fm.md"), "---\ntitle: x\n---\nbody");
  fs.writeFileSync(path.join(src, "dated.md"), "---\ncreated: 01/01/2021\n---\nbody");
  fs.writeFileSync(path.join(src, "skip.md"), "---\nignore: true\n---\nx");
  fs.writeFileSync(path.join(src, "index.md"), "# Sources Index\n");
  fs.writeFileSync(path.join(src, "image.png"), "png");
  if (git) {
    const g = (...a) => execFileSync("git", ["-C", w, ...a], { stdio: "pipe" });
    g("init", "-q");
    g("add", ".");
    g("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "init", "--date=2020-01-02T12:00:00");
  }
  return w;
}
const read = (w, f) => fs.readFileSync(path.join(w, "sources", f), "utf8");

test("stamps notes missing created (including ignored), leaves dated, index and non-md alone", () => {
  const w = wiki({ git: true });
  const { stamped } = stampCreated(w, "MM/DD/YYYY");
  assert.deepEqual(stamped.map((s) => s.file).sort(), ["fm.md", "plain.md", "skip.md"]);
  assert.equal(read(w, "plain.md"), "---\ncreated: 01/02/2020\n---\n\njust text");
  assert.equal(read(w, "fm.md"), "---\ncreated: 01/02/2020\ntitle: x\n---\nbody");
  assert.equal(read(w, "skip.md"), "---\ncreated: 01/02/2020\nignore: true\n---\nx");
  assert.equal(read(w, "dated.md"), "---\ncreated: 01/01/2021\n---\nbody");
  assert.equal(read(w, "index.md"), "# Sources Index\n");
  assert.equal(read(w, "image.png"), "png");
});

test("earlier git first-add date beats a later birth time; second run is a no-op", () => {
  const w = wiki({ git: true });
  assert.equal(stampCreated(w, "YYYY-MM-DD").stamped.find((s) => s.file === "plain.md").created, "2020-01-02");
  assert.deepEqual(stampCreated(w, "YYYY-MM-DD").stamped, []);
});

test("no git: falls back to the file's birth time", () => {
  const w = wiki({ git: false });
  const today = new Date();
  const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  assert.equal(stampCreated(w, "YYYY-MM-DD").stamped.find((s) => s.file === "plain.md").created, expected);
});
