# Feedback v2 — Status & Resume Point

**Updated:** 2026-10-14
**Branch:** `develop`, uncommitted (the owner commits)

## Where we are

Design agreed in chat section by section (2026-10-12 – 2026-10-14) and written up in
[design.md](./design.md); **the written spec is awaiting owner review.** No v2 code yet. Next after
approval: an implementation plan (`plan.md`), then code.

## Prerequisite done (uncommitted): OpenAPI sync — 2026-10-14

[design.md §9](./design.md#9-prerequisite--openapi-sync-separate-bounded-task). It had to land before
capture of `unrecognized` parameters, or the server would file false cards for valid parameters.

- `npm run sync-spec` (`scripts/sync-spec.mjs`) fetches `bundled_docs/repliers.json` at the commit
  pinned in `codegen/config.js` → `upstreamSpec` (`be440f9`, 2026-10-08) and refuses anything that is
  not an OpenAPI document with POST /listings parameters. `openapi.json` is now byte-identical to it.
- `codegen/refs.js`: `$ref` segments are percent-decoded before JSON-pointer unescaping. Restores the
  location-type and source enums on `autocomplete-location-search` and `search-locations`
  (they were `items: {}`, which let an agent pass `type: street` — tizUYBN5).
- Array query params are generated as `[args.x].flat()`: the new spec turned 11 params from string
  into array, and ChatGPT keeps the old schemas until the connector is rescanned.
- The 8 new upstream operations are excluded in `codegen/config.js` pending the roster-size decision.
  No existing tool was added, removed or renamed; 28 generated files changed (new params, enums,
  required-sets — `create-estimate` now requires `address`+`details`, `send-message` `content`;
  `get-address-listing-history` no longer requires the address parts).
- Hardened after the code-reviewer pass (verdict: approve with nits): an unresolvable `$ref` now
  throws instead of becoming `{}`; `sync-spec` refuses nameless POST /listings params and any
  unresolvable or non-local `$ref`, has a fetch timeout, and prints operations and listings params
  added/removed; array **body** properties wrap a scalar too (null passes through — it clears a field
  on PATCH); null query params are omitted instead of sent as `"null"`; dead `locations`/`buildings`
  entries removed from config and overrides; override text fixed (`search-locations` takes `name[]`,
  not `search`; `content` and `details` marked required). The reviewer's pre-existing finding about
  the required-param check is in [design.md §5.6](./design.md#56-missing-required-parameters).
- Verified: `npm test` 181/181; live through the stdio server, the "pets + virtual tour" search now
  reports `unrecognized: []` (was `["pets","hasVirtualTour"]`); scalar and array `type` both reach
  autocomplete. `get-address-listing-history` without `zip` now reaches the API and gets the empty-body
  404 that §5 turns into `not-found`.

## Baseline

Measured 2026-10-12 on current code, recorded in [design.md §3](./design.md#3-measured-baseline-2026-10-12).
Raw runs in `mcp-eval/runs/2026-10-12-gpt-5.6-sol-medium-controlled{,-part2,-always-ask}`. The first
attempt of that run failed on an expired eval login (`…-authfail`, not a result); the eval
`CODEX_HOME` login was refreshed from `~/.codex/auth.json`, previous copy kept as
`mcp-eval/.codex-eval/auth.json.bak-2026-09-17`.

Card nLD4VjI9 did **not** reproduce on the Codex harness in either consent mode; v2 removes the step
the model skipped rather than relying on a reproduction.

## Open questions

See [design.md §13](./design.md#13-open-questions): entitlement-error body, OpenAI-key 401 body and
where that key lives, a real-ChatGPT long-session reproduction, and who runs the manual ChatGPT check.
