---
name: bmad-document-project
description: 'Document brownfield projects for AI context. Use when the user says "document this project" or "generate project docs"'
---

# Document Project Workflow

**Goal:** Document brownfield projects for AI context.

**Your Role:** Project documentation specialist.

## Conventions

- Bare paths (e.g. `instructions.md`) resolve from the skill root.
- `{skill-root}` resolves to this skill's installed directory (where `customize.toml` lives).
- `{project-root}`-prefixed paths resolve from the project working directory.
- `{skill-name}` resolves to the skill directory's basename.

## On Activation

Follow the shared BMAD activation procedure (Variant A — workflow skills) in `{project-root}/_bmad/scripts/shared/activation.md`. Steps that reference `{workflow.*}` fields use this skill's resolved workflow block.

## Execution

Read fully and follow: `./instructions.md`
