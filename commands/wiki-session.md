Summarize the current Claude session and save it to sources/ for later processing.

Use this at the end of a productive session to capture learnings, decisions, and outcomes before they're gone. Pairs with /wiki-digest — session captures show up in "what did I do this week?"

Title/focus: $ARGUMENTS

## Steps

1. Read `config.yaml` to get `mcp.path` and `wiki.date_format`
2. Derive a slug:
   - If $ARGUMENTS is provided, slugify it (e.g. "payments architecture discussion" → `payments-architecture-discussion`)
   - Otherwise, infer a short topic from the session (e.g. `wiki-notes-plugin-dev`)
3. Set filename: `sources/session-<slug>-<YYYY-MM-DD>.md`

## Summarize the session

Write a structured summary of what happened in this conversation. Include:

- **What was worked on** — the main topic or problem
- **Key decisions** — choices made and the reasoning behind them
- **What was learned** — new understanding, discoveries, surprises
- **What was built or changed** — concrete outputs (files created, approaches settled on)
- **Open questions** — things unresolved or worth following up

Be selective — capture what's worth remembering, not a transcript. Aim for 150–300 words. Use the same quality bar as meeting notes: someone reading this in 3 months should understand what happened and why it mattered.

## Write the file

```markdown
---
created: <formatted-date>
type: conversation
session-topic: <topic>
---

## Session: <topic> — <formatted-date>

<summary content>
```

Then:
```bash
git -C "<wiki-path>" add sources/session-<slug>-<YYYY-MM-DD>.md && git -C "<wiki-path>" commit -m "wiki: capture session <slug>"
```

Tell the user: "Session saved to sources/session-<slug>-<YYYY-MM-DD>.md. Run /wiki-process when you're ready to organize it into wiki pages."
