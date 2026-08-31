import { fileURLToPath, URL } from "node:url"

import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

/* Aliased to the source rather than the built package, so editing the library
   hot-reloads here. Publishing is verified separately with `npm pack`. */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "prototype-machine": fileURLToPath(new URL("../src/index.ts", import.meta.url)),
    },
  },
  server: { port: 5199 },
})
