Manually commit all current wiki changes.

Steps:
1. Run `git status` in the wiki directory to see what has changed
2. If there are no changes, report "Nothing to commit — wiki is up to date"
3. If there are changes, run: `git add . && git commit -m "wiki: manual commit [YYYY-MM-DD]"` (use today's date)
4. Report which files were committed (from `git diff HEAD~1 --name-only`)
5. If `git.auto_push` is true in `config.yaml` and a remote is configured, also push and confirm

The wiki directory is determined by reading `config.yaml` (mcp.path), or if running from inside the wiki repo, use the current directory.
