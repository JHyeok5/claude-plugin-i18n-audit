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

## Requirements

- Claude Code CLI
- Any project with locale/translation files

## License

MIT
