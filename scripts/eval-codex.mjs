#!/usr/bin/env node
// Cross-LLM battery runner for the OpenAI Codex CLI (the ChatGPT-model column).
//
// One cold `codex exec` per battery query, `codex exec resume` for follow-ups, raw JSONL kept
// per query and a grading sheet generated next to it. The runner owns the MCP server lifecycle,
// because half the battery depends on server env (FEEDBACK_PROMPT_LEVEL, a deliberately broken
// REPLIERS_API_KEY) and a stale listener on the port has silently invalidated a run before.
//
//   node scripts/eval-codex.mjs --profile controlled --model gpt-6-astra --effort high
//   node scripts/eval-codex.mjs --profile baseline --model gpt-5.5 --queries B10,L1
//   node scripts/eval-codex.mjs --profile controlled --model gpt-6-astra --plan   # print, run nothing
//
// Profiles:
//   controlled - isolated CODEX_HOME (only this MCP server, no plugins), web search off, an
//                AGENTS.md that sets the realtor persona. Comparable to the Claude Code columns.
//   baseline   - the operator's real ~/.codex (plugins, web search, Codex persona) with the
//                hosted/dev Repliers servers muted so only localhost answers. Measures what a
//                ChatGPT-side user actually gets. The delta between the two IS the harness.
//   instructed - controlled plus the server's own `instructions` delivered up front in AGENTS.md,
//                regenerated per phase from lib/serverInstructions.js so it cannot drift. This
//                emulates a host-level instruction field (the ChatGPT connector's instructions
//                box). It exists because on this client MCP `instructions` only reach the model
//                if it happens to load the tool registry: W11 answered with zero registry loads,
//                so the SCOPE rule never arrived, and the profile with the text in AGENTS.md was
//                the one that refused the out-of-scope question.

import { spawn } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const defaultEvalRoot = resolve(repoRoot, "..", "mcp-eval");

// ---------------------------------------------------------------- arguments

function parseArgs(argv) {
  const args = {
    profile: "controlled",
    model: "gpt-6-astra",
    effort: "medium",
    battery: "core",
    queries: null,
    evalRoot: defaultEvalRoot,
    out: null,
    port: 3001,
    timeout: 600,
    plan: false,
    externalServer: false,
    codexBin: process.env.CODEX_BIN || null,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[(i += 1)];
    switch (arg) {
      case "--profile": args.profile = next(); break;
      case "--model": args.model = next(); break;
      case "--effort": args.effort = next(); break;
      case "--battery": args.battery = next(); break;
      case "--queries": args.queries = next().split(",").map((q) => q.trim()).filter(Boolean); break;
      case "--eval-root": args.evalRoot = resolve(next()); break;
      case "--out": args.out = resolve(next()); break;
      case "--port": args.port = Number(next()); break;
      case "--timeout": args.timeout = Number(next()); break;
      case "--codex-bin": args.codexBin = next(); break;
      case "--plan": args.plan = true; break;
      case "--external-server": args.externalServer = true; break;
      case "--help":
      case "-h": printUsage(); process.exit(0); break;
      default: fail(`unknown argument: ${arg}`);
    }
  }
  if (!["controlled", "baseline", "instructed"].includes(args.profile)) {
    fail("--profile must be controlled, baseline or instructed");
  }
  return args;
}

function printUsage() {
  const header = readFileSync(fileURLToPath(import.meta.url), "utf8")
    .split("\n")
    .filter((line) => line.startsWith("//"))
    .join("\n");
  console.log(header);
}

function fail(message) {
  console.error(`[eval-codex] ${message}`);
  process.exit(1);
}

// ---------------------------------------------------------------- codex binary

// Node cannot spawn a .cmd shim without a shell, and a shell would need every prompt re-quoted.
// Prefer the native binary the desktop app installs; fall back to the PATH shim via a shell.
function resolveCodex(explicit) {
  if (explicit) return { command: explicit, shell: false };
  const localBin = process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "OpenAI", "Codex", "bin");
  if (localBin && existsSync(localBin)) {
    const candidates = readdirSync(localBin)
      .map((dir) => join(localBin, dir, "codex.exe"))
      .filter((exe) => existsSync(exe))
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
    if (candidates.length > 0) return { command: candidates[0], shell: false };
  }
  return { command: "codex", shell: process.platform === "win32" };
}

// ---------------------------------------------------------------- child processes

function run(command, args, options = {}) {
  const { timeoutMs, ...spawnOptions } = options;
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], ...spawnOptions });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          killTree(child);
        }, timeoutMs)
      : null;
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => { stderr += `\n[spawn error] ${error.message}`; });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolvePromise({ code, stdout, stderr, timedOut });
    });
  });
}

function killTree(child) {
  if (!child.pid) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
  } else {
    child.kill("SIGKILL");
  }
}

// ---------------------------------------------------------------- MCP server

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (match) out[match[1]] = match[2].trim();
  }
  return out;
}

async function serverHealthy(port) {
  try {
    const response = await fetch(`http://localhost:${port}/health`, { signal: AbortSignal.timeout(2000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function startServer(phase, phaseEnv, { port, cardsLog }) {
  if (await serverHealthy(port)) {
    fail(
      `port ${port} already answers /health. Stop that server first (a stale listener has ` +
        "invalidated a run before), or pass --external-server to accept it as is.",
    );
  }
  const { breakApiKey, ...envOverrides } = phaseEnv;
  const env = { ...process.env, ...envOverrides, PORT: String(port), FEEDBACK_DRY_RUN_LOG: cardsLog };
  if (breakApiKey) {
    // process.loadEnvFile does not override real env vars, so a broken key passed here wins
    // over .env without anyone editing the file.
    const key = process.env.REPLIERS_API_KEY || readEnvFile(join(repoRoot, ".env")).REPLIERS_API_KEY;
    if (!key) fail("cannot run the broken-key phase: no REPLIERS_API_KEY in env or .env");
    env.REPLIERS_API_KEY = `${key}X`;
  }
  const child = spawn(process.execPath, ["mcpServer.js", "--http"], {
    cwd: repoRoot,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout.on("data", (chunk) => { log += chunk; });
  child.stderr.on("data", (chunk) => { log += chunk; });
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await serverHealthy(port)) {
      console.log(`[eval-codex] server up on :${port} (phase ${phase})`);
      return { child, serverLog: () => log };
    }
    await new Promise((done) => setTimeout(done, 500));
  }
  killTree(child);
  fail(`server did not become healthy on :${port}\n${log}`);
  return null;
}

// ---------------------------------------------------------------- profiles

// The persona both isolated profiles share. Keeping it identical makes the server instructions
// the ONLY difference between `controlled` and `instructed`.
const PERSONA = `You are a real-estate assistant for an end user (a realtor or their client).

Property data — listings, locations, market statistics — comes from the connected
Repliers tools. Do not answer property questions from memory.`;

function profileSetup(args) {
  const mcpUrl = `http://localhost:${args.port}/mcp`;
  if (args.profile === "controlled" || args.profile === "instructed") {
    const home = join(args.evalRoot, ".codex-eval");
    if (!existsSync(join(home, "config.toml"))) fail(`missing ${join(home, "config.toml")}`);
    if (!existsSync(join(home, "auth.json"))) {
      fail(`missing ${join(home, "auth.json")} - copy it from ~/.codex after a login`);
    }
    return {
      env: { CODEX_HOME: home },
      workspace: join(args.evalRoot, `codex-${args.profile}`),
      extraArgs: ["-c", `mcp_servers.repliers_local.url="${mcpUrl}"`, "-c", "tools.web_search=false"],
    };
  }
  return {
    env: {},
    workspace: join(args.evalRoot, "codex-baseline"),
    // The operator's real config also carries the hosted and Heroku-dev Repliers servers. Leaving
    // them on would put three copies of the same 45 tools in front of the model, so mute them per
    // run instead of editing their config file.
    extraArgs: [
      "-c", `mcp_servers.repliers_local.url="${mcpUrl}"`,
      "-c", "mcp_servers.repliers-dev.enabled=false",
      "-c", "mcp_servers.repliers_hosted_mcp.enabled=false",
    ],
  };
}

// The `instructed` profile hands the model the server's own instructions the way a host-level
// instruction field would: once, up front. Regenerated per phase because the text depends on the
// phase env (consent mode, whether the feedback channel is configured) — a stale file would
// silently test wording that is not the wording under test.
async function writeHostInstructions(workspace, phaseEnv) {
  const restore = {};
  for (const [key, value] of Object.entries(phaseEnv)) {
    if (key === "breakApiKey") continue;
    restore[key] = process.env[key];
    process.env[key] = value;
  }
  const { buildServerInstructions } = await import(
    pathToFileURL(join(repoRoot, "lib", "serverInstructions.js")).href
  );
  const instructions = buildServerInstructions();
  for (const [key, value] of Object.entries(restore)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  mkdirSync(workspace, { recursive: true });
  writeFileSync(join(workspace, "AGENTS.md"), `${PERSONA}\n\n${instructions}\n`);
  return instructions.length;
}

// ---------------------------------------------------------------- event extraction

function emptyFacts() {
  return {
    threadId: null,
    usage: null,
    itemCounts: {},
    mcpCalls: [],
    webSearches: [],
    shellCalls: [],
    messages: [],
    finalMessage: "",
  };
}

function extract(stdout) {
  const events = [];
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.startsWith("{")) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      // a warning line, not an event
    }
  }
  const facts = {
    threadId: null,
    usage: null,
    itemCounts: {},
    mcpCalls: [],
    webSearches: [],
    shellCalls: [],
    messages: [],
  };
  for (const event of events) {
    if (event.type === "thread.started") facts.threadId = event.thread_id;
    if (event.type === "turn.completed") facts.usage = event.usage;
    if (event.type !== "item.completed") continue;
    const item = event.item || {};
    facts.itemCounts[item.type] = (facts.itemCounts[item.type] || 0) + 1;
    if (item.type === "mcp_tool_call") {
      facts.mcpCalls.push({
        server: item.server,
        tool: item.tool,
        arguments: item.arguments,
        failed: Boolean(item.error ?? item.result?.isError ?? false),
      });
    } else if (item.type === "web_search") {
      facts.webSearches.push(item.query || item.action?.queries || "");
    } else if (item.type === "command_execution" || item.type === "local_shell_call") {
      facts.shellCalls.push(item.command || item.action || "");
    } else if (item.type === "agent_message") {
      facts.messages.push(item.text || "");
    }
  }
  facts.finalMessage = facts.messages.at(-1) || "";
  return { events, facts };
}

// Cards are appended to one dry-run log by the server, so slice the delta written per query
// instead of restarting the server just to get per-query attribution.
function cardsSince(path, offset) {
  if (!existsSync(path)) return { text: "", end: offset };
  const end = statSync(path).size;
  if (end <= offset) return { text: "", end };
  const fd = openSync(path, "r");
  const buffer = Buffer.alloc(end - offset);
  readSync(fd, buffer, 0, buffer.length, offset);
  closeSync(fd);
  return { text: buffer.toString("utf8"), end };
}

// ---------------------------------------------------------------- reporting

function summarise(result) {
  const { query, facts } = result;
  const lines = [];
  lines.push(`### ${query.id} - \`${query.prompt}\``);
  lines.push("");
  if (result.failed) {
    lines.push(
      result.skipped
        ? "**NOT RUN** - its chain broke earlier. Re-run this id; do not grade it."
        : `**NO DATA** - the Codex run produced no session (exit ${result.exitCode}${result.timedOut ? ", timed out" : ""}). Re-run this id; do not grade it.`,
    );
    lines.push("");
    return lines.join("\n");
  }
  lines.push("**Verdict:** _(fill in: PASS / PARTIAL / FAIL)_");
  lines.push("");
  lines.push(`- expected: ${query.expect}`);
  lines.push(
    `- session: \`${facts.threadId || "n/a"}\`${query.followUp ? " (resumed)" : ""} - ` +
      `${Math.round(result.durationMs / 1000)}s${result.timedOut ? " - **TIMED OUT**" : ""}`,
  );
  if (facts.usage) {
    lines.push(
      `- tokens: in ${facts.usage.input_tokens} (cached ${facts.usage.cached_input_tokens}) / out ${facts.usage.output_tokens}`,
    );
  }
  lines.push(
    `- MCP calls: **${facts.mcpCalls.length}** - web searches: **${facts.webSearches.length}** - shell: ${facts.shellCalls.length}`,
  );
  if (facts.mcpCalls.length > 0) {
    lines.push("");
    lines.push("| # | tool | arguments |");
    lines.push("|---|---|---|");
    facts.mcpCalls.forEach((call, index) => {
      const argText = JSON.stringify(call.arguments ?? {}).replace(/\|/g, "\\|").slice(0, 400);
      lines.push(`| ${index + 1} | \`${call.tool}\`${call.failed ? " (error)" : ""} | \`${argText}\` |`);
    });
  }
  if (facts.webSearches.length > 0) {
    lines.push("");
    lines.push(`- WEB SEARCH USED: ${JSON.stringify(facts.webSearches).slice(0, 300)}`);
  }
  if (result.cards.trim()) {
    lines.push("");
    lines.push("- feedback cards filed:");
    lines.push("");
    lines.push("```");
    lines.push(result.cards.trim().slice(0, 1500));
    lines.push("```");
  }
  lines.push("");
  lines.push("<details><summary>final answer</summary>");
  lines.push("");
  lines.push(facts.finalMessage.slice(0, 4000) || "_(empty)_");
  lines.push("");
  lines.push("</details>");
  lines.push("");
  return lines.join("\n");
}

// ---------------------------------------------------------------- main

async function main() {
  const args = parseArgs(process.argv);
  const batteryPath = join(__dirname, "eval-batteries", `${args.battery}.json`);
  if (!existsSync(batteryPath)) fail(`no battery at ${batteryPath}`);
  const battery = JSON.parse(readFileSync(batteryPath, "utf8"));

  let queries = battery.queries;
  if (args.queries) {
    const wanted = new Set(args.queries);
    // A follow-up is meaningless without its chain, so pull in the whole chain it belongs to.
    const chains = new Set(queries.filter((q) => wanted.has(q.id) && q.chain).map((q) => q.chain));
    queries = queries.filter((q) => wanted.has(q.id) || (q.chain && chains.has(q.chain)));
    if (queries.length === 0) fail(`none of ${[...wanted].join(", ")} exist in battery ${battery.id}`);
  }

  const setup = profileSetup(args);
  const codex = resolveCodex(args.codexBin);
  const stamp = new Date().toISOString().slice(0, 10);
  const outDir = args.out || join(args.evalRoot, "runs", `${stamp}-${args.model}-${args.effort}-${args.profile}`);
  const cardsLog = join(outDir, "cards.log");

  if (args.plan) {
    console.log(`battery ${battery.id} - profile ${args.profile} - model ${args.model} (${args.effort})`);
    console.log(`codex: ${codex.command}`);
    console.log(`workspace: ${setup.workspace}`);
    console.log(`out: ${outDir}`);
    for (const query of queries) {
      console.log(`  ${query.followUp ? "(resume)" : "        "} ${query.id.padEnd(8)} [${query.phase}] ${query.prompt}`);
    }
    return;
  }

  // `instructed` owns its workspace: the AGENTS.md in it is generated per phase, so the directory
  // is created here rather than being a precondition the operator has to remember.
  if (args.profile === "instructed") mkdirSync(setup.workspace, { recursive: true });
  if (!existsSync(setup.workspace)) fail(`workspace ${setup.workspace} does not exist`);
  mkdirSync(outDir, { recursive: true });

  const versionProbe = await run(codex.command, ["--version"], { shell: codex.shell });
  const meta = {
    startedAt: new Date().toISOString(),
    battery: battery.id,
    profile: args.profile,
    model: args.model,
    effort: args.effort,
    codexBinary: codex.command,
    codexVersion: versionProbe.stdout.trim(),
    workspace: setup.workspace,
    port: args.port,
    externalServer: args.externalServer,
    queries: queries.map((q) => q.id),
  };
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "meta.json"), JSON.stringify(meta, null, 2));
  console.log(`[eval-codex] ${meta.codexVersion} - ${args.model}/${args.effort} - profile ${args.profile}`);
  console.log(`[eval-codex] out: ${outDir}`);

  const results = [];
  const threads = new Map();
  const brokenChains = new Set();
  let cardsOffset = 0;

  // Queries are grouped by server phase so the server starts once per phase, not once per query.
  const phases = [...new Set(queries.map((q) => q.phase))];
  for (const phase of phases) {
    const phaseEnv = battery.phases[phase];
    if (!phaseEnv) fail(`battery ${battery.id} has no phase "${phase}"`);
    if (args.profile === "instructed") {
      const chars = await writeHostInstructions(setup.workspace, phaseEnv);
      console.log(`[eval-codex] phase ${phase}: AGENTS.md carries ${chars} chars of server instructions`);
    }
    let server = null;
    if (args.externalServer) {
      if (!(await serverHealthy(args.port))) fail(`--external-server given but nothing healthy on :${args.port}`);
      console.log(`[eval-codex] phase ${phase}: using the already-running server (its env is NOT enforced)`);
    } else {
      server = await startServer(phase, phaseEnv, { port: args.port, cardsLog });
    }

    for (const query of queries.filter((q) => q.phase === phase)) {
      if (query.chain && brokenChains.has(query.chain)) {
        console.log(`[eval-codex] ${query.id} ... SKIPPED (chain ${query.chain} is broken)`);
        results.push({ query, facts: emptyFacts(), durationMs: 0, timedOut: false, exitCode: null, cards: "", skipped: true, failed: true });
        continue;
      }

      // `codex exec resume` takes its options BEFORE the session id, and supports neither -s nor
      // -C: sandbox and cwd come from the session being resumed.
      let codexArgs;
      const common = [
        "--skip-git-repo-check",
        "--json",
        "-m", args.model,
        "-c", `model_reasoning_effort="${args.effort}"`,
        ...setup.extraArgs,
      ];
      if (query.followUp) {
        const threadId = threads.get(query.chain);
        if (!threadId) {
          console.log(`[eval-codex] ${query.id} ... SKIPPED (chain ${query.chain} has no session)`);
          brokenChains.add(query.chain);
          results.push({ query, facts: emptyFacts(), durationMs: 0, timedOut: false, exitCode: null, cards: "", skipped: true, failed: true });
          continue;
        }
        codexArgs = ["exec", "resume", ...common, threadId, query.prompt];
      } else {
        codexArgs = ["exec", ...common, "-s", "read-only", "-C", setup.workspace, query.prompt];
      }

      process.stdout.write(`[eval-codex] ${query.id} ... `);
      const started = Date.now();
      const child = await run(codex.command, codexArgs, {
        cwd: setup.workspace,
        env: { ...process.env, ...setup.env },
        shell: codex.shell,
        timeoutMs: args.timeout * 1000,
      });
      const durationMs = Date.now() - started;

      writeFileSync(join(outDir, `${query.id}.jsonl`), child.stdout);
      if (child.stderr.trim()) writeFileSync(join(outDir, `${query.id}.stderr.log`), child.stderr);

      const { facts } = extract(child.stdout);
      const cards = cardsSince(cardsLog, cardsOffset);
      cardsOffset = cards.end;
      if (facts.threadId && query.chain && !query.followUp) threads.set(query.chain, facts.threadId);

      // A run that never started a thread produced no data at all — usually a CLI argument the
      // installed Codex rejects. Saying "done" there is how a whole battery quietly becomes junk.
      const failed = child.code !== 0 || !facts.threadId || child.timedOut;
      if (failed && query.chain) brokenChains.add(query.chain);

      results.push({ query, facts, durationMs, timedOut: child.timedOut, exitCode: child.code, cards: cards.text, failed });
      if (failed) {
        const reason = child.timedOut ? "TIMEOUT" : `exit ${child.code}`;
        console.log(`FAILED (${reason}) - ${Math.round(durationMs / 1000)}s`);
        const detail = child.stderr.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("Reading additional input"))[0];
        if (detail) console.log(`[eval-codex]   ${detail.slice(0, 200)}`);
      } else {
        console.log(
          `done - ${facts.mcpCalls.length} MCP - ${facts.webSearches.length} web - ${Math.round(durationMs / 1000)}s`,
        );
      }
    }

    if (server) {
      killTree(server.child);
      writeFileSync(join(outDir, `server-${phase}.log`), server.serverLog());
      await new Promise((done) => setTimeout(done, 1000));
    }
  }

  const header = [
    `# Codex run - ${stamp}`,
    "",
    `**Client:** Codex CLI ${meta.codexVersion} - **model:** \`${args.model}\` (effort ${args.effort}) - **profile:** \`${args.profile}\``,
    `**Battery:** ${battery.id} (${results.length} queries) - **server:** dry-run cards, phases ${phases.join(", ")}`,
    "",
    "| Q | MCP calls | web | verdict |",
    "|---|---|---|---|",
    ...results.map((r) =>
      r.failed
        ? `| ${r.query.id} | - | - | **NO DATA — re-run** |`
        : `| ${r.query.id} | ${r.facts.mcpCalls.length} | ${r.facts.webSearches.length} | |`,
    ),
    "",
  ].join("\n");
  writeFileSync(join(outDir, "summary.md"), `${header}\n${results.map(summarise).join("\n")}`);
  writeFileSync(
    join(outDir, "results.json"),
    JSON.stringify(
      {
        meta,
        results: results.map((r) => ({
          id: r.query.id,
          ...r.facts,
          durationMs: r.durationMs,
          timedOut: r.timedOut,
          cards: r.cards,
        })),
      },
      null,
      2,
    ),
  );

  const failures = results.filter((r) => r.failed);
  const zeroMcp = results.filter((r) => !r.failed && r.facts.mcpCalls.length === 0).map((r) => r.query.id);
  console.log(`[eval-codex] done. grading sheet: ${join(outDir, "summary.md")}`);
  if (zeroMcp.length > 0) console.log(`[eval-codex] note: no MCP call at all in ${zeroMcp.join(", ")}`);
  if (failures.length > 0) {
    console.log(`[eval-codex] ${failures.length} query/queries produced NO data: ${failures.map((r) => r.query.id).join(", ")}`);
    console.log("[eval-codex] fix the cause and re-run those ids before grading — they are not results.");
    process.exitCode = 1;
  }
}

main().catch((error) => fail(error.stack || String(error)));
