---
failed_layers: '' # set at runtime: comma-separated list of layers that failed or returned empty
---

# Step 2: Review

## RULES

- YOU MUST ALWAYS SPEAK OUTPUT in your Agent communication style with the config `{communication_language}`
- Review layers are **cross-CLI** (per `SUBAGENTS.md` Rule 6 / constitution "Adversarial review gate"): each layer runs in a fresh session of an AI **other than the one that authored the change**, dispatched through the sibling CLI when possible.
- All review subagents must run at the same model capability as the current session. The cross-CLI fallback overrides the model-family part of this when needed to keep the reviewer on a different model family than the authoring model — capability never below the session's class.

## INSTRUCTIONS

1. If `{review_mode}` = `"no-spec"`, note to the user: "Acceptance Auditor skipped — no spec file provided."

2. Launch Blind Hunter and Edge Case Hunter in parallel, each in a **fresh review session with no prior conversation context** (the reviewer inherits nothing from the authoring session). If `{review_mode}` = `"full"`, include the Acceptance Auditor in the same parallel launch.

   **Cross-CLI dispatch (preferred).** Route each layer through the sibling CLI:
   - Running in **OpenCode** → write the layer prompt (below) to `{implementation_artifacts}/prompt-{layer}.md` and run it through the Codex CLI: `codex exec --sandbox read-only "<layer prompt>"`
   - Running in **Codex** → run it through the OpenCode CLI: `opencode run "<layer prompt>"`
   - On any other harness → prefer whichever sibling CLI is available (same commands); dispatch all layers in parallel and capture each CLI's findings to `{implementation_artifacts}/review-{layer}.md`.

   **Fallback.** If no sibling CLI is available, or a layer invocation fails, times out, or returns empty, launch that layer as an in-harness subagent (prompts below) on a **model family different from the authoring model's**, and record `adversarial review degraded to in-harness subagent — sibling CLI unavailable/failed (<layer>)` for the step 4 presentation.

   **No subagents either.** Generate the layer prompt files and HALT. Ask the user to run each in a separate session (ideally a different LLM) and paste back the findings. When findings are pasted, resume from this point and proceed to step 3.

   - **Blind Hunter** — prompt (external CLIs cannot resolve harness skill names by reference, so the prompt carries the skill file path explicitly):
     > First read `{project-root}/.claude/skills/bmad-review-adversarial-general/SKILL.md` and follow it as your review protocol. Review this diff:
     >
     > {diff_output}

   - **Edge Case Hunter** — prompt (same — carried path):
     > First read `{project-root}/.claude/skills/bmad-review-edge-case-hunter/SKILL.md` and follow it as your review protocol. Review this diff:
     >
     > {diff_output}

   - **Acceptance Auditor** (only if `{review_mode}` = `"full"`) — prompt:
     > You are an Acceptance Auditor. Review the provided diff against `{spec_file}` and any loaded context docs. Check for: violations of acceptance criteria, deviations from spec intent, missing implementation of specified behavior, contradictions between spec constraints and actual code. Output findings as a Markdown list. Each finding: one-line title, which AC/constraint it violates, and evidence from the diff.
     >
     > Diff:
     > {diff_output}

3. **Subagent failure handling**: If any subagent fails, times out, or returns empty results, append the layer name to `{failed_layers}` (comma-separated) and proceed with findings from the remaining layers.

4. Collect all findings from the completed layers.


## NEXT

Read fully and follow `./step-03-triage.md`
