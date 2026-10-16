import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveParam } from "../codegen/refs.js";

// Mirrors the upstream api-docs shape: /locations/autocomplete reuses the location-type enum
// declared on GET /listings/{mlsNumber}, through a JSON pointer whose braces are percent-encoded.
const spec = {
  paths: {
    "/listings/{mlsNumber}": {
      get: {
        parameters: [
          {
            name: "locationsType",
            in: "query",
            schema: {
              type: "array",
              items: { type: "string", enum: ["area", "city", "neighborhood", "postalCode"] },
            },
          },
        ],
      },
    },
    "/locations/autocomplete": {
      get: {
        parameters: [
          {
            name: "type",
            in: "query",
            schema: {
              type: "array",
              items: { $ref: "#/paths/~1listings~1%7BmlsNumber%7D/get/parameters/0/schema/items" },
            },
          },
          { $ref: "#/components/parameters/Pretty" },
        ],
      },
    },
  },
  components: {
    parameters: { Pretty: { name: "pretty", in: "query", schema: { $ref: "#/components/schemas/Flag" } } },
    schemas: { Flag: { type: "boolean" } },
  },
};

test("a percent-encoded JSON pointer resolves to the referenced enum instead of an empty schema", () => {
  const param = resolveParam(spec.paths["/locations/autocomplete"].get.parameters[0], spec);
  assert.deepEqual(param.schema, {
    type: "array",
    items: { type: "string", enum: ["area", "city", "neighborhood", "postalCode"] },
  });
});

test("parameter and schema refs through components still resolve", () => {
  const param = resolveParam(spec.paths["/locations/autocomplete"].get.parameters[1], spec);
  assert.deepEqual(param, { name: "pretty", in: "query", schema: { type: "boolean" } });
});

// An unresolved ref used to become {} without a word — how the location-type enum was lost.
test("an unresolvable ref fails loudly and names the ref", () => {
  const ref = "#/components/schemas/Missing";
  assert.throws(() => resolveParam({ name: "x", in: "query", schema: { $ref: ref } }, spec), (error) =>
    error.message.includes(ref));
});

test("a segment that is not valid percent-encoding is matched literally", () => {
  const odd = { components: { schemas: { "100%": { type: "integer" } } } };
  assert.deepEqual(resolveParam({ name: "x", schema: { $ref: "#/components/schemas/100%" } }, odd).schema, {
    type: "integer",
  });
});
