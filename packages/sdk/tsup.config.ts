import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  // The generated IDL is imported as JSON (resolveJsonModule) - tsup/esbuild
  // inlines it into the bundle by default, which is what we want (no extra
  // file for consumers to resolve at runtime).
});
