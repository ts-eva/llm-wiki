Install, remove, or check the nightly wiki job.

Args: $ARGUMENTS — `install [HH:MM]` (default 21:00), `uninstall`, or `status` (default).

The job (`scripts/nightly-process.sh`) checks `source_status` first, with plain node: on nights with nothing new it exits without starting Claude, so it costs nothing. When there is work it runs `claude -p "/llm-wiki:wiki-process auto"` in the wiki folder. Logs: `~/Library/Logs/llm-wiki-nightly.log`.

## Steps

1. Find the plugin directory (stable marketplace clone):
   ```
   grep -l '"name": "llm-wiki"' "$HOME"/.claude/plugins/marketplaces/*/.claude-plugin/plugin.json | head -1 | sed 's#/.claude-plugin/plugin.json$##'
   ```
2. Run `bash "<plugin-dir>/scripts/schedule.sh" $ARGUMENTS` and show its output.
3. After `install`, mention: it runs while the Mac is awake at that time (a missed run happens on next wake); the run commits but pushes only if `git.auto_push` is true.
