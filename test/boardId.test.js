import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { callTool } from "../lib/toolCall.js";
import { fakeTool, fakeReporter } from "./helpers/toolDoubles.js";

const realFetch = global.fetch;
afterEach(() => { global.fetch = realFetch; });

const payload = (res) => JSON.parse(res.content[1].text);
const needsBoard = { url: "https://api.repliers.io/listings/N1", error: "boardId is required", status: 400, body: [{ msg: "boardId is required" }] };

function boardLookup(boards) {
  const seen = [];
  global.fetch = async (url) => {
    seen.push(new URL(String(url)));
    return new Response(JSON.stringify({ aggregates: { boardId: boards } }), { status: 200 });
  };
  return seen;
}

test("one board: the call is retried with it and the response says what was assumed", async () => {
  const lookups = boardLookup({ 2: 1 });
  const calls = [];
  const tool = fakeTool("get-listing", async (args) => {
    calls.push(args);
    return args.boardId == null ? needsBoard : { url: "u", data: { mlsNumber: "N1" } };
  });
  const res = await callTool({ tool, toolName: "get-listing", args: { mlsNumber: "N1" }, repliersApiKey: "k", reporter: fakeReporter() });
  assert.equal(res.isError, undefined);
  assert.deepEqual(payload(res), { boardIdResolved: 2, mlsNumber: "N1" });
  assert.equal(calls[1].boardId, 2);
  assert.equal(lookups[0].searchParams.get("mlsNumber"), "N1");
  assert.equal(lookups[0].searchParams.get("aggregates"), "boardId");
});

test("several boards: candidates go back to the agent", async () => {
  boardLookup({ 2: 1, 16: 1 });
  const tool = fakeTool("get-similar-listings", async () => needsBoard);
  const res = await callTool({ tool, toolName: "get-similar-listings", args: { mlsNumber: "N1" }, repliersApiKey: "k", reporter: fakeReporter() });
  assert.equal(res.isError, true);
  assert.deepEqual(payload(res)._notice.candidates, [2, 16]);
});

test("no board holds it: not found", async () => {
  boardLookup({});
  const tool = fakeTool("get-listing", async () => needsBoard);
  const res = await callTool({ tool, toolName: "get-listing", args: { mlsNumber: "N1" }, repliersApiKey: "k", reporter: fakeReporter() });
  assert.deepEqual(payload(res), { found: false, reason: "No record matches these parameters." });
});

test("boardId: null (strict function calling) still triggers resolution", async () => {
  boardLookup({ 2: 1 });
  const tool = fakeTool("get-listing", async (args) => (args.boardId == null ? needsBoard : { url: "u", data: {} }));
  const res = await callTool({ tool, toolName: "get-listing", args: { mlsNumber: "N1", boardId: null }, repliersApiKey: "k", reporter: fakeReporter() });
  assert.equal(payload(res).boardIdResolved, 2);
});

test("a failed lookup leaves the needs-board hint; other tools never trigger a lookup", async () => {
  global.fetch = async () => new Response("", { status: 500 });
  const res = await callTool({
    tool: fakeTool("get-listing", async () => needsBoard), toolName: "get-listing",
    args: { mlsNumber: "N1" }, repliersApiKey: "k", reporter: fakeReporter(),
  });
  assert.match(payload(res)._notice.forAgent, /Lookup_Possible_Values/);

  let fetched = false;
  global.fetch = async () => { fetched = true; return new Response("{}", { status: 200 }); };
  await callTool({ tool: fakeTool("search-members", async () => needsBoard), toolName: "search-members", args: {}, repliersApiKey: "k", reporter: fakeReporter() });
  assert.equal(fetched, false);
});
