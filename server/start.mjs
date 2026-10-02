// Stable MCP entry point. Plugin updates and marketplace pulls ship without node_modules,
// so install deps on first run, or when package-lock.json changed since the last install.
import { existsSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const lock = join(dir, "package-lock.json");
const installed = join(dir, "node_modules", ".package-lock.json");
if (!existsSync(installed) || statSync(lock).mtimeMs > statSync(installed).mtimeMs) {
  // stdout is the MCP stdio channel: send npm output to stderr.
  execSync("npm ci --omit=dev --no-audit --no-fund", { cwd: dir, stdio: ["ignore", 2, 2] });
}
await import("./index.js");
