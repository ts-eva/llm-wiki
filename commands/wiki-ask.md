Synthesize an answer from your wiki. Different from /wiki-search (which returns links) — this reads relevant pages and answers directly.

Question: $ARGUMENTS

If $ARGUMENTS is empty, ask the user: "What would you like to know from your wiki?"

## Steps

1. Read `config.yaml` to get `mcp.path`
2. Read `wiki/index.md` — scan titles and one-line summaries to identify pages relevant to the question (minimal tokens)
3. Select the 2–5 most relevant page slugs. If none seem relevant, say: "I don't have anything on that yet. Add sources with /wiki-add and process them with /wiki-process."
4. Read each selected page from `wiki/pages/<slug>.md`
5. Answer the question directly and concisely, drawing from those pages
6. End with: "Sources: [Page Title](pages/slug.md), ..." listing the pages used

## Tone

Answer as if you're the user's knowledgeable colleague who has read everything in the wiki. Synthesize — don't just quote. If the pages give conflicting information, note the tension. If the answer is partial, say what's missing.
