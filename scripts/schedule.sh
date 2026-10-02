#!/bin/bash
# Install/remove the daily llm-wiki processing job as a crontab line (tagged # llm-wiki-process).
# Usage: schedule.sh install [HH:MM] | uninstall | status
# Pick a time the machine is awake: cron skips runs while asleep.
set -euo pipefail
plugin="$(cd "$(dirname "$0")/.." && pwd)"
tag="# llm-wiki-process"
log="$HOME/.claude/llm-wiki-process.log"
cmd="${1:-status}"
time="${2:-16:30}"
hour=$((10#${time%%:*})); minute=$((10#${time##*:}))
current() { crontab -l 2>/dev/null | grep -v -F "$tag" || true; }

case "$cmd" in
  install)
    # cron starts with a bare PATH: bake in the dirs holding node and claude right now.
    path="$(dirname "$(command -v node)"):$(dirname "$(command -v claude)"):/usr/bin:/bin"
    env="PATH=\"$path\" HOME=\"$HOME\""
    [ -n "${LLM_WIKI_TOKEN_FILE:-}" ] && env="$env LLM_WIKI_TOKEN_FILE=\"$LLM_WIKI_TOKEN_FILE\""
    line="$minute $hour * * * $env /bin/bash \"$plugin/scripts/nightly-process.sh\" >> \"$log\" 2>&1 $tag"
    { current; echo "$line"; } | crontab -
    printf 'Installed: daily at %02d:%02d. Log: %s\n' "$hour" "$minute" "$log"
    [ -n "${LLM_WIKI_TOKEN_FILE:-}" ] || [ -f "$HOME/.claude/.oauth-token" ] \
      || echo "Note: cron can't use the keychain login. Run 'claude setup-token' and save the token to ~/.claude/.oauth-token (chmod 600)."
    ;;
  uninstall)
    current | crontab -
    echo "Removed."
    ;;
  status)
    crontab -l 2>/dev/null | grep -F "$tag" || echo "Not installed. Run: schedule.sh install [HH:MM]"
    [ -f "$log" ] && { echo "Last log lines:"; tail -5 "$log"; }
    ;;
  *) echo "usage: schedule.sh install [HH:MM] | uninstall | status" >&2; exit 2 ;;
esac
