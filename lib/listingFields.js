// What a listing looks like in a search result: the fields a portal listing card shows
// (portal-monorepo packages/portal-frontend, configs/defaults/filters.ts `listingFields` as rendered
// by ListingCard), requested from the API through `fields` so the API does the cutting.
//
// The listing COUNT is never cut. A full /nlp page of 100 listings was ~0.5–0.7 MB; Claude Code
// saved it to a one-line file its Read tool could not open, and Codex re-ran the call to re-read it
// (query-battery-results.md runs 10–11). With these fields alone 100 listings are ~70 KB, and
// ~50 KB after the per-listing compaction described below.
//
// Differences from the card, each a token budget call:
// - images[1]: the cover only. Every image name is ~30 tokens (a 64-char hash); the rest stay
//   reachable through Get_Listing_Image by number.
// - address sub-fields: the card prints street, unit, neighbourhood, city, state, zip; addressKey,
//   majorIntersection, country and district are a third of the address bytes.
// - no description, map, agents, office or timestamps: not on the card; get-listing has them.
//
// Then, per listing (owner, 2026-11-09): the address is one printed line, dates are days, and
// `permissions` appears only when it restricts something. 100 listings were ~70 KB with fields
// alone, over Claude Code's limit (a 53 KB result passed, a 70 KB one went to a file); these bring
// a listing from ~710 to ~480 bytes. `details` stays structured.

export const LISTING_FIELDS = [
  "mlsNumber", "status", "lastStatus", "type", "class",
  "listPrice", "soldPrice", "soldDate", "listDate", "daysOnMarket", "simpleDaysOnMarket",
  "address.unitNumber", "address.streetNumber", "address.streetDirectionPrefix", "address.streetName",
  "address.streetSuffix", "address.streetDirection", "address.neighborhood", "address.city",
  "address.area", "address.state", "address.zip",
  "images[1]",
  "details.propertyType", "details.style", "details.numBedrooms", "details.numBedroomsPlus",
  "details.numBathrooms", "details.numBathroomsPlus", "details.sqft",
  "lot.acres", "openHouse", "permissions",
].join(",");

const isEmpty = (value) =>
  value === null || value === undefined || value === "" ||
  (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0);

// Drops nulls, empty strings and objects left empty by that, recursively. Arrays keep their entries
// (an image list is positional); 0 and false are values and stay.
function prune(value) {
  if (Array.isArray(value)) return value.map(prune);
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, entry] of Object.entries(value)) {
      const next = prune(entry);
      if (!isEmpty(next)) out[key] = next;
    }
    return out;
  }
  return value;
}

const day = (value) => (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) ? value.slice(0, 10) : value);

// All "Y" restricts nothing and repeats ~100 bytes on every listing; any other value is a
// restriction (display without price or address) and is kept whole.
const restricts = (permissions) =>
  permissions && typeof permissions === "object" && Object.values(permissions).some((value) => value !== "Y");

/**
 * The `listings` block of a /listings or /nlp response with every listing compacted. Only the
 * listings: the surrounding block (count, numPages, statistics) and appliedFilters, where null
 * means "not applied", are left as they are.
 */
export function compactListings(block) {
  if (!block || !Array.isArray(block.listings)) return block;
  return {
    ...block,
    listings: block.listings.map((listing) => {
      const { permissions, ...rest } = prune(compactEnrichment(listing));
      return restricts(permissions) ? { ...rest, permissions } : rest;
    }),
  };
}

/** The /nlp `request` block without the boundary polygons of each resolved location. */
export function slimRequest(request) {
  if (!request || !Array.isArray(request.locations)) return request;
  return { ...request, locations: request.locations.map(({ map: _map, ...location }) => location) };
}

const joined = (parts, separator) => parts.filter((part) => !isEmpty(part)).join(separator);

/**
 * An address object as the one line a card prints: "1203-33 University Ave, Waterfront Communities
 * C1, Toronto, Ontario M5J 2S7". The area stands in for a missing city. Anything that is not an
 * address object passes through.
 */
export function formatAddress(address) {
  if (!address || typeof address !== "object") return address;
  const a = address;
  const street = joined([a.streetNumber, a.streetDirectionPrefix, a.streetName, a.streetSuffix, a.streetDirection], " ");
  return joined([
    joined([a.unitNumber, street], "-"),
    a.neighborhood,
    a.city || a.area,
    joined([a.state, a.zip], " "),
  ], ", ");
}

/**
 * A listing's own data in its compact form: one-line address, listDate/soldDate as days. Used on
 * search listings and on the listing data the API adds to HAR rows; other fields are left alone.
 */
export function compactEnrichment(row) {
  if (!row || typeof row !== "object") return row;
  const out = { ...row };
  if (out.address && typeof out.address === "object") out.address = formatAddress(out.address);
  if ("listDate" in out) out.listDate = day(out.listDate);
  if ("soldDate" in out) out.soldDate = day(out.soldDate);
  return out;
}
