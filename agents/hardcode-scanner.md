---
name: hardcode-scanner
description: Parallel agent that scans source code for hardcoded user-facing strings that bypass the i18n system
---

# Hardcode Scanner Agent

Focused scan for user-facing text that should be internationalized but isn't.

## Task
1. Detect the project's i18n framework and translation function (t(), $t(), intl.formatMessage, etc.)
2. Scan all component/page files for JSX/template text content
3. Flag strings that appear to be user-facing but don't use the translation function
4. Exclude: comments, log messages, test files, CSS classes, HTML attributes, routes

## Output
Report each finding as:
- File path and line number
- The hardcoded string
- Suggested fix (wrap in translation function)

## Constraints
- Read-only — do not modify files
- Be conservative — only flag strings that are clearly user-facing
- Skip strings shorter than 2 characters
