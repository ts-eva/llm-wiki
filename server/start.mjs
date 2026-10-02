// Stable MCP entry point. Plugin updates and marketplace pulls ship without node_modules,
// so install deps on first run, or when package-lock.json changed since the last install.
// `npm install --no-save`, not `npm ci`: it honors the lockfile without rewriting it (the
// marketplace clone must stay clean for updates to pull) and never wipes node_modules first, so
// a failed install (offline) keeps the previous working deps. A mkdir lock stops several
// sessions starting at once from running npm in the same folder concurrently.
import { existsSync, statSync, mkdirSync, rmSync, utimesSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const lock = join(dir, "package-lock.json");
const installed = join(dir, "node_modules", ".package-lock.json");
const stale = () => !existsSync(installed) || statSync(lock).mtimeMs > statSync(installed).mtimeMs;

if (stale()) {
  const lockDir = join(dir, ".installing");
  const deadline = Date.now() + 120_000;
  let owner = false;
  while (!owner && stale() && Date.now() < deadline) {
    try {
      mkdirSync(lockDir);
      owner = true;
    } catch {
      // Another session is installing; a lock older than 2 minutes is left over from a crash.
      try { if (Date.now() - statSync(lockDir).mtimeMs > 120_000) rmSync(lockDir, { recursive: true, force: true }); } catch {}
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
    }
  }
  if (owner) {
    try {
      // stdout is the MCP stdio channel: send npm output to stderr.
      if (stale()) {
        execSync("npm install --no-save --omit=dev --no-audit --no-fund", { cwd: dir, stdio: ["ignore", 2, 2] });
        const now = new Date();
        utimesSync(installed, now, now); // npm skips rewriting it when nothing changed
      }
    } catch (e) {
      if (!existsSync(join(dir, "node_modules"))) throw e;
      console.error("llm-wiki: npm install failed, starting with existing node_modules");
    } finally {
      rmSync(lockDir, { recursive: true, force: true });
    }
  }
}
await import("./index.js");
