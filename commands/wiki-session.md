Summarize the current Claude session and save it to sources/ for later processing.

Use this at the end of a productive session to capture learnings, decisions, and outcomes before they're gone. Pairs with /llm-wiki:wiki-digest — session captures show up in "what did I do this week?"

Title/focus: $ARGUMENTS

## Steps

1. Read `config.yaml` to get `mcp.path` and `wiki.date_format`
2. Derive a title:
   - If $ARGUMENTS is provided, lowercase it, keeping spaces (e.g. "Payments Architecture Discussion" → `payments architecture discussion`)
   - Otherwise, infer a short readable topic from the session (e.g. `llm-wiki plugin dev`)
3. Set filename: `sources/<Title>.md` — see **Source file naming** in `llm-wiki:wiki-schema` (all lowercase, spaces kept, no slug, no date, no `session-` prefix; if a source with that title already exists, update it: read it, merge this session's summary in, keep its `created:` and add `updated:`)

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
git -C "<wiki-path>" add "sources/<Title>.md" && git -C "<wiki-path>" commit -m "wiki: capture session <Title>"
```

Tell the user: "Session saved to sources/<Title>.md. Run /llm-wiki:wiki-process when you're ready to organize it into wiki pages."
