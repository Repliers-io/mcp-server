// Every tool and lib helper that calls the Repliers API goes through apiFetch(): with the key
// live, every request to the configured API origin carries REPLIERS-INTEGRATION-KEY, and no
// request anywhere else does; with it unset or not enabled (stdio, self-hosted), none does; and no
// request to the API origin follows a redirect, which would carry both keys to the Location host.
// Each tool is called with minimal arguments against a stubbed fetch, so a tool that stopped using
// apiFetch() fails here by name.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { discoverTools } from "../lib/tools.js";
import { boardsForMlsNumber } from "../lib/boardId.js";
import { probeHar, harRequest, HAR_ROUTES } from "../lib/har.js";
import { apiBaseUrl, apiOrigin } from "../lib/apiBase.js";
import { enableIntegrationKey } from "../lib/apiRequest.js";

const KEY = "INT-SECRET-alltools-7f3a9c2e1b4d";
// Tools that make no request to the API origin, and why.
const NO_API = new Set(["send-feedback"]); // posts to Trello

const realFetch = global.fetch;
const realEnv = { ...process.env };
const seen = [];
let tools;

before(async () => {
  delete process.env.REPLIERS_API_BASE_URL;
  delete process.env.FEEDBACK_DRY_RUN;
  // send-feedback is in the roster only when Trello is configured at import.
  Object.assign(process.env, { TRELLO_API_KEY: "t", TRELLO_API_TOKEN: "t", TRELLO_LIST_ID: "l" });
  global.fetch = async (url, init = {}) => {
    const headers = new Headers(init.headers ?? {});
    seen.push({ url: new URL(String(url)), integration: headers.get("repliers-integration-key"), redirect: init.redirect });
    if (String(url).includes("/images/download")) {
      return new Response(new Uint8Array([1, 2]), { status: 200, headers: { "content-type": "image/jpeg" } });
    }
    if (String(url).includes("trello.com")) return new Response('{"id":"c1","shortUrl":"u"}', { status: 200 });
    return new Response(JSON.stringify({ listings: [], aggregates: { boardId: { 1: 1 } }, accounts: [{}], request: { url: "x" } }), { status: 200 });
  };
  tools = await discoverTools();
});

after(() => {
  global.fetch = realFetch;
  enableIntegrationKey(false);
  for (const key of Object.keys(process.env)) if (!(key in realEnv)) delete process.env[key];
  Object.assign(process.env, realEnv);
});

const fill = (schema = {}) => {
  if (schema.enum) return schema.enum[0];
  if (schema.type === "integer" || schema.type === "number") return 1;
  if (schema.type === "boolean") return false;
  if (schema.type === "array") return ["x"];
  if (schema.type === "object") return {};
  return "x";
};

function argsFor(fn) {
  const args = { _repliersApiKey: "k", _userAgent: "ua/1" };
  for (const name of fn.parameters?.required ?? []) args[name] = fill(fn.parameters.properties?.[name]);
  if (fn.name === "refine-search") Object.assign(args, { url: `${apiBaseUrl()}/listings?city=X`, city: "Y" });
  return args;
}

// Every request each tool makes, by tool name, then the lib helpers' under "lib:<name>".
async function sweep() {
  const byTool = new Map();
  const capture = async (name, call) => {
    const start = seen.length;
    await call();
    byTool.set(name, seen.slice(start));
  };
  for (const tool of tools) {
    const fn = tool.definition.function;
    await capture(fn.name, () => tool.function(argsFor(fn)));
  }
  await capture("lib:boardsForMlsNumber", () => boardsForMlsNumber("N1", { _repliersApiKey: "k" }));
  await capture("lib:probeHar", () => probeHar({ apiKey: "k", userAgent: "ua/1" }));
  await capture("lib:harRequest", () => harRequest(HAR_ROUTES.views, ["mlsNumber"], { _repliersApiKey: "k", mlsNumber: "N1" }));
  return byTool;
}

const atApi = (request) => request.url.origin === apiOrigin();

test("the roster under test is the whole roster", () => {
  assert.ok(tools.length >= 45, `only ${tools.length} tools discovered`);
  const names = tools.map((tool) => tool.definition.function.name);
  for (const name of [...NO_API, "Get_Listing_Image"]) assert.ok(names.includes(name), `${name} is not in the roster`);
});

test("with the key live, every request to the API origin carries it and no other request does", async () => {
  process.env.REPLIERS_INTEGRATION_KEY = KEY;
  enableIntegrationKey();
  const byTool = await sweep();
  for (const [name, requests] of byTool) {
    const api = requests.filter(atApi);
    if (NO_API.has(name)) {
      assert.equal(api.length, 0, `${name} reached the API origin`);
    } else {
      assert.ok(api.length >= 1, `${name} made no request to the API origin: ${requests.map((r) => r.url.href)}`);
    }
    for (const request of api) {
      assert.equal(request.integration, KEY, `${name} → ${request.url.pathname} lacks the key`);
      assert.equal(request.redirect, "manual", `${name} → ${request.url.pathname} would follow a redirect`);
    }
    for (const request of requests.filter((r) => !atApi(r))) {
      assert.equal(request.integration, null, `${name} sent the key to ${request.url.origin}`);
    }
  }
});

test("with the key unset, or set but not enabled (stdio, self-hosted), no request carries it", async () => {
  for (const setup of [
    () => { delete process.env.REPLIERS_INTEGRATION_KEY; enableIntegrationKey(); },
    () => { process.env.REPLIERS_INTEGRATION_KEY = KEY; enableIntegrationKey(false); },
  ]) {
    setup();
    const byTool = await sweep();
    const requests = [...byTool.values()].flat();
    assert.ok(requests.filter(atApi).length >= tools.length - NO_API.size);
    for (const [name, made] of byTool) {
      for (const request of made) assert.equal(request.integration, null, `${name} → ${request.url.href}`);
    }
  }
});
