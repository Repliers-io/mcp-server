import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { promptLevel, augmentResult } from "../lib/feedbackHints.js";

const realEnv = {
  TRELLO_API_KEY: process.env.TRELLO_API_KEY,
  TRELLO_API_TOKEN: process.env.TRELLO_API_TOKEN,
  TRELLO_LIST_ID: process.env.TRELLO_LIST_ID,
  FEEDBACK_PROMPT_LEVEL: process.env.FEEDBACK_PROMPT_LEVEL,
};

beforeEach(() => {
  process.env.TRELLO_API_KEY = "k";
  process.env.TRELLO_API_TOKEN = "t";
  process.env.TRELLO_LIST_ID = "l";
  process.env.FEEDBACK_PROMPT_LEVEL = "high";
});

afterEach(() => {
  for (const [key, value] of Object.entries(realEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("promptLevel defaults to high and rejects unknown values", () => {
  delete process.env.FEEDBACK_PROMPT_LEVEL;
  assert.equal(promptLevel(), "high");
  process.env.FEEDBACK_PROMPT_LEVEL = "banana";
  assert.equal(promptLevel(), "high");
  process.env.FEEDBACK_PROMPT_LEVEL = "low";
  assert.equal(promptLevel(), "low");
});

test("no-location-filter + verify note on Search_Listings at high", () => {
  const result = {
    data: { request: { url: "https://api.repliers.io/listings?minBeds=5" }, listings: { count: 3 } },
  };
  augmentResult("Search_Listings", result);
  assert.deepEqual(result.data._feedback.signals, ["no-location-filter"]);
  assert.match(result.data._feedback.note, /appliedFilters/);
});

test("zero-results detected from nested listings.count", () => {
  const result = {
    data: { request: { url: "https://api.repliers.io/listings?city=X" }, listings: { count: 0 } },
  };
  augmentResult("Search_Listings", result);
  assert.ok(result.data._feedback.signals.includes("zero-results"));
});

test("api-error results get _feedback on the result itself", () => {
  const result = { error: "boom", details: "x" };
  augmentResult("search-locations", result);
  assert.deepEqual(result._feedback.signals, ["api-error"]);
});

test("low level: clean non-search result stays untouched", () => {
  process.env.FEEDBACK_PROMPT_LEVEL = "low";
  const result = { data: { count: 5 } };
  augmentResult("search-locations", result);
  assert.equal(result.data._feedback, undefined);
});

test("off level and missing Trello config suppress everything", () => {
  process.env.FEEDBACK_PROMPT_LEVEL = "off";
  const zero = { data: { listings: { count: 0 } } };
  augmentResult("Search_Listings", zero);
  assert.equal(zero.data._feedback, undefined);
  process.env.FEEDBACK_PROMPT_LEVEL = "high";
  delete process.env.TRELLO_API_KEY;
  augmentResult("Search_Listings", zero);
  assert.equal(zero.data._feedback, undefined);
});
