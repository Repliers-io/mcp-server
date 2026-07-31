import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { buildServerInstructions } from "../lib/serverInstructions.js";

const realEnv = {
  TRELLO_API_KEY: process.env.TRELLO_API_KEY,
  TRELLO_API_TOKEN: process.env.TRELLO_API_TOKEN,
  TRELLO_LIST_ID: process.env.TRELLO_LIST_ID,
};

beforeEach(() => {
  delete process.env.TRELLO_API_KEY;
  delete process.env.TRELLO_API_TOKEN;
  delete process.env.TRELLO_LIST_ID;
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
  assert.ok(!instructions.includes("4."), "should have no rule 4 when no Trello");
});

test("without Trello configured: rule 2 contains no send-feedback clause", () => {
  const instructions = buildServerInstructions();
  // Extract rule 2 text (between "2." and "3.")
  const rule2Match = instructions.match(/2\.([\s\S]*?)3\./);
  assert.ok(rule2Match, "rule 2 must exist");
  assert.ok(!rule2Match[1].includes("send-feedback"), "rule 2 must not mention send-feedback");
});
