import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { buildServerInstructions } from "../lib/serverInstructions.js";

const realEnv = {
  TRELLO_API_KEY: process.env.TRELLO_API_KEY,
  TRELLO_API_TOKEN: process.env.TRELLO_API_TOKEN,
  TRELLO_LIST_ID: process.env.TRELLO_LIST_ID,
  FEEDBACK_CONSENT: process.env.FEEDBACK_CONSENT,
};

beforeEach(() => {
  delete process.env.TRELLO_API_KEY;
  delete process.env.TRELLO_API_TOKEN;
  delete process.env.TRELLO_LIST_ID;
  delete process.env.FEEDBACK_CONSENT;
});

afterEach(() => {
  for (const [key, value] of Object.entries(realEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("with Trello configured: instructions mention send-feedback and rule 3 is Repair first", () => {
  process.env.TRELLO_API_KEY = "k";
  process.env.TRELLO_API_TOKEN = "t";
  process.env.TRELLO_LIST_ID = "l";
  const instructions = buildServerInstructions();
  assert.ok(instructions.includes("send-feedback"), "should mention send-feedback");
  assert.match(instructions, /3\. Repair first/, "rule 3 should be Repair first");
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

test("auto mode: rule 3 lets technical failures be reported without asking", () => {
  withTrello();
  const rule3 = buildServerInstructions().split("\n").find((l) => l.startsWith("3."));
  assert.match(rule3, /without asking the user/i);
});

test("always-ask mode: rule 3 requires consent for every send", () => {
  withTrello();
  process.env.FEEDBACK_CONSENT = "always-ask";
  const rule3 = buildServerInstructions().split("\n").find((l) => l.startsWith("3."));
  assert.doesNotMatch(rule3, /without asking the user/i);
  assert.match(rule3, /never send.*without|only after the user agrees|explicit consent/i);
  assert.match(rule3, /every category|including/i, "must cover technical failures too");
});

test("both branches open with the real-estate role, not the host persona", () => {
  const withoutTrello = buildServerInstructions();
  withTrello();
  const withTrelloText = buildServerInstructions();
  for (const text of [withoutTrello, withTrelloText]) {
    assert.match(text, /real[- ]estate/i);
    assert.match(text, /regardless of|whatever .*persona|host application/i,
      "must tell the agent to adopt the role over the host's default persona");
  }
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
