Summarize what was added or changed in the wiki over a date range. Good for standups and weekly reflection.

Range: $ARGUMENTS (default `this week`)

## Steps

1. Turn the range into ISO dates: `today`; `this week` (last 7 days); `this month`; `YYYY-MM`; `YYYY-MM-DD to YYYY-MM-DD`.
2. Call `get_recent` with `since` and `until`. It returns log entries (pages added/updated) and sources captured or edited in the range, including ones not yet processed.
3. Nothing in either list: "Nothing was added or changed in that period." Stop.
4. Invoke `llm-wiki:wiki-analyst` (Haiku) with that JSON. Ask for one short narrative paragraph, then bullets grouped as **Added**, **Updated**, **Captured (not yet organized)**.
5. Print the analyst's output.
