import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { apiBaseUrl, apiOrigin } from "../lib/apiBase.js";

const realValue = process.env.REPLIERS_API_BASE_URL;
beforeEach(() => { delete process.env.REPLIERS_API_BASE_URL; });
afterEach(() => {
  if (realValue === undefined) delete process.env.REPLIERS_API_BASE_URL;
  else process.env.REPLIERS_API_BASE_URL = realValue;
});

test("defaults to the production host when unset or blank", () => {
  assert.equal(apiBaseUrl(), "https://api.repliers.io");
  process.env.REPLIERS_API_BASE_URL = "   ";
  assert.equal(apiBaseUrl(), "https://api.repliers.io");
});

test("an override replaces the host for everything that asks", () => {
  process.env.REPLIERS_API_BASE_URL = "https://staging.repliers.io";
  assert.equal(apiBaseUrl(), "https://staging.repliers.io");
});

// A trailing slash is the classic way to get `https://host//listings` — strip it once, here,
// instead of in each of the 40-odd call sites that concatenate a path.
test("trailing slashes are stripped", () => {
  process.env.REPLIERS_API_BASE_URL = "https://staging.repliers.io///";
  assert.equal(apiBaseUrl(), "https://staging.repliers.io");
});

test("apiOrigin follows the override and survives a malformed one", () => {
  process.env.REPLIERS_API_BASE_URL = "https://staging.repliers.io/api";
  assert.equal(apiOrigin(), "https://staging.repliers.io");
  process.env.REPLIERS_API_BASE_URL = "not a url";
  assert.equal(apiOrigin(), "https://api.repliers.io");
});

// The 39 generated tools are the bulk of the roster; the override is worthless if it stops at the
// hand-written ones. This proves it reaches a generated tool's actual request.
test("a generated tool calls the configured host", async () => {
  process.env.REPLIERS_API_BASE_URL = "https://staging.repliers.io";
  const realFetch = global.fetch;
  let called;
  global.fetch = async (url) => {
    called = new URL(String(url));
    return { ok: true, json: async () => ({}) };
  };
  try {
    const { apiTool } = await import("../tools/repliers/repliers-api/generated/get-listing.js");
    await apiTool.function({ mlsNumber: "X1", _repliersApiKey: "k" });
    assert.equal(called.origin, "https://staging.repliers.io");
    assert.match(called.pathname, /^\/listings\/X1/);
  } finally {
    global.fetch = realFetch;
  }
});
