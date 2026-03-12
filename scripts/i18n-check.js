#!/usr/bin/env node
/**
 * i18n-check.js — Zero-dependency locale file consistency checker
 *
 * Usage:
 *   node i18n-check.js <locale-dir> [--base=en] [--format=json|yaml]
 *
 * Examples:
 *   node i18n-check.js src/locales
 *   node i18n-check.js src/locales --base=ko
 *   node i18n-check.js public/locales/en public/locales/ko public/locales/zh
 *
 * Outputs a markdown report to stdout.
 */

const fs = require("fs");
const path = require("path");

// --- CLI args ---
const args = process.argv.slice(2);
const flags = {};
const paths = [];

for (const arg of args) {
  if (arg.startsWith("--")) {
    const [key, val] = arg.slice(2).split("=");
    flags[key] = val || true;
  } else {
    paths.push(arg);
  }
}

if (paths.length === 0) {
  console.error("Usage: node i18n-check.js <locale-dir-or-files> [--base=en]");
  process.exit(1);
}

const baseLang = flags.base || null; // auto-detect if not specified

// --- Helpers ---
function flattenKeys(obj, prefix = "") {
  const keys = {};
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      Object.assign(keys, flattenKeys(v, fullKey));
    } else {
      keys[fullKey] = v;
    }
  }
  return keys;
}

function loadJsonLocale(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch (e) {
    console.error(`Error reading ${filePath}: ${e.message}`);
    return null;
  }
}

function discoverLocaleFiles(dir) {
  const files = {};
  const stat = fs.statSync(dir);

  if (stat.isFile() && dir.endsWith(".json")) {
    const lang = path.basename(dir, ".json");
    files[lang] = dir;
    return files;
  }

  if (!stat.isDirectory()) return files;

  const entries = fs.readdirSync(dir);

  // Pattern 1: flat files — en.json, ko.json, zh.json
  const jsonFiles = entries.filter((e) => e.endsWith(".json"));
  if (jsonFiles.length > 0) {
    for (const f of jsonFiles) {
      const lang = path.basename(f, ".json");
      files[lang] = path.join(dir, f);
    }
    return files;
  }

  // Pattern 2: directories — en/translation.json, ko/translation.json
  for (const entry of entries) {
    const subDir = path.join(dir, entry);
    if (fs.statSync(subDir).isDirectory()) {
      const subFiles = fs.readdirSync(subDir).filter((f) => f.endsWith(".json"));
      if (subFiles.length > 0) {
        // Use first JSON file found (usually translation.json or common.json)
        files[entry] = path.join(subDir, subFiles[0]);
      }
    }
  }

  return files;
}

// --- Main ---
function main() {
  // Discover locale files
  let localeFiles = {};

  for (const p of paths) {
    const resolved = path.resolve(p);
    if (!fs.existsSync(resolved)) {
      console.error(`Path not found: ${resolved}`);
      process.exit(1);
    }
    Object.assign(localeFiles, discoverLocaleFiles(resolved));
  }

  const langs = Object.keys(localeFiles);
  if (langs.length < 2) {
    console.error(`Found ${langs.length} locale(s). Need at least 2 for comparison.`);
    console.error("Found:", localeFiles);
    process.exit(1);
  }

  // Determine base locale
  const base = baseLang || (langs.includes("en") ? "en" : langs[0]);
  if (!localeFiles[base]) {
    console.error(`Base locale "${base}" not found. Available: ${langs.join(", ")}`);
    process.exit(1);
  }

  const targets = langs.filter((l) => l !== base);

  // Load and flatten all locales
  const data = {};
  for (const lang of langs) {
    const raw = loadJsonLocale(localeFiles[lang]);
    if (!raw) process.exit(1);
    data[lang] = flattenKeys(raw);
  }

  const baseKeys = Object.keys(data[base]);
  const issues = { critical: [], warning: [], info: [] };
  const stats = {};

  for (const target of targets) {
    const targetKeys = Object.keys(data[target]);
    const targetSet = new Set(targetKeys);
    const baseSet = new Set(baseKeys);

    let missing = 0;
    let extra = 0;
    let untranslated = 0;
    let placeholderMismatch = 0;

    // Check 1: Missing keys
    for (const key of baseKeys) {
      if (!targetSet.has(key)) {
        issues.critical.push({
          check: "Missing Key",
          locale: target,
          key,
          issue: "Key absent in target",
        });
        missing++;
      }
    }

    // Check 2: Extra keys
    for (const key of targetKeys) {
      if (!baseSet.has(key)) {
        issues.warning.push({
          check: "Extra Key",
          locale: target,
          key,
          issue: "Orphaned — not in base locale",
        });
        extra++;
      }
    }

    // Check 3: Untranslated values
    for (const key of baseKeys) {
      if (!targetSet.has(key)) continue;
      const baseVal = String(data[base][key]);
      const targetVal = String(data[target][key]);

      if (targetVal === "") {
        issues.warning.push({
          check: "Untranslated",
          locale: target,
          key,
          issue: "Empty string",
        });
        untranslated++;
      } else if (
        targetVal === baseVal &&
        baseVal.length > 3 && // Skip short universal values like "OK", "km"
        !/^https?:\/\//.test(baseVal) && // Skip URLs
        !/^[A-Z_]+$/.test(baseVal) // Skip constants
      ) {
        issues.info.push({
          check: "Untranslated?",
          locale: target,
          key,
          issue: `Identical to base: "${baseVal.slice(0, 50)}${baseVal.length > 50 ? "..." : ""}"`,
        });
        untranslated++;
      } else if (/TODO|FIXME|TRANSLATE|NEEDS.TRANSLATION/i.test(targetVal)) {
        issues.warning.push({
          check: "Untranslated",
          locale: target,
          key,
          issue: `Contains marker: "${targetVal.slice(0, 50)}"`,
        });
        untranslated++;
      }
    }

    // Check 4: Placeholder consistency
    const placeholderPatterns = [
      /\{\{(\w+)\}\}/g,   // i18next: {{name}}
      /\{(\w+)\}/g,       // ICU/vue-i18n: {name}
      /%[ds@]/g,          // printf: %s, %d, %@
      /%\d+\$[sd]/g,      // Android: %1$s
    ];

    for (const key of baseKeys) {
      if (!targetSet.has(key)) continue;
      const baseVal = String(data[base][key]);
      const targetVal = String(data[target][key]);

      for (const pattern of placeholderPatterns) {
        const baseMatches = [...baseVal.matchAll(pattern)].map((m) => m[0]).sort();
        const targetMatches = [...targetVal.matchAll(pattern)].map((m) => m[0]).sort();

        if (baseMatches.length > 0 && baseMatches.join(",") !== targetMatches.join(",")) {
          const missing_ph = baseMatches.filter((m) => !targetMatches.includes(m));
          if (missing_ph.length > 0) {
            issues.critical.push({
              check: "Placeholder",
              locale: target,
              key,
              issue: `Missing: ${missing_ph.join(", ")}`,
            });
            placeholderMismatch++;
          }
        }
      }
    }

    stats[target] = {
      total: baseKeys.length,
      present: baseKeys.filter((k) => targetSet.has(k)).length,
      missing,
      extra,
      untranslated,
      placeholderMismatch,
    };
  }

  // --- Output Markdown Report ---
  const totalKeys = baseKeys.length;
  const totalTranslated = targets.reduce(
    (sum, t) => sum + (stats[t].present - stats[t].untranslated),
    0
  );
  const totalExpected = totalKeys * targets.length;
  const healthPct = totalExpected > 0 ? Math.round((totalTranslated / totalExpected) * 100) : 0;

  console.log("# i18n Audit Report\n");
  console.log("## Summary");
  console.log(`- **Base locale**: ${base} (${totalKeys} keys)`);
  console.log(`- **Target locales**: ${targets.join(", ")} (${targets.length})`);
  console.log(`- **Overall health**: ${healthPct}% (${totalTranslated}/${totalExpected})`);
  console.log(`- **Files checked**: ${Object.values(localeFiles).join(", ")}\n`);

  // Per-locale stats
  console.log("## Per-Locale Stats\n");
  console.log("| Locale | Present | Missing | Extra | Untranslated | Placeholder |");
  console.log("|--------|---------|---------|-------|-------------|-------------|");
  for (const t of targets) {
    const s = stats[t];
    console.log(
      `| ${t} | ${s.present}/${s.total} | ${s.missing} | ${s.extra} | ${s.untranslated} | ${s.placeholderMismatch} |`
    );
  }

  // Issues
  if (issues.critical.length > 0) {
    console.log("\n## Critical\n");
    console.log("| # | Check | Locale | Key | Issue |");
    console.log("|---|-------|--------|-----|-------|");
    issues.critical.forEach((i, idx) => {
      console.log(`| ${idx + 1} | ${i.check} | ${i.locale} | \`${i.key}\` | ${i.issue} |`);
    });
  }

  if (issues.warning.length > 0) {
    console.log("\n## Warning\n");
    console.log("| # | Check | Locale | Key | Issue |");
    console.log("|---|-------|--------|-----|-------|");
    issues.warning.forEach((i, idx) => {
      console.log(`| ${idx + 1} | ${i.check} | ${i.locale} | \`${i.key}\` | ${i.issue} |`);
    });
  }

  if (issues.info.length > 0) {
    console.log("\n## Info\n");
    console.log("| # | Check | Locale | Key | Issue |");
    console.log("|---|-------|--------|-----|-------|");
    issues.info.slice(0, 50).forEach((i, idx) => {
      console.log(`| ${idx + 1} | ${i.check} | ${i.locale} | \`${i.key}\` | ${i.issue} |`);
    });
    if (issues.info.length > 50) {
      console.log(`\n*...and ${issues.info.length - 50} more info items*`);
    }
  }

  if (issues.critical.length === 0 && issues.warning.length === 0 && issues.info.length === 0) {
    console.log("\n**All checks passed!** No issues found.");
  }

  // Exit code
  const exitCode = issues.critical.length > 0 ? 1 : 0;
  process.exit(exitCode);
}

main();
