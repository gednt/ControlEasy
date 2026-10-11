---
name: playwright-validate
description: Validate front-end modifications in the Angular 18 SPA by driving a real browser via Playwright MCP tools. Use when the user wants visual regression checks, smoke-testing a UI change against the running dev stack, capturing before/after screenshots of a modified component, or verifying that a route renders without console errors. Not for backend or non-UI tasks.
version: 0.1.0
user-invocable: true
argument-hint: "[route-or-component-path] [optional: action]"
license: Apache 2.0
allowed-tools:
  - playwright_*
  - Bash(docker compose -p ce-* ps web)
  - Bash(docker compose -p ce-* logs --tail=20 web)
  - Bash(curl -sf http://localhost:*)
---

# Playwright Front-end Validation

Drive a real browser to validate that a UI change renders correctly,
exercises as expected, and emits no console errors. The skill prefers
**observation over imagination**: every claim about the UI is backed by
a snapshot, a screenshot, or a console-log capture, not by what the
code probably does.

## When to use

- After modifying a component, template, route, or shared style under
  `src/Web/ControlEasyReborn.Web/**` and you want to confirm the running
  app still renders without errors.
- Before declaring a UI task complete, to capture a screenshot that
  another reviewer can compare against `mockup/` references.
- When investigating a bug report that includes a route, error message,
  or visual symptom.
- After any Angular SPA edit, as required by the repository's
  `AGENTS.md` Playwright validation overlay.

## Pre-flight (idempotent, run once per session)

1. **Stack is up.** Verify the Angular SPA is reachable. Detect the
   per-worktree Compose project name from the current branch:
   ```bash
   BRANCH=$(git rev-parse --abbrev-ref HEAD)
   PROJECT="ce-${BRANCH//\//-}"
   curl -sf -o /dev/null -w "%{http_code}\n" "http://localhost:$((18080 + $(printf '%d' "'${PROJECT#*-}") % 10 * 10))/"
   ```
   If not 2xx/3xx, bring up the worktree stack:
   ```bash
   docker compose -p "$PROJECT" -f docker/docker-compose.yml -f docker/docker-compose.worktree.yml up -d --build web
   ```
   Project naming follows the `ce-<branch-hyphens>` convention; see
   `AGENTS.WORKTREES.md` for the full table.
2. **Auth fixture.** If the route is protected, log in via the auth
   endpoint or seed an admin session token. Never paste real-user
   credentials into a script — use the synthetic test fixture at
   `tests/a11y/fixtures/auth.ts`.

## Validation loop

For each route or interaction under test:

1. **Navigate** to the route with `browser_navigate`. Use the
   worktree-local URL (`http://localhost/` for the default stack, or
   `http://localhost:<host-port>/` when the worktree uses a non-default
   port — see `AGENTS.WORKTREES.md`).
2. **Wait** for the page to settle (`browser_wait_for` on a known
   heading text, network idle, or 2 s for static routes).
3. **Snapshot** the accessibility tree (`browser_snapshot`). This is the
   authoritative structural check: confirm the expected headings, ARIA
   labels, and landmark roles are present.
4. **Console** check (`browser_console_messages` at `level=error`). Zero
   new errors is the success criterion; surface warnings separately.
5. **Screenshot** (`browser_take_screenshot fullPage=true`). Save to
   `tests/visual/snapshots/<route>-<yyyymmdd-hhmmss>.png` for the
   reviewer and for future regression diffs.
6. **Interact** (when the task is a flow, not a single page): use
   `browser_click`, `browser_type`, `browser_fill_form`,
   `browser_select_option` to drive the user path. Re-snapshot and
   re-check console after each step.

## Output format

A validation pass returns one of:

- **PASS** — page renders, no console errors, snapshot matches
  expected structure, screenshot captured. Cite the screenshot path.
- **FAIL (render)** — snapshot diverges from expected headings,
  landmarks, or ARIA. Quote the diff.
- **FAIL (console)** — `browser_console_messages` returns ≥ 1 new
  error. Quote the error and the URL where it appeared.
- **FAIL (interaction)** — the user path does not reach the expected
  next state. Quote the step where it stalled.

The auto-invoke plugin only emits FAIL cases — passes are silent so
the agent does not interrupt normal work.

## Stop conditions

- **Stack down.** If `docker compose -p "$PROJECT" ps web` is not
  `running`, abort and tell the user to bring up the worktree stack
  rather than guessing.
- **Auth required but no fixture.** Abort; do not attempt live login.
- **Three failures in a row on the same route.** Stop; the issue is
  upstream of the touched file, escalate to the user.

## Boundaries

This skill does not replace unit tests, integration tests, or
accessibility audits. It is a **smoke test** for "does this still work
in a real browser" — fast to run, cheap to ignore, and the only
verification that catches a class of bugs (hydration mismatches,
route-resolution regressions, CSS scoping leaks, third-party-script
failures) that the other layers miss.

It is **not** a substitute for the visual-regression tests under
`tests/visual/`; it complements them by giving the agent eyes during
development.
