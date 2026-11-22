# Domain Docs

## Layout

Use a single-context layout shared by the frontend and backend:

- `GLOSSARY.md` — terminology and data relationships in the Thai 43-file
  health data standard for the Health Data Quality project.
- `docs/adr/` — architecture decisions.
- `docs/adr/0000-template.md` — template for new ADRs.

Separate workspaces do not by themselves require separate domain contexts.

## Before exploring

Read the root `GLOSSARY.md` and ADRs relevant to the area of work.
Check relevant ADRs before changing API contracts, Sheet schemas,
or structural patterns.

If domain documents are absent, proceed silently.
Use `/domain-modeling` to create them when terms or decisions are resolved.

## Vocabulary

Use glossary terms in issue titles, specifications, hypotheses,
test names, and refactor proposals.

If a required concept is missing, reconsider whether the term fits
the project or note the gap for `/domain-modeling`.

## ADR conflicts

Surface any contradiction with an existing ADR explicitly.
Identify the ADR and explain why the decision may need reopening.
