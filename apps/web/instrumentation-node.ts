// Split out from instrumentation.ts: Next.js also compiles that file for a
// non-Node target, which fails on any top-level `node:`-scheme import (even
// just `node:path`) with UnhandledSchemeError. Keeping all Node-only code
// behind the dynamic `await import("./instrumentation-node")` in
// instrumentation.ts's nodejs-only branch means that target never has to
// resolve this file at all.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "@goalpost/replay";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const replayFile = path.join(repoRoot, "apps", "replay", "samples", "match1.jsonl");
const port = Number(process.env.REPLAY_PORT ?? 4001);

try {
  startServer(replayFile, 60, port);
  console.log(`[web] replay simulator started in-process on http://localhost:${port}`);
} catch (e: any) {
  // Next dev's HMR can re-run register() on some reloads - a port already
  // in use from our own prior start is expected and harmless, anything
  // else is worth seeing.
  if (e?.code === "EADDRINUSE") {
    console.log(`[web] replay simulator already running on port ${port}`);
  } else {
    console.error("[web] failed to start replay simulator:", e);
  }
}
