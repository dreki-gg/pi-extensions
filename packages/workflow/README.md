# @dreki-gg/pi-workflow

Personal [pi](https://github.com/earendil-works/pi-coding-agent) workflow helpers.

## `/commit`

Inspects the git worktree, decides what belongs in the commit, generates a Conventional Commits message, and commits. Pass extra constraints inline: `/commit only the lsp changes`.

## gpt-5.5 concise prompt

A `before_agent_start` / `before_provider_request` hook that, when the active model is `openai/gpt-5.5`, appends a concise ("caveman lite") instruction to the system prompt and forces low output verbosity.
