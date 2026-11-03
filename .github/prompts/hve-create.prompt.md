---
name: hve-create
description: 'Create an item on the AI Platform HVE board from a design pull request or a description, in Opportunities or Ready.'
argument-hint: 'PR link or what you want to achieve, then "opportunity" (default) or "ready"'
---

Create one item on the [AI Platform HVE Board](https://github.com/orgs/DEFRA/projects/23) for the request in this message.

1. Read the guide first: `../ai-platform-discovery-docs/docs/hve-board.md` in the workspace, or `gh api repos/DEFRA/ai-platform-discovery-docs/contents/docs/hve-board.md -H "Accept: application/vnd.github.raw"`. Use its item template, project and field IDs and commands exactly.
2. Check `gh auth status` lists the `project` scope; if not, stop and ask me to run `gh auth refresh -s project`.
3. Column: "ready", "prioritised" or "priority" means 2. Prioritised / Ready; anything else, 1. Opportunities / Ideas.
4. Source: for a pull request link, read it with `gh pr view <link> --json title,body,files` and its changed Markdown; otherwise use my description. If neither says what outcome is wanted, ask me in one question.
5. Write the item: title as an outcome (who can now do what); Outcome, Why it matters, Done when, Guardrails, Delivered, Learned and next, Links. For Ready, three to five observable Done when checks and the Guardrails that apply; for an opportunity, "To agree when prioritised". Link the pull request. No secrets or personal data.
6. If an open item on the board (`gh project item-list 23 --owner DEFRA --limit 1000 --format json`, the whole board) has the same outcome, tell me its number instead of creating another.
7. Create the issue with `--repo DEFRA/ai-platform-discovery-docs` (never the current checkout), add it to project 23 and set the column.

Reply in at most three lines: the item number and link, its title and its column.
