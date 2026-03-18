import { spawn } from "node:child_process";
import path from "node:path";
import { promises as fs, readFileSync } from "node:fs";

// Parse .env file manually
function loadEnv(rootDir) {
  const envPath = path.join(rootDir, ".env");
  const vars = {};
  try {
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      vars[key] = val;
    }
  } catch {}
  return vars;
}

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");

const getArgValue = (name, fallback) => {
  const idx = process.argv.findIndex((arg) => arg === name);
  if (idx === -1 || !process.argv[idx + 1]) return fallback;
  return process.argv[idx + 1];
};

const mode = getArgValue("--mode", "production");
const isProd = mode === "production";

await fs.rm(distDir, { recursive: true, force: true });
await fs.mkdir(distDir, { recursive: true });

// Build env defines
const envVars = loadEnv(rootDir);
const envObj = { DEV: !isProd, PROD: isProd, MODE: mode, SSR: false, BASE_URL: "/" };
for (const [key, value] of Object.entries(envVars)) {
  if (key.startsWith("VITE_")) {
    envObj[key] = value;
  }
}

const envDefines = [];
for (const [key, value] of Object.entries(envObj)) {
  const jsonVal = JSON.stringify(value);
  envDefines.push("--define", `import.meta.env.${key}=${jsonVal}`);
}

const buildArgs = [
  "build",
  "src/main.tsx",
  "--outdir",
  "dist",
  "--target",
  "browser",
  "--format",
  "esm",
  "--splitting",
  "--public-path",
  "/",
  "--define",
  `process.env.NODE_ENV=${JSON.stringify(isProd ? "production" : "development")}`,
  ...envDefines,
];

if (!isProd) {
  buildArgs.push("--sourcemap");
}

if (isProd) {
  buildArgs.push("--minify");
}

const buildExitCode = await new Promise((resolve) => {
  const buildProcess = spawn("bun", buildArgs, {
    cwd: rootDir,
    stdio: "inherit",
  });

  buildProcess.on("close", (code) => resolve(code ?? 1));
  buildProcess.on("error", () => resolve(1));
});

if (buildExitCode !== 0) {
  process.exit(Number(buildExitCode));
}

const distFiles = await fs.readdir(distDir);
const mainJs = distFiles.find((file) => /^main.*\.js$/.test(file));
const mainCss = distFiles.find((file) => /^main.*\.css$/.test(file));

if (!mainJs) {
  console.error("Build output missing main JavaScript bundle");
  process.exit(1);
}

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MEEET State</title>
    ${mainCss ? `<link rel="stylesheet" href="/${mainCss}" />` : ""}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/${mainJs}"></script>
  </body>
</html>`;

await fs.writeFile(path.join(distDir, "index.html"), html, "utf8");

const publicDir = path.join(rootDir, "public");
try {
  await fs.cp(publicDir, distDir, { recursive: true });
} catch {
  // no-op when public directory does not exist
}

console.log(`Build complete (${mode})`);
