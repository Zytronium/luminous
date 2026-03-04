import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["electron/main.ts", "electron/preload.ts"],
  outDir: "build",
  format: ["cjs"],
  splitting: false,
  sourcemap: false,
  clean: true,
  external: ["electron"],
  noExternal: ["get-port-please", "@electron-toolkit/utils"],
});
