// Capture in FEEDBACK_AUTO_CAPTURE=full mode: the pre-2026-10-15 behaviour (refine corrections and
// restated searches are captured too). Restored from the pre-change snapshot; narrow mode is covered
// by autoReport.test.js and toolCallCapture.test.js.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { captureSignals } from "../lib/autoReport.js";
import { callTool, createSessionState } from "../lib/toolCall.js";
import { fakeTool, fakeReporter } from "./helpers/toolDoubles.js";

const realEnv = { ...process.env };
beforeEach(() => {
  process.env.TRELLO_API_KEY = "k"; process.env.TRELLO_API_TOKEN = "t"; process.env.TRELLO_LIST_ID = "l";
  process.env.TRELLO_AUTO_LIST_ID = "auto";
  process.env.FEEDBACK_PROMPT_LEVEL = "high";
  process.env.FEEDBACK_AUTO_CAPTURE = "full";
});
afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in realEnv)) delete process.env[key];
  Object.assign(process.env, realEnv);
});

const session = () => ({ searches: new Map() });
const lineOf = (sig, label) => sig.lines.find((line) => line.startsWith(`**${label}:**`));
const KEY = "ZQXJ/live+key=7f3a9c2e5b81d4";
const leakedPrefix = (text) => {
  for (const form of [KEY, encodeURIComponent(KEY)]) {
    for (let n = form.length; n >= 6; n -= 1) if (text.includes(form.slice(0, n))) return form.slice(0, n);
  }
  return null;
};
const everything = (sig) => [sig.key, sig.summary, ...sig.lines].join("\n");
const payload = (res) => JSON.parse(res.content[1].text);
const U = "https://api.repliers.io/listings?class=condo&city=Cooksville";
const search = fakeTool("Search_Listings", async () => ({
  url: "https://api.repliers.io/nlp?nlpVersion=3",
  data: { appliedFilters: { location: "city=Cooksville", type: null, unrecognized: [] }, request: { url: U }, nlpId: "n1", listings: { count: 3 } },
}));
const refine = (to) => fakeTool("refine-search", async () => ({
  url: to, constraintPatch: true, changed: { set: { type: "sale" }, remove: [] }, data: { count: 2 },
}));

test("refine correction: keyed on changed names, carries the origin prompt and nlpId", () => {
  const s = session();
  s.searches.set("https://api.repliers.io/listings?class=condo", { nlpId: "n1", prompt: "condos in Cooksville", url: "u", appliedFilters: {} });
  const [sig] = captureSignals({
    toolName: "refine-search",
    args: { url: "https://api.repliers.io/listings?class=condo" },
    result: { url: "https://api.repliers.io/listings?city=Cooksville&type=sale", constraintPatch: true,
      changed: { set: { type: "sale", city: "Cooksville", resultsPerPage: 5 }, remove: ["class"] }, data: {} },
    session: s,
  });
  assert.equal(sig.key, "refine:-class,city,type");
  assert.match(sig.lines.join("\n"), /condos in Cooksville/);
  assert.match(sig.lines.join("\n"), /n1/);
});

test("presentation-only refines produce no signal", () => {
  const signals = captureSignals({
    toolName: "refine-search", args: { url: "u" },
    result: { url: "u2", constraintPatch: false, changed: { set: { pageNum: 2 }, remove: [] }, data: {} },
    session: session(),
  });
  assert.deepEqual(signals, []);
});

test("restated search: keyed on the filter families the new parse gained", () => {
  const s = session();
  s.searches.set("n1", { nlpId: "n1", prompt: "first", url: "u1", appliedFilters: { location: "city=Newmarket", postalCode: null } });
  const [sig] = captureSignals({
    toolName: "Search_Listings", args: { prompt: "second", repairsNlpId: "n1" },
    result: { data: { nlpId: "n2", request: { url: "u2" },
      appliedFilters: { location: "city=Newmarket", postalCode: "zip=L3Y", unrecognized: [], other: {} } } },
    session: s,
  });
  assert.equal(sig.key, "restated:postalCode");
  assert.match(sig.lines.join("\n"), /first/);
});

test("restated search with an unknown earlier nlpId is still recorded", () => {
  const [sig] = captureSignals({
    toolName: "Search_Listings", args: { prompt: "second", repairsNlpId: "gone" },
    result: { data: { nlpId: "n2", request: { url: "u2" }, appliedFilters: { unrecognized: [] } } },
    session: session(),
  });
  assert.equal(sig.key, "restated:unknown");
});

test("repairsNlpId null (strict function calling) is not a restated search", () => {
  const signals = captureSignals({
    toolName: "Search_Listings", args: { prompt: "p", repairsNlpId: null },
    result: { data: { nlpId: "n2", request: { url: "u" }, appliedFilters: { unrecognized: [] } } },
    session: session(),
  });
  assert.deepEqual(signals, []);
});

test("refine values, removed names and URLs are quoted; the prompt is capped at 500 characters", () => {
  const s = session();
  const before = "https://api.repliers.io/listings?class=condo";
  s.searches.set(before, { nlpId: "n1", prompt: `${"p".repeat(800)}`, url: before, appliedFilters: {} });
  const [sig] = captureSignals({
    toolName: "refine-search", args: { url: before },
    result: { url: `${before}&city=x`, constraintPatch: true, changed: { set: { city: "A`\n@x" }, remove: ["class"] }, data: {} },
    session: s,
  });
  assert.ok(lineOf(sig, "Prompt").length <= "**Prompt:** ``".length + 501, "prompt capped at 500 (+ ellipsis)");
  assert.ok(sig.lines.includes(`- set city = \`"A'\\n＠x"\``), sig.lines.join("\n"));
  assert.ok(sig.lines.includes("- removed `class`"));
  assert.equal(lineOf(sig, "URL before"), `**URL before:** \`${before}\``);
});

test("a repairsNlpId that is not a plain id is ignored: no restated signal", () => {
  for (const repairsNlpId of ["x y", "n1\n@board", "`n1`", "a".repeat(65)]) {
    const signals = captureSignals({
      toolName: "Search_Listings", args: { prompt: "p", repairsNlpId },
      result: { data: { nlpId: "n2", request: { url: "u" }, appliedFilters: { unrecognized: [] } } },
      session: session(),
    });
    assert.deepEqual(signals, [], `repairsNlpId ${JSON.stringify(repairsNlpId)}`);
  }
});

test("a URL-encoded key echo is scrubbed from URLs and prompts", () => {
  const s = session();
  const before = `https://api.repliers.io/listings?class=condo&token=${encodeURIComponent(KEY)}`;
  s.searches.set(before, { nlpId: "n1", prompt: `homes ${KEY}`, url: before, appliedFilters: {} });
  const [sig] = captureSignals({
    toolName: "refine-search", args: { url: before }, secret: KEY,
    result: { url: `${before}&city=x`, constraintPatch: true, changed: { set: { city: "x" }, remove: [] }, data: {} },
    session: s,
  });
  assert.equal(leakedPrefix(everything(sig)), null);
  assert.match(lineOf(sig, "URL before"), /token=\[redacted\]/);
});

test("removed presentation params stay out of the refine key and lines", () => {
  const [sig] = captureSignals({
    toolName: "refine-search", args: { url: "https://api.repliers.io/listings?class=condo&pageNum=2" },
    result: { url: "https://api.repliers.io/listings?type=sale", constraintPatch: true,
      changed: { set: { type: "sale" }, remove: ["pageNum", "class", "sortBy"] }, data: {} },
    session: session(),
  });
  assert.equal(sig.key, "refine:-class,type");
  assert.doesNotMatch(sig.lines.filter((line) => line.startsWith("- ")).join("\n"), /pageNum|sortBy/);
});

test("a refine correction is recorded, tied to the prompt it corrects, and the model is told", async () => {
  const session = createSessionState();
  const reporter = fakeReporter();
  await callTool({ tool: search, toolName: "Search_Listings", args: { prompt: "condos in Cooksville" }, repliersApiKey: "rk-test-0001", session, reporter });
  const res = await callTool({ tool: refine(`${U}&type=sale`), toolName: "refine-search", args: { url: U, type: "sale" }, repliersApiKey: "rk-test-0001", session, reporter });
  assert.equal(reporter.reports.length, 1);
  assert.equal(reporter.reports[0].key, "refine:type");
  assert.match(reporter.reports[0].lines.join("\n"), /condos in Cooksville/);
  const body = payload(res);
  assert.equal(Object.keys(body)[0], "_feedback");
  assert.ok(body._feedback.signals.includes("recorded"));
  assert.match(body._feedback.note, /Recorded for the Repliers team/);
});

test("a refine of an already refined URL still finds the original prompt", async () => {
  const session = createSessionState();
  const reporter = fakeReporter();
  await callTool({ tool: search, toolName: "Search_Listings", args: { prompt: "condos in Cooksville" }, repliersApiKey: "rk-test-0001", session, reporter });
  await callTool({ tool: refine(`${U}&type=sale`), toolName: "refine-search", args: { url: U, type: "sale" }, repliersApiKey: "rk-test-0001", session, reporter });
  await callTool({ tool: refine(`${U}&type=sale&status=A`), toolName: "refine-search", args: { url: `${U}&type=sale`, status: "A" }, repliersApiKey: "rk-test-0001", session, reporter });
  assert.match(reporter.reports[1].lines.join("\n"), /nlpId:\*\* `n1`/);
});

test("a restated search with an unknown origin returns its result and records string-only lines", async () => {
  const reporter = fakeReporter();
  const res = await callTool({
    tool: search, toolName: "Search_Listings", args: { prompt: "p", repairsNlpId: "unknown-id" },
    repliersApiKey: "rk-test-0001", session: createSessionState(), reporter,
  });
  assert.equal(res.isError, undefined);
  assert.equal(reporter.reports.length, 1);
  assert.equal(reporter.reports[0].key, "restated:unknown");
  assert.ok(reporter.reports[0].lines.every((line) => typeof line === "string"));
});

test("a restated search names the families the first parse missed", async () => {
  const session = createSessionState();
  const reporter = fakeReporter();
  await callTool({ tool: search, toolName: "Search_Listings", args: { prompt: "condos in Cooksville" }, repliersApiKey: "rk-test-0001", session, reporter });
  const restated = fakeTool("Search_Listings", async () => ({
    url: "u", data: { appliedFilters: { location: "city=Cooksville", type: "type=sale", unrecognized: [] }, request: { url: `${U}&type=sale` }, nlpId: "n2", listings: { count: 1 } },
  }));
  await callTool({ tool: restated, toolName: "Search_Listings", args: { prompt: "condos FOR SALE in Cooksville", repairsNlpId: "n1" }, repliersApiKey: "rk-test-0001", session, reporter });
  assert.equal(reporter.reports.at(-1).key, "restated:type");
});

test("one session still records at most 5 signals an hour in full mode", async () => {
  const sess = createSessionState();
  const reporter = fakeReporter();
  for (let i = 0; i < 7; i += 1) {
    await callTool({ tool: search, toolName: "Search_Listings", args: { prompt: `p${i}`, repairsNlpId: `r${i}` }, repliersApiKey: "rk-test-0001", session: sess, reporter, now: () => 0 });
  }
  assert.equal(reporter.reports.length, 5);
});

test("narrow is the default and any unknown value means narrow", () => {
  for (const value of [undefined, "narrow", "banana"]) {
    if (value === undefined) delete process.env.FEEDBACK_AUTO_CAPTURE; else process.env.FEEDBACK_AUTO_CAPTURE = value;
    const signals = captureSignals({
      toolName: "refine-search", args: { url: "u" },
      result: { url: "u2", constraintPatch: true, changed: { set: { type: "sale" }, remove: [] }, data: {} },
      session: session(),
    });
    assert.deepEqual(signals, [], String(value));
  }
});
