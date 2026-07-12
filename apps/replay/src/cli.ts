import path from "node:path";
import { record } from "./record.js";
import { startServer } from "./server.js";

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      out[key] = value;
    }
  }
  return out;
}

async function main() {
  const [, , maybeCommand, ...rest] = process.argv;

  if (maybeCommand === "record") {
    const args = parseArgs(rest);
    const fixtureId = Number(args.fixtureId);
    const outFile = args.out ? path.resolve(args.out) : path.resolve("samples/match1.jsonl");
    if (!fixtureId) {
      console.error("Usage: pnpm --filter @goalpost/replay run record -- --fixtureId <id> [--out samples/match1.jsonl]");
      process.exit(1);
    }
    await record(fixtureId, outFile);
    return;
  }

  // Default: serve. Accepts either "pnpm replay --file X --speed Y" or
  // "pnpm replay serve --file X --speed Y".
  const args = parseArgs(maybeCommand === "serve" ? rest : process.argv.slice(2));
  const file = args.file ? path.resolve(args.file) : path.resolve("samples/match1.jsonl");
  const speed = args.speed ? Number(args.speed) : 1;
  const port = args.port ? Number(args.port) : 4001;

  startServer(file, speed, port);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
