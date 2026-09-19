import type { Plugin } from "@opencode-ai/plugin";

/**
 * OpenCode plugin that enforces the mandatory local CI verification gate.
 * Listens on session.idle to verify that any code changes pass all local
 * CI jobs before the agent becomes idle.
 *
 * The shared Node entry point selects the platform-specific implementation.
 * Keeping that decision in one place prevents agent manifests from invoking
 * POSIX-only scripts on Windows hosts.
 */
export const VerifyCiPlugin: Plugin = async ({ $ }) => {
  return {
    event: async ({ event }) => {
      if (event.type === "session.idle") {
        try {
          await $`node scripts/hooks/verify-ci-agent-stop.cjs`;
        } catch (err: unknown) {
          console.error("Local CI verification gate failed on session.idle:", err);
        }
      }
    },
  };
};

export default VerifyCiPlugin;
