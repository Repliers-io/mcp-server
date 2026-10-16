#!/usr/bin/env node
// Replace openapi.json with the upstream Repliers spec at the commit pinned in codegen/config.js.
//
//   npm run sync-spec                       # pinned upstream → openapi.json
//   node scripts/sync-spec.mjs --from <url|file> --out <file>
//
// openapi.json is not only codegen input: lib/appliedFilters.js reads the POST /listings parameter
// names from it at runtime to decide which parameters the API discarded. A download that is not a
// spec, or a spec without those parameters, is therefore refused rather than written.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveRef } from "../codegen/refs.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const config = (await import("../codegen/config.js")).default;
const methods = ["get", "post", "put", "patch", "delete"];

function parseArgs(argv) {
  const { repo, ref, path } = config.upstreamSpec;
  const args = {
    from: `https://raw.githubusercontent.com/${repo}/${ref}/${path}`,
    out: resolve(root, config.specPath),
  };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--from") args.from = argv[(i += 1)];
    else if (argv[i] === "--out") args.out = resolve(argv[(i += 1)]);
  }
  return args;
}

async function load(from) {
  if (!/^https?:\/\//.test(from)) return readFileSync(from, "utf8");
  const response = await fetch(from, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`${from} responded ${response.status}`);
  return response.text();
}

function collectRefs(node, refs = new Set()) {
  if (Array.isArray(node)) node.forEach((item) => collectRefs(item, refs));
  else if (node && typeof node === "object") {
    if (typeof node.$ref === "string") refs.add(node.$ref);
    Object.values(node).forEach((value) => collectRefs(value, refs));
  }
  return refs;
}

function validate(text) {
  let spec;
  try {
    spec = JSON.parse(text);
  } catch {
    throw new Error("the download is not JSON");
  }
  if (typeof spec.openapi !== "string" || !spec.paths) throw new Error("the download is not an OpenAPI document");
  const params = spec.paths["/listings"]?.post?.parameters;
  if (!Array.isArray(params) || params.length === 0) {
    throw new Error("the spec has no POST /listings parameters, which lib/appliedFilters.js depends on");
  }
  // appliedFilters reads p.name directly; a nameless entry would turn a valid parameter into "discarded".
  if (!params.every((p) => typeof p?.name === "string")) {
    throw new Error("a POST /listings parameter has no name (lib/appliedFilters.js reads names, not $refs)");
  }
  // codegen resolves every $ref with the same resolver; refuse here rather than mid-generation.
  for (const ref of collectRefs(spec)) {
    if (!ref.startsWith("#/")) throw new Error(`non-local $ref ${ref}`);
    resolveRef(ref, spec);
  }
  return spec;
}

const operations = (spec) =>
  new Set(Object.entries(spec.paths).flatMap(([path, item]) =>
    methods.filter((m) => item[m]).map((m) => `${m.toUpperCase()} ${path}`)));
const listingsParams = (spec) => new Set((spec.paths["/listings"]?.post?.parameters || []).map((p) => p.name));

// What changed against the file being replaced — the part a reviewer of the regeneration needs.
function describeChanges(previousPath, next) {
  let previous;
  try {
    previous = existsSync(previousPath) ? JSON.parse(readFileSync(previousPath, "utf8")) : null;
  } catch {
    previous = null;
  }
  if (!previous?.paths) return [`${operations(next).size} operations (no previous spec to compare)`];
  const diff = (a, b) => [...a].filter((x) => !b.has(x));
  const [opsNext, opsPrev] = [operations(next), operations(previous)];
  const [parNext, parPrev] = [listingsParams(next), listingsParams(previous)];
  return [
    `${opsNext.size} operations: +${diff(opsNext, opsPrev).join(", ") || "none"}; -${diff(opsPrev, opsNext).join(", ") || "none"}`,
    `POST /listings params ${parPrev.size} → ${parNext.size}: +${diff(parNext, parPrev).join(", ") || "none"}; -${diff(parPrev, parNext).join(", ") || "none"}`,
  ];
}

const args = parseArgs(process.argv);
try {
  const text = await load(args.from);
  const spec = validate(text);
  const changes = describeChanges(args.out, spec);
  writeFileSync(args.out, text);
  console.log(`[sync-spec] ${args.from}\n[sync-spec] → ${args.out}`);
  for (const line of changes) console.log(`[sync-spec]   ${line}`);
  console.log("[sync-spec] Next: npm run generate, then review the roster diff.");
} catch (error) {
  console.error(`[sync-spec] refused: ${error.message}. ${args.out} was not changed.`);
  process.exit(1);
}
