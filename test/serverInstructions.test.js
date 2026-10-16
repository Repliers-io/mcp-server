import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { buildServerInstructions } from "../lib/serverInstructions.js";

const realEnv = {
  TRELLO_API_KEY: process.env.TRELLO_API_KEY,
  TRELLO_API_TOKEN: process.env.TRELLO_API_TOKEN,
  TRELLO_LIST_ID: process.env.TRELLO_LIST_ID,
  TRELLO_AUTO_LIST_ID: process.env.TRELLO_AUTO_LIST_ID,
  FEEDBACK_DRY_RUN: process.env.FEEDBACK_DRY_RUN,
  FEEDBACK_AUTO_CAPTURE: process.env.FEEDBACK_AUTO_CAPTURE,
  FEEDBACK_CONSENT: process.env.FEEDBACK_CONSENT,
};

beforeEach(() => {
  delete process.env.TRELLO_API_KEY;
  delete process.env.TRELLO_API_TOKEN;
  delete process.env.TRELLO_LIST_ID;
  delete process.env.TRELLO_AUTO_LIST_ID;
  delete process.env.FEEDBACK_DRY_RUN;
  delete process.env.FEEDBACK_AUTO_CAPTURE;
  delete process.env.FEEDBACK_CONSENT;
});

afterEach(() => {
  for (const [key, value] of Object.entries(realEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("with Trello configured: instructions mention send-feedback and rule 3 is Report", () => {
  process.env.TRELLO_API_KEY = "k";
  process.env.TRELLO_API_TOKEN = "t";
  process.env.TRELLO_LIST_ID = "l";
  const instructions = buildServerInstructions();
  assert.ok(instructions.includes("send-feedback"), "should mention send-feedback");
  assert.match(instructions, /3\. Report/, "rule 3 should be the reporting rule");
  assert.match(instructions, /4\. _feedback/, "rule 4 should be the _feedback rule");
});

test("without Trello configured: no send-feedback occurrence anywhere", () => {
  const instructions = buildServerInstructions();
  assert.ok(!instructions.includes("send-feedback"), "must not mention send-feedback");
});

test("without Trello configured: rules renumber — rule 3 is the _feedback rule", () => {
  const instructions = buildServerInstructions();
  assert.match(instructions, /3\. _feedback/, "rule 3 should be the _feedback rule when no Trello");
  // The feedback rule must not reappear under another number; other rules may follow.
  assert.ok(!instructions.includes("send-feedback"), "no rule may mention send-feedback when no Trello");
  assert.doesNotMatch(instructions, /5\./, "the Trello-only rule 5 must not leak into this branch");
});

test("without Trello configured: rule 2 contains no send-feedback clause", () => {
  const instructions = buildServerInstructions();
  // Extract rule 2 text (between "2." and "3.")
  const rule2Match = instructions.match(/2\.([\s\S]*?)3\./);
  assert.ok(rule2Match, "rule 2 must exist");
  assert.ok(!rule2Match[1].includes("send-feedback"), "rule 2 must not mention send-feedback");
});

const withTrello = () => {
  process.env.TRELLO_API_KEY = "k";
  process.env.TRELLO_API_TOKEN = "t";
  process.env.TRELLO_LIST_ID = "l";
};

// The role sentence moved to skills/repliers-real-estate/SKILL.md: OpenAI's plugin guidance for
// this field is "do not repeat every tool description or try to change the model's personality",
// and run 4 had already found that instructions carry data facts well and personas poorly. These
// two tests pin the shape so it cannot drift back.
test("both branches open with the required tool sequence, inside the first 512 characters", () => {
  const withoutTrello = buildServerInstructions();
  withTrello();
  const withTrelloText = buildServerInstructions();
  for (const text of [withoutTrello, withTrelloText]) {
    assert.match(text.slice(0, 512), /Required sequence/,
      "the cross-tool sequence must lead — hosts only guarantee the first 512 characters");
    assert.match(text.slice(0, 512), /appliedFilters/,
      "the verification step must be inside the first 512 characters");
  }
});

test("neither branch sets a persona or re-lists the tool roster", () => {
  const withoutTrello = buildServerInstructions();
  withTrello();
  const withTrelloText = buildServerInstructions();
  for (const text of [withoutTrello, withTrelloText]) {
    assert.doesNotMatch(text, /you are the|whatever persona|host application/i,
      "persona belongs in the skill, not in the instructions field");
    assert.doesNotMatch(text, /tool families/i,
      "the roster describes itself — do not repeat it here");
  }
});

test("the skill carries the role the instructions no longer state", async () => {
  const { readFileSync } = await import("node:fs");
  const skill = readFileSync(new URL("../skills/repliers-real-estate/SKILL.md", import.meta.url), "utf8");
  assert.match(skill, /^---\nname: repliers-real-estate\ndescription: /,
    "must open with the frontmatter the submission portal reads");
  assert.match(skill, /real[- ]estate assistant/i, "must state the role");
  assert.ok(!skill.includes("send-feedback"),
    "the skill is a static snapshot and cannot be gated on Trello config, so it must never mention send-feedback");
});

test("both branches state what the server does NOT have", () => {
  const withoutTrello = buildServerInstructions();
  withTrello();
  const withTrelloText = buildServerInstructions();
  for (const text of [withoutTrello, withTrelloText]) {
    assert.match(text, /mortgage|rates/i);
    assert.match(text, /say .*(you|we) (do not|don't) have|no such data|outside this server/i,
      "must instruct an honest out-of-scope answer instead of general knowledge");
  }
});

// Server-observed failures are recorded automatically (rule 3); a headline step telling the model
// to report would bring back model-filed duplicates and write confirmations on ChatGPT.
test("both branches share one headline, and it carries no reporting step", () => {
  const withoutTrello = buildServerInstructions().split("\n")[0];
  withTrello();
  const withTrelloText = buildServerInstructions().split("\n")[0];
  assert.equal(withTrelloText, withoutTrello);
  assert.equal(withoutTrello,
    "Required sequence for every listings search: Search_Listings → check appliedFilters against the request → repair any gap.");
});

const rule3Of = () => buildServerInstructions().split("\n").find((line) => line.startsWith("3."));

test("rule 3 (auto capture on): discards and service errors are recorded, parse corrections are offered", () => {
  withTrello();
  process.env.TRELLO_AUTO_LIST_ID = "a";
  assert.equal(rule3Of(),
    "3. Report: discarded parameters and Repliers service errors are recorded automatically; _feedback and _notice blocks say when. Parse corrections — a refine-search call or a restated prompt — are offered to the user and reported with send-feedback (nlp-misparse) once they agree; send-feedback also carries any report the user asks for or dissatisfaction with results.");
  assert.doesNotMatch(rule3Of(), /MUST|without asking|consent/i);
});

test("rule 3 (Trello configured, no TRELLO_AUTO_LIST_ID): no claim of automatic recording", () => {
  withTrello();
  const rule3 = rule3Of();
  assert.doesNotMatch(rule3, /recorded automatically|_notice/);
  assert.match(rule3, /^3\. Report: parse corrections/);
  assert.match(rule3, /send-feedback \(nlp-misparse\)/);
});

test("FEEDBACK_CONSENT no longer changes the text", () => {
  withTrello();
  const before = buildServerInstructions();
  process.env.FEEDBACK_CONSENT = "always-ask";
  assert.equal(buildServerInstructions(), before);
});

test("rule 2 no longer mentions repairsNlpId", () => {
  withTrello();
  process.env.TRELLO_AUTO_LIST_ID = "a";
  for (const text of [buildServerInstructions()]) {
    assert.doesNotMatch(text, /repairsNlpId/);
    assert.match(text, /restating the Search_Listings prompt emphatically\./);
  }
});

test("full mode (auto capture on): the pre-change rules 2 and 3", () => {
  withTrello();
  process.env.TRELLO_AUTO_LIST_ID = "a";
  process.env.FEEDBACK_AUTO_CAPTURE = "full";
  const text = buildServerInstructions();
  assert.match(text, /with the earlier search's nlpId as repairsNlpId/);
  const rule3 = text.split("\n").find((line) => line.startsWith("3."));
  assert.match(rule3, /failures the server observes \(API errors, refine-search corrections, discarded parameters, searches restated with repairsNlpId\) are recorded automatically/);
  assert.match(rule3, /send-feedback covers what only the conversation shows/);
  assert.doesNotMatch(rule3, /MUST|without asking|consent/i);
});

test("full mode without the auto list: no claim of automatic recording", () => {
  withTrello();
  process.env.FEEDBACK_AUTO_CAPTURE = "full";
  const full = buildServerInstructions();
  assert.doesNotMatch(full, /recorded automatically|repairsNlpId/);
  delete process.env.FEEDBACK_AUTO_CAPTURE;
  assert.equal(full, buildServerInstructions(), "effective mode is narrow: the narrow wording");
});

test("narrow is the default, and an unknown value means narrow", () => {
  withTrello();
  process.env.TRELLO_AUTO_LIST_ID = "a";
  const narrow = buildServerInstructions();
  process.env.FEEDBACK_AUTO_CAPTURE = "narrow";
  assert.equal(buildServerInstructions(), narrow);
  process.env.FEEDBACK_AUTO_CAPTURE = "banana";
  assert.equal(buildServerInstructions(), narrow);
  assert.doesNotMatch(narrow, /repairsNlpId/);
});

test("full mode without Trello: no send-feedback anywhere, headline unchanged", () => {
  process.env.FEEDBACK_AUTO_CAPTURE = "full";
  const text = buildServerInstructions();
  assert.ok(!text.includes("send-feedback"));
  assert.match(text.split("\n")[0], /^Required sequence/);
});
