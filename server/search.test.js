import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { searchWiki } from "./search.js";
import { getRecent, findUnlinkedMentions, renameTag, wikiStats } from "./maintenance.js";
import { isoDate } from "./dates.js";

function wiki() {
  const w = fs.mkdtempSync(path.join(os.tmpdir(), "llm-wiki-search-"));
  const put = (rel, text) => { fs.mkdirSync(path.dirname(path.join(w, rel)), { recursive: true }); fs.writeFileSync(path.join(w, rel), text); };
  put("config.yaml", 'wiki:\n  date_format: "MM/DD/YYYY"\n');
  put("wiki/pages/denim-factoring.md", "---\ntitle: Denim Factoring\ntype: concept\ntags: [factoring, payments]\n---\nDenim handles factoring for carriers. See Smart Match too.");
  put("wiki/pages/smart-match.md", "---\ntitle: Smart Match\ntype: entity\ntags: [ai]\n---\nWidget refresh on android.");
  put("wiki/pages/secret.md", "---\ntitle: Secret\ntype: concept\nsensitive: true\ntags: [factoring]\n---\nfactoring secret");
  put("wiki/tags.md", "# Tags\n\n- `factoring` — f\n- `payments` — p\n");
  put("log.md", `# Log\n\n## [2020-01-01] add | Old\n## [${isoDate(new Date())}] add | Denim Factoring\n`);
  const today = new Date();
  const mmddyyyy = `${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}/${today.getFullYear()}`;
  put("sources/hw-2538 widget note.md", `---\ncreated: ${mmddyyyy}\n---\nHW-2538 gates the android widget paths.`);
  put("sources/old note.md", "---\ncreated: 01/01/2020\n---\nfactoring history");
  put("sources/index.md", "# Sources Index\n<!--\n## sources/<filename>\n-->\n");
  return w;
}

test("words match in any order and any field; sensitive excluded", () => {
  const w = wiki();
  assert.deepEqual(searchWiki(w, { query: "factoring denim" }).pages.map((p) => p.slug), ["denim-factoring"]);
  assert.deepEqual(searchWiki(w, { query: "smart match widget android" }).pages.map((p) => p.slug), ["smart-match"]);
  assert.equal(searchWiki(w, { query: "factoring", include_sensitive: true }).pages.length, 2);
});

test("unprocessed sources are searchable immediately, ticket keys intact", () => {
  const r = searchWiki(wiki(), { query: "HW-2538" });
  assert.deepEqual(r.sources.map((s) => [s.file, s.processed]), [["sources/hw-2538 widget note.md", false]]);
});

test("tags filter applies to every result; tags alone list matches; partial fallback flagged", () => {
  const w = wiki();
  assert.deepEqual(searchWiki(w, { query: "carriers", tags: ["ai"] }).pages, []);
  assert.deepEqual(searchWiki(w, { tags: ["payments"] }).pages.map((p) => p.slug), ["denim-factoring"]);
  const p = searchWiki(w, { query: "denim zebra" });
  assert.equal(p.partial, true);
  assert.equal(p.pages[0].slug, "denim-factoring");
});

test("recent includes today's unprocessed capture and today's log, not old ones", () => {
  const r = getRecent(wiki(), { days: 7 });
  assert.deepEqual(r.sources.map((s) => s.file), ["hw-2538 widget note.md"]);
  assert.deepEqual(r.log.map((e) => e.title), ["Denim Factoring"]);
});

test("unlinked mentions, tag rename/merge, stats", () => {
  const w = wiki();
  assert.deepEqual(findUnlinkedMentions(w).mentions["denim-factoring"].map((m) => m.slug), ["smart-match"]);
  const r = renameTag(w, "payments", "factoring");
  assert.deepEqual(r.pages, ["denim-factoring"]);
  assert.match(fs.readFileSync(path.join(w, "wiki/pages/denim-factoring.md"), "utf8"), /^tags: \[factoring\]$/m);
  assert.doesNotMatch(fs.readFileSync(path.join(w, "wiki/tags.md"), "utf8"), /payments/);
  const s = wikiStats(w);
  assert.equal(s.pages.total, 3);
  assert.equal(s.sources.untagged, 2);
  assert.equal(s.sources.removed, 0);
});

test("append_log and remove_page", async () => {
  const { appendLog, removePage } = await import("./maintenance.js");
  const w = wiki();
  fs.writeFileSync(path.join(w, "wiki/index.md"), "# x\n\n## Entities\n- [[smart-match|Smart Match]] — s\n- [Denim](pages/denim-factoring.md) — d\n");
  assert.deepEqual(appendLog(w, [{ action: "delete", title: "Smart Match" }]), { appended: 1 });
  assert.match(fs.readFileSync(path.join(w, "log.md"), "utf8"), /\| Denim Factoring\n## \[\d{4}-\d{2}-\d{2}\] delete \| Smart Match\n$/);
  assert.deepEqual(removePage(w, "smart-match"), { removed: "smart-match", indexLine: true });
  assert.deepEqual(removePage(w, "denim-factoring"), { removed: "denim-factoring", indexLine: true });
  assert.equal(fs.readFileSync(path.join(w, "wiki/index.md"), "utf8"), "# x\n\n## Entities\n");
  assert.ok(removePage(w, "../config").error);
});
