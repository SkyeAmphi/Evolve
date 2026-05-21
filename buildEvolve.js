const vue = require("esbuild-plugin-vue3");

require("esbuild")
  .build({
    logLevel: "info",
    entryPoints: ["./src/main.js"],
    bundle: true,
    minify: true,
    outfile: "evolve/main.js",
    alias: { vue: "./src/vue-cdn-shim.js" },
    define: { "import.meta.env.BASE_URL": '""' },
    loader: { ".less": "empty" },
    plugins: [vue()],
  })
  .catch(() => process.exit(1));
