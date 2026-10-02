Summarize the current Claude session and save it to sources/ with the `save_source` tool.

Use this at the end of a productive session to capture learnings, decisions, and outcomes before they're gone. Session captures show up in `get_recent` and `/llm-wiki:wiki-digest`.

Title/focus: $ARGUMENTS

## Title

- $ARGUMENTS given: use it, lowercased.
- Otherwise: a short readable topic for the session (e.g. `llm-wiki plugin dev`). No date, no `session-` prefix.
- If `sources/<title>.md` already exists, read it and merge this session's summary in — `save_source` replaces the content and keeps `created:`.

## Summary

Write what someone reading this in 3 months needs, 150–300 words, selective, not a transcript:

- **What was worked on** — the main topic or problem
- **Key decisions** — choices made and why
- **What was learned** — new understanding, surprises
- **What was built or changed** — concrete outputs (files, commits, tickets)
- **Open questions** — unresolved, worth following up

## Save

Call `save_source` with `title`, `type: "conversation"`, and `content` (no frontmatter) starting with `## Session: <topic>`.

Tell the user: "Session saved to <file>. Searchable now; organized into pages on the next /llm-wiki:wiki-process."
