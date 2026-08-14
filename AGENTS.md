# Agent Instructions

## Commits

- Use short plain-English titles.
- Start with `Add`, `Update`, `Fix`, `Remove`, `Clean up`, or `Adjust`.
- One logical change per commit.
- Do not rewrite history for display purposes.

Examples:

- `Add bundle support`
- `Fix balance timeout`
- `Update tests`
- `Update README`

## Repository

This repository contains one DeepSeek Harness plugin:

`@xsuas/dsh-balance-display`

Host entry:

`lib/index.js`

Browser entry:

`lib/client.js`

Bundle patch:

`cordis.patch.yml`

## Code

- Keep comments short and in English.
- Comments explain intent, not implementation history.
- Do not reference removed components or previous layouts.
- User-facing UI copy may remain Chinese.

## README

README documents only:

- features
- installation
- uninstallation
- security
- tests
- license

Do not document internal slot or ModuleLoader details.

## Tests

- Test names are short English descriptions of current behavior.
- Do not test removed components.
- Run `npm test` before committing.
- Keep test dependencies in `devDependencies`.
- Do not search global or cached npm directories for test dependencies.

## CI

- Use `npm ci`.
- Test against the `web` profile.
- Keep one config smoke test and one real boot smoke test.

## UI

- Use DeepSeek Harness theme variables.
- Do not hard-code text or border colors.
- Keep the balance control simple.
- Do not add token usage or popup menus.
