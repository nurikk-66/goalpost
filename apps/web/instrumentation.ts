// Starts apps/replay's SSE server in-process when the Next.js server boots,
// so the whole demo runs from one command (`pnpm --filter @goalpost/web dev`)
// instead of needing a second terminal for the replay simulator. Reuses the
// exact `startServer()` function examples/quickstart.ts already validated
// works in-process (see MASTER_PLAN.md Phase 3/4 notes).
//
// All Node-specific code lives in instrumentation-node.ts, reached only
// through this dynamic import inside the nodejs-only branch - Next.js
// compiles this file for other runtimes too, which choke on `node:`-scheme
// imports if they appear here directly.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
