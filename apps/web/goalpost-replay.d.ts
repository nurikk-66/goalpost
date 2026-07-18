// apps/replay ships plain JS with no type declarations (its own tsup dts
// build crashes under this workspace's TypeScript version - see
// apps/replay/tsup.config.ts). Minimal ambient declaration for the one
// export instrumentation-node.ts actually uses.
declare module "@goalpost/replay" {
  export function startServer(file: string, speed: number, port: number): void;
}
