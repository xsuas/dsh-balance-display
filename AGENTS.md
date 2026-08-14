# Agent Instructions

Style rules for working in this repository. Follow these for every change.

## Commit messages

- Plain English, short title: 15-35 characters, one topic per commit.
- Start with a simple verb: `Add`, `Update`, `Fix`, `Remove`, `Clean up`, `Adjust`.
- Examples: `Add balance display`, `Update tests`, `Fix balance response`, `Clean up balance plugin`.
- No `feat:`/`fix:` prefixes, no parentheses, brackets, colons, arrows, or implementation details.
- One commit per logical change; split independent changes.
- Never rewrite history just for display purposes.

## README and docs

- README describes usage only: install, uninstall, security, tests, license.
- Do not document implementation details: slot names, ModuleLoader, UI layout history, or comparisons with official components.
- Do not record development history or removed features.

## Package descriptions

- Describe what the package does, not how it works.
- No cache durations, route paths, or UI placement details.

## Code comments

- Brief, English, explain why, not what.
- No large header comment blocks.
- Only current-state descriptions; never reference removed implementations.

## Tests

- Test names and messages in English, short, describe the current contract only.
- Never assert or mention removed components or old behavior.

## Language

- Repo-facing content (docs, tests, commits, comments) is English.
- User-facing UI copy follows the product's own language.

## Known boundaries

- Token usage is displayed by the official stats line; do not re-add it to this plugin.
- The balance chip shows symbol + number; keep it simple, no menus.
