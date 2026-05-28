Summarize what was added or changed in your wiki over a date range. Good for standups, weekly reflection, or staying aware of your own knowledge base.

Range: $ARGUMENTS

If $ARGUMENTS is empty, default to `this week`.

## Supported range formats

- `today` — today only
- `this week` — last 7 days
- `this month` — current calendar month
- `YYYY-MM` — a specific month (e.g. `2026-05`)
- `YYYY-MM-DD to YYYY-MM-DD` — explicit range

## Steps

1. Read `config.yaml` to get `mcp.path`
2. Parse `$ARGUMENTS` into a start date and end date (inclusive)
3. Read `wiki/log.md` — filter lines matching `## [YYYY-MM-DD]` within the date range
4. For each unique slug referenced, find its one-line summary in `wiki/index.md`
5. Summarize:
   - One short paragraph: overall narrative of what changed (e.g. "This week you added 3 new concepts around payments architecture and updated your notes on Postgres indexing.")
   - Bullet list grouped by action: **Added**, **Updated**, each with title and one-line summary
6. If no entries found in range: "Nothing was added or changed in that period."

Model: Haiku — this is a near-free operation.
