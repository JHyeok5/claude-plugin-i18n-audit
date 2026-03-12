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
 * State files (.i18n-audit/):
 *   config.json   — Detected project config (locale path, base, targets)
 *   glossary.json — Terms intentionally identical across locales
 *   history.json  — Audit run history for delta tracking
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

// --- Project Root Detection ---
function findProjectRoot(startDir) {
  let dir = path.resolve(startDir);
  const root = path.parse(dir).root;
  while (dir !== root) {
    if (
      fs.existsSync(path.join(dir, "package.json")) ||
      fs.existsSync(path.join(dir, ".git"))
    ) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  // Fallback: parent of the locale directory
  return path.dirname(startDir);
}

// --- State Directory Management ---
function getStateDir(localeDir) {
  const projectRoot = findProjectRoot(path.resolve(localeDir));
  return path.join(projectRoot, ".i18n-audit");
}

function ensureStateDir(stateDir) {
  if (!fs.existsSync(stateDir)) {
    fs.mkdirSync(stateDir, { recursive: true });
  }
}

// --- Config System ---
function loadConfig(stateDir) {
  const configPath = path.join(stateDir, "config.json");
  if (fs.existsSync(configPath)) {
    try {
      return JSON.parse(fs.readFileSync(configPath, "utf-8"));
    } catch {
      return null;
    }
  }
  return null;
}

function saveConfig(stateDir, config) {
  ensureStateDir(stateDir);
  const configPath = path.join(stateDir, "config.json");
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

function detectNestingStyle(data) {
  const keys = Object.keys(data);
  if (keys.length === 0) return "flat";
  const hasDots = keys.some((k) => k.includes("."));
  return hasDots ? "dot.notation" : "flat";
}

function createConfig(localeDir, base, targets, keyCount, data) {
  return {
    detectedAt: new Date().toISOString(),
    localePath: localeDir,
    baseLocale: base,
    targetLocales: targets,
    fileFormat: "json",
    keyCount: keyCount,
    nestingStyle: detectNestingStyle(data),
  };
}

// --- Glossary System ---
function loadGlossary(stateDir) {
  const glossaryPath = path.join(stateDir, "glossary.json");
  if (fs.existsSync(glossaryPath)) {
    try {
      return JSON.parse(fs.readFileSync(glossaryPath, "utf-8"));
    } catch {
      return { terms: [], autoDetected: [] };
    }
  }
  return null;
}

function saveGlossary(stateDir, glossary) {
  ensureStateDir(stateDir);
  const glossaryPath = path.join(stateDir, "glossary.json");
  fs.writeFileSync(glossaryPath, JSON.stringify(glossary, null, 2) + "\n", "utf-8");
}

/**
 * Check if a value looks like it should be intentionally identical across locales.
 * Returns a reason string if it should be glossary-exempt, or null otherwise.
 */
function detectGlossaryCandidate(key, value) {
  const val = String(value);

  // Brand-like: PascalCase or all-caps single word
  if (/^[A-Z][a-zA-Z0-9]*$/.test(val) && val.length <= 30) {
    return "Brand name or proper noun";
  }

  // URLs
  if (/^https?:\/\//.test(val)) {
    return "URL";
  }

  // Very short strings (1-3 chars) — units, symbols
  if (val.length <= 3) {
    return "Short/universal string";
  }

  // All-caps constants
  if (/^[A-Z_]+$/.test(val)) {
    return "Constant";
  }

  // Email addresses
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
    return "Email address";
  }

  // Numeric or numeric with unit (e.g., "100m", "3.5km")
  if (/^\d+(\.\d+)?\s*[a-zA-Z]{0,5}$/.test(val) && val.length <= 10) {
    return "Numeric/unit value";
  }

  // Known universal terms
  const universalTerms = [
    "ok", "id", "url", "api", "sdk", "css", "html", "json", "xml",
    "gps", "wifi", "qr", "sns", "app", "web", "email", "km", "kg",
    "mb", "gb", "tb", "px", "em", "rem", "ios", "android",
  ];
  if (universalTerms.includes(val.toLowerCase())) {
    return "Universal technical term";
  }

  return null;
}

function isGlossaryExempt(glossary, key, value) {
  if (!glossary) return false;
  const val = String(value);

  // Check manually curated terms
  for (const term of glossary.terms) {
    if (term.key === key) return true;
    if (term.value === val) return true;
  }

  // Check auto-detected terms
  for (const term of glossary.autoDetected) {
    if (term.key === key) return true;
    if (term.value === val) return true;
  }

  return false;
}

// --- History System ---
function loadHistory(stateDir) {
  const historyPath = path.join(stateDir, "history.json");
  if (fs.existsSync(historyPath)) {
    try {
      return JSON.parse(fs.readFileSync(historyPath, "utf-8"));
    } catch {
      return { runs: [] };
    }
  }
  return null;
}

function saveHistory(stateDir, history) {
  ensureStateDir(stateDir);
  const historyPath = path.join(stateDir, "history.json");
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2) + "\n", "utf-8");
}

function createRunEntry(keyCount, totalMissing, totalExtra, totalUntranslated, totalPlaceholderMismatch) {
  return {
    timestamp: new Date().toISOString(),
    keyCount,
    missing: totalMissing,
    extra: totalExtra,
    untranslated: totalUntranslated,
    placeholderMismatch: totalPlaceholderMismatch,
  };
}

function formatDelta(current, previous) {
  if (!previous) return null;

  const fields = [
    { label: "Key count", cur: current.keyCount, prev: previous.keyCount },
    { label: "Missing keys", cur: current.missing, prev: previous.missing },
    { label: "Extra keys", cur: current.extra, prev: previous.extra },
    { label: "Untranslated", cur: current.untranslated, prev: previous.untranslated },
    { label: "Placeholder mismatches", cur: current.placeholderMismatch, prev: previous.placeholderMismatch },
  ];

  const lines = [];
  for (const f of fields) {
    const diff = f.cur - f.prev;
    let indicator;
    if (diff === 0) {
      indicator = "(no change)";
    } else if (f.label === "Key count") {
      // More keys is neutral, not good or bad
      indicator = diff > 0 ? `(+${diff})` : `(${diff})`;
    } else {
      // For issues, decrease is good, increase is bad
      indicator = diff < 0 ? `(${diff})` : `(+${diff})`;
    }
    lines.push(`- **${f.label}**: ${f.prev} -> ${f.cur} ${indicator}`);
  }

  return lines;
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

  // Resolve state directory from the first locale path
  const firstLocalePath = path.resolve(paths[0]);
  const localeDir = fs.statSync(firstLocalePath).isDirectory()
    ? firstLocalePath
    : path.dirname(firstLocalePath);
  const stateDir = getStateDir(localeDir);

  // Load existing config (if any)
  const existingConfig = loadConfig(stateDir);

  // Determine base locale
  // Priority: CLI flag > existing config > auto-detect
  let base;
  if (baseLang) {
    base = baseLang;
  } else if (existingConfig && existingConfig.baseLocale && localeFiles[existingConfig.baseLocale]) {
    base = existingConfig.baseLocale;
  } else {
    base = langs.includes("en") ? "en" : langs[0];
  }

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

  // --- State: Config ---
  const isFirstRun = !existingConfig;
  const config = createConfig(
    path.relative(findProjectRoot(localeDir), localeDir) || ".",
    base,
    targets,
    baseKeys.length,
    data[base]
  );

  // Save/update config
  saveConfig(stateDir, config);

  // --- State: Glossary ---
  let glossary = loadGlossary(stateDir);
  if (!glossary) {
    glossary = { terms: [], autoDetected: [] };
  }

  // Track newly auto-detected glossary candidates this run
  const newGlossaryCandidates = [];

  // --- Audit ---
  const issues = { critical: [], warning: [], info: [] };
  const stats = {};

  // Aggregate totals for history
  let totalMissing = 0;
  let totalExtra = 0;
  let totalUntranslated = 0;
  let totalPlaceholderMismatch = 0;

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
        // Check glossary before flagging
        if (isGlossaryExempt(glossary, key, baseVal)) {
          // Silently skip — glossary-exempt term
          continue;
        }

        // Check if this is a glossary candidate
        const candidateReason = detectGlossaryCandidate(key, baseVal);
        if (candidateReason) {
          // Auto-add to glossary and skip flagging
          const alreadyDetected = glossary.autoDetected.some(
            (t) => t.key === key && t.value === baseVal
          );
          if (!alreadyDetected) {
            const entry = { key, value: baseVal, reason: candidateReason };
            glossary.autoDetected.push(entry);
            newGlossaryCandidates.push(entry);
          }
          // Don't count as untranslated
          continue;
        }

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

    totalMissing += missing;
    totalExtra += extra;
    totalUntranslated += untranslated;
    totalPlaceholderMismatch += placeholderMismatch;
  }

  // --- State: Save glossary ---
  saveGlossary(stateDir, glossary);

  // --- State: History ---
  let history = loadHistory(stateDir);
  if (!history) {
    history = { runs: [] };
  }

  const currentRun = createRunEntry(
    baseKeys.length,
    totalMissing,
    totalExtra,
    totalUntranslated,
    totalPlaceholderMismatch
  );

  const previousRun = history.runs.length > 0 ? history.runs[history.runs.length - 1] : null;

  history.runs.push(currentRun);

  // Keep last 100 runs to avoid unbounded growth
  if (history.runs.length > 100) {
    history.runs = history.runs.slice(-100);
  }

  saveHistory(stateDir, history);

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
  console.log(`- **Files checked**: ${Object.values(localeFiles).join(", ")}`);
  console.log(`- **State dir**: ${stateDir}`);
  if (isFirstRun) {
    console.log(`- **First run**: config, glossary, and history initialized`);
  }
  console.log("");

  // Delta section (if we have a previous run)
  if (previousRun) {
    const prevDate = previousRun.timestamp.split("T")[0];
    const deltaLines = formatDelta(currentRun, previousRun);
    if (deltaLines) {
      console.log(`## Delta (vs ${prevDate})\n`);
      for (const line of deltaLines) {
        console.log(line);
      }
      console.log("");
    }
  }

  // Glossary auto-detection notice
  if (newGlossaryCandidates.length > 0) {
    console.log("## Glossary Auto-Detected\n");
    console.log(`Added ${newGlossaryCandidates.length} term(s) to glossary (excluded from untranslated check):\n`);
    console.log("| Key | Value | Reason |");
    console.log("|-----|-------|--------|");
    for (const c of newGlossaryCandidates.slice(0, 20)) {
      console.log(`| \`${c.key}\` | ${c.value} | ${c.reason} |`);
    }
    if (newGlossaryCandidates.length > 20) {
      console.log(`\n*...and ${newGlossaryCandidates.length - 20} more auto-detected terms*`);
    }
    console.log(`\nEdit \`${path.join(stateDir, "glossary.json")}\` to curate.\n`);
  }

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
