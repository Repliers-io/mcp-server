// test/generatedErrorContract.test.js
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { apiTool } from "../tools/repliers/repliers-api/generated/get-listing.js";
import { apiTool as deleteClient } from "../tools/repliers/repliers-api/generated/delete-client.js";
import { callTool } from "../lib/toolCall.js";
import { fakeReporter } from "./helpers/toolDoubles.js";

const realFetch = global.fetch;
afterEach(() => { global.fetch = realFetch; });

// A DELETE that succeeds often answers with no body. Parsing it as JSON threw inside the try, so a
// success came back as a network failure: an upstream card and advice to repeat a delete.
test("a 2xx with an empty body is a success with data { ok: true }", async () => {
  global.fetch = async () => new Response("", { status: 200 });
  const result = await deleteClient.function({ clientId: 7, _repliersApiKey: "k" });
  assert.match(result.url, /\/clients\/7$/);
  assert.deepEqual(result, { url: result.url, data: { ok: true } });
  global.fetch = async () => new Response(null, { status: 204 });
  assert.deepEqual((await deleteClient.function({ clientId: 7, _repliersApiKey: "k" })).data, { ok: true });
});

test("a 2xx body is parsed when it is JSON and passed through as text when it is not", async () => {
  global.fetch = async () => new Response('{"deleted":true}', { status: 200 });
  assert.deepEqual((await deleteClient.function({ clientId: 7, _repliersApiKey: "k" })).data, { deleted: true });
  global.fetch = async () => new Response("Client deleted", { status: 200 });
  const text = await deleteClient.function({ clientId: 7, _repliersApiKey: "k" });
  assert.equal(text.error, undefined);
  assert.equal(text.data, "Client deleted");
});

test("through callTool an empty 2xx is not an error and records nothing", async () => {
  global.fetch = async () => new Response("", { status: 200 });
  const reporter = fakeReporter();
  const res = await callTool({ tool: deleteClient, toolName: "delete-client", args: { clientId: 7 }, repliersApiKey: "rk-test-0001", reporter });
  assert.equal(res.isError, undefined);
  assert.equal(JSON.parse(res.content[1].text).ok, true);
  assert.equal(reporter.reports.length, 0);
});

test("an HTTP failure keeps its status and parsed body", async () => {
  global.fetch = async () => new Response('[{"msg":"Invalid API key"}]', { status: 401 });
  const result = await apiTool.function({ mlsNumber: "N1", _repliersApiKey: "k" });
  assert.equal(result.status, 401);
  assert.deepEqual(result.body, [{ msg: "Invalid API key" }]);
  assert.equal(result.error, "Invalid API key");
});

test("an empty-body 404 is still distinguishable from a network failure", async () => {
  global.fetch = async () => new Response("", { status: 404 });
  const notFound = await apiTool.function({ mlsNumber: "N1", _repliersApiKey: "k" });
  assert.equal(notFound.status, 404);
  assert.equal(notFound.body, null);

  global.fetch = async () => { throw new TypeError("fetch failed"); };
  const network = await apiTool.function({ mlsNumber: "N1", _repliersApiKey: "k" });
  assert.equal(network.status, null);
  assert.equal(network.error, "fetch failed");
});

test("requests carry the caller's key and User-Agent", async () => {
  let headers;
  global.fetch = async (url, init) => { headers = init.headers; return new Response("{}", { status: 200 }); };
  await apiTool.function({ mlsNumber: "N1", _repliersApiKey: "k1", _userAgent: "repliers-mcp-server/9 (client x/1)" });
  assert.equal(headers["REPLIERS-API-KEY"], "k1");
  assert.equal(headers["User-Agent"], "repliers-mcp-server/9 (client x/1)");
});
