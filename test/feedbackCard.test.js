import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFeedbackCard } from "../lib/feedbackCard.js";

const base = { category: "nlp-misparse", summary: "price cap dropped", userQuery: "townhouses under 500k in X" };

test("name carries [MCP] prefix, marker and truncated summary", () => {
  const { name } = buildFeedbackCard({ ...base, summary: "s".repeat(100) });
  assert.ok(name.startsWith("[MCP] "));
  assert.ok(name.includes("s".repeat(80) + "…"));
});

test("desc contains category, query and missedConstraints rows", () => {
  const { desc } = buildFeedbackCard({
    ...base,
    missedConstraints: [{ constraint: "maxPrice", requested: "500000", applied: "none" }],
  });
  assert.match(desc, /\*\*Category:\*\* nlp-misparse/);
  assert.match(desc, /townhouses under 500k in X/);
  assert.match(desc, /maxPrice: requested `500000` → applied `none`/);
});

test("desc is capped at 16384 chars and keeps the summary head", () => {
  const { desc } = buildFeedbackCard({
    ...base,
    toolCalls: [{ tool: "Search_Listings", params: { prompt: "x".repeat(30000) } }],
  });
  assert.equal(desc.length, 16384);
  assert.match(desc.slice(0, 200), /price cap dropped/);
});
