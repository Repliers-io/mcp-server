import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Two tenants of the same PropelAuth instance, each with their own Repliers key.
const USERS = {
  "alice-token": { sub: "user-alice", email: "alice@example.test", key: "KEY-ALICE" },
  "bob-token": { sub: "user-bob", email: "bob@example.test", key: "KEY-BOB" },
};

/** Stand-in for PropelAuth: /oauth/userinfo + the backend user API mcpServer.js reads metadata from. */
function startFakePropelAuth() {
  const server = http.createServer((req, res) => {
    const bearer = (req.headers.authorization || "").replace(/^Bearer /, "");
    const url = new URL(req.url, "http://localhost");

    if (url.pathname === "/oauth/userinfo") {
      const user = USERS[bearer];
      if (!user) return res.writeHead(401).end("{}");
      return res
        .writeHead(200, { "content-type": "application/json" })
        .end(JSON.stringify({ sub: user.sub, email: user.email, email_verified: true }));
    }

    const backend = url.pathname.match(/^\/api\/backend\/v1\/user\/(.+)$/);
    if (backend) {
      const user = Object.values(USERS).find((u) => u.sub === backend[1]);
      if (!user) return res.writeHead(404).end("{}");
      return res
        .writeHead(200, { "content-type": "application/json" })
        .end(JSON.stringify({ metadata: { repliers_api_key: user.key } }));
    }

    res.writeHead(404).end("{}");
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

function freePort() {
  return new Promise((resolve) => {
    const probe = http.createServer();
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

/**
 * Boots the real mcpServer.js in hosted mode.
 * REPLIERS_API_KEY='' matters: process.loadEnvFile never overrides an already-set
 * variable, so the empty string keeps the repo's own .env from flipping the server
 * into self-hosted mode (which would bypass verifyOAuthToken entirely).
 */
async function startMcpServer(propelAuthPort) {
  const port = await freePort();
  const oauthBase = `http://127.0.0.1:${propelAuthPort}`;
  const child = spawn(process.execPath, ["mcpServer.js", "--http"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      REPLIERS_API_KEY: "",
      PORT: String(port),
      OAUTH_BASE_URL: oauthBase,
      OAUTH_USERINFO_ENDPOINT: `${oauthBase}/oauth/userinfo`,
      PROPELAUTH_API_KEY: "propelauth-test-key",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));

  const deadline = Date.now() + 20000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`server exited early:\n${log}`);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      if (res.ok) {
        const body = await res.json();
        assert.equal(body.oauth_enabled, true, `server must be in hosted mode:\n${log}`);
        break;
      }
    } catch {
      /* not listening yet */
    }
    if (Date.now() > deadline) throw new Error(`server never became ready:\n${log}`);
    await new Promise((r) => setTimeout(r, 100));
  }

  return { port, child, log: () => log };
}

function mcpFetch(port, { token, sessionId, body, method = "POST" }) {
  const headers = {
    accept: "application/json, text/event-stream",
    "content-type": "application/json",
  };
  if (token) headers.authorization = `Bearer ${token}`;
  if (sessionId) headers["mcp-session-id"] = sessionId;
  return fetch(`http://127.0.0.1:${port}/mcp`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

const INITIALIZE = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "ownership-test", version: "1.0.0" },
  },
};

/** Runs initialize + notifications/initialized and returns the issued session id. */
async function openSession(port, token) {
  const res = await mcpFetch(port, { token, body: INITIALIZE });
  const text = await res.text(); // drain the SSE stream so the connection is released
  assert.equal(res.status, 200, `initialize failed: ${text}`);
  const sessionId = res.headers.get("mcp-session-id");
  assert.ok(sessionId, "server did not issue an mcp-session-id");

  const ack = await mcpFetch(port, {
    token,
    sessionId,
    body: { jsonrpc: "2.0", method: "notifications/initialized" },
  });
  await ack.text();
  return sessionId;
}

test("hosted mode binds MCP sessions to the authenticated caller", async (t) => {
  const propelAuth = await startFakePropelAuth();
  const mcp = await startMcpServer(propelAuth.address().port);

  t.after(async () => {
    mcp.child.kill();
    await new Promise((r) => propelAuth.close(r));
  });

  const { port } = mcp;
  const aliceSession = await openSession(port, "alice-token");

  await t.test("rejects a foreign caller presenting another user's session id", async () => {
    const res = await mcpFetch(port, {
      token: "bob-token", // Bob's own valid token — he is authenticated, just not the owner
      sessionId: aliceSession,
      body: { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
    });
    const text = await res.text();
    assert.equal(
      res.status,
      404,
      `Bob rode Alice's session and would have used her Repliers key. Response: ${text}`
    );
  });

  await t.test("still serves the session to its rightful owner", async () => {
    const res = await mcpFetch(port, {
      token: "alice-token",
      sessionId: aliceSession,
      body: { jsonrpc: "2.0", id: 3, method: "tools/list", params: {} },
    });
    const text = await res.text();
    assert.equal(res.status, 200, `owner was locked out of her own session: ${text}`);
    assert.match(text, /Search_Listings/, `expected a tool roster, got: ${text}`);
  });

  await t.test("refuses to let a foreign caller terminate the session", async () => {
    const attack = await mcpFetch(port, {
      token: "bob-token",
      sessionId: aliceSession,
      method: "DELETE",
    });
    await attack.text();
    assert.equal(attack.status, 404, "Bob was able to address Alice's session with DELETE");

    const survivor = await mcpFetch(port, {
      token: "alice-token",
      sessionId: aliceSession,
      body: { jsonrpc: "2.0", id: 4, method: "tools/list", params: {} },
    });
    await survivor.text();
    assert.equal(survivor.status, 200, "Alice's session did not survive Bob's DELETE");
  });

  await t.test("rejects an unknown session id", async () => {
    const res = await mcpFetch(port, {
      token: "alice-token",
      sessionId: "00000000-0000-4000-8000-000000000000",
      body: { jsonrpc: "2.0", id: 5, method: "tools/list", params: {} },
    });
    await res.text();
    assert.equal(res.status, 404);
  });
});
