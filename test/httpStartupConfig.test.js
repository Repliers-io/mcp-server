import test from "node:test";
import assert from "node:assert/strict";
import { startFakePropelAuth, startMcpServer } from "./helpers/hostedMcpServer.js";

/**
 * A hosted server missing its OAuth credentials used to start anyway, print a warning nobody
 * reads, and then answer 500 to every request — a symptom several layers from its cause. It now
 * refuses to start, and names the variable.
 */
test("hosted mode refuses to start without the credentials it needs", async (t) => {
  const propelAuth = await startFakePropelAuth();
  t.after(async () => {
    await propelAuth.close();
  });

  for (const name of [
    "MCP_PUBLIC_URL",
    "OAUTH_BASE_URL",
    "PROPELAUTH_MCP_INTROSPECT_CLIENT_ID",
    "PROPELAUTH_MCP_INTROSPECT_CLIENT_SECRET",
    // Without it no account can be resolved at all: every authenticated request answers 503.
    "PROPELAUTH_API_KEY",
  ]) {
    await t.test(`${name} is fatal when absent`, async () => {
      await assert.rejects(
        () => startMcpServer({ propelAuth, env: { [name]: "" } }),
        new RegExp(`${name} is required in hosted mode`)
      );
    });
  }
});

test("a self-hosted server needs none of them", async (t) => {
  // Its own REPLIERS_API_KEY is the only authority, so there is no token verification to
  // configure. Demanding OAuth credentials here would break every local and stdio deployment.
  const mcp = await startMcpServer({
    env: {
      REPLIERS_API_KEY: "self-hosted-key",
      MCP_PUBLIC_URL: "",
      OAUTH_BASE_URL: "",
      PROPELAUTH_MCP_INTROSPECT_CLIENT_ID: "",
      PROPELAUTH_MCP_INTROSPECT_CLIENT_SECRET: "",
      PROPELAUTH_API_KEY: "",
    },
  });
  t.after(() => mcp.close());

  const health = await (await fetch(`http://127.0.0.1:${mcp.port}/health`)).json();
  assert.equal(health.oauth_enabled, false);
});

/**
 * The worst available misconfiguration, because it does not look like one: the server starts,
 * /health reports ok, and every anonymous caller is served with one shared Repliers key.
 */
test("a hosted environment with a stray REPLIERS_API_KEY refuses to start", async (t) => {
  const propelAuth = await startFakePropelAuth();
  t.after(async () => {
    await propelAuth.close();
  });

  await assert.rejects(
    () => startMcpServer({ propelAuth, env: { REPLIERS_API_KEY: "left-behind" } }),
    /REPLIERS_API_KEY is set alongside/
  );
});
