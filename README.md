# i18n Audit — Multi-Locale Consistency Checker Plugin

Audit internationalization files for missing keys, untranslated values, hardcoded strings, and inconsistencies. Works across **any tech stack, i18n library, and locale file format**.

## What This Plugin Does

- Auto-detects locale files and translation functions in any framework
- Runs 6 checks: missing keys, orphaned keys, untranslated values, placeholder mismatches, hardcoded strings, naming conventions
- Generates actionable reports with copy-paste fixes
- Builds a project glossary to reduce false positives over time
- Tracks improvement history across audits

## Supported Frameworks

| Framework | Format | Translation Call |
|-----------|--------|-----------------|
| i18next / react-i18next | JSON | `t('key')` |
| next-intl | JSON | `t('key')` |
| react-intl | JSON | `intl.formatMessage()` |
| vue-i18n | JSON/YAML | `$t('key')` |
| Angular | JSON | `translate` pipe |
| Rails | YAML | `t('key')` |
| Django | PO | `gettext()` |
| Flutter | ARB | `AppLocalizations` |
| iOS | .strings | `NSLocalizedString` |
| Android | XML | `getString()` |
| Custom | Configurable | Configurable |

## Installation

```bash
/plugin install i18n-audit@JHyeok5
```

Or load directly:

```bash
claude --plugin-dir ./claude-plugin-i18n-audit
```

## Usage

```
/i18n-audit:i18n-audit
```

Or describe your need — auto-triggers on i18n tasks:

- "Check if all translations are complete"
- "Find missing translation keys"
- "Audit my locale files"
- "Are there any hardcoded strings?"

## 6 Audit Checks

| # | Check | Severity | What It Catches |
|---|-------|----------|-----------------|
| 1 | Missing Keys | Critical | Keys in base locale missing from targets |
| 2 | Extra Keys | Warning | Orphaned keys from deleted features |
| 3 | Untranslated | Warning | Empty or copy-pasted values |
| 4 | Placeholders | Critical | Mismatched `{{variables}}` across locales |
| 5 | Hardcoded | Warning | User-facing text bypassing i18n |
| 6 | Naming | Info | Inconsistent key naming conventions |

## Self-Improvement

The skill creates `.i18n-audit/` in your project on first run:
- `config.json` — detected locale paths, base locale, translation function
- `glossary.json` — terms intentionally identical across locales (brand names, units)
- `history.json` — past audit results for delta tracking

Each run gets smarter: fewer false positives, faster detection, progress tracking.

## Auto-Check Hook

When installed, the plugin automatically monitors edits to locale files:
- Detects changes to `*.json` files in locale/i18n/messages directories
- Runs quick key consistency check against sibling locale files
- Warns about missing keys or placeholder mismatches — no manual invocation needed

## Parallel Agents

For comprehensive audits, the plugin spawns parallel agents:
- **key-checker**: Missing and orphaned key analysis
- **hardcode-scanner**: Source code scan for un-internationalized strings

These run concurrently for faster results on large codebases.

## Script Output Example

```
$ node scripts/i18n-check.js src/locales --base=en

# i18n Audit Report

## Summary
- **Base locale**: en (245 keys)
- **Target locales**: ko, zh, zh-TW (3)
- **Overall health**: 87% (639/735)

## Per-Locale Stats
| Locale | Present | Missing | Extra | Untranslated | Placeholder |
|--------|---------|---------|-------|-------------|-------------|
| ko     | 240/245 | 5       | 2     | 8           | 1           |
| zh     | 232/245 | 13      | 0     | 15          | 3           |
| zh-TW  | 235/245 | 10      | 1     | 12          | 2           |

## Critical
| # | Check | Locale | Key | Issue |
|---|-------|--------|-----|-------|
| 1 | Missing Key | zh | `payment.error.declined` | Key absent |
| 2 | Placeholder | ko | `greeting.welcome` | Missing {{count}} |
```

## Requirements

- Claude Code CLI
- Any project with locale/translation files

## License

MIT
