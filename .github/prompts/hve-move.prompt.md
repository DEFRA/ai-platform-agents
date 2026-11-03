---
name: hve-move
description: 'Move an item on the AI Platform HVE board to Opportunities, Ready, In Progress, Validation or Done.'
argument-hint: 'Item number or title, then the column: opportunities, ready, in progress, validation or done'
---

Move the item named in this message on the [AI Platform HVE Board](https://github.com/orgs/DEFRA/projects/23).

1. Read the guide first: `../ai-platform-discovery-docs/docs/hve-board.md` in the workspace, or `gh api repos/DEFRA/ai-platform-discovery-docs/contents/docs/hve-board.md -H "Accept: application/vnd.github.raw"`. Use its project, field and column option IDs and commands exactly.
2. Check `gh auth status` lists the `project` scope; if not, stop and ask me to run `gh auth refresh -s project`.
3. Find the item on project 23 (`gh project item-list 23 --owner DEFRA --format json`) by number, link or title words. If more than one matches, or none, list the candidates and ask me; never guess.
4. Map the column: opportunities or ideas to 1, ready or prioritised to 2, in progress or start to 3, validation or review to 4, done or finished to 5. If the column is missing, ask me.
5. Set the column. Then:
   - In Progress: assign me (`gh issue edit <number> --add-assignee "@me"`).
   - Done: find the pull requests that delivered it from the issue's timeline (`gh api repos/DEFRA/ai-platform-discovery-docs/issues/<number>/timeline --paginate`, `cross-referenced` events whose source is a pull request), links in the item, or ask me; fill Delivered (what, dates, pull requests) and Learned and next; tick only the Done when checks with evidence and say which are left; close the issue as completed.
   - Out of Done to another column: reopen the issue.

Reply in at most two lines: the item number and title, and the column it moved from and to.
