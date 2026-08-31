# Repliers API / NLP — defect report

**Reported by:** MCP server integration team
**Date:** 2026-08-29
**Dataset:** Ontario demo key (TRREB vocabulary)
**Endpoints:** `POST /nlp?nlpVersion=3`, `GET /listings`, `GET /statistics`

## How these were found

We ran a fixed battery of 28 realtor-style queries (everyday searches, location traps, and
deliberately messy phrasing) through the Repliers MCP server, three times, against three different
LLM agents — roughly 100 independent sessions. Each agent was instructed to compare the filters the
NLP engine actually applied against what the user asked for, and to file a report when they
diverged. **36 reports were filed; 24 carry an `nlpId`** for tracing on your side.

The defects below reproduced across independent sessions and, in most cases, across different
agents. They are ordered by user impact, not by frequency.

---

## 1. `type=sale` is never inferred for purchase-intent queries — highest impact

**Symptom.** A query that unambiguously means "buy" gets no `type` filter, so monthly rental
listings are returned alongside sale listings and compared on price.

| Query | Applied | Result |
|---|---|---|
| `condos in Mississauga under 600k` | no `type` | leases at **$2,250/mo** in the results |
| `trouve-moi un condo 2 chambres à Toronto, budget maximum 800k` | no `type` | a **$2,300/mo** rental among for-sale condos |
| `luxury mansion in Rosedale under $400k` | no `type` | 77 "matches" — **74 of them leases**, up to $19,900/mo |

**Why this is the worst one.** A $2,250/month rental and a $2,250 sale price are indistinguishable
once they sit in the same list sorted by price — a budget cap silently becomes a rent cap. One of
the weaker agents we tested presented **"168 townhouses under $500k"** to the user where most rows
were monthly rents: no error, no warning, just a confident wrong answer.

**Expected.** Purchase language ("under $600k", "budget maximum 800k", "for sale") should set
`type=sale`; where intent is genuinely ambiguous, say so rather than merging two markets.

**nlpIds:** `a5254935`, `58a7f359`, `4fa6d997`, `5f6a3931`, `8b2ea22d` — 9 reports total.

---

## 2. Location constraints dropped — most frequent (14 reports)

**Symptom.** The named place is silently removed. Sometimes it degrades to `state=Ontario`,
sometimes to no geo filter at all.

| Query | Applied | Result |
|---|---|---|
| `find listings with 5+ bedrooms in Miami` | `minBeds=5` only | **116,807 listings** returned as a match |
| `condos in Yorkville under 2` | `class=condo&maxPrice=2000000` | **25,497 listings**, nation-wide |
| `3 bedroom detached houses in Mississauga under $1.2M` | no city, no propertyType | ~98,000 listings |
| `new listings in Vaughan from the last 3 days` | `state=Ontario` only | province-wide |
| `how long do condos stay on the market in North York?` | no location; `locations` returned empty | stats for the whole board |

**On the Miami case.** The dataset legitimately has no Miami. The defect is not the empty result —
it is that the constraint is dropped and 116k unrelated listings come back as a successful match,
with nothing in the response indicating the location was ignored.

**Expected.** An unresolvable location should surface explicitly (empty result plus a
"location not applied" signal), never as a silent removal.

**nlpIds:** `39200cfe`, `72059f30`, `44feb039`, `3b139f1f`, `1d416298`.

---

## 3. `propertyType` dropped (13 reports)

**Symptom.** The property type in the query is not applied. `houses with a pool in Oakville` —
the pool filter lands, "houses" does not. `houses near High Park under 1.5m` returns condos and
commercial. `detached in Oakville or Burlington under 900k` drops `propertyType` entirely.

**Vocabulary note.** In TRREB "townhouse" spans two distinct values — `Att/Row/Twnhouse` (freehold)
and `Condo Townhouse`. A generic "townhouses" query that resolves to only the freehold value
returns **zero results in markets where the whole sub-$500k inventory is condo townhouses**.
Mapping a generic term to one of several valid values is worse than not mapping it: the empty
result reads to the user as "nothing on the market".

**nlpIds:** `f8ecbd55`, `8b2ea22d`, `5f6a3931`, `72059f30`.

---

## 4. `minBeds` does not exclude rows with no bedroom data — API filter bug, not NLP

**Symptom.** Parking spaces and storage lockers are sold as separate `class=condo` listings with no
`numBedrooms` value. A `minBeds` filter lets those NULL rows through instead of rejecting them.

**Reproduce.** `GET /listings?class=condo&city=Toronto&maxPrice=200000&minBeds=12`
→ **80 rows: 65 parking spaces, 9 lockers, 6 ordinary 1–3 bedroom units.** Zero rows have 12 bedrooms.

**Not an edge case.** The same leak shows up on an everyday `minBeds=2` lease search in Toronto,
where zero-bedroom parking and locker listings surface among "2-bedroom apartments".

**Expected.** A row whose bedroom count is unknown should fail `minBeds`, not pass it.

**nlpId:** `54898336`.

---

## 5. `minBeds` intent inverted for "N bedroom" phrasing

**Symptom.** `12 bedroom condos under 200k in Toronto` parsed as **`maxBeds=12`** — "up to twelve"
— instead of a minimum or exact match, matching nearly the entire inventory. The response came back
at roughly **3.8 million characters** of low-bedroom listings.

**Expected.** "N bedroom" means at least N, or exactly N — never at most N.

---

## 6. Relative dates resolved against the wrong epoch

**Symptom.** `new listings in Vaughan from the last 3 days` produced **`minListDate=2023-10-21`** —
nearly three years in the past. Reproduced by two different agents in separate sessions.

**Impact.** "New this week" is a core realtor query. The filter silently returns three years of
inventory, and nothing in the response flags the misresolved date.

**nlpIds:** `44feb039`, `7fc4cda7`.

---

## 7. `Market_Statistics` returns 400 on a valid parameter combination

`cnt-available` combined with `aggregateStatistics` / `aggregates` returns HTTP 400. Either the
combination should work, or the error should name the conflicting parameters — the current response
gives an integrator nothing to act on.

---

## 8. A street address is parsed as an `mlsNumber`

`Search_Listings` given a plain street address (`3182 Bracknell Cres, Mississauga`) parsed it as an
MLS number, then rejected a rephrased address-only query outright. Either resolve the address or
return a clear "address lookup is not supported here" — the current failure mode is a wrong parse
followed by a hard rejection.

---

## What would help most, in order

1. **Never drop a constraint silently.** Every defect above becomes far less harmful if the
   response reports which requested constraints were not applied. A `droppedConstraints` field (or
   equivalent) in the `/nlp` response would let integrators tell the user honestly instead of
   inferring it by diffing the request URL.
2. **Fix `type=sale` inference** (#1) — the only defect that produces confidently wrong prices.
3. **Fix the NULL passthrough in `minBeds`** (#4) — small and well-scoped, API-side.

## Appendix — traceable session IDs

24 of the 36 reports carry an `nlpId`. Representative set: `a5254935`, `58a7f359`, `4fa6d997`,
`5f6a3931`, `8b2ea22d`, `39200cfe`, `72059f30`, `44feb039`, `3b139f1f`, `1d416298`, `f8ecbd55`,
`54898336`, `58205ab7`, `7fc4cda7`. Full transcripts and the complete card set are available on
request.
