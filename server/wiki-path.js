import fs from "fs";
import os from "os";
import path from "path";

// The wiki the MCP server serves: $WIKI_PATH, else the path registered for the llm-wiki MCP
// server in ~/.claude.json, else ~/wiki. Hooks run outside the server, so they resolve it here.
export function resolveWikiPath() {
  if (process.env.WIKI_PATH) {
    return path.resolve(process.env.WIKI_PATH.replace(/^~/, os.homedir()));
  }
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".claude.json"), "utf8"));
    const p = cfg?.mcpServers?.["llm-wiki"]?.env?.WIKI_PATH;
    if (p) return path.resolve(p.replace(/^~/, os.homedir()));
  } catch {}
  return path.join(os.homedir(), "wiki");
}
