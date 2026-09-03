// Shared harness for the hosted-mode HTTP tests: a stub PropelAuth, a stub Repliers API and
// a real `node mcpServer.js --http` child. Lives outside the *.test.js glob so npm test
// does not try to run it as a suite.
import http from "node:http";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Two tenants of the same PropelAuth instance, each with their own Repliers key. */
export function defaultUsers() {
  return {
    "alice-token": { sub: "user-alice", email: "alice@example.test", key: "KEY-ALICE-1" },
    "bob-token": { sub: "user-bob", email: "bob@example.test", key: "KEY-BOB-1" },
  };
}

/**
 * Stands in for PropelAuth: /oauth/userinfo plus the backend user API that mcpServer.js
 * reads repliers_api_key from. Serves `users` live, so rotateKey() is visible to the very
 * next request the server makes.
 */
export async function startFakePropelAuth(users = defaultUsers()) {
  const server = http.createServer((req, res) => {
    const bearer = (req.headers.authorization || "").replace(/^Bearer /, "");
    const url = new URL(req.url, "http://localhost");

    if (url.pathname === "/oauth/userinfo") {
      const user = users[bearer];
      if (!user) return res.writeHead(401).end("{}");
      return res
        .writeHead(200, { "content-type": "application/json" })
        .end(JSON.stringify({ sub: user.sub, email: user.email, email_verified: true }));
    }

    const backend = url.pathname.match(/^\/api\/backend\/v1\/user\/(.+)$/);
    if (backend) {
      const user = Object.values(users).find((u) => u.sub === backend[1]);
      if (!user) return res.writeHead(404).end("{}");
      return res
        .writeHead(200, { "content-type": "application/json" })
        .end(JSON.stringify({ metadata: { repliers_api_key: user.key } }));
    }

    res.writeHead(404).end("{}");
  });

  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return {
    port: server.address().port,
    users,
    rotateKey(sub, key) {
      const user = Object.values(users).find((u) => u.sub === sub);
      assert.ok(user, `no such fake user: ${sub}`);
      user.key = key;
    },
    close: () => new Promise((r) => server.close(r)),
  };
}

/** Stands in for api.repliers.io, recording the REPLIERS-API-KEY each tool call arrives with. */
export async function startFakeRepliersApi() {
  const received = [];
  const server = http.createServer((req, res) => {
    const key = req.headers["repliers-api-key"] ?? null;
    received.push({ key, url: req.url });
    res
      .writeHead(200, { "content-type": "application/json" })
      .end(JSON.stringify({ receivedKey: key }));
  });

  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return {
    port: server.address().port,
    received,
    lastKey: () => received.at(-1)?.key,
    close: () => new Promise((r) => server.close(r)),
  };
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
 * The empty REPLIERS_API_KEY matters: process.loadEnvFile never overrides an already-set
 * variable, so it keeps the repo's own .env from flipping the server into self-hosted mode
 * (which would drop verifyOAuthToken from the chain entirely). Same trick pins the API host.
 */
export async function startMcpServer({ propelAuthPort, repliersApiPort }) {
  const port = await freePort();
  const oauthBase = `http://127.0.0.1:${propelAuthPort}`;
  const child = spawn(process.execPath, ["mcpServer.js", "--http"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      REPLIERS_API_KEY: "",
      REPLIERS_API_BASE_URL: repliersApiPort ? `http://127.0.0.1:${repliersApiPort}` : "",
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

  return { port, child, log: () => log, close: () => child.kill() };
}

export function mcpFetch(port, { token, sessionId, body, method = "POST" }) {
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

export const INITIALIZE = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "hosted-harness", version: "1.0.0" },
  },
};

/** Runs initialize + notifications/initialized and returns the issued session id. */
export async function openSession(port, token) {
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

let nextId = 100;

/** Issues a tools/call and returns { status, text }. */
export async function callTool(port, { token, sessionId, name, args = {} }) {
  const res = await mcpFetch(port, {
    token,
    sessionId,
    body: {
      jsonrpc: "2.0",
      id: nextId++,
      method: "tools/call",
      params: { name, arguments: args },
    },
  });
  return { status: res.status, text: await res.text() };
}
