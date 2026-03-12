#!/usr/bin/env bash
# locale-check-hook.sh — PostToolUse hook for Write|Edit
# Reads JSON from stdin, checks if the edited file is a locale file,
# and runs a quick consistency check against sibling locale files.
# Always exits 0 (warn but don't block).

set -euo pipefail

# Read the tool use JSON from stdin
INPUT=$(cat)

# Extract file_path from the JSON input
# Try common JSON shapes: .file_path, .input.file_path, .tool_input.file_path
FILE_PATH=""
for field in ".file_path" ".input.file_path" ".tool_input.file_path"; do
  if command -v jq &>/dev/null; then
    CANDIDATE=$(echo "$INPUT" | jq -r "$field // empty" 2>/dev/null || true)
  else
    # Fallback: basic grep extraction for file_path
    CANDIDATE=$(echo "$INPUT" | grep -oP '"file_path"\s*:\s*"([^"]+)"' | head -1 | sed 's/.*"file_path"\s*:\s*"//;s/"$//' || true)
  fi
  if [[ -n "$CANDIDATE" ]]; then
    FILE_PATH="$CANDIDATE"
    break
  fi
done

# If we couldn't extract a file path, exit silently
if [[ -z "$FILE_PATH" ]]; then
  exit 0
fi

# Check if the file matches common locale paths
# Patterns: */locales/*.json, */i18n/*.json, */lang/*.json, */messages/*.json, */translations/*.json
LOCALE_DIR_PATTERN="/(locales|i18n|lang|messages|translations)/"
if ! echo "$FILE_PATH" | grep -qP "$LOCALE_DIR_PATTERN"; then
  exit 0
fi

# Only process .json files
if [[ "$FILE_PATH" != *.json ]]; then
  exit 0
fi

# Check that the file exists
if [[ ! -f "$FILE_PATH" ]]; then
  exit 0
fi

# Get the directory containing the locale file
LOCALE_DIR=$(dirname "$FILE_PATH")

# Count sibling JSON files
SIBLING_COUNT=$(find "$LOCALE_DIR" -maxdepth 1 -name "*.json" -type f 2>/dev/null | wc -l)
if [[ "$SIBLING_COUNT" -lt 2 ]]; then
  exit 0
fi

# Locate the i18n-check.js script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHECK_SCRIPT="$SCRIPT_DIR/i18n-check.js"

if [[ ! -f "$CHECK_SCRIPT" ]]; then
  # Try CLAUDE_PLUGIN_ROOT
  if [[ -n "${CLAUDE_PLUGIN_ROOT:-}" && -f "$CLAUDE_PLUGIN_ROOT/scripts/i18n-check.js" ]]; then
    CHECK_SCRIPT="$CLAUDE_PLUGIN_ROOT/scripts/i18n-check.js"
  else
    exit 0
  fi
fi

# Check that node is available
if ! command -v node &>/dev/null; then
  echo "[i18n-audit] Warning: node not found, skipping locale check" >&2
  exit 0
fi

# --- Read base locale from .i18n-audit/config.json ---
BASE_FLAG=""

# Walk up from the locale file's directory to find .i18n-audit/config.json
find_config() {
  local dir="$1"
  local root
  root=$(stat -c '%m' "$dir" 2>/dev/null || echo "/")
  while [[ "$dir" != "/" && "$dir" != "$root" ]]; do
    if [[ -f "$dir/.i18n-audit/config.json" ]]; then
      echo "$dir/.i18n-audit/config.json"
      return 0
    fi
    dir=$(dirname "$dir")
  done
  return 1
}

CONFIG_FILE=$(find_config "$LOCALE_DIR") || true

if [[ -n "$CONFIG_FILE" && -f "$CONFIG_FILE" ]]; then
  if command -v jq &>/dev/null; then
    BASE_LOCALE=$(jq -r '.baseLocale // empty' "$CONFIG_FILE" 2>/dev/null || true)
  else
    # Fallback: grep extraction
    BASE_LOCALE=$(grep -oP '"baseLocale"\s*:\s*"([^"]+)"' "$CONFIG_FILE" | head -1 | sed 's/.*"baseLocale"\s*:\s*"//;s/"$//' || true)
  fi
  if [[ -n "$BASE_LOCALE" ]]; then
    BASE_FLAG="--base=$BASE_LOCALE"
  fi
fi

# Run the check and capture output
EDITED_BASENAME=$(basename "$FILE_PATH" .json)
OUTPUT=$(node "$CHECK_SCRIPT" "$LOCALE_DIR" $BASE_FLAG 2>&1) || true

# Check for critical issues in the output
if echo "$OUTPUT" | grep -q "## Critical"; then
  echo "" >&2
  echo "[i18n-audit] Locale file changed: $FILE_PATH" >&2
  echo "[i18n-audit] Critical issues detected in $LOCALE_DIR:" >&2
  # Extract just the critical section (up to next ## or end)
  echo "$OUTPUT" | sed -n '/## Critical/,/^## [^C]/p' | head -20 >&2
  echo "" >&2
  echo "[i18n-audit] Run 'node scripts/i18n-check.js $LOCALE_DIR' for full report." >&2
fi

exit 0
