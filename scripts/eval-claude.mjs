#!/usr/bin/env node
// Cross-LLM battery runner for Claude Code (the Claude column), the counterpart of
// scripts/eval-codex.mjs: same battery file, same server phases, same persona.
//
// One cold `claude -p` per battery query, `--resume <session>` for follow-ups, raw stream-json kept
// per query, and a results.json whose per-query facts use the same shape as the Codex run:
// { calls: [{ tool, args, status, bytes }], inTok, outTok, final, ms, cards }.
//
//   node scripts/eval-claude.mjs --model claude-sonnet-5-5 --effort medium
//   node scripts/eval-claude.mjs --model claude-sonnet-5-5 --queries B10,W12
//   node scripts/eval-claude.mjs --model claude-sonnet-5-5 --plan      # print, run nothing
//
// Isolation (the `controlled` profile of the Codex runner): only this MCP server
// (--strict-mcp-config), project settings only (no user plugins or hooks), the same two-sentence
// realtor persona appended to Claude Code's system prompt, and of the built-in tools only Read
// (--builtin-tools, default "Read"; no shell, no web search). Read is there because Claude Code
// saves an MCP result over its token limit to a file and points the model at it. Search_Listings
// results used to be ~0.5 MB and always took that path; since lib/listingFields.js 100 listings
// are ~50 KB and arrive inline (a 53 KB result did, a 70 KB one went to a file), so Read now
// matters only for results that still overflow. Pass --builtin-tools none to run with no way to
// open a saved result.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, openSync, readSync, closeSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const defaultEvalRoot = resolve(repoRoot, "..", "mcp-eval");
const SERVER = "repliers-local";

const PERSONA = `You are a real-estate assistant for an end user (a realtor or their client).

Property data — listings, locations, market statistics — comes from the connected
Repliers tools. Do not answer property questions from memory.`;

function fail(message) {
  console.error(`[eval-claude] ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { model: "claude-sonnet-5-5", effort: "medium", battery: "core", queries: null, evalRoot: defaultEvalRoot, out: null, port: 3001, timeout: 600, plan: false, builtinTools: "Read" };
  for (let i = 2; i < argv.length; i += 1) {
    const next = () => argv[(i += 1)];
    switch (argv[i]) {
      case "--model": args.model = next(); break;
      case "--effort": args.effort = next(); break;
      case "--battery": args.battery = next(); break;
      case "--queries": args.queries = next().split(",").map((q) => q.trim()).filter(Boolean); break;
      case "--eval-root": args.evalRoot = resolve(next()); break;
      case "--out": args.out = resolve(next()); break;
      case "--port": args.port = Number(next()); break;
      case "--timeout": args.timeout = Number(next()); break;
      case "--builtin-tools": args.builtinTools = next(); break;
      case "--plan": args.plan = true; break;
      default: fail(`unknown argument: ${argv[i]}`);
    }
  }
  return args;
}

function run(command, args, { timeoutMs, ...options } = {}) {
  return new Promise((done) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], ...options });
    let stdout = "", stderr = "", timedOut = false;
    const timer = timeoutMs ? setTimeout(() => { timedOut = true; killTree(child); }, timeoutMs) : null;
    child.stdout.on("data", (c) => { stdout += c; });
    child.stderr.on("data", (c) => { stderr += c; });
    child.on("error", (e) => { stderr += `\n[spawn error] ${e.message}`; });
    child.on("close", (code) => { if (timer) clearTimeout(timer); done({ code, stdout, stderr, timedOut }); });
  });
}

function killTree(child) {
  if (!child.pid) return;
  if (process.platform === "win32") spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
  else child.kill("SIGKILL");
}

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

async function serverHealthy(port) {
  try { return (await fetch(`http://localhost:${port}/health`, { signal: AbortSignal.timeout(2000) })).ok; } catch { return false; }
}

async function startServer(phase, phaseEnv, { port, cardsLog }) {
  if (await serverHealthy(port)) fail(`port ${port} already answers /health. Stop that server first.`);
  const { breakApiKey, ...overrides } = phaseEnv;
  const env = { ...process.env, ...overrides, PORT: String(port), FEEDBACK_DRY_RUN_LOG: cardsLog };
  if (breakApiKey) {
    // process.loadEnvFile does not override real env vars, so the broken key passed here wins.
    const key = process.env.REPLIERS_API_KEY || readEnvFile(join(repoRoot, ".env")).REPLIERS_API_KEY;
    if (!key) fail("cannot run the broken-key phase: no REPLIERS_API_KEY in env or .env");
    env.REPLIERS_API_KEY = `${key}X`;
  }
  const child = spawn(process.execPath, ["mcpServer.js", "--http"], { cwd: repoRoot, env, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  child.stdout.on("data", (c) => { log += c; });
  child.stderr.on("data", (c) => { log += c; });
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await serverHealthy(port)) { console.log(`[eval-claude] server up on :${port} (phase ${phase})`); return { child, serverLog: () => log }; }
    await new Promise((r) => setTimeout(r, 500));
  }
  killTree(child);
  fail(`server did not become healthy on :${port}\n${log}`);
}

function cardsSince(path, offset) {
  if (!existsSync(path)) return { text: "", end: offset };
  const size = statSync(path).size;
  if (size <= offset) return { text: "", end: size };
  const fd = openSync(path, "r");
  const buffer = Buffer.alloc(size - offset);
  readSync(fd, buffer, 0, buffer.length, offset);
  closeSync(fd);
  return { text: buffer.toString("utf8"), end: size };
}

// stream-json → the shared facts shape. Tool results arrive in `user` events keyed by tool_use_id.
function extract(stdout) {
  const events = stdout.split(/\r?\n/).filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const calls = [];
  const byId = new Map();
  let sessionId = null, result = null, toolsSeen = [];
  for (const e of events) {
    if (e.type === "system" && e.subtype === "init") { sessionId = e.session_id; toolsSeen = e.tools || []; }
    if (e.type === "assistant") for (const c of e.message?.content || []) {
      if (c.type !== "tool_use") continue;
      const call = { tool: c.name.replace(`mcp__${SERVER}__`, ""), args: c.input, status: "pending", bytes: 0, mcp: c.name.startsWith(`mcp__${SERVER}__`) };
      calls.push(call); byId.set(c.id, call);
    }
    if (e.type === "user") for (const c of e.message?.content || []) {
      if (c.type !== "tool_result") continue;
      const call = byId.get(c.tool_use_id); if (!call) continue;
      call.status = c.is_error ? "failed" : "completed";
      call.bytes = JSON.stringify(c.content ?? "").length;
    }
    if (e.type === "result") { result = e; sessionId = e.session_id || sessionId; }
  }
  const u = result?.usage || {};
  return {
    sessionId,
    calls: calls.filter((c) => c.mcp).map(({ mcp, ...c }) => c),
    otherTools: calls.filter((c) => !c.mcp).map((c) => c.tool),
    web: calls.filter((c) => /^Web(Search|Fetch)$/.test(c.tool)).length,
    inTok: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0),
    cachedTok: u.cache_read_input_tokens ?? null,
    outTok: u.output_tokens ?? null,
    costUsd: result?.total_cost_usd ?? null,
    numTurns: result?.num_turns ?? null,
    final: result?.result ?? "",
    isError: Boolean(result?.is_error),
    toolsAvailable: toolsSeen.length,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const battery = JSON.parse(readFileSync(join(__dirname, "eval-batteries", `${args.battery}.json`), "utf8"));
  let queries = battery.queries;
  if (args.queries) {
    const wanted = new Set(args.queries);
    const chains = new Set(queries.filter((q) => wanted.has(q.id) && q.chain).map((q) => q.chain));
    queries = queries.filter((q) => wanted.has(q.id) || (q.chain && chains.has(q.chain)));
  }
  const stamp = new Date().toISOString().slice(0, 10);
  const outDir = args.out || join(args.evalRoot, "runs", `${stamp}-${args.model}-${args.effort}-claude`);
  const cardsLog = join(outDir, "cards.log");
  const workspace = args.evalRoot;
  const mcpConfig = JSON.stringify({ mcpServers: { [SERVER]: { type: "http", url: `http://localhost:${args.port}/mcp` } } });

  if (args.plan) {
    console.log(`battery ${battery.id} - model ${args.model} (${args.effort}) - out ${outDir}`);
    for (const q of queries) console.log(`  ${q.followUp ? "(resume)" : "        "} ${q.id.padEnd(8)} [${q.phase}] ${q.prompt}`);
    return;
  }
  mkdirSync(outDir, { recursive: true });
  const claudeBin = process.platform === "win32" ? "claude.exe" : "claude";
  const version = (await run(claudeBin, ["--version"])).stdout.trim();
  const builtins = args.builtinTools === "none" ? [] : args.builtinTools.split(",").map((t) => t.trim()).filter(Boolean);
  writeFileSync(join(outDir, "meta.json"), JSON.stringify({ startedAt: new Date().toISOString(), client: "claude-code", clientVersion: version, builtinTools: builtins, battery: battery.id, model: args.model, effort: args.effort, workspace, queries: queries.map((q) => q.id) }, null, 2));
  console.log(`[eval-claude] Claude Code ${version} - ${args.model}/${args.effort} - built-in tools: ${builtins.join(",") || "none"}`);
  console.log(`[eval-claude] out: ${outDir}`);

  const results = [];
  const sessions = new Map();
  let cardsOffset = 0;
  for (const phase of [...new Set(queries.map((q) => q.phase))]) {
    const server = await startServer(phase, battery.phases[phase], { port: args.port, cardsLog });
    for (const query of queries.filter((q) => q.phase === phase)) {
      const common = [
        "-p", query.prompt,
        "--model", args.model,
        "--effort", args.effort,
        "--output-format", "stream-json", "--verbose",
        "--strict-mcp-config", "--mcp-config", mcpConfig,
        "--tools", builtins.join(","),
        "--allowedTools", [`mcp__${SERVER}`, ...builtins].join(","),
        "--setting-sources", "project",
        "--disable-slash-commands",
        "--append-system-prompt", PERSONA,
      ];
      let cliArgs = common;
      if (query.followUp) {
        const sid = sessions.get(query.chain);
        if (!sid) { console.log(`[eval-claude] ${query.id} ... SKIPPED (chain ${query.chain} has no session)`); results.push({ id: query.id, failed: true }); continue; }
        cliArgs = [...common, "--resume", sid];
      }
      process.stdout.write(`[eval-claude] ${query.id} ... `);
      const started = Date.now();
      // Spawned without a shell where possible so the prompt and JSON are passed verbatim.
      const child = await run(claudeBin, cliArgs, { cwd: workspace, timeoutMs: args.timeout * 1000 });
      const ms = Date.now() - started;
      writeFileSync(join(outDir, `${query.id}.jsonl`), child.stdout);
      if (child.stderr.trim()) writeFileSync(join(outDir, `${query.id}.stderr.log`), child.stderr);
      const facts = extract(child.stdout);
      const cards = cardsSince(cardsLog, cardsOffset);
      cardsOffset = cards.end;
      if (facts.sessionId && query.chain && !query.followUp) sessions.set(query.chain, facts.sessionId);
      const failed = child.code !== 0 || !facts.sessionId || child.timedOut || facts.isError;
      results.push({ id: query.id, ...facts, ms, cards: cards.text, failed, exitCode: child.code, timedOut: child.timedOut });
      console.log(failed
        ? `FAILED (${child.timedOut ? "TIMEOUT" : `exit ${child.code}`}) ${(child.stderr || facts.final).split(/\r?\n/)[0].slice(0, 200)}`
        : `done - ${facts.calls.length} MCP - ${facts.otherTools.length} other - ${Math.round(ms / 1000)}s - $${(facts.costUsd ?? 0).toFixed(3)}`);
    }
    killTree(server.child);
    writeFileSync(join(outDir, `server-${phase}.log`), server.serverLog());
    await new Promise((r) => setTimeout(r, 1000));
  }
  writeFileSync(join(outDir, "results.json"), JSON.stringify(results, null, 1));
  const bad = results.filter((r) => r.failed).map((r) => r.id);
  console.log(`[eval-claude] done. results: ${join(outDir, "results.json")}${bad.length ? ` - NO DATA: ${bad.join(", ")}` : ""}`);
}

main();
