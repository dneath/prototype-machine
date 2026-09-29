import { defineConfig, type Options } from "tsup"

/* React is a peer, and jsx is compiled with the automatic runtime so the
   consumer does not need React in scope. */
const external = ["react", "react-dom", "react/jsx-runtime"]

const outExtension: Options["outExtension"] = ({ format }) => ({
  js: format === "cjs" ? ".cjs" : ".js",
})

/* The React entries import core from the built core entry instead of bundling
   their own copy, so CommonJS consumers get one ScenarioError class. */
const sharedCore: NonNullable<Options["esbuildPlugins"]>[number] = {
  name: "shared-core",
  setup(build) {
    const ext = build.initialOptions.outExtension?.[".js"] ?? ".js"
    build.onResolve({ filter: /\/core\/index$/ }, (args) =>
      args.importer.includes("/src/core/") ? undefined : { path: `./core/index${ext}`, external: true },
    )
  },
}

export default defineConfig([
  {
    entry: { "core/index": "src/core/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    sourcemap: true,
    treeshake: true,
    external,
    outExtension,
  },
  {
    entry: { index: "src/index.ts", production: "src/production.ts", panel: "src/panel.ts" },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
        splitting: false,
    external,
    outExtension,
    esbuildPlugins: [sharedCore],
    banner: { js: '"use client";' },
  },
])
