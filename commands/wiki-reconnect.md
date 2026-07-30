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
   find "$HOME/.claude" -type d -name "llm-wiki" 2>/dev/null | head -1
   ```
   If not found, also try:
   ```
   find "$HOME/Library/Application Support/Claude" -type d -name "llm-wiki" 2>/dev/null | head -1
   ```
   If still not found, tell the user:
   "Could not locate the llm-wiki plugin directory. Is the plugin installed? Run /plugin install llm-wiki@llm-wiki-marketplace and /reload-plugins first."
   Stop here.

5. Run `npm install` inside `<plugin-dir>/server/` (a freshly reinstalled plugin has no `node_modules` — without this the server fails to connect with "Connection closed").

6. Clear any stale registration first — a previous install may have registered a now-deleted plugin path:
   ```
   claude mcp remove llm-wiki --scope user
   ```
   Ignore a "not found" error here; it just means there was nothing to clear.

7. Register fresh:
   ```
   claude mcp add llm-wiki --scope user --env WIKI_PATH="<path>" -- node "<plugin-dir>/server/index.js"
   ```

8. Confirm: "MCP server reconnected for <wiki.name> at <path>. Restart this session (or start a new one) for the tools to become available — a running session keeps the old connection until restarted."
