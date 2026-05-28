Check sources/ for new untagged files and run wiki-tagger on them. Designed to be run by a scheduled cron job — silent if nothing new, reports what it tagged if there is.

## Steps

1. Read `config.yaml` to get `mcp.path`
2. List files in `sources/` (excluding `.gitkeep`, `index.md`)
3. Read `sources/index.md` to get already-tagged filenames (sections `## sources/<filename>`)
4. Compute untagged = files in sources/ not in sources/index.md
5. If nothing untagged: exit silently (no output — cron-friendly)
6. Invoke `llm-wiki:wiki-tagger` (Haiku) on all untagged files in one pass
7. Commit: `git add sources/index.md wiki/tags.md && git commit -m "wiki: autotag <N> new source(s) [YYYY-MM-DD]"`
8. Report: "Tagged N new file(s): filename1, filename2, ..."

## Setting up the cron

To run this daily, add a cron in any Claude Code session:

```
/cron "daily wiki autotag" "0 9 * * *" "run /wiki-autotag in my wiki repo at <wiki-path>"
```

Or set it up manually via the Claude Code cron system with the prompt:
`Read config.yaml at <wiki-path>, then run the llm-wiki:wiki-autotag command to tag any new files in sources/`

The cron only runs wiki-tagger (Haiku, cheap). Organization into wiki pages still requires /wiki-process.
