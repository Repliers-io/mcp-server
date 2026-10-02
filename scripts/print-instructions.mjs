#!/usr/bin/env node
// Prints the server's `instructions` text — the same string `initialize` returns — so it can be
// pasted into a host's own instruction field (the ChatGPT connector's instructions box, a Codex
// AGENTS.md, a Claude project prompt).
//
// Why this exists: on clients that expose MCP tools through a searchable registry rather than the
// opening prompt (Codex/ChatGPT code mode), the server's `instructions` are glued onto EVERY tool
// description and the registry listing is then truncated — 45 copies of a ~2.3 KB text is what
// blows the budget. A host-level instruction field is loaded once and survives. Same source of
// truth either way, so the two channels cannot drift.
//
//   node scripts/print-instructions.mjs                      # current .env / process env
//   node scripts/print-instructions.mjs --consent always-ask # force the consent-first wording
//   node scripts/print-instructions.mjs --no-feedback        # the Trello-absent variant
//   node scripts/print-instructions.mjs --out connector.txt
//
// The feedback channel is gated on Trello config, so `--no-feedback` is the text to use on a
// deployment without Trello keys — it must never promise a tool that is not in the roster.

import { existsSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
let consent = null;
let feedback = null;
let outFile = null;
for (let i = 0; i < args.length; i += 1) {
  switch (args[i]) {
    case "--consent": consent = args[(i += 1)]; break;
    case "--no-feedback": feedback = false; break;
    case "--feedback": feedback = true; break;
    case "--out": outFile = resolve(args[(i += 1)]); break;
    case "--help":
    case "-h":
      console.log(
        (await import("node:fs")).readFileSync(fileURLToPath(import.meta.url), "utf8")
          .split("\n").filter((l) => l.startsWith("//")).join("\n"),
      );
      process.exit(0);
      break;
    default:
      console.error(`unknown argument: ${args[i]}`);
      process.exit(1);
  }
}

// The builder reads env at call time, so shape the env before importing it.
const envPath = resolve(repoRoot, ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);
if (consent) process.env.FEEDBACK_CONSENT = consent;
if (feedback === false) {
  delete process.env.TRELLO_API_KEY;
  delete process.env.TRELLO_API_TOKEN;
  delete process.env.TRELLO_LIST_ID;
  process.env.FEEDBACK_DRY_RUN = "false";
} else if (feedback === true) {
  process.env.FEEDBACK_DRY_RUN = "true";
}

const { buildServerInstructions } = await import(`file://${resolve(repoRoot, "lib/serverInstructions.js")}`);
const text = buildServerInstructions();

if (outFile) {
  writeFileSync(outFile, `${text}\n`);
  console.error(`[print-instructions] ${text.length} chars → ${outFile}`);
} else {
  process.stdout.write(`${text}\n`);
}
