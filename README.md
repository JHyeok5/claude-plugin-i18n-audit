# i18n Audit — Multi-Locale Consistency Checker Plugin

[![Version](https://img.shields.io/badge/version-1.0.0-blue?style=flat-square)](https://github.com/JHyeok5/claude-plugin-i18n-audit)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey?style=flat-square)]()
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Plugin-blueviolet?style=flat-square)]()

Audit internationalization files for missing keys, untranslated values, hardcoded strings, and inconsistencies. Works across **any tech stack, i18n library, and locale file format**.

## The Problem

```
You ship a feature → add 3 new keys to en.json → forget ko.json and zh.json
                                                          ↓
                  Users see raw keys: "payment.error.declined" in production
```

Manual checking doesn't scale. With 1000+ keys across 4 locales, human review misses drift.

## The Solution

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Run audit  │ --> │ 1270 keys ×  │ --> │  Fix issues  │ --> │ Delta: -5    │
│   First time │     │ 4 locales    │     │  with report │     │ missing keys │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
         │                   │                                        │
         └── config.json ────┘── glossary.json ── history.json ───────┘
             (base locale,       (brand names,     (per-metric
              nesting style)      URLs to skip)     delta tracking)
```

## Key Features

| Feature | Description |
|---------|-------------|
| 6 Audit Checks | Missing keys, orphaned keys, untranslated, placeholders, hardcoded, naming |
| 11 Frameworks | i18next, next-intl, vue-i18n, Angular, Rails, Django, Flutter, iOS, Android... |
| Auto-Check Hook | Monitors locale file edits, warns about missing keys in real-time |
| Glossary System | Auto-detects brand names/URLs/constants, excludes from false positives |
| Progress Tracking | `.i18n-audit/history.json` — per-metric delta across runs |
| Parallel Agents | key-checker + hardcode-scanner run concurrently on large codebases |
| Zero Dependencies | Pure Node.js, no npm packages required |

## Installation

```bash
# From marketplace
/plugin install i18n-audit@JHyeok5

# Or clone directly
git clone https://github.com/JHyeok5/claude-plugin-i18n-audit.git
claude --plugin-dir ./claude-plugin-i18n-audit
```

> **Note**: Restart Claude Code after installation to activate hooks.

## Usage

```
/i18n-audit:i18n-audit
```

Or describe your need — auto-triggers on i18n tasks:

- "Check if all translations are complete"
- "Find missing translation keys"
- "Audit my locale files"
- "Are there any hardcoded strings?"

### Standalone Script

```bash
node scripts/i18n-check.js src/locales --base=en
```

## How It Works

```
[First Run]
  1. Scan locale directory for JSON files
  2. Detect base locale (--base flag or auto from config)
  3. Flatten nested keys, run 4 checks (missing/extra/untranslated/placeholders)
  4. Create .i18n-audit/ → config.json + glossary.json + history.json
  5. Auto-detect glossary candidates (brand names, URLs, short strings)

[Subsequent Runs]
  1. Read .i18n-audit/config.json → use saved baseLocale
  2. Read glossary.json → exclude known-identical terms from "untranslated"
  3. Run checks → compare with history → show per-metric delta
  4. Append history (capped at 100 entries)

[Hooks (automatic)]
  Edit locale file → detect via path pattern (/locales/, /i18n/, /messages/)
                   → run i18n-check.js with config-aware --base flag
                   → warn on Critical issues (missing keys, placeholder mismatch)
```

## 6 Audit Checks

| # | Check | Severity | What It Catches |
|---|-------|----------|-----------------|
| 1 | Missing Keys | Critical | Keys in base locale missing from targets |
| 2 | Extra Keys | Warning | Orphaned keys from deleted features |
| 3 | Untranslated | Warning | Empty or copy-pasted values (glossary-aware) |
| 4 | Placeholders | Critical | Mismatched `{{variables}}` across locales |
| 5 | Hardcoded | Warning | User-facing text bypassing i18n |
| 6 | Naming | Info | Inconsistent key naming conventions |

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

## Auto-Check Hook

When installed, the plugin automatically monitors edits to locale files:

- Detects changes to `*.json` files in `locales/`, `i18n/`, `lang/`, `messages/`, `translations/` directories
- Reads `.i18n-audit/config.json` for base locale (no guessing)
- Runs quick key consistency check against sibling locale files
- Warns about Critical issues — no manual invocation needed

## Self-Improvement

The plugin creates `.i18n-audit/` in your project on first run:

```
.i18n-audit/
├── config.json    ← base locale, target locales, nesting style, key count
├── glossary.json  ← auto-detected terms to skip (brand names, URLs, constants)
└── history.json   ← per-metric delta tracking across runs
```

### Glossary System

Terms auto-detected as intentionally identical across locales:

| Pattern | Example | Reason |
|---------|---------|--------|
| PascalCase brand names | "RE:Play" | Brand — never translated |
| URLs | "https://..." | Locale independent |
| Short strings (<=3 chars) | "km", "OK" | Universal units |
| ALL_CAPS constants | "API_KEY" | Technical term |

Glossary entries are excluded from the "untranslated" check. Each run grows smarter.

## Parallel Agents

For comprehensive audits, the plugin spawns parallel agents:

- **key-checker**: Missing and orphaned key analysis across all locale files
- **hardcode-scanner**: Source code scan for un-internationalized strings

These run concurrently for faster results on large codebases.

## Script Output Example

**First run:**
```
# i18n Audit Report

## Summary
- **Base locale**: en (245 keys)
- **Target locales**: ko, zh, zh-TW (3)
- **Overall health**: 87% (639/735)
- **State dir**: /project/.i18n-audit
- **First run**: config, glossary, and history initialized

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

**Second run (after fixes):**
```
## Delta (vs 2026-03-11)
- **Key count**: 245 -> 248 (+3)
- **Missing keys**: 28 -> 0 (no change)
- **Untranslated**: 35 -> 12 (-23)
- **Placeholder mismatches**: 4 -> 0 (-4)
```

## Plugin Structure

```
claude-plugin-i18n-audit/
├── .claude-plugin/
│   └── plugin.json             ← plugin manifest
├── skills/
│   └── i18n-audit/
│       └── SKILL.md            ← skill definition (6-check audit guide)
├── hooks/
│   └── hooks.json              ← PostToolUse hook config
├── agents/
│   ├── key-checker.md          ← parallel agent: missing/orphaned keys
│   └── hardcode-scanner.md     ← parallel agent: hardcoded strings
├── scripts/
│   ├── i18n-check.js           ← standalone audit script (zero-dep Node.js)
│   └── locale-check-hook.sh    ← hook script (config-aware)
├── references/
│   ├── framework-detection.md  ← auto-detection rules for 10+ frameworks
│   └── check-examples.md       ← BAD/GOOD examples for each check
├── README.md
└── LICENSE
```

## Requirements

- Claude Code CLI
- Node.js (for `i18n-check.js` script)
- Any project with locale/translation files
- jq (optional — used by hook for config reading, graceful fallback)

## License

MIT
