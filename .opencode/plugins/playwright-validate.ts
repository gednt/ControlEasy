import type { Plugin } from "@opencode-ai/plugin"
import * as path from "node:path"

/**
 * playwright-validate — auto-invoke the Playwright front-end validation
 * skill after any file under src/Web/ControlEasyReborn.Web/** is touched.
 *
 * Enforcement model: this plugin is a *prompt-injection* layer, NOT a
 * hard CI gate. It surfaces the validation request to the agent (via a
 * TUI prompt-injection) and to the human (via a toast). The agent is
 * expected to comply; the human reviewer sees the toast and can follow
 * up if the agent skips. Do NOT use this as a substitute for the
 * verify-ci Stop hook (which is mandatory per AGENTS.POLICY.md).
 *
 * Re-arming: the plugin arms a per-session buffer of recently-touched
 * web paths. On every `session.idle` event the buffer is drained into
 * a single combined prompt. That keeps the auto-invoke from spamming
 * the agent during a multi-file edit. If dispatch fails, the paths are
 * pushed back into the buffer for retry on the next idle.
 *
 * See .opencode/skills/playwright-validate/SKILL.md for the validation
 * loop the agent runs once it picks the prompt up.
 */

type ArgsWithPath = {
  filePath?: string
  path?: string
  target?: string
  file?: string
}

type PluginContext = {
  client: any
  directory: string
  worktree?: string
}

const WEB_RE =
  /(?:^|[\\/])src[\\/]web[\\/]controleasyreborn\.web[\\/]/i

const isWebPath = (resolved: string | undefined): boolean =>
  typeof resolved === "string" && WEB_RE.test(resolved)

const resolvePath = (candidate: string, ctx: PluginContext): string => {
  if (path.isAbsolute(candidate)) return candidate
  return path.resolve(ctx.worktree ?? ctx.directory, candidate)
}

export const PlaywrightValidatePlugin = async (
  ctx: PluginContext,
): Promise<Plugin> => {
  const touchedWebPaths: string[] = []

  const drain = (): string[] => touchedWebPaths.splice(0, touchedWebPaths.length)

  const restore = (paths: string[]): void => {
    touchedWebPaths.unshift(...paths)
  }

  return {
    "tool.execute.after": async (input: any, output?: any) => {
      const toolName: string = input?.tool ?? ""
      if (toolName !== "edit" && toolName !== "write") return

      const args: ArgsWithPath =
        (output?.args as ArgsWithPath | undefined) ??
        (input?.args as ArgsWithPath | undefined) ??
        {}
      const raw =
        args.filePath ?? args.path ?? args.target ?? args.file ?? ""
      if (!raw) return

      const candidate = resolvePath(raw, ctx)
      if (!isWebPath(candidate)) return

      touchedWebPaths.push(candidate)

      await ctx.client.app.log({
        body: {
          service: "playwright-validate",
          level: "info",
          message: `web file touched: ${candidate}`,
        },
      })
    },

    "session.idle": async () => {
      if (touchedWebPaths.length === 0) return

      const paths = drain()
      const fileList = paths.map((p) => `- \`${p}\``).join("\n")
      const reminder = [
        "",
        "<system-reminder>",
        "Front-end files changed since the previous agent turn:",
        fileList,
        "",
        "Run the `playwright-validate` skill against the affected",
        "route(s) before claiming the task done. Smoke-test the page,",
        "capture a screenshot, and report any console errors.",
        "</system-reminder>",
      ].join("\n")

      try {
        await ctx.client.tui.showToast({
          body: {
            message: `Validating ${paths.length} front-end change(s)…`,
            variant: "info",
          },
        })
        await ctx.client.tui.appendPrompt({ body: { text: reminder } })
        await ctx.client.app.log({
          body: {
            service: "playwright-validate",
            level: "info",
            message: `queued validation for ${paths.length} web file(s)`,
            extra: { paths },
          },
        })
      } catch (err) {
        restore(paths)
        await ctx.client.app.log({
          body: {
            service: "playwright-validate",
            level: "warn",
            message: `failed to dispatch validation: ${String(err)}`,
            extra: { restoredCount: paths.length },
          },
        })
      }
    },
  }
}
