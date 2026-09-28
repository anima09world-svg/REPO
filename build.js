/**
 * build.js — SkyStream Multi-Plugin Builder
 * Compiles each plugin TypeScript file in src/plugins/ to dist/*.js
 * using esbuild (no external dependencies required).
 */

const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const PLUGINS_DIR = path.join(__dirname, "src", "plugins");
const DIST_DIR = path.join(__dirname, "dist");
const isDev = process.argv.includes("--dev");

// Ensure dist/ exists
if (!fs.existsSync(DIST_DIR)) fs.mkdirSync(DIST_DIR, { recursive: true });

// Discover all plugin files
const pluginFiles = fs.readdirSync(PLUGINS_DIR).filter(f => f.endsWith(".ts"));
console.log(`Building ${pluginFiles.length} plugins...`);

const builds = pluginFiles.map(file => {
  const name = file.replace(".ts", "");
  const entryPoint = path.join(PLUGINS_DIR, file);
  const outfile = path.join(DIST_DIR, `${name}.js`);
  return esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    platform: "node",
    target: "es2020",
    format: "cjs",
    outfile,
    minify: !isDev,
    sourcemap: isDev ? "inline" : false,
    logLevel: "warning",
    // Suppress 'declare' errors — SkyStream globals are injected at runtime
    define: {},
  }).then(() => {
    console.log(`  ✓ ${name}.js`);
  }).catch(err => {
    console.error(`  ✗ ${name}: ${err.message}`);
  });
});

Promise.all(builds).then(() => {
  console.log(`\nDone! Built ${pluginFiles.length} plugins → dist/`);
  // Also copy repo.json to dist/
  const repoSrc = path.join(__dirname, "repo.json");
  const repoDst = path.join(DIST_DIR, "repo.json");
  if (fs.existsSync(repoSrc)) {
    fs.copyFileSync(repoSrc, repoDst);
    console.log("  ✓ repo.json copied to dist/");
  }
}).catch(err => {
  console.error("Build failed:", err);
  process.exit(1);
});
