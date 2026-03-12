---
name: i18n-audit
description: Audit and fix internationalization (i18n) consistency across multi-locale projects. This skill should be used when checking for missing translation keys, untranslated values, hardcoded user-facing strings, placeholder mismatches, or locale file drift. Works with any i18n framework (react-intl, next-intl, vue-i18n, i18next, Angular, Flutter ARB, Android strings.xml, iOS Localizable.strings) and file format (JSON, YAML, PO, XLIFF, ARB). Builds a project glossary over time for consistent terminology.
license: MIT
metadata:
  author: JHyeok5
  version: "1.0.0"
  tags: [i18n, l10n, internationalization, localization, translation, multilingual]
  platforms: Claude, ChatGPT, Gemini
---

# i18n Audit — Multi-Locale Consistency Checker

Audit internationalization files for missing keys, untranslated values, hardcoded strings, and inconsistencies. Works across any tech stack, i18n library, and locale file format.

## When to Use

- **Before release**: Ensure all user-facing strings are translated
- **After adding features**: Check that new strings have all locale variants
- **Periodic audit**: Catch locale file drift over time
- **Adding a new language**: Verify completeness against the base locale
- **CI/CD gate**: Automated i18n quality check before merge
- **Onboarding translators**: Generate a report of what needs translation

## Quick Start

For any project, regardless of framework. No coding experience required.

### What is i18n?

Internationalization (i18n) means keeping all user-facing text (buttons, messages, labels) in separate files per language, instead of hardcoding them in the app. This lets the app switch languages without changing code.

```
Without i18n:  <button>Submit</button>              ← Only English, forever
With i18n:     <button>{t('form.submit')}</button>   ← Shows "Submit", "제출", "提交" depending on language
```

### How the Audit Works

```
[Step 1] Find locale files     → Auto-detect or specify paths
[Step 2] Identify base locale  → The "source of truth" language (usually en or ko)
[Step 3] Run 6 checks          → Missing keys, untranslated, hardcoded, placeholders, extras, naming
[Step 4] Generate report       → Issues by severity with copy-paste fixes
[Step 5] Save progress         → Track improvements over time
```

## Auto-Detection

The skill auto-detects the i18n setup by scanning common locations:

### Locale File Locations by Framework

| Framework | Typical Paths | Format |
|-----------|--------------|--------|
| i18next / react-i18next | `src/locales/*.json`, `public/locales/**/*.json` | JSON |
| next-intl | `messages/*.json`, `src/messages/*.json` | JSON |
| react-intl | `src/lang/*.json`, `src/translations/*.json` | JSON |
| vue-i18n | `src/i18n/*.json`, `src/locales/*.json` | JSON/YAML |
| Angular | `src/assets/i18n/*.json` | JSON |
| Nuxt i18n | `locales/*.json`, `i18n/*.json` | JSON/YAML |
| Rails | `config/locales/*.yml` | YAML |
| Django | `locale/*/LC_MESSAGES/*.po` | PO |
| Laravel | `lang/*.json`, `resources/lang/**/*.php` | JSON/PHP |
| Flutter | `lib/l10n/*.arb` | ARB (JSON) |
| iOS | `*.lproj/Localizable.strings` | .strings |
| Android | `res/values*/strings.xml` | XML |
| Svelte (paraglide) | `messages/*.json` | JSON |
| Custom | Configurable via `.i18n-audit/config.json` | Any |

### Translation Function Detection

| Framework | Translation Call | Import Pattern |
|-----------|-----------------|----------------|
| i18next | `t('key')` | `useTranslation()` |
| react-intl | `intl.formatMessage({ id: 'key' })`, `<FormattedMessage id="key" />` | `useIntl()` |
| vue-i18n | `$t('key')`, `t('key')` | `useI18n()` |
| next-intl | `t('key')` | `useTranslations()` |
| Angular | `{{ 'key' \| translate }}` | `TranslateModule` |
| Flutter | `AppLocalizations.of(context)!.key` | `flutter_localizations` |
| Custom | Configurable | Configurable |

## Audit Checks

### Check 1: Missing Keys

Keys present in the base locale but absent in target locales.

**Impact**: Users see raw keys (e.g., `home.welcome_message`) or blank UI.

**Example:**
```
Base (en.json):   { "home": { "title": "Home", "subtitle": "Welcome back" } }
Target (ko.json): { "home": { "title": "홈" } }
                                                  ← "subtitle" MISSING
```

**Severity**: Critical — blocks release.

**Fix**: Add the missing key with a translated value or a placeholder:
```json
{ "home": { "title": "홈", "subtitle": "[NEEDS_TRANSLATION] Welcome back" } }
```

### Check 2: Extra Keys (Orphaned)

Keys present in target locales but NOT in the base locale.

**Impact**: Dead code. Locale files grow unbounded, confusing translators.

**Example:**
```
Base (en.json):   { "home": { "title": "Home" } }
Target (ko.json): { "home": { "title": "홈", "old_banner": "이전 배너" } }
                                                    ← "old_banner" ORPHANED
```

**Severity**: Warning — should clean up.

**Fix**: Remove orphaned keys from all target locales.

### Check 3: Untranslated Values

Keys that exist in target locales but contain:
- Empty string `""`
- Exact same value as base locale (possible copy-paste)
- Placeholder markers: `TODO`, `FIXME`, `[TRANSLATE]`, `[NEEDS_TRANSLATION]`

**Example:**
```
Base (en.json):   { "error": { "network": "Network error occurred" } }
Target (ja.json): { "error": { "network": "Network error occurred" } }
                                             ← IDENTICAL TO BASE — likely untranslated
```

**Severity**: Warning (empty/TODO) or Info (identical — may be intentional).

**Exceptions**: Some values are intentionally identical across locales:
- Brand names ("Google", "iPhone")
- URLs and email addresses
- Units ("km", "kg", "USD")
- Technical codes ("HTTP 404")

These are tracked in the glossary (see Self-Improvement) to avoid false positives.

### Check 4: Placeholder Consistency

Translation strings with variables must use the same placeholders in all locales.

**Placeholder formats by library:**

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
                                                          ← {{count}} MISSING
```

**Severity**: Critical — missing placeholders cause runtime errors or incorrect display.

### Check 5: Hardcoded Strings

User-facing strings in source code that bypass the i18n system.

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

**Severity**: Warning — each hardcoded string is a missed translation.

### Check 6: Key Naming Convention

Consistent key naming improves maintainability and translator experience.

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

**Severity**: Info — style consistency.

## Output Format

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

## Self-Improvement

This skill builds project knowledge over time, reducing false positives and speeding up audits.

### First Run

1. Auto-detect locale files, base locale, and translation function
2. Run full 6-check audit
3. Create `.i18n-audit/` directory with:
   - `config.json`: detected paths, base locale, translation function pattern, file format
   - `glossary.json`: terms intentionally identical across locales (brand names, units)
   - `history.json`: baseline audit results with timestamp

### Subsequent Runs

1. Read `.i18n-audit/config.json` — skip detection step
2. Check `glossary.json` — exclude known-identical terms from untranslated check
3. Run audit and compare with `history.json`
4. Show delta: fixed / new / remaining issues
5. Update history with new results

### Glossary Building

Terms added to the glossary are excluded from the "untranslated value" check:

```json
{
  "terms": [
    { "key": "brand.name", "value": "MyApp", "reason": "Brand name — never translated" },
    { "key": "unit.km", "value": "km", "reason": "Universal unit" },
    { "key": "social.url", "value": "https://...", "reason": "URL — locale independent" }
  ]
}
```

**How it grows**: When the audit flags an identical value, ask whether it should be added to the glossary. Once added, future audits skip it automatically.

### Progressive Strictness

As the project matures, the skill tightens its checks:

| Project Stage | Strictness | Checks Enforced |
|---------------|-----------|-----------------|
| Early (< 50 keys) | Lenient | Missing keys, placeholders only |
| Growing (50-500) | Standard | All 6 checks, glossary building |
| Mature (500+) | Strict | Zero-tolerance on missing keys, naming convention enforced |

## Constraints

### Required (MUST)

1. **Every user-facing string must go through i18n**: No hardcoded text in UI components
2. **All locales must have all base keys**: Missing keys cause blank UI or raw key display
3. **Placeholders must match across locales**: Mismatched variables cause runtime crashes or incorrect content
4. **Base locale is the source of truth**: Add keys to base first, then translate

### Prohibited (MUST NOT)

1. **Never delete a base key without checking targets**: Creates orphaned keys across all locales
2. **Never use machine translation without human review**: Leads to embarrassing mistranslations in production
3. **Never mix key naming conventions**: Pick one pattern and enforce it project-wide
4. **Never use placeholder as label**: `placeholder="Enter name"` is not a substitute for i18n

## Best Practices

1. **Base locale first**: Always add keys to the base, then translate to targets
2. **Group by feature**: `payment.title` not `titles.payment` — colocate related keys
3. **Keep nesting shallow**: 2-3 levels max (`section.element.modifier`)
4. **Delete unused keys**: Run orphaned-key check after removing features
5. **Freeze before release**: No new keys in the final testing phase
6. **Automate in CI**: Run i18n-audit as a pre-merge check to catch issues early
7. **Provide context for translators**: Add `_description` keys or use i18n platforms with context support
8. **Test with pseudo-localization**: Replace strings with accented characters to catch hardcoded text and layout issues

## References

- [i18next documentation](https://www.i18next.com/)
- [ICU Message Format](https://unicode-org.github.io/icu/userguide/format_parse/messages/)
- [Unicode CLDR (Common Locale Data Repository)](https://cldr.unicode.org/)
- [Mozilla L10n Guide](https://mozilla-l10n.github.io/localizer-documentation/)
- [W3C Internationalization](https://www.w3.org/International/)
- [Pseudo-localization explained](https://docs.google.com/document/d/1e3wYKZm9MzB5dCBP3GYKsHBYGLqLC4MijYYP_FpkSfM)

## Related Skills

- `translate-content`: Active translation workflow (complements i18n-audit)
- `web-accessibility`: Accessibility often intersects with i18n (screen reader language, dir attributes)
