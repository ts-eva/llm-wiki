Add content to the wiki using the two-phase ingestion pipeline.

Content: $ARGUMENTS

If $ARGUMENTS is empty, ask the user: "What would you like to add to your wiki?"

## Phase 1 — Tag (wiki-tagger, Haiku)

If the content is a file path in sources/, invoke wiki-tagger on it.
If the content is pasted text, first write it to `sources/<slug>-<YYYY-MM-DD>.md`, then invoke wiki-tagger.

wiki-tagger reads the raw content once and writes a rich entry to sources/index.md (tags, key-points, action-items, notable-quotes). This is the only time raw content is read.

## Phase 2 — Organize (wiki-curator, Sonnet)

Invoke wiki-curator to read the sources/index.md entry (not the raw file) and write a structured wiki page. wiki-curator updates wiki/index.md, wiki/log.md, wiki/backlinks.md, and commits everything.

Report back: the wiki page created/updated, tags applied, and the commit summary.
