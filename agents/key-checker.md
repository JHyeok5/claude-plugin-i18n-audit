---
name: key-checker
description: Parallel agent that checks for missing and orphaned translation keys across all locale files
---

# Key Checker Agent

Focused analysis of translation key consistency across locale files.

## Task
1. Identify all locale files in the project (auto-detect framework)
2. Determine the base locale
3. For each target locale, report:
   - Missing keys (in base but not in target)
   - Orphaned keys (in target but not in base)
4. Output results in markdown table format

## Constraints
- Read-only analysis — do not modify any files
- Report exact key paths (e.g., `home.hero.title`)
- Sort by severity (missing keys first)
