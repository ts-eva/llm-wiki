Scan wiki pages for unlinked mentions of other page titles and suggest adding links. Run occasionally as the wiki grows to keep the knowledge graph dense.

## Steps

1. Read `config.yaml` to get `mcp.path` and `wiki.link_format`
2. Read `wiki/index.md` — build a map of all page titles → slugs
3. Invoke `llm-wiki:wiki-analyst` (Haiku) with the title map and all page content to find:
   - Pages that mention another page's title in their body but don't link to it
   - Return as: `slug → [{ mentioned_title, slug, line_excerpt }]`
4. If nothing found: "All page titles are linked — graph looks good."
5. Otherwise display grouped by page:

```
event-sourcing.md mentions but doesn't link:
  - "Postgres" → postgres.md  (line: "...works well with Postgres for...")
  - "CQRS" → cqrs.md          (line: "...often paired with CQRS...")

payments-architecture.md mentions but doesn't link:
  - "Stripe" → stripe.md      (line: "...Stripe handles the charge...")
```

6. Ask: "Add these links? (A)ll, (S)elect, (N)o"
   - All: add all suggested links
   - Select: user types page numbers to include (e.g. `1,3`)
   - No: exit

7. For each confirmed link, edit the page — wrap the first occurrence of the title in the body with a link:
   - Standard mode: `[Title](pages/slug.md)`
   - Obsidian mode: `[[slug]]`
   - Do NOT link occurrences inside existing links, headings, or frontmatter

8. Update `log.md` (root): `## [YYYY-MM-DD] update | <page title>` for each edited page
9. Commit: `git add . && git commit -m "wiki: add missing links (N pages updated)"`
