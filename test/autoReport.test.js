import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createReporter, captureSignals, autoCaptureNotice } from "../lib/autoReport.js";

const envKeys = ["TRELLO_API_KEY", "TRELLO_API_TOKEN", "TRELLO_LIST_ID", "TRELLO_AUTO_LIST_ID", "FEEDBACK_DRY_RUN"];
const realEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
afterEach(() => {
  for (const [key, value] of Object.entries(realEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function fakeTrello({ failFirst = false, hang = false } = {}) {
  const calls = { cards: [], options: [], comments: [] };
  let n = 0;
  return {
    calls,
    createCard: async (card, options) => {
      calls.cards.push(card);
      calls.options.push(options);
      if (hang) return new Promise(() => {});
      n += 1;
      if (failFirst && n === 1) return { ok: false, error: "Trello responded 500" };
      return { ok: true, cardId: `c${n}` };
    },
    addComment: async (cardId, text) => { calls.comments.push({ cardId, text }); return { ok: true }; },
  };
}
const signal = (key) => ({ key, marker: "🧩", summary: `summary ${key}`, lines: [`line ${key}`] });

test("first occurrence creates one card; repeats in the window become comments on it", async () => {
  const trello = fakeTrello();
  const { report } = createReporter({ trello, enabled: () => true, now: () => 0 });
  await report(signal("unrecognized:type")).done;
  await report(signal("unrecognized:type")).done;
  assert.equal(trello.calls.cards.length, 1);
  assert.match(trello.calls.cards[0].name, /^\[MCP·auto\] 🧩 summary unrecognized:type$/);
  assert.deepEqual(trello.calls.comments, [{ cardId: "c1", text: "line unrecognized:type" }]);
});

test("at most 10 comments per key per window; the rest are suppressed but still count as recorded", async () => {
  const trello = fakeTrello();
  const { report } = createReporter({ trello, enabled: () => true, now: () => 0 });
  const outcomes = [];
  for (let i = 0; i < 12; i += 1) outcomes.push(report(signal("k")));
  await Promise.all(outcomes.map((o) => o.done));
  assert.equal(trello.calls.cards.length, 1);
  assert.equal(trello.calls.comments.length, 10);
  assert.ok(outcomes.every((o) => o.accepted));
});

test("after 24 hours the same key opens a new card", async () => {
  const trello = fakeTrello();
  let time = 0;
  const { report } = createReporter({ trello, enabled: () => true, now: () => time });
  await report(signal("k")).done;
  time = 24 * 60 * 60 * 1000;
  await report(signal("k")).done;
  assert.equal(trello.calls.cards.length, 2);
});

test("the circuit breaker allows 20 new cards per hour and drops the 21st", async () => {
  const trello = fakeTrello();
  let time = 0;
  const { report } = createReporter({ trello, enabled: () => true, now: () => time });
  for (let i = 0; i < 20; i += 1) await report(signal(`k${i}`)).done;
  const dropped = report(signal("k20"));
  assert.equal(dropped.accepted, false);
  assert.equal(await dropped.done, "dropped");
  time = 60 * 60 * 1000;
  assert.equal(report(signal("k21")).accepted, true);
});

// Parse signals are caller-shaped; a flood of them must not hide a Repliers outage (security S1).
test("error and parse signals have separate breaker budgets", async () => {
  const trello = fakeTrello();
  const { report } = createReporter({ trello, enabled: () => true, now: () => 0 });
  for (let i = 0; i < 20; i += 1) await report(signal(`unrecognized:p${i}`)).done;
  assert.equal(report(signal("unrecognized:z")).accepted, false, "the parse budget is spent");
  assert.equal(report(signal("upstream:get-listing:502:bad gateway")).accepted, true, "the error budget is not");
  for (let i = 0; i < 19; i += 1) report(signal(`nlp-scope:m${i}`));
  assert.equal(report(signal("upstream:get-listing:503:x")).accepted, false, "20 error cards spend the error budget");
});

test("disabled (no Trello) records nothing", async () => {
  const trello = fakeTrello();
  const { report } = createReporter({ trello, enabled: () => false, now: () => 0 });
  const outcome = report(signal("k"));
  assert.equal(outcome.accepted, false);
  assert.equal(await outcome.done, "off");
  assert.equal(trello.calls.cards.length, 0);
});

test("a failed card does not hide the defect: the next occurrence tries again", async () => {
  const trello = fakeTrello({ failFirst: true });
  const { report } = createReporter({ trello, enabled: () => true, now: () => 0 });
  assert.equal(await report(signal("k")).done, "failed");
  assert.equal(await report(signal("k")).done, "card");
  assert.equal(trello.calls.cards.length, 2);
});

test("two identical signals in flight at once create one card", async () => {
  const trello = fakeTrello();
  const { report } = createReporter({ trello, enabled: () => true, now: () => 0 });
  await Promise.all([report(signal("k")).done, report(signal("k")).done]);
  assert.equal(trello.calls.cards.length, 1);
});

test("report() returns before Trello answers", () => {
  const trello = fakeTrello({ hang: true });
  const { report } = createReporter({ trello, enabled: () => true, now: () => 0 });
  assert.equal(report(signal("k")).accepted, true);
});

test("card descriptions are capped at Trello's 16384 characters", async () => {
  const trello = fakeTrello();
  const { report } = createReporter({ trello, enabled: () => true, now: () => 0 });
  await report({ ...signal("big"), lines: ["x".repeat(20000)] }).done;
  assert.ok(trello.calls.cards[0].desc.length <= 16384);
});

// ---- signal builders

test("a refine-search success produces no signal: parse corrections are offered to the user, not captured", () => {
  const signals = captureSignals({
    toolName: "refine-search", args: { url: "https://api.repliers.io/listings?class=condo" },
    result: { url: "https://api.repliers.io/listings?city=Cooksville&type=sale", constraintPatch: true,
      changed: { set: { type: "sale", city: "Cooksville" }, remove: ["class"] }, data: {} },
  });
  assert.deepEqual(signals, []);
});

test("a restated Search_Listings prompt produces no signal and repairsNlpId is no longer read", () => {
  const signals = captureSignals({
    toolName: "Search_Listings", args: { prompt: "second", repairsNlpId: "n1" },
    result: { data: { nlpId: "n2", request: { url: "u2" }, appliedFilters: { location: "city=Newmarket", unrecognized: [] } } },
  });
  assert.deepEqual(signals, []);
});

test("discarded parameters: keyed on sorted names", () => {
  const [sig] = captureSignals({
    toolName: "Search_Listings", args: { prompt: "p" },
    result: { data: { nlpId: "n2", request: { url: "u" }, appliedFilters: { unrecognized: ["zeta", "alpha"] } } },
  });
  assert.equal(sig.key, "unrecognized:alpha,zeta");
});

test("captured errors: upstream and nlp-scope keys; non-captured kinds produce nothing", () => {
  const upstream = captureSignals({
    toolName: "get-listing", args: {}, result: { url: "u", status: 502, body: "bad" },
    classification: { kind: "upstream", status: 502, message: "bad gateway", capture: true },
  });
  assert.equal(upstream[0].key, "upstream:get-listing:502:bad gateway");
  const scope = captureSignals({
    toolName: "Search_Listings", args: { prompt: "count homes" }, result: { url: "u", status: 406 },
    classification: { kind: "nlp-scope", status: 406, message: "listings only", capture: true },
  });
  assert.equal(scope[0].key, "nlp-scope:listings only");
  assert.match(scope[0].lines.join("\n"), /count homes/);
  assert.deepEqual(captureSignals({
    toolName: "get-listing", args: {}, result: { url: "u", status: 401 },
    classification: { kind: "account", status: 401, message: "Invalid API key", capture: false },
  }), []);
});

test("a rejected comment resolves failed instead of comment", async () => {
  const trello = { ...fakeTrello(), addComment: async () => ({ ok: false, error: "Trello responded 429" }) };
  const { report } = createReporter({ trello, enabled: () => true, now: () => 0 });
  await report(signal("k")).done;
  assert.equal(await report(signal("k")).done, "failed");
});

test("a duplicate attached to an in-flight card that fails opens a new card", async () => {
  const trello = fakeTrello({ failFirst: true });
  const { report } = createReporter({ trello, enabled: () => true, now: () => 0 });
  const first = report(signal("k"));
  const second = report(signal("k"));
  assert.equal(await first.done, "failed");
  assert.equal(await second.done, "card");
  assert.equal(trello.calls.cards.length, 2);
});

// ---- caller text on the board (security S2)

const lineOf = (sig, label) => sig.lines.find((line) => line.startsWith(`**${label}:**`));
const INJECTION = "condos\n# FIXED see [x](https://evil.example) @board `x`";

test("caller text is one line of inline code, with backticks and @ neutralised", () => {
  const [sig] = captureSignals({
    toolName: "Search_Listings", args: { prompt: INJECTION },
    result: { data: { nlpId: "n2", request: { url: "https://api.repliers.io/listings?city=A\n@b" }, appliedFilters: { unrecognized: ["zeta"] } } },
  });
  assert.equal(lineOf(sig, "Prompt"), "**Prompt:** `condos # FIXED see [x](https://evil.example) ＠board 'x'`");
  for (const line of sig.lines) {
    assert.doesNotMatch(line, /[\r\n]/);
    assert.doesNotMatch(line, /@/);
  }
  assert.match(lineOf(sig, "URL"), /^\*\*URL:\*\* `https:\/\/api\.repliers\.io\/listings\?city=A[^`]*`$/);
  // CR and the Unicode line separator break a line as well as LF does.
  const [other] = captureSignals({
    toolName: "Search_Listings", args: { prompt: `a\r\n# b${String.fromCharCode(0x2028)}# c` },
    result: { data: { request: { url: "u" }, appliedFilters: { unrecognized: ["zeta"] } } },
  });
  assert.equal(lineOf(other, "Prompt"), "**Prompt:** `a # b # c`");
});

test("the prompt is capped at 500 characters and the URL is quoted", () => {
  const [sig] = captureSignals({
    toolName: "Search_Listings", args: { prompt: "p".repeat(800) },
    result: { data: { nlpId: "n1", request: { url: "https://api.repliers.io/listings?city=x`\n@x" }, appliedFilters: { unrecognized: ["zeta"] } } },
  });
  assert.ok(lineOf(sig, "Prompt").length <= "**Prompt:** ``".length + 501, "prompt capped at 500 (+ ellipsis)");
  assert.doesNotMatch(lineOf(sig, "URL"), /@|\n/);
});

// ---- the caller's key, redacted before anything is cut (security S3)

const KEY = "ZQXJ/live+key=7f3a9c2e5b81d4";
// A cut that runs through the key leaves a prefix that a later exact-match redaction cannot see.
const leakedPrefix = (text) => {
  for (const form of [KEY, encodeURIComponent(KEY)]) {
    for (let n = form.length; n >= 6; n -= 1) if (text.includes(form.slice(0, n))) return form.slice(0, n);
  }
  return null;
};
const everything = (sig) => [sig.key, sig.summary, ...sig.lines].join("\n");

test("a key across the 80-character key cut and the 2000-character body cut leaves no prefix", () => {
  const message = `${"y".repeat(72)}${KEY}`;
  const shell = JSON.stringify({ message, echo: "" }).length - 2;
  const body = { message, echo: `${"x".repeat(1995 - shell)}${KEY}` };
  assert.equal(JSON.stringify(body).indexOf(KEY, shell), 1995, "the body echo straddles the 2000 cut");
  const [sig] = captureSignals({
    toolName: "Search_Listings", args: { prompt: "p" }, secret: KEY,
    result: { url: "https://api.repliers.io/nlp?nlpVersion=3", status: 500, body },
    classification: { kind: "upstream", status: 500, message, capture: true },
  });
  assert.ok(lineOf(sig, "Body"), "the listing-search tools keep the body");
  assert.equal(leakedPrefix(everything(sig)), null);
  assert.match(sig.key, /:y{72}\[redacte$/, "redaction ran before the 80-character cut");
});

test("a key across the 200-character summary cut leaves no prefix", () => {
  const message = `${"y".repeat(190)}${KEY}`;
  const [sig] = captureSignals({
    toolName: "get-listing", args: {}, secret: KEY,
    result: { url: "https://api.repliers.io/listings/N1", status: 502, body: null },
    classification: { kind: "upstream", status: 502, message, capture: true },
  });
  assert.equal(leakedPrefix(everything(sig)), null);
});

test("a URL-encoded key echo is scrubbed from URLs and prompts", () => {
  const url = `https://api.repliers.io/listings?class=condo&token=${encodeURIComponent(KEY)}`;
  const [sig] = captureSignals({
    toolName: "Search_Listings", args: { prompt: `homes ${KEY}` }, secret: KEY,
    result: { data: { nlpId: "n1", request: { url }, appliedFilters: { unrecognized: ["zeta"] } } },
  });
  assert.equal(leakedPrefix(everything(sig)), null);
  assert.match(lineOf(sig, "URL"), /token=\[redacted\]/);
});

// ---- third-party personal data (security S4)

test("an error card names the path and parameter names, never their values or a CRM body", () => {
  const [sig] = captureSignals({
    toolName: "search-clients", args: { email: "a@b.c", phone: "1" },
    result: { url: "https://api.repliers.io/clients?phone=1&email=a%40b.c&email=x%40y.z", status: 502,
      body: { clients: [{ email: "a@b.c" }] } },
    classification: { kind: "upstream", status: 502, message: "bad gateway", capture: true },
  });
  assert.equal(lineOf(sig, "URL"), "**URL:** `/clients?email&phone`");
  assert.equal(lineOf(sig, "Body"), undefined);
  assert.doesNotMatch(everything(sig), /a@b\.c|a＠b\.c|a%40b|=1\b/);
});

test("the listing-search tools keep their body on an error card; others do not", () => {
  const error = (toolName) => captureSignals({
    toolName, args: { prompt: "p" },
    result: { url: "https://api.repliers.io/listings?city=Toronto", status: 500, body: { error: "boom" } },
    classification: { kind: "upstream", status: 500, message: "boom", capture: true },
  })[0];
  assert.ok(lineOf(error("Search_Listings"), "Body"));
  assert.ok(lineOf(error("refine-search"), "Body"));
  assert.equal(lineOf(error("send-message"), "Body"), undefined);
  assert.equal(lineOf(error("refine-search"), "URL"), "**URL:** `/listings?city`");
});

// ---- final review F6, F7

test("the summary carries at most 200 characters of the API message", () => {
  const [sig] = captureSignals({
    toolName: "get-listing", args: {}, result: { url: "u", status: 502 },
    classification: { kind: "upstream", status: 502, message: "m".repeat(5000), capture: true },
  });
  assert.ok(sig.summary.length <= "get-listing failed: ".length + 201, `summary was ${sig.summary.length}`);
});

test("an error classification without a message does not throw", () => {
  const signals = captureSignals({
    toolName: "get-listing", args: {}, result: { url: "u" },
    classification: { kind: "upstream", status: 500, capture: true },
  });
  assert.equal(signals.length, 1);
});

// ---- the auto list (owner change 2026-10-15)

test("auto cards are created on TRELLO_AUTO_LIST_ID", async () => {
  process.env.TRELLO_AUTO_LIST_ID = "auto-list";
  const trello = fakeTrello();
  const { report } = createReporter({ trello, enabled: () => true, now: () => 0 });
  await report(signal("k")).done;
  assert.deepEqual(trello.calls.options, [{ listId: "auto-list" }]);
});

test("Trello keys without TRELLO_AUTO_LIST_ID: the default reporter is off and posts nothing", async () => {
  Object.assign(process.env, { TRELLO_API_KEY: "k", TRELLO_API_TOKEN: "t", TRELLO_LIST_ID: "l" });
  delete process.env.TRELLO_AUTO_LIST_ID;
  delete process.env.FEEDBACK_DRY_RUN;
  const trello = fakeTrello();
  const { report } = createReporter({ trello, now: () => 0 });
  const outcome = report(signal("k"));
  assert.equal(outcome.accepted, false);
  assert.equal(await outcome.done, "off");
  assert.equal(trello.calls.cards.length, 0);
});

test("with TRELLO_AUTO_LIST_ID the default reporter is on, and dry-run captures without keys", async () => {
  Object.assign(process.env, { TRELLO_API_KEY: "k", TRELLO_API_TOKEN: "t", TRELLO_LIST_ID: "l", TRELLO_AUTO_LIST_ID: "a" });
  const trello = fakeTrello();
  assert.equal(createReporter({ trello, now: () => 0 }).report(signal("k")).accepted, true);
  for (const key of envKeys) delete process.env[key];
  process.env.FEEDBACK_DRY_RUN = "true";
  assert.equal(createReporter({ trello, now: () => 0 }).report(signal("k2")).accepted, true);
});

test("startup notice: only when Trello is configured but TRELLO_AUTO_LIST_ID is not", () => {
  Object.assign(process.env, { TRELLO_API_KEY: "k", TRELLO_API_TOKEN: "t", TRELLO_LIST_ID: "l" });
  delete process.env.TRELLO_AUTO_LIST_ID;
  delete process.env.FEEDBACK_DRY_RUN;
  assert.equal(autoCaptureNotice(),
    "[CONFIG] TRELLO_AUTO_LIST_ID is not set: server-side capture is off; send-feedback still works.");
  process.env.TRELLO_AUTO_LIST_ID = "a";
  assert.equal(autoCaptureNotice(), null);
  for (const key of envKeys) delete process.env[key];
  assert.equal(autoCaptureNotice(), null, "no Trello at all: nothing to say");
});
