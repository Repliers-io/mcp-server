// test/apiRequest.test.js
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  userAgent, apiHeaders, apiFetch, readFailure, errorMessage, enableIntegrationKey, integrationKey, integrationKeyNotice,
} from "../lib/apiRequest.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

// The shell running the suite may carry these; every test starts without the integration key, with
// the default API host, and with the key disabled, as in stdio and self-hosted mode.
const realEnv = { REPLIERS_INTEGRATION_KEY: process.env.REPLIERS_INTEGRATION_KEY, REPLIERS_API_BASE_URL: process.env.REPLIERS_API_BASE_URL };
beforeEach(() => {
  for (const name of Object.keys(realEnv)) delete process.env[name];
});
afterEach(() => {
  enableIntegrationKey(false);
  for (const [name, value] of Object.entries(realEnv)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

const VALID = "INT-SECRET-7f3a9c2e1b4d6f8a0c";
const API_URL = "https://api.repliers.io/listings/N1";
const sent = (options) => apiHeaders({ _repliersApiKey: "k" }, { url: API_URL, ...options })["REPLIERS-INTEGRATION-KEY"];

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
  assert.deepEqual(apiHeaders({ _repliersApiKey: "k", _userAgent: "ua/1" }, { json: true, url: API_URL }), {
    "REPLIERS-API-KEY": "k", "User-Agent": "ua/1", Accept: "application/json", "Content-Type": "application/json",
  });
  const noAccept = apiHeaders({ _repliersApiKey: "k" }, { accept: null, url: API_URL });
  assert.equal(noAccept.Accept, undefined);
  assert.equal(noAccept["User-Agent"], `repliers-mcp-server/${version}`);
});

// Hosted only: a self-hosted server sends no integration header at all, never an empty one.
test("REPLIERS-INTEGRATION-KEY is absent while the variable is unset or blank", () => {
  enableIntegrationKey();
  for (const value of [undefined, "", "   ", "\n"]) {
    if (value === undefined) delete process.env.REPLIERS_INTEGRATION_KEY;
    else process.env.REPLIERS_INTEGRATION_KEY = value;
    const headers = apiHeaders({ _repliersApiKey: "k" }, { url: API_URL });
    assert.ok(!("REPLIERS-INTEGRATION-KEY" in headers), `sent for ${JSON.stringify(value)}`);
    assert.equal(integrationKey(), null);
    assert.equal(integrationKeyNotice(), null);
  }
});

test("REPLIERS-INTEGRATION-KEY carries the variable, trimmed, read on every call", () => {
  enableIntegrationKey();
  process.env.REPLIERS_INTEGRATION_KEY = `  ${VALID}\n`;
  assert.equal(sent(), VALID);
  assert.equal(integrationKeyNotice(), null);
  const rotated = "Zk3Qx9_-aB7cD2eF4gH6iJ8kL0mN1oP3qR5sT7uV9wX"; // 43-char base64url
  process.env.REPLIERS_INTEGRATION_KEY = rotated;
  assert.equal(sent(), rotated);
  for (const boundary of ["a".repeat(24), "b".repeat(256)]) {
    process.env.REPLIERS_INTEGRATION_KEY = boundary;
    assert.equal(sent(), boundary);
  }
});

// stdio and self-hosted servers never enable it: their environment (or .env) is not hosted traffic.
test("a valid key is not sent until hosted mode enables it, and the notice says it is ignored", () => {
  process.env.REPLIERS_INTEGRATION_KEY = VALID;
  assert.equal(sent(), undefined);
  assert.equal(integrationKey(), null);
  const notice = integrationKeyNotice();
  assert.match(notice, /^\[CONFIG\] REPLIERS_INTEGRATION_KEY is ignored outside hosted HTTP mode/);
  assert.ok(!notice.includes(VALID));
  enableIntegrationKey();
  assert.equal(sent(), VALID);
  enableIntegrationKey(false);
  assert.equal(sent(), undefined);
});

// Only the issued format passes. A CR/LF makes fetch throw an error that quotes the value; a short
// or literal value would let the scrubber mangle text or confirm guesses.
test("anything but the issued format is dropped, and the notice never repeats it", () => {
  enableIntegrationKey();
  const invalid = [
    `${VALID}\r\nX-Evil-1`, // invalid only because of the CRLF
    "abcdefghijklmnopqrstuvw", // 23 characters
    "undefined", "null", "0",
    `${VALID}\u0007`, `${VALID}é`, `${VALID} x`, `${VALID}/+=`, "x".repeat(257),
  ];
  const notices = new Set();
  for (const value of invalid) {
    process.env.REPLIERS_INTEGRATION_KEY = value;
    const headers = apiHeaders({ _repliersApiKey: "k" }, { url: API_URL });
    assert.ok(!("REPLIERS-INTEGRATION-KEY" in headers), `sent for ${JSON.stringify(value)}`);
    assert.doesNotThrow(() => new Headers(headers));
    const notice = integrationKeyNotice();
    assert.match(notice, /^\[CONFIG\] REPLIERS_INTEGRATION_KEY is set but invalid/);
    assert.ok(!notice.includes("INT-SECRET"), `notice repeats part of ${JSON.stringify(value)}`);
    notices.add(notice);
  }
  assert.equal(notices.size, 1, "the notice must not vary with the value");
});

test("tool args can neither set nor override the integration key", () => {
  enableIntegrationKey();
  const args = { _repliersApiKey: "k", _repliersIntegrationKey: "evil", REPLIERS_INTEGRATION_KEY: "evil", "REPLIERS-INTEGRATION-KEY": "evil" };
  assert.ok(!("REPLIERS-INTEGRATION-KEY" in apiHeaders(args, { url: API_URL })));
  process.env.REPLIERS_INTEGRATION_KEY = VALID;
  assert.equal(apiHeaders(args, { url: API_URL })["REPLIERS-INTEGRATION-KEY"], VALID);
});

test("the integration key goes only to the configured API origin", () => {
  enableIntegrationKey();
  process.env.REPLIERS_INTEGRATION_KEY = VALID;
  assert.equal(sent({ url: "https://api.repliers.io/listings/N1" }), VALID);
  for (const url of ["https://dev.repliers.io/listings/N1", "https://api.repliers.io@evil.example/x", "http://api.repliers.io/x", "not a url"]) {
    assert.equal(sent({ url }), undefined, url);
  }
  process.env.REPLIERS_API_BASE_URL = "https://dev.repliers.io";
  assert.equal(sent({ url: "https://dev.repliers.io/listings/N1" }), VALID, "follows REPLIERS_API_BASE_URL");
  assert.equal(sent({ url: "https://api.repliers.io/listings/N1" }), undefined);
});

// A destination-less call could hand the key anywhere: apiHeaders refuses rather than guess.
test("apiHeaders requires a url", () => {
  enableIntegrationKey();
  process.env.REPLIERS_INTEGRATION_KEY = VALID;
  for (const url of [undefined, null, ""]) {
    assert.throws(() => apiHeaders({ _repliersApiKey: "k" }, { url }), /url is required/, String(url));
  }
  assert.throws(() => apiHeaders({ _repliersApiKey: "k" }), /url is required/);
});

// The API never redirects. fetch keeps custom headers across one, so following a 3xx would hand
// both keys to whatever host Location names: apiFetch returns the 3xx as a failure instead.
test("apiFetch never follows a redirect and hands the 3xx back as the response", async () => {
  const realFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response("", { status: 302, headers: { location: "https://evil.example/x" } });
  };
  try {
    const response = await apiFetch(new URL("https://api.repliers.io/listings/N1"), { _repliersApiKey: "k" }, { method: "GET" });
    assert.equal(response.status, 302);
    assert.equal(calls.length, 1, "the Location host was never contacted");
    assert.equal(calls[0].url, "https://api.repliers.io/listings/N1");
    assert.equal(calls[0].init.redirect, "manual");
    assert.equal(calls[0].init.method, "GET");
  } finally {
    global.fetch = realFetch;
  }
});

test("apiFetch builds the headers from args and forwards method, body, signal, json and accept", async () => {
  const realFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, init) => { calls.push({ url, init }); return new Response("{}", { status: 200 }); };
  try {
    const signal = AbortSignal.timeout(1000);
    await apiFetch("https://api.repliers.io/listings", { _repliersApiKey: "k", _userAgent: "ua/1" },
      { method: "POST", json: true, body: "{}", signal });
    const { init } = calls[0];
    assert.equal(init.method, "POST");
    assert.equal(init.body, "{}");
    assert.equal(init.signal, signal);
    assert.equal(init.headers["REPLIERS-API-KEY"], "k");
    assert.equal(init.headers["User-Agent"], "ua/1");
    assert.equal(init.headers["Content-Type"], "application/json");
    assert.equal(init.headers.Accept, "application/json");
    assert.equal(init.json, undefined, "json is not a fetch option");
    assert.equal(init.accept, undefined, "accept is not a fetch option");

    await apiFetch("https://api.repliers.io/x", { _repliersApiKey: "k" }, { accept: "image/*" });
    assert.equal(calls[1].init.headers.Accept, "image/*");
    assert.equal(calls[1].init.headers["Content-Type"], undefined);
  } finally {
    global.fetch = realFetch;
  }
});

test("apiFetch passes the url to the origin guard, so a foreign host never gets the integration key", async () => {
  enableIntegrationKey();
  process.env.REPLIERS_INTEGRATION_KEY = VALID;
  const realFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, init) => { calls.push({ url, init }); return new Response("{}", { status: 200 }); };
  try {
    await apiFetch("https://api.repliers.io/listings", { _repliersApiKey: "k" });
    assert.equal(calls[0].init.headers["REPLIERS-INTEGRATION-KEY"], VALID);
    await apiFetch("https://dev.repliers.io/listings", { _repliersApiKey: "k" });
    assert.equal(calls[1].init.headers["REPLIERS-INTEGRATION-KEY"], undefined);
  } finally {
    global.fetch = realFetch;
  }
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
