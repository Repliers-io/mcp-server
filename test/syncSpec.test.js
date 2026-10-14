import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../scripts/sync-spec.mjs", import.meta.url));

const validSpec = `{
  "openapi": "3.1.0",
  "info": { "title": "repliers", "version": "1.0" },
  "paths": {
    "/listings": {
      "post": { "parameters": [{ "name": "pets", "in": "query", "schema": { "type": "string" } }] }
    }
  }
}
`;

function run(source) {
  const dir = mkdtempSync(join(tmpdir(), "sync-spec-"));
  const from = join(dir, "upstream.json");
  const out = join(dir, "openapi.json");
  writeFileSync(from, source);
  writeFileSync(out, "PREVIOUS SPEC");
  const result = spawnSync(process.execPath, [script, "--from", from, "--out", out], { encoding: "utf8" });
  return { status: result.status, stderr: result.stderr, written: readFileSync(out, "utf8") };
}

test("a valid upstream spec replaces openapi.json byte for byte", () => {
  const { status, written } = run(validSpec);
  assert.equal(status, 0);
  assert.equal(written, validSpec);
});

test("a non-JSON download (e.g. an HTML error page) leaves openapi.json untouched", () => {
  const { status, written } = run("<!DOCTYPE html><html><body>404: Not Found</body></html>");
  assert.notEqual(status, 0);
  assert.equal(written, "PREVIOUS SPEC");
});

// appliedFilters reads p.name; a listings parameter turned into a $ref has none, and every value sent
// for it would be reported to agents as discarded.
test("a POST /listings parameter without a name is refused", () => {
  const spec = JSON.parse(validSpec);
  spec.paths["/listings"].post.parameters.push({ $ref: "#/components/parameters/Pets" });
  spec.components = { parameters: { Pets: { name: "pets", in: "query" } } };
  const { status, written } = run(JSON.stringify(spec));
  assert.notEqual(status, 0);
  assert.equal(written, "PREVIOUS SPEC");
});

test("a spec with a $ref that resolves to nothing is refused before it reaches codegen", () => {
  const spec = JSON.parse(validSpec);
  spec.paths["/locations"] = {
    get: { parameters: [{ name: "type", in: "query", schema: { $ref: "#/components/schemas/Gone" } }] },
  };
  const { status, written, stderr } = run(JSON.stringify(spec));
  assert.notEqual(status, 0);
  assert.equal(written, "PREVIOUS SPEC");
  assert.match(stderr, /#\/components\/schemas\/Gone/);
});

test("a spec without POST /listings parameters is refused, since appliedFilters reads them", () => {
  const { status, written, stderr } = run(
    JSON.stringify({ openapi: "3.1.0", info: { title: "x", version: "1" }, paths: { "/locations": {} } })
  );
  assert.notEqual(status, 0);
  assert.equal(written, "PREVIOUS SPEC");
  assert.match(stderr, /\/listings/);
});
