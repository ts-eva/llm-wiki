#!/bin/bash
# Nightly llm-wiki pipeline. Free when idle: counts pending source work with plain node and
# starts Claude only when there is something to process.
# Usage: nightly-process.sh [wiki-path]   (default: WIKI_PATH, else the llm-wiki MCP registration)
set -uo pipefail
plugin="$(cd "$(dirname "$0")/.." && pwd)"
wiki="${1:-${WIKI_PATH:-}}"
if [ -z "$wiki" ]; then
  wiki=$(node -e 'try { console.log(require(require("os").homedir() + "/.claude.json").mcpServers["llm-wiki"].env.WIKI_PATH) } catch {}')
fi
wiki="${wiki/#\~/$HOME}"
echo "== $(date '+%F %T') $wiki"
[ -d "$wiki/sources" ] || { echo "no wiki at '$wiki'"; exit 1; }

pending=$(node "$plugin/server/sources-state.js" status "$wiki" | node -e '
  let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
    const r = JSON.parse(s);
    console.log(r.untagged.length + r.changed.length + r.unorganized.length + r.removed.length);
  });') || { echo "status check failed"; exit 1; }

if [ "$pending" = "0" ]; then
  echo "nothing pending"
  exit 0
fi
echo "$pending pending, running /llm-wiki:wiki-process auto"
cd "$wiki" && claude -p "/llm-wiki:wiki-process auto" \
  --permission-mode acceptEdits \
  --allowedTools "mcp__llm-wiki" "Read" "Write" "Edit" "Agent" "Bash(git:*)"
