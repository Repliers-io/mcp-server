// What a listing looks like in a search result: the fields a portal listing card shows
// (portal-monorepo packages/portal-frontend, configs/defaults/filters.ts `listingFields` as rendered
// by ListingCard), requested from the API through `fields` so the API does the cutting.
//
// The listing COUNT is never cut. A full /nlp page of 100 listings was ~0.5–0.7 MB; Claude Code
// saved it to a one-line file its Read tool could not open, and Codex re-ran the call to re-read it
// (query-battery-results.md runs 10–11). With these fields 100 listings are ~70 KB.
//
// Differences from the card, each a token budget call:
// - images[1]: the cover only. Every image name is ~30 tokens (a 64-char hash); the rest stay
//   reachable through Get_Listing_Image by number.
// - address sub-fields: the card prints street, unit, neighbourhood, city, state, zip; addressKey,
//   majorIntersection, country and district are a third of the address bytes.
// - no description, map, agents, office or timestamps: not on the card; get-listing has them.

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

/**
 * The `listings` block of a /listings or /nlp response with every listing pruned. Only the listings:
 * the surrounding block (count, numPages, statistics) and appliedFilters, where null means "not
 * applied", are left as they are.
 */
export function compactListings(block) {
  if (!block || !Array.isArray(block.listings)) return block;
  return { ...block, listings: block.listings.map(prune) };
}

/** The /nlp `request` block without the boundary polygons of each resolved location. */
export function slimRequest(request) {
  if (!request || !Array.isArray(request.locations)) return request;
  return { ...request, locations: request.locations.map(({ map: _map, ...location }) => location) };
}

const DROPPED_ADDRESS_KEYS = new Set(["addressKey", "communityCode", "majorIntersection", "country", "district"]);

/** A listing address reduced to what a card prints. Used on HAR rows, which the API enriches itself. */
export function trimAddress(address) {
  if (!address || typeof address !== "object") return address;
  const out = {};
  for (const [key, value] of Object.entries(address)) {
    if (!DROPPED_ADDRESS_KEYS.has(key) && !isEmpty(value)) out[key] = value;
  }
  return out;
}
