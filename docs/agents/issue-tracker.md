# Issue tracker: GitHub

Issues and published specs live in GitHub Issues for
`9GotStory/health-data-quality`. Use the `gh` CLI.

Local files under `.scratch/` are supporting drafts.
GitHub issues are the authoritative tracked tickets.

## Target repository

Use `--repo 9GotStory/health-data-quality` for issue commands.

Before the first issue creation in a session, verify the target with
`gh repo view --json nameWithOwner`. If it resolves to another repository,
stop and reconcile the target with the user.

## Conventions

- Create: `gh issue create --repo 9GotStory/health-data-quality --title "..." --body-file <path>`.
- Read: `gh issue view <number> --repo 9GotStory/health-data-quality --json number,title,body,labels,comments`.
- List: `gh issue list --repo 9GotStory/health-data-quality --state open --json number,title,body,labels,comments`.
  Add label or state filters as needed.
- Edit: `gh issue edit <number> --repo 9GotStory/health-data-quality --body-file <path>`.
- Comment: `gh issue comment <number> --repo 9GotStory/health-data-quality --body-file <path>`.
- Labels: `gh issue edit <number> --repo 9GotStory/health-data-quality --add-label "..." --remove-label "..."`.
- Close: post the explanation as a separate comment, then use
  `gh issue close <number> --repo 9GotStory/health-data-quality`.
  Do not rely on `close --comment` for an already-closed issue.

For multiline bodies, write the exact Markdown to a temporary file
and pass it with `--body-file`.

## Parent tickets and blockers

Use native GitHub sub-issues for parent-child relationships:

`gh issue edit <parent> --repo 9GotStory/health-data-quality --add-sub-issue <child>`

Use native issue dependencies for blockers:

`gh issue edit <child> --repo 9GotStory/health-data-quality --add-blocked-by <blocker>`

These flags require gh 2.94 or later. On older versions, use the
GitHub REST sub-issue and dependency endpoints with numeric issue
database IDs, not issue numbers or node IDs.

If native relationships are unavailable, put `Part of #<parent>`
and `Blocked by: #<number>` at the top of the child body.
Include fallback children in the parent's task list.

Inspect dependencies and each blocker's state with:

`gh issue view <number> --repo 9GotStory/health-data-quality --json blockedBy`

The result may include closed blockers. A ticket is unblocked only when
every blocker is closed; any blocker with state `OPEN` still blocks it.
For fallback `Blocked by` references, read each referenced issue and
check its state before treating the ticket as unblocked.

## Pull requests as a triage surface

**PRs as a request surface: no.**

GitHub shares issue and PR numbers. If a reference is ambiguous,
resolve its type before acting.

## Skill operations

When a skill says "publish to the issue tracker", create a GitHub issue.
When it says "fetch the relevant ticket", read the GitHub issue.
