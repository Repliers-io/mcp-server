import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { promptLevel, augmentResult } from "../lib/feedbackHints.js";

const realEnv = {
  TRELLO_API_KEY: process.env.TRELLO_API_KEY,
  TRELLO_API_TOKEN: process.env.TRELLO_API_TOKEN,
  TRELLO_LIST_ID: process.env.TRELLO_LIST_ID,
  FEEDBACK_PROMPT_LEVEL: process.env.FEEDBACK_PROMPT_LEVEL,
  FEEDBACK_AUTO_CAPTURE: process.env.FEEDBACK_AUTO_CAPTURE,
  TRELLO_AUTO_LIST_ID: process.env.TRELLO_AUTO_LIST_ID,
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

test("zero-results suppressed when another present count is non-zero", () => {
  const result = {
    data: { request: { url: "https://api.repliers.io/listings?city=X" }, count: 0, listings: { count: 3 } },
  };
  augmentResult("Search_Listings", result);
  assert.ok(!result.data._feedback.signals.includes("zero-results"));
});

test("zero-results fires on top-level count alone", () => {
  const result = {
    data: { request: { url: "https://api.repliers.io/listings?city=X" }, count: 0 },
  };
  augmentResult("Search_Listings", result);
  assert.ok(result.data._feedback.signals.includes("zero-results"));
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

test("zero-results: non-search tool with count 0 gets no _feedback at low level", () => {
  process.env.FEEDBACK_PROMPT_LEVEL = "low";
  const result = { data: { count: 0 } };
  augmentResult("agents", result);
  assert.equal(result.data._feedback, undefined);
});

test("zero-results: non-search tool with count 0 gets no zero-results signal at high level", () => {
  const result = { data: { count: 0 } };
  augmentResult("clients", result);
  // CRM tools at high level may get generic verify note, but must not have zero-results signal
  if (result.data._feedback) {
    assert.ok(
      !result.data._feedback.signals.includes("zero-results"),
      "non-search tool must not get zero-results signal"
    );
  }
});

test("_feedback serializes FIRST in data — clients truncate huge payloads head-first", () => {
  const result = {
    data: { request: { url: "https://api.repliers.io/listings?minBeds=5" }, listings: { count: 3 } },
  };
  augmentResult("Search_Listings", result);
  assert.equal(Object.keys(result.data)[0], "_feedback");
});

test("no-location-filter: suppressed for union (complexQuery) searches with body.queries", () => {
  const result = {
    data: {
      request: {
        url: "https://api.repliers.io/listings",
        body: { queries: [{ city: "Seattle" }] },
      },
      listings: { count: 5 },
    },
  };
  augmentResult("Search_Listings", result);
  if (result.data._feedback) {
    assert.ok(
      !result.data._feedback.signals.includes("no-location-filter"),
      "no-location-filter must not fire when body.queries is present"
    );
  }
});

test("errors get no _feedback: they carry a _notice from the call path instead", () => {
  const result = { error: "boom", status: 500, data: { count: 5 } };
  augmentResult("Search_Listings", result);
  assert.equal(result._feedback, undefined);
  assert.equal(result.data._feedback, undefined);
});

const refineResult = (changed, constraintPatch = true) => ({
  constraintPatch, changed, data: { count: 28, request: { url: "https://api.repliers.io/listings?city=X" } },
});

test("a constraint-changing refine-search gets a refined note naming what it changed", () => {
  const result = refineResult({ set: { type: "sale", city: "Cooksville", pageNum: 2 }, remove: ["class", "sortBy"] });
  augmentResult("refine-search", result);
  const { signals, note } = result.data._feedback;
  assert.ok(signals.includes("refined"));
  assert.match(note, /changed type, city, class \(removed\), which the original parse missed or mis-mapped/);
  assert.match(note, /send-feedback \(category nlp-misparse, missedConstraints\) can report it to the Repliers team if the user agrees/);
  assert.doesNotMatch(note, /pageNum|sortBy/, "presentation params are not parse gaps");
  assert.equal(Object.keys(result.data)[0], "_feedback");
});

test("full capture mode: no refined offer (the server records the correction), zero-results keeps repairsNlpId", () => {
  process.env.FEEDBACK_AUTO_CAPTURE = "full";
  process.env.TRELLO_AUTO_LIST_ID = "a";
  const refined = refineResult({ set: { type: "sale" }, remove: [] });
  augmentResult("refine-search", refined);
  assert.ok(!(refined.data._feedback?.signals ?? []).includes("refined"));
  const zero = { data: { request: { url: "https://api.repliers.io/listings?city=X" }, listings: { count: 0 } } };
  augmentResult("Search_Listings", zero);
  assert.match(zero.data._feedback.note, /restated Search_Listings prompt with repairsNlpId repairs the rest/);
  process.env.FEEDBACK_AUTO_CAPTURE = "narrow";
  const narrow = { data: { request: { url: "https://api.repliers.io/listings?city=X" }, listings: { count: 0 } } };
  augmentResult("Search_Listings", narrow);
  assert.doesNotMatch(narrow.data._feedback.note, /repairsNlpId/);
});

test("full mode without TRELLO_AUTO_LIST_ID: capture is off, so the refined offer is made", () => {
  process.env.FEEDBACK_AUTO_CAPTURE = "full";
  delete process.env.TRELLO_AUTO_LIST_ID;
  const result = refineResult({ set: { type: "sale" }, remove: [] });
  augmentResult("refine-search", result);
  assert.ok(result.data._feedback.signals.includes("refined"));
  const zero = { data: { request: { url: "https://api.repliers.io/listings?city=X" }, listings: { count: 0 } } };
  augmentResult("Search_Listings", zero);
  assert.doesNotMatch(zero.data._feedback.note, /repairsNlpId/);
});

test("a presentation-only refine-search gets no refined note", () => {
  const result = refineResult({ set: { pageNum: 2 }, remove: [] }, false);
  augmentResult("refine-search", result);
  assert.ok(!(result.data._feedback?.signals ?? []).includes("refined"));
});

test("the refined note needs the feedback channel and a prompt level above off", () => {
  const changed = { set: { type: "sale" }, remove: [] };
  delete process.env.TRELLO_API_KEY;
  const noTrello = refineResult(changed);
  augmentResult("refine-search", noTrello);
  assert.equal(noTrello.data._feedback, undefined);
  process.env.TRELLO_API_KEY = "k";
  process.env.FEEDBACK_PROMPT_LEVEL = "off";
  const off = refineResult(changed);
  augmentResult("refine-search", off);
  assert.equal(off.data._feedback, undefined);
});

test("a Search_Listings result never gets a refined note", () => {
  const result = { ...refineResult({ set: { type: "sale" }, remove: [] }) };
  augmentResult("Search_Listings", result);
  assert.ok(!(result.data._feedback?.signals ?? []).includes("refined"));
});

// ChatGPT's safety layer flags approval-steering wording (design.md §2.2); notes are statements.
test("no note uses imperative or approval-steering wording", () => {
  const results = [
    ["Search_Listings", { data: { request: { url: "https://api.repliers.io/listings?minBeds=5" }, listings: { count: 0 } } }],
    ["Search_Listings", { data: { request: { url: "https://api.repliers.io/listings?city=X" }, listings: { count: 3 }, big: "x".repeat(1_000_001) } }],
    ["refine-search", refineResult({ set: { type: "sale" }, remove: ["class"] })],
  ];
  for (const [tool, result] of results) {
    augmentResult(tool, result);
    assert.doesNotMatch(result.data._feedback.note, /MUST|REQUIRED|no need to ask|without asking|only after|NEXT tool call/);
  }
});
