import test from "node:test";
import assert from "node:assert/strict";
import {
  startFakePropelAuth,
  startMcpServer,
  mcpFetch,
  openSession,
  waitForLog,
} from "./helpers/hostedMcpServer.js";

/**
 * A client whose request the transport refuses — a header we do not speak, a body that is not
 * JSON-RPC, a protocol revision our SDK does not know — is at fault, but the SDK reports it
 * through the same onerror hook it uses for genuine server faults. Logged as "[SERVER ERROR]"
 * with a stack it reads like an outage, and there is no way to tell WHICH client is doing it:
 * clientInfo appears once, in the initialize the transport never complains about.
 */
test("hosted mode blames refused requests on the client that caused them", async (t) => {
  const propelAuth = await startFakePropelAuth();
  const mcp = await startMcpServer({ propelAuth });

  t.after(async () => {
    mcp.close();
    await propelAuth.close();
  });

  const { port } = mcp;

  await t.test("records the client and its protocol version when a session opens", async () => {
    await openSession(port, "alice-token");
    await waitForLog(mcp, /client: hosted-harness\/1\.0\.0, protocol: 2025-06-18/);
  });

  await t.test("rejects an unsupported version on an established session", async () => {
    const sessionId = await openSession(port, "bob-token");
    const res = await mcpFetch(port, {
      token: "bob-token",
      sessionId,
      headers: { "mcp-protocol-version": "2999-01-01" },
      body: { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
    });
    const text = await res.text();
    assert.equal(res.status, 400, `expected the transport to refuse it: ${text}`);
    assert.match(text, /Unsupported protocol version: 2999-01-01/);
  });

  await t.test("logs that rejection as a one-line warning naming the client", async () => {
    await waitForLog(
      mcp,
      /\[WARN\] Refused request from hosted-harness\/1\.0\.0 \(user user-bob\): Bad Request: Unsupported protocol version: 2999-01-01/
    );
    assert.doesNotMatch(
      mcp.log(),
      /\[SERVER ERROR\]/,
      "a client sending a header we do not speak is not a server fault and must not be logged as one"
    );
  });
  /**
   * `initializeMessage` accepts a batch whose members include the initialize, because the SDK
   * does. Reading clientInfo off req.body assumed the object form and lost the client name for
   * exactly the shape that reaches this code path least often and is hardest to debug.
   */
  await t.test("names the client behind a batched initialize", async () => {
    const res = await mcpFetch(port, {
      token: "alice-token",
      body: [
        {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2999-01-02",
            capabilities: {},
            clientInfo: { name: "batch-client", version: "2.0.0" },
          },
        },
      ],
    });
    await res.text();
    await waitForLog(mcp, /client: batch-client\/2\.0\.0, protocol: 2999-01-02/);
  });

  /**
   * clientInfo is client-controlled JSON that this change turns into log attribution. Left raw,
   * a name carrying newlines forges whole log lines - including the [FATAL] any alerting would
   * page on - and an unbounded one is replayed on every refused request.
   */
  await t.test("neutralises clientInfo before it becomes log attribution", async () => {
    const res = await mcpFetch(port, {
      token: "alice-token",
      body: {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18\n[FATAL] forged through protocolVersion",
          capabilities: {},
          clientInfo: {
            name: "innocent\n[FATAL] Uncaught exception: database melted",
            version: "9".repeat(200),
          },
        },
      },
    });
    await res.text();
    await waitForLog(mcp, /client: innocent /);
    assert.doesNotMatch(
      mcp.log(),
      /^\[FATAL\] Uncaught exception: database melted/m,
      "a client forged a log line through clientInfo"
    );
    assert.doesNotMatch(
      mcp.log(),
      /^\[FATAL\] forged through protocolVersion/m,
      "a client forged a log line through protocolVersion"
    );
    assert.doesNotMatch(mcp.log(), /9{65}/, "an unbounded client version reached the log");
  });
});
