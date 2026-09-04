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

**Sections dated 2026-09-02** were added after two further sessions run a month later against the
same key. They are marked inline; everything else is from the original 2026-08-29 battery.

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

**Update — 2026-09-02, two fresh sessions.** The defect reproduces a month later, and one case
narrows it considerably:

| Query | Applied | Result |
|---|---|---|
| `find me listings with 5+ bedrooms in Miami` | `minBeds=5` only | **111,879 listings** (116,807 in July) |
| `3 bedroom condos in Mississauga under 700k` | no city, no `type`, no `status` | board-wide mixed sale/lease set |

In the Mississauga case the response's own `locations` block **resolved the city correctly** —
`Mississauga`, `locationId LBCAONCAJBHMCJPH` — while the accompanying `request.url` carried no
`city`, no `area` and no `locationId`. The location is therefore not failing to *resolve*: it
resolves, and is then lost when the query is assembled. That should narrow the search a great deal.

**nlpIds:** `b81a09ff-669d-4083-9fe2-95daf988992f`, `98e032e7-288d-4ec8-a3d4-b46f39204d02`.

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

**Update — 2026-09-02.** `3 bedroom houses under 900k` applied no `propertyType` at all, so Condo
Apt, Vacant Land and Commercial came back among the "houses" — **84,665 results**. With
`propertyType=Detached,Semi-Detached,Link` and `type=sale` supplied by hand the same query yields
18,071. nlpId `222d8e5c-8b27-41c2-a471-f845be59a951`.

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

## 9. `request.summary` asserts constraints that were never applied — added 2026-09-02

**Symptom.** The human-readable summary in the response states the very constraint the filters do
not contain.

| Query | `request.summary` says | `appliedFilters` |
|---|---|---|
| `find me listings with 5+ bedrooms in Miami` | "Searching for listings with 5+ bedrooms in Miami" | `location: null` |
| `3 bedroom condos in Mississauga under 700k` | "3+ bedroom condos in Mississauga under $700,000" | `location: null` |

**Why this is worse than the silent drops above.** Defects 1–3 remove a constraint quietly; an
integrator who diffs the request URL against the user's words can still catch them. Here the
response actively *confirms* the constraint was honoured. Any agent or UI that surfaces `summary` —
the obvious field to show a user — will report a Miami search that never took place, and the more
carefully it quotes your response, the more confidently it misleads. Two independent sessions, on
different queries, produced it on the same day.

**Expected.** Generate the summary from the filters actually applied, never from the input text. If
a constraint was dropped, the summary is the one place a user would have noticed.

**nlpIds:** `b81a09ff-669d-4083-9fe2-95daf988992f`, `98e032e7-288d-4ec8-a3d4-b46f39204d02`.

---

## 10. NLP emits `minBathrooms`, which `/listings` rejects — added 2026-09-02

**Symptom.** `condos under 500k with 2 bathrooms` produced `minBathrooms=2`. The listings endpoint's
parameter is `minBaths`: it put `query.minBathrooms` into `unrecognizedParams`, discarded it, and
returned one-bathroom units — 5 of the first 12 rows.

**Why this is the most dangerous member of the family.** `appliedFilters` listed `minBathrooms`
under `other` **as though the filter were live**. The whole integration contract — "diff
appliedFilters against what the user asked for" — *passes* here, while the search is silently wrong.
Every other defect in this document is catchable that way; this one is not. It surfaces only from
the `unrecognizedParams` array, or from reading the returned rows.

**And `/nlp` hides the evidence.** The same URL, asked twice:

| Call | `unrecognizedParams` | count |
|---|---|---|
| `POST /nlp?nlpVersion=3` (`listings: true`) | `[]` | 15,273 |
| `GET /listings?maxPrice=500000&minBathrooms=2&class=condo` | `["query.minBathrooms"]` | 15,273 |

Identical results, identical wrong filtering — but the embedded `listings` block in the NLP
response reports **no** unrecognized parameters, while the endpoint it wraps reports one. An
integrator reading the NLP response has no way to learn that a parameter was discarded. Verified
2026-09-02 against the demo key.

**Expected.** Three fixes, each independently cheap:
1. emit the parameter name the listings endpoint accepts (`minBaths`);
2. propagate `unrecognizedParams` through the `/nlp` response instead of blanking it — without this,
   the other two cannot be acted on by anyone consuming NLP;
3. never let a parameter that landed in `unrecognizedParams` appear in `appliedFilters` as applied.

**nlpId:** `ffed12ce-7b70-426b-8850-4c8cbbd4d670`.

---

## What would help most, in order

1. **Never drop a constraint silently.** Every defect above becomes far less harmful if the
   response reports which requested constraints were not applied. A `droppedConstraints` field (or
   equivalent) in the `/nlp` response would let integrators tell the user honestly instead of
   inferring it by diffing the request URL.
2. **Stop the summary from asserting what the filters do not say** (#9). Until `droppedConstraints`
   exists, this is the cheapest half-measure: a summary derived from the applied filters turns every
   silent drop above into something a user can see. As it stands the summary is the mechanism that
   converts a dropped constraint into a confident false answer.
3. **Fix `type=sale` inference** (#1) — the only defect that produces confidently wrong prices.
4. **Fix the NULL passthrough in `minBeds`** (#4) — small and well-scoped, API-side.

## Appendix — traceable session IDs

24 of the 36 reports carry an `nlpId`. Representative set: `a5254935`, `58a7f359`, `4fa6d997`,
`5f6a3931`, `8b2ea22d`, `39200cfe`, `72059f30`, `44feb039`, `3b139f1f`, `1d416298`, `f8ecbd55`,
`54898336`, `58205ab7`, `7fc4cda7`. Full transcripts and the complete card set are available on
request.
