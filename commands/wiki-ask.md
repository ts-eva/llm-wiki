Answer a question from the wiki. Different from /llm-wiki:wiki-search (which returns links) — this reads the relevant notes and answers directly.

Question: $ARGUMENTS

If $ARGUMENTS is empty, ask the user: "What would you like to know from your wiki?"

## Steps

1. Call `search_wiki` with the key words of the question (try a second, narrower or broader query if the first finds nothing useful).
2. Read the 2–5 most relevant hits: `get_page` for pages; Read `<wiki>/sources/<file>` for unprocessed source hits (`<wiki>` = the `wiki` field of `source_status`).
3. Nothing relevant: "I don't have anything on that yet. Capture it with /llm-wiki:wiki-add." Stop.
4. Answer directly and concisely. Synthesize, don't quote. Note conflicting information; say what's missing if the answer is partial.
5. End with: "Sources: <page titles / source files used>".
