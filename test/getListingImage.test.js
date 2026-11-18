// Get_Listing_Image talks to the configured API host and unwraps the endpoint's response, which
// carries the photo as MCP content ({ content: [{ type: "image", data, mimeType }] }) under
// application/json, not as raw bytes.
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { apiTool } from "../tools/repliers/repliers-api/custom/get-listing-image.js";

const realFetch = global.fetch;
const realBase = process.env.REPLIERS_API_BASE_URL;
afterEach(() => {
  global.fetch = realFetch;
  if (realBase === undefined) delete process.env.REPLIERS_API_BASE_URL;
  else process.env.REPLIERS_API_BASE_URL = realBase;
});

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]).toString("base64");
const call = (args = {}) => apiTool.function({ mlsNumber: "N 1/2", imageNumber: 3, _repliersApiKey: "k", _userAgent: "ua/1", ...args });
const respond = (body, type) => { global.fetch = async () => new Response(body, { status: 200, headers: { "content-type": type } }); };

test("requests the configured API host, not a fixed one", async () => {
  const urls = [];
  global.fetch = async (url) => { urls.push(String(url)); return new Response("{}", { status: 404 }); };
  delete process.env.REPLIERS_API_BASE_URL;
  await call();
  process.env.REPLIERS_API_BASE_URL = "https://staging.example.test/";
  await call();
  assert.deepEqual(urls, [
    "https://api.repliers.io/listings/N%201%2F2/images/download/3",
    "https://staging.example.test/listings/N%201%2F2/images/download/3",
  ]);
});

test("unwraps the image block the endpoint returns as JSON", async () => {
  respond(JSON.stringify({ content: [{ type: "image", data: JPEG, mimeType: "image/jpeg" }] }), "application/json; charset=utf-8");
  const result = await call();
  assert.deepEqual(result.image, { data: JPEG, mimeType: "image/jpeg" });
  assert.equal(result.error, undefined);
});

test("a JSON image block without a mimeType is taken as JPEG", async () => {
  respond(JSON.stringify({ content: [{ type: "text", text: "x" }, { type: "image", data: JPEG }] }), "application/json");
  assert.deepEqual((await call()).image, { data: JPEG, mimeType: "image/jpeg" });
});

test("raw image bytes are base64-encoded, with the content-type's parameters dropped", async () => {
  respond(Buffer.from(JPEG, "base64"), "image/png; foo=bar");
  assert.deepEqual((await call()).image, { data: JPEG, mimeType: "image/png" });
});

for (const [label, body, type] of [
  ["JSON without an image block", JSON.stringify({ content: [{ type: "text", text: "x" }] }), "application/json"],
  ["an image block with empty data", JSON.stringify({ content: [{ type: "image", data: "" }] }), "application/json"],
  ["a body that is not JSON", "<html>oops</html>", "text/html"],
]) {
  test(`a 200 with ${label} is not-found, never a broken image`, async () => {
    respond(body, type);
    const result = await call();
    assert.equal(result.image, undefined);
    assert.equal(result.status, 404);
    assert.match(result.error, /no image data for image 3 of listing N 1\/2/);
  });
}
