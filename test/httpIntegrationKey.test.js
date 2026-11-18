// REPLIERS_INTEGRATION_KEY: the hosted deployment's REPLIERS-INTEGRATION-KEY header on every
// Repliers API request, absent in every other mode, and never echoed to a client or the log.
// A real server (hosted --http, self-hosted --http, stdio) against a fake Repliers API that records
// the header.
import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  repoRoot,
  startFakePropelAuth,
  startFakeRepliersApi,
  startMcpServer,
  openSession,
  callTool,
  listTools,
  waitForLog,
} from "./helpers/hostedMcpServer.js";

const TOOL = { name: "autocomplete-location-search", args: { search: "tor" } };
const VALID = "INT-SECRET-7f3a9c2e1b4d6f8a0c";
const IGNORED = /\[CONFIG\] REPLIERS_INTEGRATION_KEY is ignored outside hosted HTTP mode/;
const FORCED = /\[CONFIG\] --send-integration-key: this self-hosted HTTP server sends the REPLIERS-INTEGRATION-KEY header/;

// The child's log is a pipe: only after it exits is every line known to have arrived.
async function stop(mcp) {
  if (mcp.child.exitCode === null && mcp.child.signalCode === null) {
    const closed = once(mcp.child, "close");
    mcp.close();
    await closed;
  }
  return mcp.log();
}

async function hosted(t, env) {
  const propelAuth = await startFakePropelAuth();
  const repliers = await startFakeRepliersApi();
  let mcp;
  t.after(async () => {
    if (mcp) await stop(mcp);
    await Promise.all([propelAuth.close(), repliers.close()]);
  });
  mcp = await startMcpServer({ propelAuth, repliersApiPort: repliers.port, env });
  const sessionId = await openSession(mcp.port, "alice-token");
  return { repliers, mcp, sessionId };
}

function assertNoneCarried(received) {
  assert.ok(received.length >= 1, "nothing reached the API");
  for (const request of received) {
    assert.equal(request.integrationKey, null, `${request.url} carried an integration key`);
  }
}

test("hosted with REPLIERS_INTEGRATION_KEY: every API request carries it, no client or log line does", async (t) => {
  const { repliers, mcp, sessionId } = await hosted(t, { REPLIERS_INTEGRATION_KEY: VALID });

  const listed = await listTools(mcp.port, { token: "alice-token", sessionId });
  assert.equal(listed.status, 200, listed.text);
  const call = await callTool(mcp.port, { token: "alice-token", sessionId, ...TOOL });
  assert.equal(call.status, 200, call.text);
  assert.match(call.text, /receivedKey/, `tool never reached the stub API: ${call.text}`);

  const probe = repliers.received.find((r) => r.url === "/accounts");
  assert.ok(probe, "tools/list never probed /accounts");
  assert.equal(probe.integrationKey, VALID);
  const tool = repliers.received.find((r) => r.url.startsWith("/locations/autocomplete"));
  assert.ok(tool, `tool call never reached the API: ${JSON.stringify(repliers.received.map((r) => r.url))}`);
  assert.equal(tool.integrationKey, VALID);
  assert.ok(repliers.received.every((r) => r.integrationKey === VALID));

  for (const text of [listed.text, call.text]) assert.doesNotMatch(text, /INT-SECRET/);
  assert.doesNotMatch(await stop(mcp), /INT-SECRET/);
});

test("hosted without REPLIERS_INTEGRATION_KEY: no request carries the header", async (t) => {
  const { repliers, mcp, sessionId } = await hosted(t, {});
  await listTools(mcp.port, { token: "alice-token", sessionId });
  const call = await callTool(mcp.port, { token: "alice-token", sessionId, ...TOOL });
  assert.match(call.text, /receivedKey/, call.text);
  assert.ok(repliers.received.length >= 2);
  assertNoneCarried(repliers.received);
});

// The CRLF is the only thing wrong with this value: without it the key would be valid and sent.
test("hosted with a CRLF in REPLIERS_INTEGRATION_KEY: dropped with a startup notice that never repeats it", async (t) => {
  const { repliers, mcp, sessionId } = await hosted(t, { REPLIERS_INTEGRATION_KEY: `${VALID}\r\nX-Evil-1` });
  await waitForLog(mcp, /\[CONFIG\] REPLIERS_INTEGRATION_KEY is set but invalid/);

  const call = await callTool(mcp.port, { token: "alice-token", sessionId, ...TOOL });
  assert.equal(call.status, 200, call.text);
  assert.match(call.text, /receivedKey/, `the tool call failed instead of going out without the header: ${call.text}`);
  assert.doesNotMatch(call.text, /INT-SECRET/);
  assertNoneCarried(repliers.received);
  assert.doesNotMatch(await stop(mcp), /INT-SECRET/);
});

test("self-hosted HTTP ignores REPLIERS_INTEGRATION_KEY", async (t) => {
  const repliers = await startFakeRepliersApi();
  let mcp;
  t.after(async () => {
    if (mcp) await stop(mcp);
    await repliers.close();
  });
  mcp = await startMcpServer({
    repliersApiPort: repliers.port,
    env: {
      REPLIERS_API_KEY: "SELF-HOSTED-KEY",
      REPLIERS_INTEGRATION_KEY: VALID,
      MCP_PUBLIC_URL: "",
      PROPELAUTH_MCP_INTROSPECT_CLIENT_ID: "",
      PROPELAUTH_MCP_INTROSPECT_CLIENT_SECRET: "",
      PROPELAUTH_API_KEY: "",
    },
  });
  await waitForLog(mcp, IGNORED);
  const sessionId = await openSession(mcp.port);
  await listTools(mcp.port, { sessionId });
  const call = await callTool(mcp.port, { sessionId, ...TOOL });
  assert.match(call.text, /receivedKey/, call.text);
  assert.ok(repliers.received.every((r) => r.key === "SELF-HOSTED-KEY"));
  assertNoneCarried(repliers.received);
  assert.doesNotMatch(await stop(mcp), /INT-SECRET/);
});

test("self-hosted HTTP with --send-integration-key: every API request carries it, no client or log line does", async (t) => {
  const repliers = await startFakeRepliersApi();
  let mcp;
  t.after(async () => {
    if (mcp) await stop(mcp);
    await repliers.close();
  });
  mcp = await startMcpServer({
    repliersApiPort: repliers.port,
    args: ["--send-integration-key"],
    env: {
      REPLIERS_API_KEY: "SELF-HOSTED-KEY",
      REPLIERS_INTEGRATION_KEY: VALID,
      MCP_PUBLIC_URL: "",
      PROPELAUTH_MCP_INTROSPECT_CLIENT_ID: "",
      PROPELAUTH_MCP_INTROSPECT_CLIENT_SECRET: "",
      PROPELAUTH_API_KEY: "",
    },
  });
  await waitForLog(mcp, FORCED);
  const sessionId = await openSession(mcp.port);
  const listed = await listTools(mcp.port, { sessionId });
  assert.equal(listed.status, 200, listed.text);
  const call = await callTool(mcp.port, { sessionId, ...TOOL });
  assert.match(call.text, /receivedKey/, call.text);
  assert.doesNotMatch(listed.text, /INT-SECRET/);
  assert.doesNotMatch(call.text, /INT-SECRET/);

  assert.ok(repliers.received.length >= 1, "nothing reached the API");
  assert.ok(repliers.received.every((r) => r.key === "SELF-HOSTED-KEY"));
  for (const request of repliers.received) {
    assert.equal(request.integrationKey, VALID, `${request.url} lacks the integration key`);
  }

  const log = await stop(mcp);
  assert.doesNotMatch(log, IGNORED);
  assert.doesNotMatch(log, /INT-SECRET/);
});

// The flag is a developer's request to exercise the header: without a usable key the server must
// not start and quietly send nothing.
test("self-hosted HTTP with --send-integration-key refuses to start without a valid key", async (t) => {
  const repliers = await startFakeRepliersApi();
  t.after(() => repliers.close());
  for (const value of ["", "   ", `${VALID}\r\nX-Evil-1`, "too-short"]) {
    await assert.rejects(
      startMcpServer({
        repliersApiPort: repliers.port,
        args: ["--send-integration-key"],
        env: {
          REPLIERS_API_KEY: "SELF-HOSTED-KEY",
          REPLIERS_INTEGRATION_KEY: value,
          MCP_PUBLIC_URL: "",
          PROPELAUTH_MCP_INTROSPECT_CLIENT_ID: "",
          PROPELAUTH_MCP_INTROSPECT_CLIENT_SECRET: "",
          PROPELAUTH_API_KEY: "",
        },
      }),
      (error) => {
        assert.match(error.message, /server exited early/, JSON.stringify(value));
        assert.match(error.message, /\[FATAL\] --send-integration-key: REPLIERS_INTEGRATION_KEY is unset or invalid/);
        assert.doesNotMatch(error.message, /INT-SECRET/);
        return true;
      },
    );
  }
  assert.equal(repliers.received.length, 0, "a server that refused to start reached the API");
});

// The flag is for HTTP only: stdio ignores the key even when it is passed.
test("stdio ignores REPLIERS_INTEGRATION_KEY, even with --send-integration-key", async (t) => {
  const repliers = await startFakeRepliersApi();
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["mcpServer.js", "--send-integration-key"],
    cwd: repoRoot,
    env: {
      ...process.env,
      REPLIERS_API_KEY: "STDIO-KEY",
      REPLIERS_API_BASE_URL: `http://127.0.0.1:${repliers.port}`,
      REPLIERS_INTEGRATION_KEY: VALID,
    },
    stderr: "pipe",
  });
  let log = "";
  transport.stderr.on("data", (chunk) => (log += chunk));
  const client = new Client({ name: "stdio-integration-key-test", version: "0.0.0" });
  t.after(async () => {
    await client.close();
    await repliers.close();
  });
  await client.connect(transport);

  const result = await client.callTool({ name: TOOL.name, arguments: TOOL.args });
  assert.match(JSON.stringify(result), /receivedKey/, JSON.stringify(result));
  assert.doesNotMatch(JSON.stringify(result), /INT-SECRET/);
  assert.ok(repliers.received.every((r) => r.key === "STDIO-KEY"));
  assertNoneCarried(repliers.received);

  const deadline = Date.now() + 5000;
  while (!IGNORED.test(log) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
  assert.match(log, IGNORED);
  assert.doesNotMatch(log, /INT-SECRET/);
});
