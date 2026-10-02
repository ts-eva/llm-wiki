#!/bin/bash
# Install/remove the nightly llm-wiki job (macOS launchd; prints a crontab line elsewhere).
# Usage: schedule.sh install [HH:MM] | uninstall | status
set -euo pipefail
plugin="$(cd "$(dirname "$0")/.." && pwd)"
label="com.llm-wiki.nightly"
plist="$HOME/Library/LaunchAgents/$label.plist"
log="$HOME/Library/Logs/llm-wiki-nightly.log"
cmd="${1:-status}"
time="${2:-21:00}"
hour=$((10#${time%%:*})); minute=$((10#${time##*:}))

if [ "$(uname)" != "Darwin" ]; then
  echo "Not macOS. Add this to crontab -e:"
  echo "$minute $hour * * * /bin/bash \"$plugin/scripts/nightly-process.sh\" >> \"\$HOME/llm-wiki-nightly.log\" 2>&1"
  exit 0
fi

case "$cmd" in
  install)
    # launchd starts with a bare PATH: bake in the dirs holding node and claude right now.
    path="$(dirname "$(command -v node)"):$(dirname "$(command -v claude)"):/usr/bin:/bin:/usr/sbin:/sbin"
    mkdir -p "$(dirname "$plist")" "$(dirname "$log")"
    cat > "$plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$label</string>
  <key>ProgramArguments</key>
  <array><string>/bin/bash</string><string>$plugin/scripts/nightly-process.sh</string></array>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>$path</string><key>HOME</key><string>$HOME</string></dict>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>$hour</integer><key>Minute</key><integer>$minute</integer></dict>
  <key>StandardOutPath</key><string>$log</string>
  <key>StandardErrorPath</key><string>$log</string>
</dict>
</plist>
PLIST
    launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
    launchctl bootstrap "gui/$(id -u)" "$plist"
    printf 'Installed: daily at %02d:%02d. Log: %s\n' "$hour" "$minute" "$log"
    ;;
  uninstall)
    launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
    rm -f "$plist"
    echo "Removed $label."
    ;;
  status)
    if [ -f "$plist" ]; then
      echo "Installed: $plist"
      launchctl print "gui/$(id -u)/$label" 2>/dev/null | grep -E 'state|last exit' || echo "(not loaded)"
      [ -f "$log" ] && { echo "Last log lines:"; tail -5 "$log"; }
    else
      echo "Not installed. Run: schedule.sh install [HH:MM]"
    fi
    ;;
  *) echo "usage: schedule.sh install [HH:MM] | uninstall | status" >&2; exit 2 ;;
esac
