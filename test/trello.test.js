import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { trelloConfigured, autoCaptureConfigured, autoCaptureMode, effectiveCaptureMode, createCard, addComment, dryRunLogPath } from "../lib/trello.js";

const realFetch = global.fetch;
const realEnv = {
  TRELLO_API_KEY: process.env.TRELLO_API_KEY,
  TRELLO_API_TOKEN: process.env.TRELLO_API_TOKEN,
  TRELLO_LIST_ID: process.env.TRELLO_LIST_ID,
  TRELLO_AUTO_LIST_ID: process.env.TRELLO_AUTO_LIST_ID,
  FEEDBACK_DRY_RUN: process.env.FEEDBACK_DRY_RUN,
  FEEDBACK_DRY_RUN_LOG: process.env.FEEDBACK_DRY_RUN_LOG,
};
beforeEach(() => {
  process.env.TRELLO_API_KEY = "test-key";
  process.env.TRELLO_API_TOKEN = "test-token";
  process.env.TRELLO_LIST_ID = "test-list";
  delete process.env.TRELLO_AUTO_LIST_ID;
  delete process.env.FEEDBACK_DRY_RUN;
});
afterEach(() => {
  global.fetch = realFetch;
  for (const [key, value] of Object.entries(realEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("trelloConfigured true only when all three env vars set", () => {
  assert.equal(trelloConfigured(), true);
  delete process.env.TRELLO_LIST_ID;
  assert.equal(trelloConfigured(), false);
});

test("createCard posts to the cards endpoint with credentials in the query", async () => {
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url: String(url), method: init.method });
    return { ok: true, json: async () => ({ id: "c-abc", shortUrl: "https://trello.com/c/abc" }) };
  };
  const result = await createCard({ name: "card name", desc: "card body" });
  assert.deepEqual(result, { ok: true, cardId: "c-abc", cardUrl: "https://trello.com/c/abc" });
  const sent = new URL(calls[0].url);
  assert.equal(calls[0].method, "POST");
  assert.equal(sent.origin + sent.pathname, "https://api.trello.com/1/cards");
  assert.equal(sent.searchParams.get("key"), "test-key");
  assert.equal(sent.searchParams.get("token"), "test-token");
});

// Trello rejects request URLs past ~8 KB with 414, but buildFeedbackCard caps desc at 16 KB —
// twice the transport limit. Card content therefore has to travel in the body, not the query.
test("createCard sends card content in the body, so a 16k description still fits", async () => {
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return { ok: true, json: async () => ({ id: "c-abc", shortUrl: "https://trello.com/c/abc" }) };
  };
  const desc = "y".repeat(16384);
  const result = await createCard({ name: "card name", desc });
  assert.deepEqual(result, { ok: true, cardId: "c-abc", cardUrl: "https://trello.com/c/abc" });

  const sent = new URL(calls[0].url);
  assert.ok(sent.toString().length < 500, `URL must stay short, was ${sent.toString().length}`);
  assert.equal(sent.searchParams.get("name"), null);
  assert.equal(sent.searchParams.get("desc"), null);

  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.idList, "test-list");
  assert.equal(body.name, "card name");
  assert.equal(body.desc, desc);
  assert.match(calls[0].init.headers["content-type"], /application\/json/);
});

test("dry-run: channel configured without keys, card logged instead of posted", async () => {
  delete process.env.TRELLO_API_KEY;
  delete process.env.TRELLO_API_TOKEN;
  delete process.env.TRELLO_LIST_ID;
  process.env.FEEDBACK_DRY_RUN = "true";
  assert.equal(trelloConfigured(), true);
  global.fetch = async () => { throw new Error("must not fetch in dry-run"); };
  const result = await createCard({ name: "card name", desc: "card body" });
  assert.equal(result.ok, true);
  assert.equal(result.dryRun, true);
  assert.match(result.cardId, /^dry-run-\d+$/);
});

test("createCard returns ok:false on HTTP error and on network throw", async () => {
  global.fetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
  assert.equal((await createCard({ name: "n", desc: "d" })).ok, false);
  global.fetch = async () => { throw new Error("ECONNREFUSED"); };
  const failed = await createCard({ name: "n", desc: "d" });
  assert.equal(failed.ok, false);
  assert.match(failed.error, /ECONNREFUSED/);
});

test("dry-run appends the card to FEEDBACK_DRY_RUN_LOG and still writes stderr", async () => {
  const logPath = join(tmpdir(), `fb-cards-${process.pid}.log`);
  rmSync(logPath, { force: true });
  process.env.FEEDBACK_DRY_RUN = "true";
  process.env.FEEDBACK_DRY_RUN_LOG = logPath;
  const realError = console.error;
  const stderr = [];
  console.error = (msg) => stderr.push(String(msg));
  try {
    await createCard({ name: "card one", desc: "body one" });
    await createCard({ name: "card two", desc: "body two" });
  } finally {
    console.error = realError;
  }
  const log = readFileSync(logPath, "utf8");
  assert.match(log, /card one/);
  assert.match(log, /body one/);
  assert.match(log, /card two/, "second card must append, not overwrite");
  assert.ok(stderr.some((l) => l.includes("card one")), "stderr must still receive the card");
  rmSync(logPath, { force: true });
});

test("dry-run log defaults to feedback-cards.log in the server root", () => {
  delete process.env.FEEDBACK_DRY_RUN_LOG;
  assert.match(dryRunLogPath().replaceAll("\\", "/"), /mcp-server\/feedback-cards\.log$/);
});

test("an unwritable log path never breaks the card result", async () => {
  process.env.FEEDBACK_DRY_RUN = "true";
  process.env.FEEDBACK_DRY_RUN_LOG = join(tmpdir(), "no-such-dir-xyz", "cards.log");
  const realError = console.error;
  console.error = () => {};
  try {
    const result = await createCard({ name: "n", desc: "d" });
    assert.equal(result.ok, true);
    assert.equal(result.dryRun, true);
    assert.match(result.cardId, /^dry-run-\d+$/);
  } finally {
    console.error = realError;
  }
});

test("createCard returns the card id, which comments are attached to", async () => {
  global.fetch = async () => ({ ok: true, json: async () => ({ id: "c123", shortUrl: "https://trello.com/c/x" }) });
  const result = await createCard({ name: "n", desc: "d" });
  assert.equal(result.cardId, "c123");
});

test("addComment posts the text in the body to the card's comments endpoint", async () => {
  let call;
  global.fetch = async (url, init) => { call = { url: new URL(String(url)), init }; return { ok: true }; };
  const result = await addComment("c123", "seen again");
  assert.equal(result.ok, true);
  assert.equal(call.url.pathname, "/1/cards/c123/actions/comments");
  assert.equal(call.url.searchParams.get("key"), "test-key");
  assert.deepEqual(JSON.parse(call.init.body), { text: "seen again" });
});

test("addComment reports HTTP and network failures instead of throwing", async () => {
  global.fetch = async () => ({ ok: false, status: 429 });
  assert.match((await addComment("c1", "t")).error, /429/);
  global.fetch = async () => { throw new Error("offline"); };
  assert.match((await addComment("c1", "t")).error, /offline/);
});

test("dry-run: cards get an id and comments go to the log, not to Trello", async () => {
  process.env.FEEDBACK_DRY_RUN = "true";
  const log = join(tmpdir(), `comments-${Date.now()}.log`);
  process.env.FEEDBACK_DRY_RUN_LOG = log;
  global.fetch = async () => { throw new Error("must not be called"); };
  const card = await createCard({ name: "n", desc: "d" });
  assert.match(card.cardId, /^dry-run-\d+$/);
  await addComment(card.cardId, "seen again");
  assert.match(readFileSync(log, "utf8"), new RegExp(`Trello comment on ${card.cardId}:\nseen again`));
  rmSync(log, { force: true });
});

test("createCard posts to the list it is given, else to TRELLO_LIST_ID", async () => {
  const bodies = [];
  global.fetch = async (url, init) => { bodies.push(JSON.parse(init.body)); return { ok: true, json: async () => ({ id: "c1" }) }; };
  await createCard({ name: "n", desc: "d" }, { listId: "auto-list" });
  await createCard({ name: "n", desc: "d" });
  await createCard({ name: "n", desc: "d" }, {});
  assert.deepEqual(bodies.map((b) => b.idList), ["auto-list", "test-list", "test-list"]);
});

test("autoCaptureConfigured needs the Trello keys and TRELLO_AUTO_LIST_ID, or dry-run", () => {
  assert.equal(autoCaptureConfigured(), false, "no auto list");
  process.env.TRELLO_AUTO_LIST_ID = "auto-list";
  assert.equal(autoCaptureConfigured(), true);
  delete process.env.TRELLO_API_TOKEN;
  assert.equal(autoCaptureConfigured(), false, "no token");
  delete process.env.TRELLO_AUTO_LIST_ID;
  process.env.FEEDBACK_DRY_RUN = "true";
  assert.equal(autoCaptureConfigured(), true, "dry-run acts configured");
});

test("autoCaptureConfigured needs the whole feedback channel: no TRELLO_LIST_ID means capture off", () => {
  process.env.TRELLO_AUTO_LIST_ID = "auto-list";
  delete process.env.TRELLO_LIST_ID;
  assert.equal(autoCaptureConfigured(), false);
});

test("effectiveCaptureMode is full only when FEEDBACK_AUTO_CAPTURE=full and capture is configured", () => {
  process.env.FEEDBACK_AUTO_CAPTURE = "full";
  assert.equal(effectiveCaptureMode(), "narrow", "no auto list");
  process.env.TRELLO_AUTO_LIST_ID = "a";
  assert.equal(effectiveCaptureMode(), "full");
  process.env.FEEDBACK_AUTO_CAPTURE = "banana";
  assert.equal(effectiveCaptureMode(), "narrow");
  assert.equal(autoCaptureMode(), "narrow");
});
