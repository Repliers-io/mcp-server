import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { apiTool as views } from "../tools/repliers/repliers-api/custom/har-listing-views.js";
import { apiTool as showings } from "../tools/repliers/repliers-api/custom/har-showings.js";
import { apiTool as reviews } from "../tools/repliers/repliers-api/custom/har-listing-reviews.js";
import { probeHar } from "../lib/har.js";
import { discoverTools, toolAnnotations } from "../lib/tools.js";
import { callTool } from "../lib/toolCall.js";
import { fakeReporter } from "./helpers/toolDoubles.js";

const realFetch = global.fetch;
afterEach(() => { global.fetch = realFetch; });

function recordFetch(respond = () => Response.json({ success: true, total: 0, data: [] })) {
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url: new URL(url), init });
    return respond(url, init);
  };
  return calls;
}

const auth = { _repliersApiKey: "HAR-KEY", _userAgent: "ua/1" };

const tools = [
  [views, "get-har-listing-views", "/partners/har/listings/views",
    { boardAgentId: "jmeyer", sortBy: "dateTracked:desc" }, "dateTracked"],
  [showings, "get-har-showings", "/partners/har/showingsmart/logs",
    { listingBoardAgentId: "jmeyer", showingBoardAgentId: "BLUMCATH", brokerType: "Showing", sortBy: "showingDate:desc" }, "showingDate"],
  [reviews, "get-har-listing-reviews", "/partners/har/listings/reviews",
    { boardAgentId: "jmeyer", sortBy: "score:desc" }, "createdDate"],
];

for (const [tool, name, route, own, dateColumn] of tools) {
  // Measured against the live API 2026-11-09 (har-partner status.md): each route filters on one
  // column, and for reviews it is not the closing date a model would guess.
  test(`${name}: dateBegin/dateEnd name the column they filter on (${dateColumn})`, () => {
    const { dateBegin, dateEnd } = tool.definition.function.parameters.properties;
    assert.match(dateBegin.description, new RegExp(`\\b${dateColumn}\\b`));
    assert.match(dateEnd.description, new RegExp(`\\b${dateColumn}\\b`));
  });

  test(`${name}: gated on the har entitlement, read-only`, () => {
    assert.equal(tool.entitlement, "har");
    assert.equal(tool.definition.function.name, name);
    assert.equal(toolAnnotations(name).readOnlyHint, true);
    const declared = Object.keys(tool.definition.function.parameters.properties).sort();
    const forwarded = ["mlsNumber", "dateBegin", "dateEnd", "limit", "offset", ...Object.keys(own)].sort();
    assert.deepEqual(declared, forwarded, "every declared parameter is forwarded, and nothing else");
  });

  test(`${name}: forwards its own parameters to ${route} with the caller's key`, async () => {
    const calls = recordFetch();
    const args = { mlsNumber: "77241710", dateBegin: "2026-10-01", dateEnd: "2026-10-31", limit: 10, offset: 20, ...own };
    const result = await tool.function({ ...args, ...auth });
    assert.equal(calls.length, 1);
    const { url, init } = calls[0];
    assert.equal(url.pathname, route);
    assert.deepEqual(Object.fromEntries(url.searchParams), Object.fromEntries(Object.entries(args).map(([k, v]) => [k, String(v)])));
    assert.equal(init.headers["REPLIERS-API-KEY"], "HAR-KEY");
    assert.equal(init.headers["User-Agent"], "ua/1");
    assert.equal(result.url, url.toString());
    assert.deepEqual(result.data, { success: true, total: 0, data: [] });
  });

  test(`${name}: drops arguments the route does not accept, and caps rows at 50 by default`, async () => {
    const calls = recordFetch();
    await tool.function({ resultsPerPage: 1000, status: "A", boardId: 6001, mlsNumber: "", ...auth });
    assert.deepEqual(Object.fromEntries(calls[0].url.searchParams), { limit: "50" });
  });

  test(`${name}: an HTTP failure keeps status and body`, async () => {
    recordFetch(() => Response.json(
      [{ msg: "This API key is configured for a specific agent and cannot be used to access other agents' data." }],
      { status: 403 }));
    const result = await tool.function({ ...auth });
    assert.equal(result.status, 403);
    assert.match(result.error, /configured for a specific agent/);
    assert.ok(Array.isArray(result.body));
  });

  test(`${name}: a network failure is status null`, async () => {
    global.fetch = async () => { throw new TypeError("fetch failed"); };
    const result = await tool.function({ ...auth });
    assert.equal(result.status, null);
    assert.equal(result.error, "fetch failed");
  });
}

// GET /accounts answers an ordinary key its own account only (realtime-api routes/accounts.js).
const account = (configuration) => ({ accountId: 1, apiSecret: "HAR-KEY", configuration });
const enabled = { partners: { har: { enabled: true, brokerCode: "B1" } } };

test("probeHar reads the key's own account, with the given key and a timeout", async () => {
  const calls = recordFetch(() => Response.json({ accounts: [account(enabled)] }));
  assert.equal(await probeHar({ apiKey: "HAR-KEY", userAgent: "ua/2" }), "yes");
  const { url, init } = calls[0];
  assert.equal(url.pathname, "/accounts");
  assert.equal(url.search, "", "the API scopes the answer to the key; no parameter is needed");
  assert.equal(init.headers["REPLIERS-API-KEY"], "HAR-KEY");
  assert.equal(init.headers["User-Agent"], "ua/2");
  assert.ok(init.signal instanceof AbortSignal, "the probe has no timeout");
});

// Mirrors assertHarAccess: enabled === true and a broker code.
const configCases = [
  ["enabled with a broker code", enabled, "yes"],
  ["enabled, agent-scoped", { partners: { har: { enabled: true, brokerCode: "B1", boardAgentId: "jmeyer" } } }, "yes"],
  ["enabled without a broker code", { partners: { har: { enabled: true } } }, "no"],
  ["disabled", { partners: { har: { enabled: false, brokerCode: "B1" } } }, "no"],
  ["other partners only", { partners: {} }, "no"],
  ["no configuration", null, "no"],
];

for (const [name, configuration, verdict] of configCases) {
  test(`probeHar: account ${name} is "${verdict}"`, async () => {
    recordFetch(() => Response.json({ accounts: [account(configuration)] }));
    assert.equal(await probeHar({ apiKey: "K" }), verdict);
  });
}

test("probeHar: a key answered several accounts (super-user) is \"no\"", async () => {
  recordFetch(() => Response.json({ accounts: [account(enabled), account({})] }));
  assert.equal(await probeHar({ apiKey: "K" }), "no");
});

const probeCases = [
  ["invalid Repliers key", 401, [{ msg: "Invalid API key" }], "no"],
  ["missing key", 401, [{ msg: "Missing API key" }], "no"],
  ["a 403 that is not the API's own shape", 403, "", "unknown"],
  ["rate limited", 429, [{ msg: "Too many requests" }], "unknown"],
  ["server error", 502, "<html>bad gateway</html>", "unknown"],
  ["200 without an accounts list", 200, { message: "ok" }, "unknown"],
  ["200 that is not JSON", 200, "<html>", "unknown"],
];

for (const [name, status, body, verdict] of probeCases) {
  test(`probeHar: ${name} (${status}) is "${verdict}"`, async () => {
    recordFetch(() => new Response(body === null ? null : typeof body === "string" ? body : JSON.stringify(body), { status }));
    assert.equal(await probeHar({ apiKey: "K" }), verdict);
  });
}

test("probeHar: a timeout or network failure is \"unknown\"", async () => {
  global.fetch = async () => { throw new DOMException("The operation was aborted due to timeout", "TimeoutError"); };
  assert.equal(await probeHar({ apiKey: "K" }), "unknown");
});

// The API relays HAR's own error body verbatim; it may echo the gateway credential or carry rows.
const leakyBody = { success: false, detail: "upstream failure", api_key: "GATEWAY-SECRET", broker_code: "B1", data: [{ clientEmail: "c@x.test" }] };

test("a HAR-made error body is withheld: status kept, text replaced", async () => {
  recordFetch(() => Response.json(leakyBody, { status: 502 }));
  const result = await views.function({ boardAgentId: "AGENT1", ...auth });
  assert.equal(result.status, 502);
  assert.equal(result.body, null);
  assert.equal(result.error, "The HAR partner service returned HTTP 502.");
});

test("a HAR-made error body reaches neither the model nor a capture card", async () => {
  recordFetch(() => Response.json(leakyBody, { status: 502 }));
  const reporter = fakeReporter();
  const result = await callTool({
    tool: views, toolName: "get-har-listing-views", args: { boardAgentId: "AGENT1" },
    repliersApiKey: "HAR-KEY", userAgent: "ua/1", reporter,
  });
  assert.equal(result.isError, true);
  assert.equal(reporter.reports.length, 1, "a HAR 5xx is still captured as a Repliers service error");
  // The result echoes the caller's own request URL back to them; HAR's body is what must not appear.
  for (const secret of ["GATEWAY-SECRET", "B1", "c@x.test"]) {
    assert.doesNotMatch(JSON.stringify(result), new RegExp(secret), `${secret} reached the model`);
  }
  // Cards carry path and parameter names only — never values, never the key.
  for (const secret of ["GATEWAY-SECRET", "B1", "c@x.test", "AGENT1", "HAR-KEY"]) {
    assert.doesNotMatch(JSON.stringify(reporter.reports), new RegExp(secret), `${secret} reached a card`);
  }
});

test("a caller-supplied _repliersApiKey cannot replace the caller's own key", async () => {
  const calls = recordFetch();
  await callTool({
    tool: views, toolName: "get-har-listing-views", args: { _repliersApiKey: "SOMEONE-ELSES-KEY" },
    repliersApiKey: "MY-KEY", userAgent: "ua/1", reporter: fakeReporter(),
  });
  assert.equal(calls[0].init.headers["REPLIERS-API-KEY"], "MY-KEY");
});

// Fail closed for the future: a HAR tool added without the gate would be shown to every key.
test("every tool on a HAR route is gated on the har entitlement", async () => {
  const roster = await discoverTools();
  const har = roster.filter((tool) => /^get-har-/.test(tool.definition.function.name) || /[\\/]har-[^\\/]+\.js$/.test(tool.path));
  assert.equal(har.length, 3);
  for (const tool of har) assert.equal(tool.entitlement, "har", tool.definition.function.name);
});
