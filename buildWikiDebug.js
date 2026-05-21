const vue = require("esbuild-plugin-vue3");

require("esbuild")
  .build({
    logLevel: "debug",
    entryPoints: ["./src/wiki/wiki.js"],
    bundle: true,
    minify: false,
    sourcemap: true,
    outfile: "wiki/wiki.js",
    alias: { vue: "./src/vue-cdn-shim.js" },
    loader: { ".less": "empty" },
    plugins: [vue()],
  })
  .catch(() => process.exit(1));
