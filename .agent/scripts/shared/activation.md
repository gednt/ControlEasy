# BMAD Skill Activation (shared procedure)

Shared activation procedure for all BMAD skills. Replaces the previously inlined
"On Activation" boilerplate in each skill. Read this file once per skill run and
apply the variant below.

## Conventions (applies to all BMAD skills)

- Bare paths resolve from the skill root.
- `{skill-root}` resolves to the skill's installed directory (where `customize.toml` lives).
- `{project-root}`-prefixed paths resolve from the project working directory.
- `{skill-name}` resolves to the skill directory's basename.

## Variant A — Workflow skills

Standard activation for skills whose customization key is `workflow`:

1. **Resolve the Workflow Block.**
   Run: `python3 {project-root}/_bmad/scripts/resolve_customization.py --skill {skill-root} --key workflow`
   **If the script fails**, resolve the `workflow` block yourself by reading these three files in base → team → user order and applying the same structural merge rules as the resolver:
   1. `{skill-root}/customize.toml` — defaults
   2. `{project-root}/_bmad/custom/{skill-name}.toml` — team overrides
   3. `{project-root}/_bmad/custom/{skill-name}.user.toml` — personal overrides

   Any missing file is skipped. Scalars override, tables deep-merge, arrays of tables keyed by `code` or `id` replace matching entries and append new entries, and all other arrays append.

2. **Execute Prepend Steps.** Execute each entry in `{workflow.activation_steps_prepend}` in order before proceeding.

3. **Load Persistent Facts.** Treat every entry in `{workflow.persistent_facts}` as foundational context you carry for the rest of the workflow run. Entries prefixed `file:` are paths or globs under `{project-root}` — load the referenced contents as facts. All other entries are facts verbatim.

4. **Load Config.** Load config from `{project-root}/_bmad/bmm/config.yaml` and resolve the config fields the skill lists (typically `project_name`, `user_name`, `communication_language`, `document_output_language`, `user_skill_level`, `planning_artifacts`, `implementation_artifacts`, `date`). Missing keys → neutral defaults; never block.

5. **Greet the User.** Greet `{user_name}`, speaking in `{communication_language}`.

6. **Execute Append Steps.** Execute each entry in `{workflow.activation_steps_append}` in order.

Activation is complete once all six entries are done. If `activation_steps_prepend` or `activation_steps_append` were non-empty, confirm every entry was executed in order before proceeding. Do not begin the main workflow until activation completes.

## Variant B — Agent-persona skills

Standard activation for agent skills whose customization key is `agent`. Same as
Variant A steps 1–4 (with `agent` as the block key instead of `workflow`), then:

5. **Adopt Persona.** Adopt the identity established in the skill's Overview. Layer the customized persona on top: fill the additional role of `{agent.role}`, embody `{agent.identity}`, speak in the style of `{agent.communication_style}`, and follow `{agent.principles}`. Do not break character until the user dismisses the persona. When the user calls a skill, this persona carries through.

6. **Greet the User.** Greet `{user_name}` warmly by name in persona, speaking in `{communication_language}`. Lead the greeting with `{agent.icon}` so the user can see at a glance which agent is speaking. Remind the user they can invoke `bmad-help` at any time for advice. Continue to prefix messages with `{agent.icon}` throughout the session.

7. **Load Persistent Facts** (if not already loaded in step 3). Treat every entry in `{agent.persistent_facts}` as foundational context you carry for the rest of the session. Entries prefixed `file:` are paths or globs under `{project-root}` — load the referenced contents as facts. All other entries are facts verbatim.

8. **Dispatch or Present the Menu.** If the user's initial message already names an intent that clearly maps to a menu item, skip the menu and dispatch that item directly after greeting. Otherwise render `{agent.menu}` as a numbered table (`Code`, `Description`, `Action`) and **stop and wait for input**. Accept a number, menu `code`, or fuzzy description match. Dispatch on a clear match by invoking the item's `skill` or executing its `prompt`. When nothing on the menu fits, just continue the conversation; chat, clarifying questions, and `bmad-help` are always fair game.

From here the persona stays active — persona, persistent facts, `{agent.icon}` prefix, and `{communication_language}` carry into every turn until the user dismisses it.

## Activation-completion clause (both variants)

Activation is complete. If `activation_steps_prepend` or `activation_steps_append` were non-empty, confirm every entry was executed in order before proceeding. Do not begin the main workflow until all activation steps have been completed.