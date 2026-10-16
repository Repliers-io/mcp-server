// test/apiRequest.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { userAgent, apiHeaders, readFailure, errorMessage } from "../lib/apiRequest.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test("User-Agent names this server, and the MCP client when it announced itself", () => {
  assert.equal(userAgent(), `repliers-mcp-server/${version}`);
  assert.equal(userAgent({ name: "ChatGPT", version: "1.2" }), `repliers-mcp-server/${version} (client ChatGPT/1.2)`);
  assert.equal(userAgent({ name: "codex" }), `repliers-mcp-server/${version} (client codex)`);
});

// clientInfo is client-controlled JSON; a header must not carry control characters or unbounded text.
test("client-controlled clientInfo is reduced to printable ASCII and capped at 64 characters", () => {
  const ua = userAgent({ name: "Evil\r\nX-Injected: 1" + "a".repeat(200), version: "1" });
  assert.doesNotMatch(ua, /[\r\n]/);
  const name = ua.match(/\(client (.*)\/1\)$/)[1];
  assert.ok(name.length <= 64, `name was ${name.length} chars`);
});

test("apiHeaders carries key, User-Agent, Accept, and Content-Type only for JSON bodies", () => {
  assert.deepEqual(apiHeaders({ _repliersApiKey: "k", _userAgent: "ua/1" }, { json: true }), {
    "REPLIERS-API-KEY": "k", "User-Agent": "ua/1", Accept: "application/json", "Content-Type": "application/json",
  });
  const noAccept = apiHeaders({ _repliersApiKey: "k" }, { accept: null });
  assert.equal(noAccept.Accept, undefined);
  assert.equal(noAccept["User-Agent"], `repliers-mcp-server/${version}`);
});

test("readFailure keeps the status and parses JSON, text, or nothing", async () => {
  assert.deepEqual(await readFailure(new Response('[{"msg":"Invalid API key"}]', { status: 401 })),
    { status: 401, body: [{ msg: "Invalid API key" }] });
  assert.deepEqual(await readFailure(new Response("", { status: 404 })), { status: 404, body: null });
  assert.deepEqual(await readFailure(new Response("<html>bad gateway</html>", { status: 502 })),
    { status: 502, body: "<html>bad gateway</html>" });
});

test("errorMessage flattens every error body shape the API uses", () => {
  assert.equal(errorMessage([{ msg: "Invalid API key" }]), "Invalid API key");
  assert.equal(errorMessage([{ param: "resultsPerPage", msg: "must be a number" }]), "resultsPerPage: must be a number");
  assert.equal(errorMessage({ request: { error: "Currently this NLP endpoint is designed to search listings only. " } }),
    "Currently this NLP endpoint is designed to search listings only.");
  assert.equal(errorMessage({ message: "Your account does not have access to this feature" }),
    "Your account does not have access to this feature");
  assert.equal(errorMessage(null), "");
  assert.equal(errorMessage("plain text"), "plain text");
});

// The message reaches the model in _notice; an error page or echo can run to megabytes.
test("errorMessage is capped at 1000 characters whatever the body shape", () => {
  for (const body of [{ message: "m".repeat(5000) }, "t".repeat(5000), [{ param: "p", msg: "v".repeat(5000) }], { other: "o".repeat(5000) }]) {
    const message = errorMessage(body);
    assert.ok(message.length <= 1000, `was ${message.length}`);
    assert.ok(message.endsWith("…"), "a cut message says it was cut");
  }
  assert.equal(errorMessage("short"), "short");
});
