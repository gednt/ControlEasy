#!/usr/bin/env bash
# shellcheck shell=bash
#
# scripts/hooks/verify-ci-agent-stop.sh — Agent Stop lifecycle hook.
# Enforces the mandatory local CI verification gate across Antigravity, Claude Code,
# Codex, and Cursor agents.
#
# When an agent attempts to stop or mark a task done:
# 1. Checks if code changes exist (working tree dirty or branch ahead of origin/main).
# 2. If no modifications exist (read-only inspection), allows stop immediately: {}.
# 3. If modifications exist:
#    - Checks if the current state matches $(git rev-parse --git-dir)/ci-local-passed.stamp.
#    - If not verified, runs `scripts/verify-ci-local.sh`.
#    - If verification fails, blocks termination with decision="continue" and failure explanation.

set -uo pipefail

SCRIPT_DIR="$(CDPATH= cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(CDPATH= cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

GIT_DIR="$(git rev-parse --absolute-git-dir 2>/dev/null || echo "$REPO_ROOT/.git")"
STAMP_FILE="$GIT_DIR/ci-local-passed.stamp"
FAST_STAMP_FILE="$GIT_DIR/ci-local-fast-passed.stamp"

# Consume stdin if present (JSON payload from Antigravity/Codex/Claude hook runner)
INPUT_JSON=""
if [ ! -t 0 ]; then
  INPUT_JSON="$(cat || true)"
fi

# Prevent infinite recursion if stop hook was already triggered
if echo "$INPUT_JSON" | grep -q '"stop_hook_active":\s*true'; then
  printf '{}\n'
  exit 0
fi

# Check if there are any working tree changes (staged or unstaged or untracked code)
IS_DIRTY=false
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  IS_DIRTY=true
fi

# Check if branch has commits ahead of main / base reference
IS_AHEAD=false
BASE_REF=""
if git rev-parse --verify "origin/main" >/dev/null 2>&1; then
  BASE_REF="origin/main"
elif git rev-parse --verify "main" >/dev/null 2>&1; then
  BASE_REF="main"
elif git rev-parse --verify "origin/HEAD" >/dev/null 2>&1; then
  BASE_REF="origin/HEAD"
fi

if [ -n "$BASE_REF" ]; then
  COMMITS_AHEAD="$(git rev-list "$BASE_REF..HEAD" --count 2>/dev/null || echo "0")"
  if [ "$COMMITS_AHEAD" -gt 0 ]; then
    IS_AHEAD=true
  fi
else
  # Offline or standalone repo: check if HEAD exists
  if git rev-parse --verify HEAD >/dev/null 2>&1; then
    IS_AHEAD=true
  fi
fi

compute_sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 | awk '{print $1}'
  elif command -v python3 >/dev/null 2>&1; then
    python3 -c "import hashlib, sys; print(hashlib.sha256(sys.stdin.buffer.read()).hexdigest())"
  else
    git hash-object --stdin
  fi
}

is_task_completion_indicated() {
  if [ "${CE_TASK_COMPLETE:-}" = "true" ] || [ "${FULL_CI:-}" = "true" ]; then
    return 0
  fi
  local task_files
  task_files="$( { git diff --name-only HEAD 2>/dev/null; git status --porcelain=v1 -uall 2>/dev/null | awk '{print $2}'; } | grep -E '(tasks\.md|\.specs/.*tasks.*\.md)' | sort -u || true )"
  [ -z "$task_files" ] && return 1

  local found_task=false
  for tf in $task_files; do
    if [ -f "$tf" ]; then
      if grep -q -E '^- \[[xX]\]' "$tf"; then
        found_task=true
        if grep -q '^- \[ \]' "$tf"; then
          return 1
        fi
      fi
    fi
  done
  [ "$found_task" = true ]
}

# If repository has zero modifications and zero branch commits ahead, allow stop immediately.
if [ "$IS_DIRTY" = false ] && [ "$IS_AHEAD" = false ]; then
  printf '{}\n'
  exit 0
fi

# Compute fingerprint of current code state
HEAD_SHA="$(git rev-parse HEAD 2>/dev/null || echo "none")"
DIFF_HASH="$(git diff HEAD 2>/dev/null | compute_sha256)"
STATUS_HASH="$(git status --porcelain=v1 -uall 2>/dev/null | compute_sha256)"
EXPECTED_PREFIX="${HEAD_SHA}:${DIFF_HASH}:${STATUS_HASH}"

VERIFY_OUTPUT=""
VERIFY_EXIT_CODE=0

if [ "$IS_DIRTY" = true ]; then
  if is_task_completion_indicated; then
    # -------------------------------------------------------------------------
    # All tasks are marked completed or task completion requested:
    # Full CI verification gate (including Docker & Testcontainers) is required!
    # -------------------------------------------------------------------------
    if [ -f "$STAMP_FILE" ] && head -n 1 "$STAMP_FILE" 2>/dev/null | grep -q "^${EXPECTED_PREFIX}"; then
      printf '{}\n'
      exit 0
    fi

    VERIFY_OUTPUT="$("$REPO_ROOT/scripts/verify-ci-local.sh" 2>&1)" || VERIFY_EXIT_CODE=$?
    if [ "$VERIFY_EXIT_CODE" -eq 0 ]; then
      printf '{}\n'
      exit 0
    fi
  else
    # -------------------------------------------------------------------------
    # Active editing / intermediate turn:
    # Fast checks only (format, build, unit + arch tests).
    # Zero Docker downloads, zero containers!
    # -------------------------------------------------------------------------
    if [ -f "$FAST_STAMP_FILE" ] && head -n 1 "$FAST_STAMP_FILE" 2>/dev/null | grep -q "^${EXPECTED_PREFIX}"; then
      printf '{}\n'
      exit 0
    fi
    if [ -f "$STAMP_FILE" ] && head -n 1 "$STAMP_FILE" 2>/dev/null | grep -q "^${EXPECTED_PREFIX}"; then
      printf '{}\n'
      exit 0
    fi

    VERIFY_OUTPUT="$("$REPO_ROOT/scripts/verify-ci-local.sh" --fast 2>&1)" || VERIFY_EXIT_CODE=$?
    if [ "$VERIFY_EXIT_CODE" -eq 0 ]; then
      printf '{}\n'
      exit 0
    fi
  fi
else
  # -------------------------------------------------------------------------
  # Working tree is clean but branch is ahead of main (commits exist).
  # Task completion / end of all tasks completion:
  # Must verify that full CI gate passed (including Docker web build & Testcontainers).
  # -------------------------------------------------------------------------
  if [ -f "$STAMP_FILE" ]; then
    STAMP_CONTENT="$(head -n 1 "$STAMP_FILE" 2>/dev/null || true)"
    case "$STAMP_CONTENT" in
      "${EXPECTED_PREFIX}"*)
        printf '{}\n'
        exit 0
        ;;
    esac

    # Check for commit rollover: was the committed diff verified in a full CI pass before commit?
    IFS=':' read -r STAMP_HEAD STAMP_DIFF STAMP_STATUS _ <<< "$STAMP_CONTENT"
    if [ -n "$STAMP_HEAD" ] && [ "$STAMP_HEAD" != "none" ] && [ -n "$STAMP_DIFF" ]; then
      if git merge-base --is-ancestor "$STAMP_HEAD" HEAD 2>/dev/null; then
        COMMITTED_DIFF_HASH="$(git diff "$STAMP_HEAD..HEAD" 2>/dev/null | compute_sha256)"
        if [ "$COMMITTED_DIFF_HASH" = "$STAMP_DIFF" ]; then
          # The entire diff in HEAD was already verified in the full CI pass.
          # Roll over the stamp to HEAD so slow Docker checks do not re-run.
          NEW_TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
          printf '%s:%s:%s:%s\n' "$HEAD_SHA" "$DIFF_HASH" "$STATUS_HASH" "$NEW_TIMESTAMP" > "$STAMP_FILE"
          printf '%s:%s:%s:%s\n' "$HEAD_SHA" "$DIFF_HASH" "$STATUS_HASH" "$NEW_TIMESTAMP" > "$FAST_STAMP_FILE"
          printf '{}\n'
          exit 0
        fi
      fi
    fi
  fi

  # Run full CI verification gate once per task completion / at the end of all tasks completions
  VERIFY_OUTPUT="$("$REPO_ROOT/scripts/verify-ci-local.sh" 2>&1)" || VERIFY_EXIT_CODE=$?
  if [ "$VERIFY_EXIT_CODE" -eq 0 ]; then
    printf '{}\n'
    exit 0
  fi
fi

# Verification failed: block agent from stopping and return reason
ESCAPED_OUTPUT="$(printf '%s' "$VERIFY_OUTPUT" | tail -n 25 | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | tr '\n' ' ')"
REASON="MANDATORY LOCAL CI GATE FAILED: You have modifications or commits on this branch, but the local CI verification jobs (dotnet format, build, unit + arch + integration tests, web build, or OpenAPI drift check) failed. Per project rules, an agent MUST NOT consider any modification done until all local CI jobs pass. Please fix the following errors and re-run scripts/verify-ci-local.sh before finishing: ${ESCAPED_OUTPUT}"

# Check whether caller is Antigravity (uses camelCase terminationReason / artifactDirectoryPath)
# Antigravity Stop contract: { "decision": "continue", "reason": "..." } with exit 0 to re-enter loop.
# Claude Code / generic agent contract: { "decision": "block", "reason": "..." } with exit 2.
if echo "$INPUT_JSON" | grep -q -E '"(terminationReason|artifactDirectoryPath)"'; then
  cat <<EOF
{
  "decision": "continue",
  "reason": "${REASON}"
}
EOF
  exit 0
else
  cat <<EOF
{
  "decision": "block",
  "reason": "${REASON}"
}
EOF
  exit 2
fi
