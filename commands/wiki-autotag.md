Check sources/ for new or changed files and run wiki-tagger on them. Designed to be run by a scheduled cron job — silent if nothing to do, reports what it tagged if there is.

## Steps

1. Read `config.yaml` to get `mcp.path`
2. Call the `source_status` tool (llm-wiki MCP server)
3. Work = **untagged** (new files) + **changed** (edited since tagging). Leave **unstamped** entries alone here — `/llm-wiki:wiki-process` asks the user how to handle them.
4. If there is no work: exit silently (no output — cron-friendly)
5. Invoke `llm-wiki:wiki-tagger` (Haiku) once with two labeled lists: **New files** and **Changed files** (replace existing entries in place, carrying `wiki-pages:` forward)
6. Call `mark_sources` with `stage: "tagged"` and all those files
7. Commit: `git add sources/index.md wiki/tags.md && git commit -m "wiki: autotag <N> source(s) [YYYY-MM-DD]"`
8. Report: "Tagged N new, re-tagged M changed file(s): filename1, filename2, ..."

## Setting up the cron

To run this daily, add a cron in any Claude Code session:

```
/cron "daily wiki autotag" "0 9 * * *" "run /llm-wiki:wiki-autotag in my wiki repo at <wiki-path>"
```

Or set it up manually via the Claude Code cron system with the prompt:
`Read config.yaml at <wiki-path>, then run the llm-wiki:wiki-autotag command to tag any new or changed files in sources/`

The cron only runs wiki-tagger (Haiku, cheap). Organization into wiki pages (including updating pages for changed sources) still requires /llm-wiki:wiki-process.
