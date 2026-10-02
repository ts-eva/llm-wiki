Show a dashboard of the wiki's current state. Free — the `wiki_stats` tool computes everything.

Call `wiki_stats` and print:

```
Wiki: <wiki.name from <wiki>/config.yaml; <wiki> = source_status `wiki` field>

Pages      Total N  (concept N, entity N, summary N, synthesis N)
Tags       N canonical — top: tag (N), tag (N), …
Sources    N files, N tagged, N organized
           Pending: N new, N changed, N to organize, N removed; N ignored
Activity   N changes this month
           [YYYY-MM-DD] action | title  (last 5)
```

Omit pending counts that are zero. If anything is pending, suggest `/llm-wiki:wiki-process`.
