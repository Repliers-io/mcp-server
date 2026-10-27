// Copies the public part of this repo into the open-source mirror: `npm run export:oss [-- <outDir>]`,
// default ../mcp-server-oss. The destination is emptied except its .git, so files deleted here do not
// linger there and a repo kept there shows each export as a diff. Only files git tracks are copied —
// untracked working files (.env, .superpowers/, feedback-cards.log) never reach an export.
// Files under oss/ replace or add their counterpart at the same path (oss/CLAUDE.md → CLAUDE.md).
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const OVERLAY = "oss";

// Internal to the dev repo: docs, agent config, ops, eval tooling, and this exporter itself.
const EXCLUDE = [
  "docs/**",
  "CLAUDE.md",
  ".claude/**",
  ".vscode/**",
  "Procfile",
  ".gitkeep",
  "scripts/eval-*",
  "scripts/eval-batteries/**",
  "scripts/probe-propelauth.mjs",
  "scripts/print-instructions.mjs",
  "scripts/internal/**",
  `${OVERLAY}/**`,
];

const source = path.resolve(import.meta.dirname, "../..");
const destination = path.resolve(process.argv[2] ?? path.join(source, "../mcp-server-oss"));

const inside = path.relative(destination, source);
if (!inside.startsWith("..") && !path.isAbsolute(inside)) {
  console.error(`Refusing to clear ${destination}: it contains the source repo.`);
  process.exit(1);
}

mkdirSync(destination, { recursive: true });
for (const entry of readdirSync(destination)) {
  if (entry !== ".git") rmSync(path.join(destination, entry), { recursive: true, force: true });
}

const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: source, encoding: "utf8" })
  .split("\0")
  .filter(Boolean)
  .filter((file) => existsSync(path.join(source, file))); // tracked, but deleted in the working tree

let copied = 0;
for (const file of tracked) {
  if (EXCLUDE.some((pattern) => path.matchesGlob(file, pattern))) continue;
  cpSync(path.join(source, file), path.join(destination, file));
  copied++;
}

let overlaid = 0;
for (const file of tracked.filter((f) => f.startsWith(`${OVERLAY}/`))) {
  cpSync(path.join(source, file), path.join(destination, file.slice(OVERLAY.length + 1)));
  overlaid++;
}

// The export script itself does not ship, so neither does its npm entry.
const packagePath = path.join(destination, "package.json");
const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
delete pkg.scripts["export:oss"];
writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + "\n");

console.log(`Exported ${copied} files (${overlaid} from ${OVERLAY}/) to ${destination}`);
