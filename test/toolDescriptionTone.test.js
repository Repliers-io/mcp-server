// ChatGPT's safety layer flags tool text that steers approval or prescribes behaviour to it
// (design.md §2.2); and a tool absent from the roster must never be promised (CLAUDE.md).
// The roster is built in a child process per Trello state, because tool modules read env at import.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const toolsModule = new URL("../lib/tools.js", import.meta.url).href;

// state: "auto" = Trello + auto list, "trello" = Trello without TRELLO_AUTO_LIST_ID, "none" = neither.
function roster(state, mode = "narrow") {
  const env = { ...process.env };
  for (const key of ["TRELLO_API_KEY", "TRELLO_API_TOKEN", "TRELLO_LIST_ID", "TRELLO_AUTO_LIST_ID", "FEEDBACK_DRY_RUN", "FEEDBACK_AUTO_CAPTURE"]) delete env[key];
  if (state !== "none") Object.assign(env, { TRELLO_API_KEY: "k", TRELLO_API_TOKEN: "t", TRELLO_LIST_ID: "l" });
  if (state === "auto") env.TRELLO_AUTO_LIST_ID = "a";
  env.FEEDBACK_AUTO_CAPTURE = mode;
  const script = `
    const { discoverTools } = await import(${JSON.stringify(toolsModule)});
    const walk = (node, out) => { if (node && typeof node === "object") for (const [k, v] of Object.entries(node)) { if (k === "description" && typeof v === "string") out.push(v); else walk(v, out); } return out; };
    const tools = (await discoverTools()).map((t) => ({ name: t.definition.function.name, custom: t.path.includes("custom"),
      texts: [t.definition.function.description, ...walk(t.definition.function.parameters, [])] }));
    process.stdout.write(JSON.stringify(tools));`;
  const run = spawnSync(process.execPath, ["--input-type=module", "-e", script], { env, encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout);
}

const steering = [/\bMUST\b/, /\bREQUIRED\b/, /\bMANDATORY\b/, /\bCRITICAL\b/, /only after/i, /without asking/i,
  /no need to ask/i, /consent/i, /says yes/i, /task is (unfinished|not complete)/i];
const customOnly = [/\bALWAYS\b/, /\bNEVER\b/, /\bONLY\b/];

for (const mode of ["narrow", "full"]) for (const state of ["auto", "trello", "none"]) {
  test(`no approval-steering wording (${state}, ${mode})`, () => {
    const offenders = [];
    for (const tool of roster(state, mode)) {
      for (const text of tool.texts) {
        for (const pattern of [...steering, ...(tool.custom ? customOnly : [])]) {
          if (pattern.test(text)) offenders.push(`${tool.name}: ${pattern} in "${text.slice(0, 80)}…"`);
        }
      }
    }
    assert.deepEqual(offenders, []);
  });
}

for (const mode of ["narrow", "full"]) test(`without Trello, nothing mentions send-feedback or recording (${mode})`, () => {
  const offenders = roster("none", mode).flatMap((tool) =>
    tool.texts.filter((text) => /send-feedback|recorded for the Repliers team/i.test(text)).map(() => tool.name));
  assert.deepEqual(offenders, []);
});

const textsOf = (state, name, mode = "narrow") => roster(state, mode).find((tool) => tool.name === name).texts.join(" ");

test("auto capture on: only discarded parameters are claimed as recorded, and send-feedback lists the offered parse correction", () => {
  assert.match(textsOf("auto", "Search_Listings"), /Discarded parameters are recorded for the Repliers team/);
  assert.doesNotMatch(textsOf("auto", "Search_Listings"), /repairsNlpId/);
  assert.doesNotMatch(textsOf("auto", "refine-search"), /recorded/);
  const feedback = textsOf("auto", "send-feedback");
  assert.match(feedback, /recorded automatically/);
  assert.match(feedback, /a parse correction the user agreed to report/);
  assert.doesNotMatch(feedback, /refine-search corrections|restated|repairsNlpId/);
});

test("Trello without TRELLO_AUTO_LIST_ID: send-feedback stays, no text claims automatic recording", () => {
  const all = roster("trello");
  const offenders = all.flatMap((tool) =>
    tool.texts.filter((text) => /recorded for the Repliers team|recorded automatically/i.test(text)).map(() => tool.name));
  assert.deepEqual(offenders, []);
  assert.ok(all.some((tool) => tool.name === "send-feedback"));
  assert.match(textsOf("trello", "send-feedback"), /a parse correction the user agreed to report/);
});

test("full mode with auto capture on: the pre-change texts and the repairsNlpId parameter", () => {
  const search = roster("auto", "full").find((tool) => tool.name === "Search_Listings");
  assert.match(search.texts.join(" "), /Discarded parameters and restated searches are recorded for the Repliers team/);
  assert.match(search.texts.join(" "), /restated prompt with repairsNlpId repairs a semantic one/);
  assert.match(search.texts.join(" "), /nlpId of an earlier Search_Listings call/);
  assert.match(textsOf("auto", "refine-search", "full"), /recorded for the Repliers team as a probable NLP parse gap/);
  assert.match(textsOf("auto", "send-feedback", "full"), /refine-search corrections, parameters the API discarded, searches restated with repairsNlpId/);
});

test("full mode without the auto list behaves as narrow: no repairsNlpId, no text claims recording", () => {
  const all = roster("trello", "full");
  assert.doesNotMatch(all.find((tool) => tool.name === "Search_Listings").texts.join(" "), /repairsNlpId/);
  assert.doesNotMatch(textsOf("trello", "send-feedback", "full"), /refine-search corrections/);
  const offenders = all.flatMap((tool) =>
    tool.texts.filter((text) => /recorded for the Repliers team|recorded automatically/i.test(text)).map(() => tool.name));
  assert.deepEqual(offenders, []);
});

test("narrow mode (default and unknown values): no repairsNlpId anywhere in the roster", () => {
  for (const mode of ["narrow", "banana"]) {
    const offenders = roster("auto", mode).filter((tool) => tool.texts.some((text) => /repairsNlpId/.test(text))).map((tool) => tool.name);
    assert.deepEqual(offenders, [], mode);
  }
});
