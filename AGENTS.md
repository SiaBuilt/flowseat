# FlowSeat project handoff

Before continuing work, read `PROJECT_MEMORY.md` in this directory. It records the current functional baseline, preserved visual worktree, unresolved publishing/authentication tasks, and verification limits.

The root checkout is the old-UI functional baseline. `.worktrees/visual` preserves the experimental new UI; do not merge or replace the functional UI without the user's direction. Keep credentials and runtime state out of tracked files.

## Required delivery loop

Use Ponytail full. Every delivery must follow `docs/development/协作与交付流程.md`: implementation → independent QA → real UI acceptance → fixes and rechecks → release verification → documentation. Use the QA, UI, and full-stack agents with the root coordinating ownership and final acceptance. A successful build or deployment alone is not acceptance. Record blocked or unverified checks explicitly; never report an incomplete loop as release-ready.
