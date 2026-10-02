Install, remove, or check the daily wiki processing job (a crontab line).

Args: $ARGUMENTS — `install [HH:MM]` (default 16:30), `uninstall`, or `status` (default).

The job (`scripts/nightly-process.sh`) checks `source_status` first with plain node: when nothing is new it exits without starting Claude, so idle days cost nothing. When there is work it runs `claude -p "/llm-wiki:wiki-process auto"` in the wiki folder. Log: `~/.claude/llm-wiki-process.log`.

## Steps

1. Find the plugin directory (stable marketplace clone):
   ```
   grep -l '"name": "llm-wiki"' "$HOME"/.claude/plugins/marketplaces/*/.claude-plugin/plugin.json | head -1 | sed 's#/.claude-plugin/plugin.json$##'
   ```
2. For `install`: pick a time the machine is awake (cron skips runs while asleep). Cron can't use the keychain login, so `claude -p` needs a token file. If neither `~/.claude/.oauth-token` exists nor the user names another token file, tell them to run `claude setup-token` and save the token to `~/.claude/.oauth-token` with `chmod 600`. For an existing token file elsewhere, prefix the command with `LLM_WIKI_TOKEN_FILE="<path>"`.
3. Run `bash "<plugin-dir>/scripts/schedule.sh" $ARGUMENTS` and show its output.
4. After `install`: the run commits to the wiki, and pushes only if `git.auto_push` is true.
