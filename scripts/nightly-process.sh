#!/bin/bash
# Scheduled llm-wiki pipeline (cron, via schedule.sh). Free when idle: counts pending source
# work with plain node and starts Claude only when there is something to process.
# Usage: nightly-process.sh [wiki-path]   (default: WIKI_PATH, else the llm-wiki MCP registration)
set -uo pipefail

# Cron's stripped environment breaks `claude -p` auth: it needs HOME/USER/LOGNAME/TMPDIR, and
# can't read the login keychain outside the GUI session, so it authenticates with a token from
# `claude setup-token` stored in a file (LLM_WIKI_TOKEN_FILE, default ~/.claude/.oauth-token).
export USER="${USER:-$(id -un)}" LOGNAME="${LOGNAME:-$(id -un)}" TMPDIR="${TMPDIR:-/tmp}"
token_file="${LLM_WIKI_TOKEN_FILE:-$HOME/.claude/.oauth-token}"
if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] && [ -f "$token_file" ]; then
  export CLAUDE_CODE_OAUTH_TOKEN="$(cat "$token_file")"
fi

# A slow run must not overlap the next one (macOS has no flock; mkdir is atomic).
lock="${TMPDIR%/}/llm-wiki-process.lock"
mkdir "$lock" 2>/dev/null || { echo "$(date '+%F %T') previous run still active, skipping"; exit 0; }
trap 'rmdir "$lock"' EXIT
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
[ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] || echo "warning: no CLAUDE_CODE_OAUTH_TOKEN or $token_file; claude -p may fail auth under cron"
# Pin the MCP server to the wiki just checked, so a wiki-path argument can't diverge from
# the user's llm-wiki registration.
mcp=$(node -e 'console.log(JSON.stringify({ mcpServers: { "llm-wiki": { command: "node", args: [process.argv[1]], env: { WIKI_PATH: process.argv[2] } } } }))' "$plugin/server/start.mjs" "$wiki")
cd "$wiki" && claude -p "/llm-wiki:wiki-process auto" \
  --strict-mcp-config --mcp-config "$mcp" \
  --permission-mode acceptEdits \
  --allowedTools "mcp__llm-wiki" "Read" "Write" "Edit" "Agent" "Bash(git:*)"
