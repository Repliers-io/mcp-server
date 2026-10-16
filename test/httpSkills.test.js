import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as z from "zod/v4";
import { INITIALIZE, mcpFetch, openSession, repoRoot, startFakePropelAuth, startMcpServer } from "./helpers/hostedMcpServer.js";

const SKILL_URI = "skill://repliers-real-estate/SKILL.md";

/** Pulls the JSON-RPC message out of a Streamable HTTP response (SSE or plain JSON). */
async function rpcBody(res) {
  const text = await res.text();
  const data = text.split("\n").find((l) => l.startsWith("data: "));
  return JSON.parse(data ? data.slice(6) : text);
}

/**
 * Both `new Server(...)` sites in mcpServer.js must advertise and serve the skill: lib/skillHandlers.js
 * is tested on its own in skills.test.js, these check the wiring reached each transport — and that
 * on HTTP the skill sits behind the same bearer auth as the tools.
 */
test("HTTP: initialize advertises the skills extension and skills/list serves the skill", async (t) => {
  const propelAuth = await startFakePropelAuth();
  const mcp = await startMcpServer({ propelAuth });
  t.after(async () => {
    mcp.close();
    await propelAuth.close();
  });

  const init = await rpcBody(await mcpFetch(mcp.port, { token: "alice-token", body: INITIALIZE }));
  assert.deepEqual(init.result.capabilities.extensions?.["io.modelcontextprotocol/skills"], {});
  assert.ok(init.result.capabilities.resources);
  assert.ok(init.result.capabilities.tools);

  const sessionId = await openSession(mcp.port, "alice-token");
  const list = await rpcBody(
    await mcpFetch(mcp.port, {
      token: "alice-token",
      sessionId,
      body: { jsonrpc: "2.0", id: 7, method: "skills/list", params: {} },
    })
  );
  assert.equal(list.result.resultType, "complete");
  assert.deepEqual(list.result.skills.map((s) => s.uri), [SKILL_URI]);

  const read = await rpcBody(
    await mcpFetch(mcp.port, {
      token: "alice-token",
      sessionId,
      body: { jsonrpc: "2.0", id: 8, method: "resources/read", params: { uri: SKILL_URI } },
    })
  );
  assert.equal(read.result.contents[0].mimeType, "text/markdown");
});

test("HTTP: skills/list without a token is refused like any other MCP request", async (t) => {
  const propelAuth = await startFakePropelAuth();
  const mcp = await startMcpServer({ propelAuth });
  t.after(async () => {
    mcp.close();
    await propelAuth.close();
  });

  const res = await mcpFetch(mcp.port, { body: { jsonrpc: "2.0", id: 1, method: "skills/list", params: {} } });
  await res.text();
  assert.equal(res.status, 401);
});

test("stdio: initialize advertises the skills extension and skills/get serves the skill", async (t) => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["mcpServer.js"],
    cwd: repoRoot,
    env: { ...process.env, REPLIERS_API_KEY: "stdio-test-key", REPLIERS_API_BASE_URL: "http://127.0.0.1:1" },
    stderr: "ignore",
  });
  const client = new Client({ name: "stdio-skills-test", version: "0.0.0" });
  await client.connect(transport);
  t.after(() => client.close());

  const caps = client.getServerCapabilities();
  assert.deepEqual(caps.extensions?.["io.modelcontextprotocol/skills"], {});
  assert.ok(caps.resources);

  const got = await client.request(
    { method: "skills/get", params: { uri: SKILL_URI } },
    z.object({}).passthrough()
  );
  assert.equal(got.skill.uri, SKILL_URI);
});
