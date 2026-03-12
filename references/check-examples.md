# i18n Audit — Check Examples & Output Format

Detailed examples for each audit check, placeholder format reference, and report template.

## Check 1: Missing Keys — Examples

**Example:**
```
Base (en.json):   { "home": { "title": "Home", "subtitle": "Welcome back" } }
Target (ko.json): { "home": { "title": "홈" } }
                                                  <- "subtitle" MISSING
```

**Fix**: Add the missing key with a translated value or a placeholder:
```json
{ "home": { "title": "홈", "subtitle": "[NEEDS_TRANSLATION] Welcome back" } }
```

## Check 2: Extra Keys (Orphaned) — Examples

**Example:**
```
Base (en.json):   { "home": { "title": "Home" } }
Target (ko.json): { "home": { "title": "홈", "old_banner": "이전 배너" } }
                                                    <- "old_banner" ORPHANED
```

**Fix**: Remove orphaned keys from all target locales.

## Check 3: Untranslated Values — Examples

**Example:**
```
Base (en.json):   { "error": { "network": "Network error occurred" } }
Target (ja.json): { "error": { "network": "Network error occurred" } }
                                             <- IDENTICAL TO BASE — likely untranslated
```

**Exceptions** (intentionally identical across locales):
- Brand names ("Google", "iPhone")
- URLs and email addresses
- Units ("km", "kg", "USD")
- Technical codes ("HTTP 404")

## Check 4: Placeholder Consistency — Examples

### Placeholder formats by library

| Library | Format | Example |
|---------|--------|---------|
| i18next | `{{name}}` | `Hello, {{name}}!` |
| react-intl (ICU) | `{name}` | `Hello, {name}!` |
| vue-i18n | `{name}` or `%{name}` | `Hello, {name}!` |
| printf-style | `%s`, `%d`, `%1$s` | `Hello, %s!` |
| Flutter | `{name}` | `Hello, {name}!` |
| Android | `%1$s`, `%2$d` | `Hello, %1$s!` |
| iOS | `%@`, `%d` | `Hello, %@!` |

**Example:**
```
Base (en.json):   { "greeting": "Hello, {{name}}! You have {{count}} items." }
Target (ko.json): { "greeting": "안녕하세요, {{name}}님!" }
                                                          <- {{count}} MISSING
```

## Check 5: Hardcoded Strings — Examples

**Detection patterns by framework:**

| Framework | Translation call | Hardcoded = text without this call |
|-----------|-----------------|-----------------------------------|
| react-i18next | `t('key')` | JSX text content not wrapped in `t()` |
| react-intl | `<FormattedMessage>` | JSX text without FormattedMessage |
| vue-i18n | `$t('key')` | Template text without `$t()` |
| Angular | `translate` pipe | Template text without translate pipe |
| Flutter | `AppLocalizations` | String literals in widget build methods |

**Exclusions** (do not flag):
- Code comments and documentation
- Log messages and console output
- Test fixtures and mock data
- CSS class names, routes, HTML attributes
- `aria-label` if already i18n-aware
- `alt=""` for decorative images

## Check 6: Key Naming Convention — Examples

**Common conventions:**

| Convention | Example | Used by |
|-----------|---------|---------|
| dot.notation | `home.hero.title` | Most JSON-based i18n |
| SCREAMING_SNAKE | `HOME_HERO_TITLE` | Some Angular projects |
| slash/path | `home/hero/title` | Some custom setups |
| camelCase | `homeHeroTitle` | Some Flutter projects |

**Checks:**
- All keys follow the same convention (no mixing)
- Nesting depth is consistent (warn if > 4 levels)
- No special characters in keys (spaces, dashes in some formats)
- Logical grouping: `section.element.modifier` pattern

## Output Format

Full markdown report template:

```markdown
# i18n Audit Report

## Summary
- **Base locale**: en (245 keys)
- **Target locales**: ko, zh, zh-TW (3 locales)
- **Overall health**: 87% (639/735 fully translated)
- **Framework**: react-i18next (detected)

## Issues by Severity

### Critical (X issues — blocks release)
| # | Check | Locale | Key | Issue |
|---|-------|--------|-----|-------|
| 1 | Missing Key | zh | payment.error.declined | Key absent |
| 2 | Placeholder | ko | greeting.welcome | Missing {{count}} |

### Warning (X issues — should fix)
| # | Check | Locale | Key | Issue |
|---|-------|--------|-----|-------|
| 3 | Untranslated | zh-TW | settings.theme | Identical to base |
| 4 | Extra Key | ko | deprecated.old_feature | Orphaned |
| 5 | Hardcoded | — | src/components/Footer.tsx:12 | "Copyright 2024" |

### Info (X issues)
| # | Check | Details |
|---|-------|---------|
| 6 | Convention | 3 keys use camelCase, rest use dot.notation |

## Delta (vs. previous audit)
- Fixed: 5 issues resolved since last audit
- New: 2 issues introduced
- Remaining: 8 issues unchanged

## Quick Fixes
[Copy-paste ready JSON/code for each critical issue]
```
