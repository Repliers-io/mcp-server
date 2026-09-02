import { readFileSync } from "fs";

// Param names verified against openapi.json POST /listings; NLP-built URLs may
// also use aliases (minBeds/maxBeds observed live), so families list both.
const geoParams = [
  "city", "area", "neighborhood", "district", "zip", "locationId",
  "map", "lat", "long", "radius", "areaOrCity", "cityOrDistrict",
];

const families = {
  location: geoParams,
  propertyType: ["propertyType", "propertyTypeOrStyle"],
  style: ["style"],
  class: ["class"],
  type: ["type"],
  priceRange: ["minPrice", "maxPrice"],
  bedrooms: ["minBeds", "maxBeds", "minBedrooms", "maxBedrooms", "minBedroomsTotal", "maxBedroomsTotal"],
  bathrooms: ["minBaths", "maxBaths"],
  sqft: ["minSqft", "maxSqft"],
  status: ["status", "lastStatus", "standardStatus"],
};

const familyNames = new Set(Object.values(families).flat());

// The published /listings query parameters, read once on first use. Used to catch params the
// API will silently discard — /nlp reports `unrecognizedParams: []` even for URLs that
// /listings rejects, so the response alone cannot be trusted to reveal them.
let documented;
function documentedParams() {
  if (documented) return documented;
  try {
    const spec = JSON.parse(readFileSync(new URL("../openapi.json", import.meta.url), "utf8"));
    const names = (spec.paths?.["/listings"]?.post?.parameters || []).map((p) => p.name);
    documented = new Set(names.filter(Boolean));
  } catch {
    // No spec, no check: an empty set disables the heuristic rather than flagging every param.
    documented = new Set();
  }
  return documented;
}

export function parseAppliedFilters(urlString, unrecognizedParams = []) {
  let params;
  try {
    params = new URL(urlString).searchParams;
  } catch {
    return null;
  }
  const out = {};
  const used = new Set();
  for (const [family, names] of Object.entries(families)) {
    const present = names.filter((name) => params.has(name));
    present.forEach((name) => used.add(name));
    out[family] = present.length
      ? present.map((name) => `${name}=${params.getAll(name).join(",")}`).join(" ")
      : null;
  }
  const reported = new Set(
    (Array.isArray(unrecognizedParams) ? unrecognizedParams : []).map((name) =>
      String(name).replace(/^query\./, "")
    )
  );
  const docs = documentedParams();
  const unrecognized = [];
  const other = {};
  for (const [key, value] of params.entries()) {
    const rejected = reported.has(key) || (docs.size > 0 && !docs.has(key) && !familyNames.has(key));
    if (rejected) {
      if (!unrecognized.includes(key)) unrecognized.push(key);
      continue;
    }
    if (!used.has(key)) other[key] = value;
  }
  out.other = other;
  // Sent but not applied: the API discarded these. A constraint here was NOT searched, however
  // convincing the rest of the block looks.
  out.unrecognized = unrecognized;
  return out;
}

export function geoFilterPresent(urlString) {
  try {
    const params = new URL(urlString).searchParams;
    return geoParams.some((name) => params.has(name));
  } catch {
    return false;
  }
}
