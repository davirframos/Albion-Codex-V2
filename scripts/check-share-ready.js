import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const checks = [];

function addCheck(label, ok, detail, fix = null) {
  checks.push({ label, ok, detail, fix });
}

function exists(relativePath) {
  return fs.existsSync(path.join(rootDir, relativePath));
}

function versionAtLeast(actual, expected) {
  const actualParts = actual.split(".").map(Number);
  const expectedParts = expected.split(".").map(Number);

  for (let index = 0; index < expectedParts.length; index += 1) {
    const actualPart = actualParts[index] || 0;
    const expectedPart = expectedParts[index] || 0;
    if (actualPart > expectedPart) return true;
    if (actualPart < expectedPart) return false;
  }

  return true;
}

const nodeVersion = process.versions.node;
addCheck(
  "Node.js >= 22.5.0",
  versionAtLeast(nodeVersion, "22.5.0"),
  `Atual: ${nodeVersion}`,
  "Instale Node.js 22 LTS ou mais novo."
);

addCheck(
  "Dependencias da API instaladas",
  exists("node_modules/fastify"),
  "Procurei node_modules/fastify",
  "Rode: npm install"
);

addCheck(
  "Dependencias da web instaladas",
  exists("apps/web/node_modules/vite"),
  "Procurei apps/web/node_modules/vite",
  "Rode: npm --prefix apps/web install"
);

addCheck(
  "Schema SQLite presente",
  exists("db/schema.sql"),
  "Procurei db/schema.sql",
  "Baixe o projeto completo, incluindo a pasta db."
);

addCheck(
  "README presente",
  exists("README.md"),
  "Procurei README.md",
  "Inclua o README ao compartilhar o projeto."
);

const ignoredLocalFiles = [
  "node_modules",
  "apps/web/node_modules",
  "apps/web/dist",
  "db/albion-codex-v2.sqlite",
  "db/albion-codex-v2.sqlite-shm",
  "db/albion-codex-v2.sqlite-wal",
  "api.err.log",
  "api.out.log"
].filter(exists);

if (ignoredLocalFiles.length > 0) {
  console.log("Aviso: existem arquivos locais que nao devem ser enviados:");
  for (const file of ignoredLocalFiles) console.log(`  - ${file}`);
  console.log("Eles estao no .gitignore; ao compactar manualmente, deixe-os de fora.\n");
}

for (const check of checks) {
  console.log(`${check.ok ? "OK " : "ERRO"} ${check.label} - ${check.detail}`);
  if (!check.ok && check.fix) console.log(`     Como resolver: ${check.fix}`);
}

const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.error(`\n${failed.length} checagem(ns) falharam. Corrija antes de rodar o projeto.`);
  process.exit(1);
}

console.log("\nAmbiente local pronto para rodar API e web.");
