Open the wiki vault in Obsidian. Only works in Obsidian mode (`wiki.link_format: obsidian` in config.yaml).

## Steps

1. Read `config.yaml` to get `mcp.path` (wiki path) and `wiki.link_format`
2. If `link_format` is not `obsidian`, tell the user:
   "Your wiki is in standard format. Run /wiki-convert obsidian first if you want to use Obsidian."
   Stop here.
3. Try opening via URI scheme (works if vault is already known to Obsidian):
   ```bash
   open "obsidian://open?vault=$(basename '<wiki-path>/wiki')"
   ```
4. Wait 2 seconds. If Obsidian does not come to the foreground (no way to verify — just proceed), fall back to:
   ```bash
   open -a Obsidian "<wiki-path>/wiki"
   ```
5. Tell the user: "Opening your wiki vault in Obsidian. If it prompts you to trust the vault, click 'Trust and Enable Plugins'."
