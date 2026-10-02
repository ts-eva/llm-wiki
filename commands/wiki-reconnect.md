Re-register the MCP server for an existing wiki, without touching its content. Use this after reinstalling the llm-wiki plugin, after `claude mcp` state gets cleared, or whenever `search_wiki`/`save_source`/etc. stop showing up in a session that used to have them.

Path: $ARGUMENTS

## Steps

1. Determine the wiki path:
   - If `$ARGUMENTS` is provided, use it (expand `~` to `$HOME`)
   - Else if the current directory contains `config.yaml`, use the current directory
   - Else ask the user: "What's the path to your existing wiki?"

2. Confirm it's a real wiki: check `<path>/config.yaml` exists. If not, tell the user:
   "No wiki found at <path> (no config.yaml). If you're setting up a new wiki, use /llm-wiki:wiki-setup instead."
   Stop here.

3. Read `<path>/config.yaml` to get `wiki.name`, for the confirmation message.

4. Find the llm-wiki plugin directory:
   ```
   grep -l '"name": "llm-wiki"' "$HOME"/.claude/plugins/marketplaces/*/.claude-plugin/plugin.json 2>/dev/null | head -1 | sed 's#/.claude-plugin/plugin.json$##'
   ```
   This is the marketplace clone, a stable path that plugin updates pull into. Do NOT use the versioned `~/.claude/plugins/cache/.../llm-wiki/<version>/` folder: each update creates a new one, so a registration pointing there stays on the old version forever.
   If not found, tell the user:
   "Could not locate the llm-wiki plugin. Is it installed? Run /plugin install llm-wiki@llm-wiki-marketplace and /reload-plugins first."
   Stop here.

5. Clear any stale registration first. Older setups registered a versioned cache path that later updates leave behind:
   ```
   claude mcp remove llm-wiki --scope user
   ```
   Ignore a "not found" error here; it just means there was nothing to clear.

6. Register fresh (`start.mjs` installs npm dependencies itself on first run):
   ```
   claude mcp add llm-wiki --scope user --env WIKI_PATH="<path>" -- node "<plugin-dir>/server/start.mjs"
   ```

7. Smoke-test the server starts: `printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"t","version":"0"}}}' | WIKI_PATH="<path>" node "<plugin-dir>/server/start.mjs"` should print a JSON line containing `"serverInfo"` (first run can take ~20s while npm installs; stop it with Ctrl-C once the line appears).

8. Confirm: "MCP server reconnected for <wiki.name> at <path>. Restart this session (or start a new one) for the tools to become available — a running session keeps the old connection until restarted."
