# Framework Detection Reference

Detailed auto-detection rules for i18n setups across frameworks.

## Locale File Discovery

### Priority Order

1. Check `package.json` for i18n dependencies → infer framework
2. Check common paths for locale files
3. Fall back to recursive `.json`/`.yaml`/`.po` search

### Detection by Dependency

| package.json dependency | Framework | Default locale path |
|------------------------|-----------|-------------------|
| `i18next` | i18next | `public/locales/{lang}/translation.json` |
| `react-i18next` | react-i18next | `public/locales/{lang}/translation.json` or `src/locales/{lang}.json` |
| `next-intl` | next-intl | `messages/{lang}.json` |
| `react-intl` | react-intl | `src/lang/{lang}.json` |
| `vue-i18n` | vue-i18n | `src/locales/{lang}.json` or `src/i18n/{lang}.json` |
| `@ngx-translate/core` | Angular | `src/assets/i18n/{lang}.json` |
| `@nuxtjs/i18n` | Nuxt | `locales/{lang}.json` |
| `flutter_localizations` | Flutter | `lib/l10n/app_{lang}.arb` |

### File Format Detection

| Extension | Format | Parser |
|-----------|--------|--------|
| `.json` | JSON | `JSON.parse()` |
| `.yaml`, `.yml` | YAML | YAML parser |
| `.po`, `.pot` | GNU gettext | PO parser |
| `.xliff`, `.xlf` | XLIFF | XML parser |
| `.arb` | Flutter ARB | `JSON.parse()` (ARB is JSON) |
| `.strings` | iOS | Custom key-value parser |
| `.xml` | Android | XML parser (`<string name="key">`) |

## Translation Function Patterns

### Hardcoded String Detection

For each framework, search source files for user-facing text that bypasses i18n.

#### React (JSX/TSX)

**i18next pattern:**
```
// TRANSLATED — OK
{t('home.title')}
<Trans i18nKey="home.subtitle" />

// HARDCODED — Flag
<h1>Welcome to our app</h1>
<button>Submit</button>
<p>No results found</p>
```

**react-intl pattern:**
```
// TRANSLATED — OK
<FormattedMessage id="home.title" />
{intl.formatMessage({ id: 'home.subtitle' })}

// HARDCODED — Flag
<h1>Welcome to our app</h1>
```

#### Vue (SFC)

```
// TRANSLATED — OK
{{ $t('home.title') }}
v-text="$t('home.title')"

// HARDCODED — Flag
<h1>Welcome to our app</h1>
```

#### Angular

```
// TRANSLATED — OK
{{ 'home.title' | translate }}
[innerHTML]="'home.title' | translate"

// HARDCODED — Flag
<h1>Welcome to our app</h1>
```

### Exclusion Rules (Do NOT flag)

| Pattern | Reason |
|---------|--------|
| `<!-- comments -->` | HTML comments |
| `// comments`, `/* comments */` | JS comments |
| `console.log(...)` | Debug output |
| `className="..."` | CSS classes |
| `href="..."`, `src="..."` | URLs/paths |
| `type="..."`, `name="..."` | HTML attributes |
| `aria-label` with i18n | Already internationalized |
| `alt=""` | Empty alt = decorative image |
| `data-testid="..."` | Test selectors |
| `key={...}` | React keys |
| String literals in `.test.`, `.spec.` files | Test files |

## Placeholder Format Reference

### i18next

```
Simple:     {{name}}
Nested:     {{user.name}}
Plural:     {{count}} item_one / {{count}} items_other
Context:    friend_male / friend_female
```

### ICU MessageFormat (react-intl, next-intl)

```
Simple:     {name}
Number:     {price, number, currency}
Date:       {date, date, medium}
Plural:     {count, plural, one {# item} other {# items}}
Select:     {gender, select, male {He} female {She} other {They}}
```

### Printf-style (C, PHP, Android)

```
String:     %s, %1$s
Integer:    %d, %1$d
Float:      %f, %.2f
iOS:        %@
```

## Config File Format

`.i18n-audit/config.json`:

```json
{
  "framework": "react-i18next",
  "baseLocale": "en",
  "localeFiles": {
    "en": "src/locales/en.json",
    "ko": "src/locales/ko.json",
    "zh": "src/locales/zh.json",
    "zh-TW": "src/locales/zh-TW.json"
  },
  "translationFunction": "t",
  "importPattern": "useTranslation",
  "fileFormat": "json",
  "sourceGlob": "src/**/*.{tsx,ts,jsx,js,vue}",
  "excludePatterns": ["**/*.test.*", "**/*.spec.*", "**/node_modules/**"]
}
```
